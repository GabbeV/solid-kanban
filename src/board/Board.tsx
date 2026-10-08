import {
  type ParentProps,
  For,
  Show,
  Loading,
  latest,
  isPending,
  createSignal,
  flush,
  onCleanup,
} from "solid-js";
import { useParams, useLocation, useNavigate } from "@solidjs/router";
import { css } from "@csslit/core";
import { compareCards, placementKey } from "./cards";
import { space, colors } from "#/theme.ts";
import { CardTile } from "./CardTile";
import { tables } from "#/module_bindings/index.ts";
import {
  createCardState,
  type CardState,
  type MoveRequest,
} from "./card-state";
import { CardEditor } from "./editor/CardEditor";
import { useTable } from "#/spacetimedb.tsx";
import { useCardFilters } from "#/board/card-filters.ts";
import { closeDialog, openDialog } from "#/nav.ts";
import { Lane, type DropPosition } from "./Lane";
import { BoardSkeleton } from "./BoardSkeleton";

type Drag = {
  id: string;
  width: number;
  left: number;
  top: number;
  target?: DropPosition;
};

export function Board(props: ParentProps) {
  const params = useParams();
  const location = useLocation<{ dialogOpenedFromApp: true }>();
  const navigate = useNavigate();
  const cardState = createCardState();
  const closeEditor = () =>
    closeDialog(
      navigate,
      location,
      params.boardId ? `/b/${params.boardId}` : "/",
    );
  return (
    <>
      <Loading on={params.boardId ?? "studio"} fallback={<BoardSkeleton />}>
        <BoardContents cardState={cardState} />
      </Loading>
      <Show when={latest(() => params.cardId)} keyed>
        {(cardId) => (
          <CardEditor
            id={cardId}
            pending={isPending(() => params.cardId)}
            cardState={cardState}
            onClose={closeEditor}
          />
        )}
      </Show>
      {props.children}
    </>
  );
}

function BoardContents(props: { cardState: CardState }) {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const boardId = () => params.boardId ?? "studio";
  const lanes = useTable(() =>
    tables.lane.where((lane) => lane.boardId.eq(boardId())),
  );
  const boardLanes = () =>
    [...lanes()].sort((left, right) => left.position - right.position);
  const { cards, moveCard } = props.cardState;
  const boardComments = useTable(() =>
    tables.comment.where((comment) => comment.boardId.eq(boardId())),
  );
  const filters = useCardFilters();
  const filtered = (laneId: string) =>
    cards
      .filter(
        (card) =>
          !card.archived && card.laneId === laneId && filters.matches(card),
      )
      .sort(compareCards);

  const [drag, setDrag] = createSignal<Drag>();
  let preview: HTMLDivElement | undefined;
  let stopPointerListeners: (() => void) | undefined;
  let suppressClickId: string | undefined;
  onCleanup(() => stopPointerListeners?.());

  const startMove = (id: string, target: DropPosition) => {
    const card = cards.find((item) => item.id === id);
    if (!card) return;
    const currentLane = cards
      .filter((item) => !item.archived && item.laneId === card.laneId)
      .sort(compareCards);
    const nextId =
      currentLane[currentLane.findIndex((item) => item.id === id) + 1]?.id ??
      "";
    if (
      !card.moveFailed &&
      card.laneId === target.laneId &&
      nextId === target.beforeId
    )
      return;

    const request: MoveRequest = {
      boardId: boardId(),
      id,
      laneId: target.laneId,
      orderKey: placementKey(cards, id, target.laneId, target.beforeId),
    };
    void moveCard(request);
  };

  const pointerDown = (event: PointerEvent, id: string) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if ((event.target as Element).closest("[data-move-action]")) return;
    stopPointerListeners?.();
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;

    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      if (
        !drag() &&
        Math.hypot(next.clientX - startX, next.clientY - startY) < 4
      )
        return;
      const lane = document
        .elementFromPoint(next.clientX, next.clientY)
        ?.closest<HTMLElement>("[data-lane-id]");
      const laneId = lane?.dataset.laneId;
      const beforeId = laneId
        ? ([...lane.querySelectorAll<HTMLElement>("[data-card-id]")]
            .filter((item) => item.dataset.cardId !== id)
            .find((item) => {
              const bounds = item.getBoundingClientRect();
              return next.clientY < bounds.top + bounds.height / 2;
            })?.dataset.cardId ?? "")
        : "";
      const target = laneId ? { laneId, beforeId } : undefined;
      const left = next.clientX - offsetX;
      const top = next.clientY - offsetY;
      setDrag((old) =>
        old?.id === id &&
        old.target?.laneId === target?.laneId &&
        old.target?.beforeId === target?.beforeId
          ? old
          : { id, width: rect.width, left, top, target },
      );
      if (preview) {
        preview.style.left = `${left}px`;
        preview.style.top = `${top}px`;
      }
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      stopPointerListeners = undefined;
    };
    const cancel = () => {
      stop();
      setDrag(undefined);
    };
    const up = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      const finished = drag();
      stop();
      setDrag(undefined);
      flush();
      if (!finished) return;
      suppressClickId = id;
      setTimeout(() => {
        if (suppressClickId === id) suppressClickId = undefined;
      }, 0);
      if (finished.target) startMove(id, finished.target);
    };
    stopPointerListeners = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  };

  const click = (event: MouseEvent) => {
    if (suppressClickId !== (event.currentTarget as HTMLElement).dataset.cardId)
      return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickId = undefined;
  };

  return (
    <>
      <div
        class={css`
          display: flex;
          gap: ${space.md}px;
          align-items: flex-start;
          min-width: min-content;
          padding-block: ${space.xs}px ${space.md}px;
        `}
      >
        <For each={boardLanes()} keyed={(lane) => lane.id}>
          {(lane) => (
            <Lane
              lane={lane()}
              cards={filtered(lane().id)}
              cardState={props.cardState}
              drop={drag()?.target}
              drag={{ activeId: () => drag()?.id, pointerDown, click }}
              commentCount={(id) =>
                boardComments().filter((comment) => comment.cardId === id)
                  .length
              }
              hasFilters={filters.hasFilters()}
              onEdit={() => openDialog(navigate, location, `lane/${lane().id}`)}
            />
          )}
        </For>
      </div>
      <Show when={drag()}>
        {(active) => (
          <div
            ref={preview}
            inert
            aria-hidden="true"
            class={css`
              position: fixed;
              z-index: 20;
              pointer-events: none;
              box-shadow: 0 8px 24px ${colors.shadowDrag};
            `}
            style={{
              left: `${active().left}px`,
              top: `${active().top}px`,
              width: `${active().width}px`,
            }}
          >
            <Show when={cards.find((card) => card.id === active().id)}>
              {(card) => <CardTile card={card()} />}
            </Show>
          </div>
        )}
      </Show>
    </>
  );
}
