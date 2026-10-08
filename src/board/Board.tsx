import type { CardState, MoveRequest } from "#/board/card-state.ts";
import type { DropPosition } from "#/board/Lane.tsx";
import type { ParentProps } from "solid-js";

import { css } from "@csslit/core";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { For, Loading, Show, createSignal, flush, latest, onCleanup } from "solid-js";

import { useCardFilters } from "#/board/card-filters.ts";
import { createCardState } from "#/board/card-state.ts";
import { Card } from "#/board/Card.tsx";
import { compareCards, placementKey } from "#/board/cards.ts";
import { CardEditor } from "#/board/editor/CardEditor.tsx";
import { Lane } from "#/board/Lane.tsx";
import { tables } from "#/module_bindings/index.ts";
import { closeDialog, openDialog } from "#/nav.ts";
import { useTable } from "#/spacetimedb.tsx";
import { boardLane, colors, control, space } from "#/theme.ts";
import { Skeleton } from "#/ui/Skeleton.tsx";

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
    closeDialog(navigate, location, params.boardId ? `/b/${params.boardId}` : "/");

  return (
    <>
      <Loading on={params.boardId ?? "studio"} fallback={<BoardSkeleton />}>
        <BoardContents cardState={cardState} />
      </Loading>
      <Show when={latest(() => params.cardId)} keyed>
        {(cardId) => <CardEditor id={cardId} cardState={cardState} onClose={closeEditor} />}
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

  const lanes = useTable(() => tables.lane.where((lane) => lane.boardId.eq(boardId())));
  const boardLanes = () => [...lanes()].sort((left, right) => left.position - right.position);
  const { cards, moveCard } = props.cardState;
  const boardComments = useTable(() =>
    tables.comment.where((comment) => comment.boardId.eq(boardId())),
  );

  const filters = useCardFilters();
  const filtered = (laneId: string) =>
    cards
      .filter((card) => !card.archived && card.laneId === laneId && filters.matches(card))
      .sort(compareCards);

  const drag = createCardDrag((id, target) => {
    const card = cards.find((item) => item.id === id);
    if (!card) return;

    const currentLane = cards
      .filter((item) => !item.archived && item.laneId === card.laneId)
      .sort(compareCards);
    const nextId = currentLane[currentLane.findIndex((item) => item.id === id) + 1]?.id ?? "";
    if (!card.moveFailed && card.laneId === target.laneId && nextId === target.beforeId) return;

    const request: MoveRequest = {
      boardId: boardId(),
      id,
      laneId: target.laneId,
      orderKey: placementKey(cards, id, target.laneId, target.beforeId),
    };

    void moveCard(request);
  });

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
              drop={drag.active()?.target}
              drag={drag}
              commentCount={(id) =>
                boardComments().filter((comment) => comment.cardId === id).length
              }
              hasFilters={filters.hasFilters()}
              onEdit={() => openDialog(navigate, location, `lane/${lane().id}`)}
            />
          )}
        </For>
      </div>
      <Show when={drag.active()}>
        {(active) => (
          <div
            ref={drag.previewRef}
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
              {(card) => <Card card={card()} />}
            </Show>
          </div>
        )}
      </Show>
    </>
  );
}

function createCardDrag(onDrop: (id: string, target: DropPosition) => void) {
  const [drag, setDrag] = createSignal<Drag>();
  let preview: HTMLDivElement | undefined;
  let stopPointerListeners: (() => void) | undefined;
  let suppressClickId: string | undefined;
  onCleanup(() => stopPointerListeners?.());

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
      if (!drag() && Math.hypot(next.clientX - startX, next.clientY - startY) < 4) return;

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
      if (finished.target) onDrop(id, finished.target);
    };

    stopPointerListeners = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  };

  const click = (event: MouseEvent) => {
    if (suppressClickId !== (event.currentTarget as HTMLElement).dataset.cardId) return;

    event.preventDefault();
    event.stopPropagation();
    suppressClickId = undefined;
  };

  return {
    active: drag,
    activeId: () => drag()?.id,
    pointerDown,
    click,
    previewRef: (element: HTMLDivElement) => {
      preview = element;
    },
  };
}

function BoardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading board"
      class={css`
        display: flex;
        gap: ${space.md}px;
        align-items: flex-start;
        width: 100%;
        min-width: 0;
        max-height: 100%;
        overflow: clip;
        padding-block: ${space.xs}px ${space.md}px;
        mask-image:
          linear-gradient(to right, black 35%, transparent 80%),
          linear-gradient(to bottom, black 35%, transparent 80%);
        mask-composite: intersect;
      `}
    >
      <For each={[0, 1, 2, 3, 4, 5]}>
        {(lane) => (
          <div
            class={css`
              display: flex;
              flex-direction: column;
              gap: ${space.sm}px;
              min-width: 0;
              flex: none;
              width: clamp(
                ${boardLane.minWidth}px,
                (100cqi - ${space.md * (boardLane.lanesPerView - 1)}px) / ${boardLane.lanesPerView},
                ${boardLane.maxWidth}px
              );
              border-radius: 10px;
              background: ${colors.soft};
              padding: ${space.sm}px;
            `}
          >
            <div
              class={css`
                padding: ${space.sm}px ${space.md}px;
              `}
            >
              <Skeleton height={10} width={96 + lane * 16} />
            </div>
            <For each={[0, 1, 2, 3]}>
              {() => (
                <div
                  class={css`
                    display: flex;
                    flex-direction: column;
                    gap: ${space.md}px;
                    padding: ${space.lg - 1}px;
                    border: 1px solid ${colors.border};
                    border-radius: 9px;
                    background: ${colors.paper};
                  `}
                >
                  <Skeleton height={9} width={120} />
                  <Skeleton height={16} />
                  <Skeleton height={9} width={144} />
                </div>
              )}
            </For>
            <Skeleton height={control.fontSize + 2 * space.md} variant="background" />
          </div>
        )}
      </For>
    </div>
  );
}
