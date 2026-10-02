import { css } from "@csslit/core";
import {
  Show,
  action,
  createOptimistic,
  createSignal,
  createStore,
} from "solid-js";
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
  const [pending, setPending] = createOptimistic(false);
  const [error, setError] = createSignal<string>();
  let boardId: string | undefined;
  let operationId: string | undefined;
  const addBoard = action(function* (event: {
    preventDefault(): void;
    currentTarget: HTMLFormElement;
  }) {
    event.preventDefault();
    if (pending()) return;
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    boardId ??= crypto.randomUUID();
    operationId ??= crypto.randomUUID();
    try {
      yield reducers.createBoard({
        boardId,
        operationId,
        actor: name(),
        title: String(fields.get("title")),
        description: String(fields.get("description")),
      });
      props.onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't confirm the new board.",
      );
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
        <Field label="Board name">
          <Input
            name="title"
            value={draft.title}
            onInput={(event) =>
              setDraft((draft) => {
                draft.title = event.currentTarget.value;
              })
            }
            disabled={pending()}
            placeholder="Board name"
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
            disabled={pending()}
            placeholder="Optional description"
            maxlength={500}
          />
        </Field>
        <Show when={error() && !pending()}>
          <Notice role="alert">{error()}</Notice>
        </Show>
        <div
          class={css`
            display: flex;
            align-items: center;
            gap: ${space.sm}px;
          `}
        >
          <Button type="submit" variant="primary" disabled={pending()}>
            <span>Add</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
