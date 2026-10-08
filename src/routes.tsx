import { css } from "@csslit/core";
import { Layout } from "#/Layout.tsx";
import { colors, fontSize, lineHeight, space } from "#/theme.ts";
import { BoardHeader } from "#/board/BoardHeader.tsx";
import { Board } from "#/board/Board.tsx";
import { Activity } from "#/board/Activity.tsx";
import { Archive } from "#/board/Archive.tsx";
import { Show, type ParentProps } from "solid-js";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { createRouter, type RouteDefinition } from "@solidjs/router";
import { tables } from "#/module_bindings/index.ts";
import { useRow, useTable } from "#/spacetimedb.tsx";
import { closeDialog } from "#/nav.ts";
import { EditBoardDialog } from "./board/dialogs/EditBoardDialog";
import { LaneDialog } from "./board/dialogs/LaneDialog";
import { EditNameDialog } from "./board/dialogs/EditNameDialog";
import { AddBoardDialog } from "./board/dialogs/AddBoardDialog";

function useClose(fallbackPath?: string) {
  const location = useLocation<{ dialogOpenedFromApp: true }>();
  const navigate = useNavigate();
  return () => closeDialog(navigate, location, fallbackPath);
}

function EditNameDialogRoute() {
  const close = useClose();
  return <EditNameDialog onClose={close} />;
}

function AddBoardDialogRoute() {
  const close = useClose();
  return <AddBoardDialog onClose={close} />;
}

function LaneDialogRoute() {
  const params = useParams();
  const close = useClose();
  return <LaneDialog boardId={params.boardId ?? "studio"} onClose={close} />;
}

function EditLaneDialogRoute() {
  const params = useParams();
  const close = useClose(`/b/${params.boardId ?? "studio"}`);
  const lane = useRow(
    () => tables.lane,
    () => params.laneId ?? "",
  );
  return (
    <Show when={lane()}>
      {(item) => (
        <LaneDialog
          lane={item()}
          boardId={params.boardId ?? "studio"}
          onClose={close}
        />
      )}
    </Show>
  );
}

function EditBoardDialogRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const boards = useTable(() => tables.board);
  const close = useClose();
  const board = useRow(
    () => tables.board,
    () => params.boardId ?? "studio",
  );
  return (
    <Show when={board()}>
      {(item) => (
        <EditBoardDialog
          board={item()}
          onClose={close}
          onDeleted={(id) => {
            const next = boards().find((board) => board.id !== id);
            navigate(next ? `/b/${next.id}` : "/", { replace: true });
          }}
        />
      )}
    </Show>
  );
}

/** Sidebar dialogs — valid wherever Layout is shown (workspace + all board tabs). */
const globalDialogRoutes: RouteDefinition[] = [
  { path: "/name", component: EditNameDialogRoute },
  { path: "/board", component: AddBoardDialogRoute },
];

/** Board header dialogs — Add lane / Edit board (all views with the header). */
const headerDialogRoutes: RouteDefinition[] = [
  { path: "/new-lane", component: LaneDialogRoute },
  { path: "/details", component: EditBoardDialogRoute },
  { path: "/lane/:laneId", component: EditLaneDialogRoute },
];

function BoardRoute(props: ParentProps) {
  return (
    <Layout>
      <BoardHeader>{props.children}</BoardHeader>
    </Layout>
  );
}

const boardChildren: RouteDefinition[] = [
  {
    path: "/",
    component: Board,
    info: { tab: "board" },
    children: [
      { path: "/" },
      { path: "/card/:cardId" },
      ...globalDialogRoutes,
      ...headerDialogRoutes,
    ],
  },
  {
    path: "/activity",
    component: Activity,
    info: { tab: "activity" },
    children: [{ path: "/" }, ...globalDialogRoutes, ...headerDialogRoutes],
  },
  {
    path: "/archive",
    component: Archive,
    info: { tab: "archive" },
    children: [{ path: "/" }, ...globalDialogRoutes, ...headerDialogRoutes],
  },
];

export const Router = createRouter({
  routes: [
    {
      path: "/",
      component: BoardRoute,
      children: [boardChildren[0]],
    },
    {
      path: "/b/:boardId",
      component: BoardRoute,
      children: boardChildren,
    },
    {
      path: "*404",
      component: () => (
        <div
          class={css`
            padding: ${space.xl}px;
            color: ${colors.muted};
            text-align: center;
            font-size: ${fontSize.control}px;
            line-height: ${lineHeight.control}px;
          `}
        >
          {"This page does not exist. "}
          <a href="/">Back to the board</a>
        </div>
      ),
    },
  ],
});
