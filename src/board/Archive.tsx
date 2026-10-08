import type { CardState, ViewCard } from "#/board/card-state.ts";
import type { ParentProps } from "solid-js";

import { css } from "@csslit/core";
import { useParams } from "@solidjs/router";
import { For, Loading, Show } from "solid-js";

import { useCardFilters } from "#/board/card-filters.ts";
import { createCardState } from "#/board/card-state.ts";
import { CardErrors } from "#/board/CardErrors.tsx";
import { CardLabel } from "#/board/CardLabel.tsx";
import { tables } from "#/module_bindings/index.ts";
import { useTable } from "#/spacetimedb.tsx";
import { breakpoints, colors, fontSize, lineHeight, radius, space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Skeleton } from "#/ui/Skeleton.tsx";

export function Archive(props: ParentProps) {
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
  const boardLanes = useTable(() => tables.lane.where((lane) => lane.boardId.eq(boardId())));
  const cardState = createCardState(true);
  const filters = useCardFilters();
  const archived = () => cardState.cards.filter((card) => card.archived && filters.matches(card));

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
                <Button onClick={() => filters.setSearch({ q: undefined, label: undefined })}>
                  <span>Clear filters</span>
                </Button>
              </Show>
            </div>
          }
        >
          {(card) => (
            <ArchivedCard
              card={card()}
              cardState={cardState}
              laneTitle={boardLanes().find((lane) => lane.id === card().laneId)?.title}
            />
          )}
        </For>
      </section>
    </>
  );
}

function ArchivedCard(props: { card: ViewCard; cardState: CardState; laneTitle?: string }) {
  return (
    <article
      aria-label={props.card.title}
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
          {props.card.title}
        </h3>
        <Show when={props.card.description}>
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
            {props.card.description}
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
          title="Original lane"
        >
          <Icon name="board" />
          <span
            class={css`
              min-width: 0;
            `}
          >
            {props.laneTitle}
          </span>
        </span>
        <Show when={props.card.label}>
          <CardLabel label={props.card.label} />
        </Show>
        <Show when={props.card.assignee}>
          <span
            class={css`
              overflow-wrap: anywhere;
              min-width: 0;
              line-height: ${lineHeight.caption}px;
            `}
          >
            {props.card.assignee}
          </span>
        </Show>
      </div>
      <div
        class={css`
          grid-column: 2;
          grid-row: 1 / span 2;
          justify-self: end;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: ${space.sm}px;
          min-width: 0;
          max-width: 180px;
          @media (max-width: ${breakpoints.phone}px) {
            grid-row: 2;
          }
        `}
      >
        <Button
          variant={props.card.restoreFailed ? "danger" : undefined}

          onClick={() => props.cardState.restoreCard(props.card)}
        >
          <Icon name="restore" />
          <span>Restore</span>
        </Button>
        <CardErrors card={props.card} cardState={props.cardState} />
      </div>
    </article>
  );
}
