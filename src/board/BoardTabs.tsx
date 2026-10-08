import { css } from "@csslit/core";
import { createMemo, createOptimistic } from "solid-js";
import { useLocation, useParams, useRouteMatches } from "@solidjs/router";
import { space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";

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

export type Tab = "board" | "activity" | "archive";

export function useTab(): () => Tab {
  const matches = useRouteMatches();
  return createMemo(() => {
    const chain = matches();
    for (let i = chain.length - 1; i >= 0; i--) {
      const tab = chain[i].route.info?.tab;
      if (tab === "board" || tab === "activity" || tab === "archive")
        return tab;
    }
    return "board" as const;
  });
}

export function BoardTabs(props: { current: Tab }) {
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
