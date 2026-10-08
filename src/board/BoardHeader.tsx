import type { ParentProps } from "solid-js";

import { css } from "@csslit/core";
import { useLocation, useNavigate, useParams, useRouteMatches } from "@solidjs/router";
import { For, Loading, Show, createMemo, createOptimistic } from "solid-js";

import { useCardFilters } from "#/board/card-filters.ts";
import { labels } from "#/board/cards.ts";
import { tables } from "#/module_bindings/index.ts";
import { openDialog } from "#/nav.ts";
import { useRow, useTable } from "#/spacetimedb.tsx";
import { breakpoints, colors, fontSize, lineHeight, space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Input } from "#/ui/Input.tsx";
import { Select } from "#/ui/Select.tsx";
import { Skeleton } from "#/ui/Skeleton.tsx";

function CardCount(props: { archived: boolean }) {
  const params = useParams();
  const cards = useTable(() =>
    tables.card.where((card) =>
      card.boardId.eq(params.boardId ?? "studio").and(card.archived.eq(props.archived)),
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
            <Show when={params.boardId} fallback="Choose a board or add one from the sidebar.">
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
              <Button onClick={() => openDialog(navigate, location, "new-lane")}>
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

function BoardTab(props: {
  href: string;
  selected: boolean;
  icon: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <Button
      href={props.href}
      variant="ghost"
      aria-current={props.selected ? "page" : undefined}
      onClick={props.onClick}
    >
      <Icon name={props.icon} />
      <span>{props.title}</span>
    </Button>
  );
}

type Tab = "board" | "activity" | "archive";

function useTab(): () => Tab {
  const matches = useRouteMatches();

  return createMemo(() => {
    const chain = matches();
    for (let i = chain.length - 1; i >= 0; i--) {
      const tab = chain[i].route.info?.tab;
      if (tab === "board" || tab === "activity" || tab === "archive") return tab;
    }

    return "board" as const;
  });
}

function BoardTabs(props: { current: Tab }) {
  const location = useLocation();
  const params = useParams();
  const boardId = () => params.boardId ?? "studio";
  const [selected, setSelected] = createOptimistic(() => props.current);

  return (
    <nav
      class={css`
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: ${space.xs}px;
      `}
      aria-label="Board views"
    >
      <BoardTab
        href={`/b/${boardId()}${location.search}`}
        selected={selected() === "board"}
        onClick={() => setSelected("board")}
        icon="board"
        title="Board"
      />
      <BoardTab
        href={`/b/${boardId()}/activity${location.search}`}
        selected={selected() === "activity"}
        onClick={() => setSelected("activity")}
        icon="activity"
        title="Activity"
      />
      <BoardTab
        href={`/b/${boardId()}/archive${location.search}`}
        selected={selected() === "archive"}
        onClick={() => setSelected("archive")}
        icon="archive"
        title="Archive"
      />
    </nav>
  );
}

function CardFilters() {
  const filters = useCardFilters();

  return (
    <div
      class={css`
        display: flex;
        align-items: center;
        gap: ${space.sm}px;
        min-width: 0;
      `}
    >
      <span
        class={css`
          width: 180px;
          min-width: 0;
          flex-shrink: 1;
        `}
      >
        <Input
          icon="search"
          aria-label="Search cards"
          placeholder="Search cards…"
          value={filters.query()}
          onInput={(event) =>
            filters.setSearch({ q: event.currentTarget.value }, { replace: true })
          }
        />
      </span>
      <Select
        fitContent
        aria-label="Filter by label"
        value={filters.label()}
        onChange={(event) => filters.setSearch({ label: event.currentTarget.value })}
      >
        <For each={labels}>{(label) => <option value={label}>{label || "All labels"}</option>}</For>
      </Select>
    </div>
  );
}
