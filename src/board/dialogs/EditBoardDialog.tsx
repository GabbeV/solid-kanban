import type * as db from "#/module_bindings/types.ts";

import { css } from "@csslit/core";
import { Show, action, createSignal, createStore, untrack } from "solid-js";

import { useName } from "#/name.tsx";
import { useReducers } from "#/spacetimedb.tsx";
import { space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Dialog } from "#/ui/Dialog.tsx";
import { Field } from "#/ui/Field.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Input } from "#/ui/Input.tsx";
import { Notice } from "#/ui/Notice.tsx";
import { Textarea } from "#/ui/Textarea.tsx";

export function EditBoardDialog(props: {
  board: db.Board;
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
  const [error, setError] = createSignal<string>();
  const [deleteError, setDeleteError] = createSignal<string>();
  const deleteBoard = action(function* () {
    const request = {
      boardId: props.board.id,
      actor: name(),
    };
    try {
      yield reducers.deleteBoard(request);
      setDeleteError(undefined);
      props.onDeleted(request.boardId);
    } catch {
      setDeleteError("Deletion not confirmed.");
    }
  });
  const save = action(function* (event: {
    preventDefault(): void;
    currentTarget: HTMLFormElement;
  }) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const title = fields.get("title");
    const description = fields.get("description");
    try {
      yield reducers.editBoard({
        boardId: props.board.id,
        actor: name(),
        title: typeof title === "string" ? title : "",
        description: typeof description === "string" ? description : "",
      });
      setError(undefined);
      props.onClose();
    } catch {
      setError("Changes not confirmed.");
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
        <Field label="Title">
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
          />
        </Field>
        <Field label="Description">
          <Textarea
            name="description"
            value={draft.description}
            onInput={(event) =>
              setDraft((draft) => {
                draft.description = event.currentTarget.value;
              })
            }
            maxlength={500}
          />
        </Field>
        <Show when={error()}>
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
          <Button type="submit" variant="primary">
            <span>Save</span>
          </Button>
          <Button variant="danger" onClick={deleteBoard}>
            <Icon name="trash" />
            <span>Delete</span>
          </Button>
        </div>
      </form>
      <Show when={deleteError()}>
        <Notice role="alert">{deleteError()}</Notice>
      </Show>
    </Dialog>
  );
}
