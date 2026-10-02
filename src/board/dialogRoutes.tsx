import { Show } from "solid-js";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import type { RouteDefinition } from "@solidjs/router";
import { tables } from "#/module_bindings/index.ts";
import { useRow, useTable } from "#/spacetimedb.tsx";
import { closeDialog } from "#/nav.ts";
import { EditBoardDialog } from "./dialogs/EditBoardDialog";
import { ListDialog } from "./dialogs/ListDialog";
import { EditNameDialog } from "./dialogs/EditNameDialog";
import { AddBoardDialog } from "./dialogs/AddBoardDialog";

function useClose(fallbackPath?: string) {
  const location = useLocation<{ dialogOpenedFromApp: true }>();
  const navigate = useNavigate();
  return () => closeDialog(navigate, location, fallbackPath);
}

export function EditNameDialogRoute() {
  const close = useClose();
  return <EditNameDialog onClose={close} />;
}

export function AddBoardDialogRoute() {
  const close = useClose();
  return <AddBoardDialog onClose={close} />;
}

export function ListDialogRoute() {
  const params = useParams();
  const close = useClose();
  return <ListDialog boardId={params.boardId ?? "studio"} onClose={close} />;
}

export function EditListDialogRoute() {
  const params = useParams();
  const close = useClose(`/b/${params.boardId ?? "studio"}`);
  const column = useRow(
    () => tables.column,
    () => params.columnId ?? "",
  );
  return (
    <Show when={column()}>
      {(item) => (
        <ListDialog
          column={item()}
          boardId={params.boardId ?? "studio"}
          onClose={close}
        />
      )}
    </Show>
  );
}

export function EditBoardDialogRoute() {
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
export const globalDialogRoutes: RouteDefinition[] = [
  { path: "/name", component: EditNameDialogRoute },
  { path: "/board", component: AddBoardDialogRoute },
];

/** Board header dialogs — Add list / Edit board (all views with the header). */
export const headerDialogRoutes: RouteDefinition[] = [
  { path: "/new-list", component: ListDialogRoute },
  { path: "/details", component: EditBoardDialogRoute },
  { path: "/list/:columnId", component: EditListDialogRoute },
];
