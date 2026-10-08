import { css } from "@csslit/core";
import { Show, action, createSignal, createStore } from "solid-js";
import { space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Dialog } from "#/ui/Dialog.tsx";
import { Field } from "#/ui/Field.tsx";
import { Input } from "#/ui/Input.tsx";
import { Notice } from "#/ui/Notice.tsx";
import { Textarea } from "#/ui/Textarea.tsx";
import { useReducers } from "#/spacetimedb.tsx";
import { useName } from "#/name.tsx";

export function AddBoardDialog(props: { onClose: () => void }) {
  const reducers = useReducers();
  const { name } = useName();
  const [draft, setDraft] = createStore({ title: "", description: "" });
  const [error, setError] = createSignal<string>();
  let boardId: string | undefined;
  const addBoard = action(function* (event: {
    preventDefault(): void;
    currentTarget: HTMLFormElement;
  }) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    boardId ??= crypto.randomUUID();
    try {
      yield reducers.createBoard({
        boardId,
        actor: name(),
        title: String(fields.get("title")),
        description: String(fields.get("description")),
      });
      setError(undefined);
      props.onClose();
    } catch {
      setError("Creation not confirmed.");
    }
  });
  return (
    <Dialog title="Add board" onClose={() => props.onClose()}>
      <form
        onSubmit={addBoard}
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.lg}px;
        `}
      >
        <Field label="Title">
          <Input
            name="title"
            value={draft.title}
            onInput={(event) =>
              setDraft((draft) => {
                draft.title = event.currentTarget.value;
              })
            }

            placeholder="Title"
            maxlength={80}
            required
            autofocus
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

            placeholder="Optional description"
            maxlength={500}
          />
        </Field>
        <Show when={error()}>
          <Notice role="alert">{error()}</Notice>
        </Show>
        <div
          class={css`
            display: flex;
            align-items: center;
            gap: ${space.sm}px;
          `}
        >
          <Button type="submit" variant="primary">
            <span>Add</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
