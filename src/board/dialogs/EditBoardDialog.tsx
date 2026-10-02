import { css } from "@csslit/core";
import {
  Show,
  action,
  createOptimistic,
  createSignal,
  createStore,
  untrack,
} from "solid-js";
import type { Board } from "../../module_bindings/types";
import { space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Dialog } from "#/ui/Dialog.tsx";
import { Field } from "#/ui/Field.tsx";
import { Input } from "#/ui/Input.tsx";
import { Notice } from "#/ui/Notice.tsx";
import { Textarea } from "#/ui/Textarea.tsx";
import { useReducers } from "#/spacetimedb.tsx";
import { useName } from "#/name.tsx";

export function EditBoardDialog(props: {
  board: Board;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const reducers = useReducers();
  const { name } = useName();
  const initial = untrack(() => ({
    title: props.board.title,
    description: props.board.description,
  }));
  const [draft, setDraft] = createStore(initial);
  const [pending, setPending] = createOptimistic(false);
  const [error, setError] = createSignal<string>();
  const [deleting, setDeleting] = createOptimistic(false);
  const [deleteError, setDeleteError] = createSignal<string>();
  const busy = () => pending() || deleting();
  let deleteOperationId: string | undefined;
  const deleteBoard = action(function* () {
    if (busy()) return;
    const request = {
      boardId: props.board.id,
      actor: name(),
      operationId: (deleteOperationId ??= crypto.randomUUID()),
    };
    setDeleting(true);
    setDeleteError(undefined);
    try {
      yield reducers.deleteBoard(request);
      props.onDeleted(request.boardId);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error
          ? cause.message
          : "Couldn't confirm board deletion.",
      );
    }
  });
  let previous:
    { title: string; description: string; operationId: string } | undefined;
  const save = action(function* (event: {
    preventDefault(): void;
    currentTarget: HTMLFormElement;
  }) {
    event.preventDefault();
    if (busy()) return;
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get("title"));
    const description = String(fields.get("description"));
    const operationId =
      previous?.title === title && previous.description === description
        ? previous.operationId
        : crypto.randomUUID();
    previous = { title, description, operationId };
    setPending(true);
    setError(undefined);
    try {
      yield reducers.renameBoard({
        boardId: props.board.id,
        operationId,
        actor: name(),
        title,
        description,
      });
      props.onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't confirm the board changes.",
      );
    }
  });
  return (
    <Dialog title="Edit board" onClose={() => props.onClose()}>
      <form
        onSubmit={save}
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.lg}px;
        `}
      >
        <Field label="Board title">
          <Input
            autofocus
            name="title"
            value={draft.title}
            onInput={(event) =>
              setDraft((draft) => {
                draft.title = event.currentTarget.value;
              })
            }
            maxlength={80}
            required
            disabled={busy()}
          />
        </Field>
        <Field label="Board description">
          <Textarea
            name="description"
            value={draft.description}
            onInput={(event) =>
              setDraft((draft) => {
                draft.description = event.currentTarget.value;
              })
            }
            maxlength={500}
            disabled={busy()}
          />
        </Field>
        <Show when={error() && !pending()}>
          <Notice>{error()} Your draft stays here.</Notice>
        </Show>
        <div
          class={css`
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: ${space.sm}px;
          `}
        >
          <Button type="submit" variant="primary" disabled={busy()}>
            <span>Save</span>
          </Button>
          <Button variant="danger" disabled={busy()} onClick={deleteBoard}>
            <Icon name="trash" />
            <span>Delete</span>
          </Button>
        </div>
      </form>
      <Show when={deleteError() && !deleting()}>
        <Notice role="alert">{deleteError()}</Notice>
      </Show>
    </Dialog>
  );
}
