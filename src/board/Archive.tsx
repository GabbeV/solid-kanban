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
import { ArchivedCard } from "./ArchivedCard";
import { tables } from "#/module_bindings/index.ts";
import { createCardState } from "./card-state";
import { useTable } from "#/spacetimedb.tsx";
import { useCardFilters } from "#/board/card-filters.ts";
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
  const boardLanes = useTable(() =>
    tables.lane.where((lane) => lane.boardId.eq(boardId())),
  );
  const cardState = createCardState(true);
  const filters = useCardFilters();
  const archived = () =>
    cardState.cards.filter((card) => card.archived && filters.matches(card));

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
            <ArchivedCard
              card={card()}
              cardState={cardState}
              laneTitle={
                boardLanes().find((lane) => lane.id === card().laneId)?.title
              }
            />
          )}
        </For>
      </section>
    </>
  );
}
