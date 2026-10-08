import { css } from "@csslit/core";
import { type ParentProps, Show, Loading } from "solid-js";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { space, breakpoints, colors, fontSize, lineHeight } from "#/theme.ts";
import { Icon } from "#/ui/Icon.tsx";
import { Button } from "#/ui/Button.tsx";
import { Skeleton } from "#/ui/Skeleton.tsx";
import { tables } from "#/module_bindings/index.ts";
import { useRow, useTable } from "#/spacetimedb.tsx";
import { openDialog } from "#/nav.ts";
import { useCardFilters } from "./card-filters";
import { BoardTabs, useTab } from "./BoardTabs";
import { CardFilters } from "./CardFilters";

function CardCount(props: { archived: boolean }) {
  const params = useParams();
  const cards = useTable(() =>
    tables.card.where((card) =>
      card.boardId
        .eq(params.boardId ?? "studio")
        .and(card.archived.eq(props.archived)),
    ),
  );
  const filters = useCardFilters();
  const count = () => cards().filter(filters.matches).length;
  return (
    <>
      {count()}
      {props.archived ? " archived" : ""}
      {count() === 1 ? " card" : " cards"}
    </>
  );
}

export function BoardHeader(props: ParentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const boardId = () => params.boardId ?? "studio";
  const tab = useTab();
  const board = useRow(() => tables.board, boardId);

  return (
    <div
      class={css`
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        min-height: 0;
        padding-top: ${space.lg}px;
      `}
    >
      <Show
        when={board()}
        fallback={
          <div
            class={css`
              padding: ${space.xl}px;
              color: ${colors.muted};
              text-align: center;
              font-size: ${fontSize.control}px;
              line-height: ${lineHeight.control}px;
            `}
          >
            <Show
              when={params.boardId}
              fallback="Choose a board or add one from the sidebar."
            >
              {"This board doesn't exist. "}
              <a href="/">Go back to the workspace</a>
            </Show>
          </div>
        }
      >
        <div
          class={css`
            flex-shrink: 0;
            padding-inline: ${space.xl}px;
            @media (max-width: ${breakpoints.compact}px) {
              padding-inline: ${space.md}px;
            }
          `}
        >
          <header
            class={css`
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: ${space.md}px;
              flex-wrap: wrap;
              margin-bottom: ${space.lg}px;
            `}
          >
            <div
              class={css`
                min-width: 0;
                flex: 1 1 240px;
                overflow-wrap: anywhere;
              `}
            >
              <h1
                class={css`
                  font-size: ${fontSize.heading}px;
                  line-height: ${lineHeight.heading}px;

                  @media (max-width: ${breakpoints.compact}px) {
                    font-size: ${fontSize.headingCompact}px;
                    line-height: ${lineHeight.headingCompact}px;
                  }
                `}
              >
                {board()!.title}
              </h1>
              <Show when={board()!.description}>
                <p
                  class={css`
                    margin-top: ${space.md}px;
                    font-size: ${fontSize.control}px;
                    line-height: ${lineHeight.control}px;

                    color: ${colors.muted};
                  `}
                >
                  {board()!.description}
                </p>
              </Show>
            </div>
            <div
              class={css`
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: ${space.sm}px;
              `}
            >
              <Button
                variant="ghost"
                iconOnly
                aria-label="Edit board"
                onClick={() => openDialog(navigate, location, "details")}
              >
                <Icon name="more" />
              </Button>
              <Button
                onClick={() => openDialog(navigate, location, "new-lane")}
              >
                <Icon name="plus" />
                <span>Add lane</span>
              </Button>
            </div>
          </header>
          <div
            class={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: ${space.lg}px;
              padding: 0 0 ${space.sm}px;
              border-bottom: 1px solid ${colors.border};
              flex-wrap: wrap;
            `}
          >
            <BoardTabs current={tab()} />
            <Show when={tab() !== "activity"}>
              <CardFilters />
            </Show>
          </div>
          <div
            class={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: ${space.md}px;
              padding-block: ${space.xs}px;
              font-size: ${fontSize.caption}px;
              color: ${colors.muted};
            `}
          >
            <span
              class={[
                css`
                  display: inline-flex;
                  align-items: center;
                  gap: ${space.sm}px;
                  font-size: ${fontSize.caption}px;
                  color: ${colors.success};
                  padding: ${space.xs}px;
                  margin-inline-start: -${space.xs}px;
                `,
                false &&
                  css`
                    color: ${colors.pending};
                  `,
                false &&
                  css`
                    color: ${colors.danger};
                  `,
              ]}
              role="status"
            >
              <i
                class={css`
                  display: inline-block;
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  background: currentColor;
                `}
              />
              <span>Live updates</span>
            </span>
            <Show when={tab() !== "activity"}>
              <span
                class={css`
                  padding: ${space.xs}px;
                  margin-inline-end: -${space.xs}px;
                `}
              >
                <Loading
                  on={`${boardId()}:${tab()}`}
                  fallback={<Skeleton height={fontSize.caption} width={40} />}
                >
                  <CardCount archived={tab() === "archive"} />
                </Loading>
              </span>
            </Show>
          </div>
        </div>
      </Show>
      <div
        class={css`
          flex: 1;
          min-width: 0;
          min-height: 0;
          container-type: inline-size;
          overflow: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          padding-inline: ${space.xl}px;
          @media (max-width: ${breakpoints.compact}px) {
            padding-inline: ${space.md}px;
          }
        `}
        data-board-scroll
      >
        {props.children}
      </div>
    </div>
  );
}
