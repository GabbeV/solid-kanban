import {
  type ParentProps,
  For,
  Show,
  Loading,
  latest,
  isPending,
  action,
  createSignal,
  flush,
  onCleanup,
  untrack,
} from "solid-js";
import { useParams, useLocation, useNavigate } from "@solidjs/router";
import { css } from "@csslit/core";
import { compareCards, placementKey } from "#/domain/cards.ts";
import {
  space,
  boardLane,
  colors,
  control,
  fontSize,
  lineHeight,
} from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { CardTile } from "./CardTile";
import { CardComposer } from "./CardComposer";
import { tables } from "#/module_bindings/index.ts";
import { createCards, type CardState, type ViewCard } from "../cards";
import { CardEditor } from "../card/CardEditor";
import { useReducers, useTable } from "#/spacetimedb.tsx";
import { useCardFilters } from "#/board/cardFilters.ts";
import { Skeleton } from "#/ui/Skeleton.tsx";
import { useName } from "#/name.tsx";
import { closeDialog, openDialog } from "#/nav.ts";

type MoveRequest = {
  operationId: string;
  boardId: string;
  id: string;
  columnId: string;
  orderKey: string;
};

type DropPosition = { columnId: string; beforeId: string };

type Drag = {
  id: string;
  width: number;
  left: number;
  top: number;
  target?: DropPosition;
};

export function BoardBody(props: ParentProps) {
  const params = useParams();
  const location = useLocation<{ dialogOpenedFromApp: true }>();
  const navigate = useNavigate();
  const cardState = createCards();
  const closeEditor = () =>
    closeDialog(navigate, location, `/b/${params.boardId ?? "studio"}`);
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
                (100cqi - ${space.md * (boardLane.columnsPerView - 1)}px) /
                  ${boardLane.columnsPerView},
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
            <Skeleton
              height={control.fontSize + 2 * space.md}
              variant="background"
            />
          </div>
        )}
      </For>
    </div>
  );
}

function BoardContents(props: { cardState: CardState }) {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { name } = useName();
  const boardId = () => params.boardId ?? "studio";
  const reducers = useReducers();
  const columns = useTable(() =>
    tables.column.where((column) => column.boardId.eq(boardId())),
  );
  const boardColumns = () =>
    [...columns()].sort((left, right) => left.position - right.position);
  const {
    serverCards,
    setLocalCards,
    cards,
    setOptimisticCards,
    editCard,
    createCard,
    removeCard,
  } = props.cardState;
  const boardComments = useTable(() =>
    tables.comment.where((comment) => comment.boardId.eq(boardId())),
  );
  const filters = useCardFilters();
  const filtered = (columnId: string) =>
    cards
      .filter(
        (card) =>
          !card.archived && card.columnId === columnId && filters.matches(card),
      )
      .sort(compareCards);

  const [drag, setDrag] = createSignal<Drag>();
  let preview: HTMLDivElement | undefined;
  let stopPointerListeners: (() => void) | undefined;
  let suppressClickId: string | undefined;
  onCleanup(() => stopPointerListeners?.());

  const moveCard = action(function* (request: MoveRequest) {
    setLocalCards((draft) => {
      const card = draft.find((item) => item.id === request.id);
      if (card) card.moveFailed = false;
    });
    setOptimisticCards((draft) => {
      const card = draft.find((item) => item.id === request.id);
      if (!card) return;
      card.columnId = request.columnId;
      card.orderKey = request.orderKey;
      card.moveFailed = false;
      card.moving = true;
    });

    try {
      yield reducers.moveCard({ ...request, actor: name() });
    } catch {
      setLocalCards((draft) => {
        const card = draft.find((item) => item.id === request.id);
        if (!card) return;
        card.columnId = request.columnId;
        card.orderKey = request.orderKey;
        card.moveFailed = true;
      });
    }
  });

  const startMove = (id: string, target: DropPosition) => {
    const card = cards.find((item) => item.id === id);
    if (!card) return;
    const currentLane = cards
      .filter((item) => !item.archived && item.columnId === card.columnId)
      .sort(compareCards);
    const nextId =
      currentLane[currentLane.findIndex((item) => item.id === id) + 1]?.id ??
      "";
    if (
      !card.moveFailed &&
      card.columnId === target.columnId &&
      nextId === target.beforeId
    )
      return;

    const request: MoveRequest = {
      operationId: crypto.randomUUID(),
      boardId: boardId(),
      id,
      columnId: target.columnId,
      orderKey: placementKey(
        cards,
        id,
        target.columnId,
        target.beforeId,
        crypto.randomUUID().replaceAll("-", ""),
      ),
    };
    void moveCard(request);
  };

  const retryMove = (card: ViewCard) => {
    if (!card.moveFailed) return;
    void moveCard({
      operationId: crypto.randomUUID(),
      boardId: boardId(),
      id: card.id,
      columnId: card.columnId,
      orderKey: card.orderKey,
    });
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
        ?.closest<HTMLElement>("[data-column-id]");
      const columnId = lane?.dataset.columnId;
      const beforeId = columnId
        ? ([...lane.querySelectorAll<HTMLElement>("[data-card-id]")]
            .filter((item) => item.dataset.cardId !== id)
            .find((item) => {
              const bounds = item.getBoundingClientRect();
              return next.clientY < bounds.top + bounds.height / 2;
            })?.dataset.cardId ?? "")
        : "";
      const target = columnId ? { columnId, beforeId } : undefined;
      const left = next.clientX - offsetX;
      const top = next.clientY - offsetY;
      setDrag((old) =>
        old?.id === id &&
        old.target?.columnId === target?.columnId &&
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
        <For each={boardColumns()} keyed={(column) => column.id}>
          {(column) => (
            <section
              class={css`
                display: flex;
                flex-direction: column;
                gap: ${space.sm}px;
                min-width: 0;
                flex: none;
                width: clamp(
                  ${boardLane.minWidth}px,
                  (100cqi - ${space.md * (boardLane.columnsPerView - 1)}px) /
                    ${boardLane.columnsPerView},
                  ${boardLane.maxWidth}px
                );
                border-radius: 10px;
                background: ${colors.soft};
                min-height: 120px;
                padding: ${space.sm}px;
              `}
              data-column-id={column().id}
              aria-label={column().title}
            >
              <header
                class={css`
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: ${space.sm}px ${space.md}px;
                `}
              >
                <h2
                  class={css`
                    display: flex;
                    align-items: center;
                    gap: ${space.sm}px;
                    font-size: ${fontSize.control}px;
                    line-height: ${lineHeight.control}px;

                    font-weight: 640;
                    letter-spacing: 0;
                  `}
                >
                  <span
                    class={[
                      css`
                        width: 9px;
                        height: 9px;
                        background: ${colors.neutralDot};
                        border-radius: 50%;
                      `,
                      column().position % 4 === 1 &&
                        css`
                          background: ${colors.orangeDot};
                        `,
                      column().position % 4 === 2 &&
                        css`
                          background: ${colors.blueDot};
                        `,
                      column().position % 4 === 3 &&
                        css`
                          background: ${colors.skyDot};
                        `,
                    ]}
                  />
                  <span>{column().title}</span>
                  <span
                    class={css`
                      font-size: ${fontSize.caption}px;
                      color: ${colors.muted};
                      font-weight: 500;
                    `}
                  >
                    {filtered(column().id).length}
                  </span>
                </h2>
                <Button
                  variant="ghost"
                  iconOnly
                  pad="sm"
                  bleed
                  aria-label={`Rename ${column().title}`}
                  onClick={() =>
                    openDialog(navigate, location, `list/${column().id}`)
                  }
                >
                  <Icon name="more" />
                </Button>
              </header>
              <div
                class={css`
                  display: flex;
                  flex-direction: column;
                  gap: ${space.sm}px;
                `}
              >
                <Show when={filtered(column().id).length === 0}>
                  <p
                    class={[
                      css`
                        margin: 0;
                        border: 1px dashed ${colors.border};
                        border-radius: 7px;
                        padding: 23px;
                        text-align: center;
                        font-size: ${fontSize.caption}px;
                        color: ${colors.muted};
                      `,
                      drag()?.target?.columnId === column().id &&
                        css`
                          border-style: solid;
                          border-color: ${colors.accent};
                          background: ${colors.selected};
                          color: ${colors.primary};
                        `,
                    ]}
                  >
                    {filters.hasFilters() ? "No matching cards" : "No cards"}
                  </p>
                </Show>
                <For each={filtered(column().id)} keyed={(card) => card.id}>
                  {(card) => {
                    // Workaround for https://github.com/solidjs/solid/issues/3706:
                    // keep this immutable keyed ID out of the reactive drag condition.
                    const cardId = untrack(() => card().id);
                    return (
                      <>
                        <Show
                          when={
                            drag()?.target?.columnId === column().id &&
                            drag()?.target?.beforeId === cardId
                          }
                        >
                          <div
                            data-drop-line
                            class={css`
                              flex: none;
                              height: 2px;
                              margin-block: -${(space.sm + 2) / 2}px;
                              border-radius: 1px;
                              background: ${colors.accent};
                            `}
                          />
                        </Show>
                        <CardTile
                          card={card()}
                          onRemoved={removeCard}
                          drag={{
                            activeId: () => drag()?.id,
                            pointerDown,
                            click,
                          }}
                          onRetry={() => {
                            if (card().createFailed) void createCard(card());
                            else if (card().editFailed) void editCard(card());
                            else retryMove(card());
                          }}
                          onDiscard={() => {
                            const remote = serverCards().find(
                              (row) => row.id === card().id,
                            );
                            setLocalCards((draft) => {
                              const item = draft.find(
                                (row) => row.id === card().id,
                              );
                              if (item && remote) {
                                Object.assign(item, remote);
                                item.moveFailed = false;
                                item.editFailed = false;
                                item.createFailed = false;
                              } else if (item)
                                draft.splice(draft.indexOf(item), 1);
                            });
                          }}
                          commentCount={
                            boardComments().filter(
                              (comment) => comment.cardId === card().id,
                            ).length
                          }
                        />
                      </>
                    );
                  }}
                </For>
                <Show
                  when={
                    drag()?.target?.columnId === column().id &&
                    drag()?.target?.beforeId === ""
                  }
                >
                  <div
                    data-drop-line
                    class={[
                      css`
                        flex: none;
                        height: 2px;
                        margin-block: -${(space.sm + 2) / 2}px;
                        border-radius: 1px;
                        background: ${colors.accent};
                      `,
                      filtered(column().id).length === 0 &&
                        css`
                          visibility: hidden;
                        `,
                    ]}
                  />
                </Show>
                <CardComposer
                  column={column()}
                  cards={cards}
                  createCard={createCard}
                />
              </div>
            </section>
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
