import { css } from "@csslit/core";
import { Show, action, createSignal, untrack } from "solid-js";
import type { Lane } from "../../module_bindings/types";
import { space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Dialog } from "#/ui/Dialog.tsx";
import { Field } from "#/ui/Field.tsx";
import { Input } from "#/ui/Input.tsx";
import { Notice } from "#/ui/Notice.tsx";
import { useReducers } from "#/spacetimedb.tsx";
import { useName } from "#/name.tsx";

export function LaneDialog(props: {
  lane?: Lane;
  boardId: string;
  onClose: () => void;
}) {
  const reducers = useReducers();
  const { name } = useName();
  const [title, setTitle] = createSignal(
    untrack(() => props.lane?.title ?? ""),
  );
  const [error, setError] = createSignal<string>();
  const [deleteError, setDeleteError] = createSignal<string>();
  const deleteLane = action(function* () {
    if (!props.lane) return;
    const request = {
      id: props.lane.id,
      boardId: props.boardId,
      actor: name(),
    };
    try {
      yield reducers.deleteLane(request);
      setDeleteError(undefined);
      props.onClose();
    } catch {
      setDeleteError("Deletion not confirmed.");
    }
  });
  let newId: string | undefined;
  const addLane = action(function* (event: {
    preventDefault(): void;
    currentTarget: HTMLFormElement;
  }) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title"));
    newId ??= crypto.randomUUID();
    const request = {
      id: newId,
      boardId: props.boardId,
      title,
      actor: name(),
    };
    try {
      yield reducers.createLane(request);
      setError(undefined);
      props.onClose();
    } catch {
      setError("Creation not confirmed.");
    }
  });
  const renameLane = action(function* (event: {
    preventDefault(): void;
    currentTarget: HTMLFormElement;
  }) {
    event.preventDefault();
    if (!props.lane) return;
    const title = String(new FormData(event.currentTarget).get("title"));
    try {
      yield reducers.renameLane({
        id: props.lane.id,
        boardId: props.boardId,
        title,
        actor: name(),
      });
      setError(undefined);
      props.onClose();
    } catch {
      setError("Changes not confirmed.");
    }
  });
  return (
    <Dialog
      title={props.lane ? "Edit lane" : "Add lane"}
      onClose={() => props.onClose()}
    >
      <form
        onSubmit={props.lane ? renameLane : addLane}
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.lg}px;
        `}
      >
        <Field label="Title">
          <Input
            name="title"
            value={title()}
            onInput={(event) => setTitle(event.currentTarget.value)}

            maxlength={60}
            autofocus
            required
          />
        </Field>
        <Show when={error()}>
          <Notice role="alert">{error()} Your draft stays here.</Notice>
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
            <span>{props.lane ? "Save" : "Add"}</span>
          </Button>
          <Show when={props.lane}>
            <Button variant="danger" onClick={deleteLane}>
              <Icon name="trash" />
              <span>Delete</span>
            </Button>
          </Show>
        </div>
      </form>
      <Show when={deleteError()}>
        <Notice role="alert">{deleteError()}</Notice>
      </Show>
    </Dialog>
  );
}
