import { type ParentProps, For, Show, Loading } from "solid-js";
import { useParams } from "@solidjs/router";
import { css } from "@csslit/core";
import {
  space,
  radius,
  breakpoints,
  colors,
  fontSize,
  lineHeight,
} from "#/theme.ts";
import { Icon } from "#/ui/Icon.tsx";
import { Button } from "#/ui/Button.tsx";
import { CardLabel } from "#/ui/CardLabel.tsx";
import { ArchiveCardButton } from "#/board/card/ArchiveCardButton.tsx";
import { tables } from "#/module_bindings/index.ts";
import { useTable } from "#/spacetimedb.tsx";
import { useCardFilters } from "#/board/cardFilters.ts";
import { Skeleton } from "#/ui/Skeleton.tsx";

export function ArchiveBody(props: ParentProps) {
  const params = useParams();
  return (
    <>
      <Loading on={params.boardId ?? "studio"} fallback={<ArchiveSkeleton />}>
        <ArchiveContents />
      </Loading>
      {props.children}
    </>
  );
}

function ArchiveSkeleton() {
  return (
    <section
      role="status"
      aria-label="Loading archive"
      class={css`
        width: 100%;
        max-width: 960px;
        max-height: calc(100% - ${space.sm + space.lg}px);
        min-width: 0;
        overflow: clip;
        margin-block: ${space.sm}px ${space.lg}px;
        border: 1px solid ${colors.border};
        border-radius: ${radius.card}px;
        background: ${colors.paper};
        mask-image: linear-gradient(to bottom, black 35%, transparent 80%);
      `}
    >
      <For each={[0, 1, 2, 3, 4, 5, 6, 7]}>
        {() => (
          <div
            class={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: ${space.lg}px;
              padding: ${space.lg - 1}px;
              border-bottom: 1px solid ${colors.borderSubtle};
              &:last-child {
                border-bottom: 0;
              }
              @media (max-width: ${breakpoints.phone}px) {
                padding: ${space.md - 1}px;
              }
            `}
          >
            <div
              class={css`
                display: flex;
                flex-direction: column;
                gap: ${space.sm}px;
                flex: 1;
                min-width: 0;
              `}
            >
              <Skeleton height={10} width={200} />
              <Skeleton height={16} width={400} />
              <Skeleton height={8} width={128} />
            </div>
            <Skeleton height={33} width={80} />
          </div>
        )}
      </For>
    </section>
  );
}

function ArchiveContents() {
  const params = useParams();
  const boardId = () => params.boardId ?? "studio";
  const boardColumns = useTable(() =>
    tables.column.where((column) => column.boardId.eq(boardId())),
  );
  const boardCards = useTable(() =>
    tables.card.where((card) =>
      card.boardId.eq(boardId()).and(card.archived.eq(true)),
    ),
  );
  const filters = useCardFilters();
  const archived = () =>
    boardCards().filter((card) => card.archived && filters.matches(card));

  return (
    <>
      <section
        aria-label="Archived cards"
        class={css`
          width: 100%;
          max-width: 960px;
          min-width: 0;
          margin-block: ${space.sm}px ${space.lg}px;
          border: 1px solid ${colors.border};
          border-radius: ${radius.card}px;
          background: ${colors.paper};
        `}
      >
        <For
          each={archived()}
          keyed={(card) => card.id}
          fallback={
            <div
              class={css`
                display: grid;
                justify-items: center;
                gap: ${space.md}px;
                padding: 23px;
                color: ${colors.muted};
                text-align: center;
                font-size: ${fontSize.control}px;
              `}
            >
              <Icon name="archive" />
              <p
                class={css`
                  line-height: ${lineHeight.control}px;
                `}
              >
                {filters.hasFilters()
                  ? "No archived cards match these filters."
                  : "No archived cards."}
              </p>
              <Show when={filters.hasFilters()}>
                <Button
                  onClick={() =>
                    filters.setSearch({ q: undefined, label: undefined })
                  }
                >
                  <span>Clear filters</span>
                </Button>
              </Show>
            </div>
          }
        >
          {(card) => (
            <article
              aria-label={card().title}
              class={css`
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                gap: ${space.sm}px ${space.lg}px;
                min-width: 0;
                padding: 15px;
                border-bottom: 1px solid ${colors.borderSubtle};
                &:last-child {
                  border-bottom: 0;
                }
                @media (max-width: ${breakpoints.phone}px) {
                  padding: 11px;
                  column-gap: ${space.md}px;
                }
              `}
            >
              <div
                class={css`
                  grid-column: 1;
                  grid-row: 1;
                  min-width: 0;
                  display: flex;
                  flex-direction: column;
                  gap: ${space.sm}px;
                  @media (max-width: ${breakpoints.phone}px) {
                    grid-column: 1 / -1;
                  }
                `}
              >
                <h3
                  class={css`
                    font-size: ${fontSize.control}px;
                    line-height: ${lineHeight.control}px;

                    font-weight: 600;
                    letter-spacing: -0.01em;
                    overflow-wrap: anywhere;
                  `}
                >
                  {card().title}
                </h3>
                <Show when={card().description}>
                  <p
                    class={css`
                      display: -webkit-box;
                      text-box-edge: text;
                      -webkit-line-clamp: 2;
                      -webkit-box-orient: vertical;
                      overflow: hidden;
                      overflow-wrap: anywhere;
                      font-size: ${fontSize.body}px;
                      line-height: ${lineHeight.body}px;

                      color: ${colors.muted};
                    `}
                  >
                    {card().description}
                  </p>
                </Show>
              </div>
              <div
                class={css`
                  grid-column: 1;
                  grid-row: 2;
                  min-width: 0;
                  display: flex;
                  flex-wrap: wrap;
                  align-items: center;
                  gap: ${space.sm}px ${space.md}px;
                  font-size: ${fontSize.caption}px;

                  color: ${colors.muted};
                `}
              >
                <span
                  class={css`
                    display: inline-flex;
                    align-items: center;
                    gap: ${space.xs}px;
                    min-width: 0;
                    overflow-wrap: anywhere;
                    line-height: ${lineHeight.caption}px;
                  `}
                  title="Original list"
                >
                  <Icon name="board" />
                  <span
                    class={css`
                      min-width: 0;
                    `}
                  >
                    {
                      boardColumns().find(
                        (column) => column.id === card().columnId,
                      )?.title
                    }
                  </span>
                </span>
                <Show when={card().label}>
                  <CardLabel label={card().label} />
                </Show>
                <Show when={card().assignee}>
                  <span
                    class={css`
                      overflow-wrap: anywhere;
                      min-width: 0;
                      line-height: ${lineHeight.caption}px;
                    `}
                  >
                    {card().assignee}
                  </span>
                </Show>
              </div>
              <div
                class={css`
                  grid-column: 2;
                  grid-row: 1 / span 2;
                  justify-self: end;
                  @media (max-width: ${breakpoints.phone}px) {
                    grid-row: 2;
                  }
                `}
              >
                <ArchiveCardButton card={card()} />
              </div>
            </article>
          )}
        </For>
      </section>
    </>
  );
}
