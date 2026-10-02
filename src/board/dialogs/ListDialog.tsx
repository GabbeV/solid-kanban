import { css } from "@csslit/core";
import {
  Show,
  action,
  createOptimistic,
  createSignal,
  untrack,
} from "solid-js";
import type { Column } from "../../module_bindings/types";
import { space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Dialog } from "#/ui/Dialog.tsx";
import { Field } from "#/ui/Field.tsx";
import { Input } from "#/ui/Input.tsx";
import { Notice } from "#/ui/Notice.tsx";
import { useReducers } from "#/spacetimedb.tsx";
import { useName } from "#/name.tsx";

export function ListDialog(props: {
  column?: Column;
  boardId: string;
  onClose: () => void;
}) {
  const reducers = useReducers();
  const { name } = useName();
  const [title, setTitle] = createSignal(
    untrack(() => props.column?.title ?? ""),
  );
  const [pending, setPending] = createOptimistic(false);
  const [error, setError] = createSignal<string>();
  const [deleting, setDeleting] = createOptimistic(false);
  const [deleteError, setDeleteError] = createSignal<string>();
  const busy = () => pending() || deleting();
  let deleteOperationId: string | undefined;
  const deleteList = action(function* () {
    if (busy() || !props.column) return;
    const request = {
      id: props.column.id,
      boardId: props.boardId,
      actor: name(),
      operationId: (deleteOperationId ??= crypto.randomUUID()),
    };
    setDeleting(true);
    setDeleteError(undefined);
    try {
      yield reducers.deleteColumn(request);
      props.onClose();
    } catch (cause) {
      setDeleteError(
        cause instanceof Error
          ? cause.message
          : "Couldn't confirm list deletion.",
      );
    }
  });
  let newId: string | undefined;
  let newOperationId: string | undefined;
  let previous: { title: string; operationId: string } | undefined;
  const addList = action(function* (event: {
    preventDefault(): void;
    currentTarget: HTMLFormElement;
  }) {
    event.preventDefault();
    if (busy()) return;
    const title = String(new FormData(event.currentTarget).get("title"));
    newId ??= crypto.randomUUID();
    newOperationId ??= crypto.randomUUID();
    const request = {
      id: newId,
      boardId: props.boardId,
      title,
      operationId: newOperationId,
      actor: name(),
    };
    setPending(true);
    setError(undefined);
    try {
      yield reducers.createColumn(request);
      props.onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't confirm the list changes.",
      );
    }
  });
  const renameList = action(function* (event: {
    preventDefault(): void;
    currentTarget: HTMLFormElement;
  }) {
    event.preventDefault();
    if (busy() || !props.column) return;
    const title = String(new FormData(event.currentTarget).get("title"));
    const operationId =
      previous?.title === title ? previous.operationId : crypto.randomUUID();
    previous = { title, operationId };
    setPending(true);
    setError(undefined);
    try {
      yield reducers.renameColumn({
        id: props.column.id,
        boardId: props.boardId,
        title,
        operationId,
        actor: name(),
      });
      props.onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't confirm the list changes.",
      );
    }
  });
  return (
    <Dialog
      title={props.column ? "Edit list" : "Add list"}
      onClose={() => props.onClose()}
    >
      <form
        onSubmit={props.column ? renameList : addList}
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.lg}px;
        `}
      >
        <Field label="List name">
          <Input
            name="title"
            value={title()}
            onInput={(event) => setTitle(event.currentTarget.value)}
            disabled={busy()}
            maxlength={60}
            autofocus
            required
          />
        </Field>
        <Show when={error() && !pending()}>
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
          <Button type="submit" variant="primary" disabled={busy()}>
            <span>{props.column ? "Save" : "Add"}</span>
          </Button>
          <Show when={props.column}>
            <Button variant="danger" disabled={busy()} onClick={deleteList}>
              <Icon name="trash" />
              <span>Delete</span>
            </Button>
          </Show>
        </div>
      </form>
      <Show when={deleteError() && !deleting()}>
        <Notice role="alert">{deleteError()}</Notice>
      </Show>
    </Dialog>
  );
}
