import { action, createOptimistic, createSignal } from "solid-js";
import type { Card } from "#/module_bindings/types.ts";
import { useReducers } from "#/spacetimedb.tsx";
import { useName } from "#/name.tsx";

export function createCardActions(props: {
  card: () => Card;
  disabled?: () => boolean;
  onArchived?: (id: string) => void;
  onDeleted?: (id: string) => void;
}) {
  const reducers = useReducers();
  const { name } = useName();
  const [pending, setPending] = createOptimistic(false);
  const [error, setError] = createSignal<string>();
  let previousArchive: { archived: boolean; operationId: string } | undefined;
  let deleteOperationId: string | undefined;

  const archive = action(function* () {
    if (pending() || props.disabled?.()) return;
    const card = props.card();
    const archived = !card.archived;
    const operationId =
      previousArchive?.archived === archived
        ? previousArchive.operationId
        : crypto.randomUUID();
    previousArchive = { archived, operationId };
    const request = {
      id: card.id,
      boardId: card.boardId,
      archived,
      operationId,
      actor: name(),
    };
    setPending(true);
    setError(undefined);
    try {
      yield reducers.archiveCard(request);
      props.onArchived?.(request.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't confirm the card's archive status.",
      );
    }
  });

  const remove = action(function* () {
    if (pending() || props.disabled?.()) return;
    const card = props.card();
    const request = {
      id: card.id,
      boardId: card.boardId,
      operationId: (deleteOperationId ??= crypto.randomUUID()),
      actor: name(),
    };
    setPending(true);
    setError(undefined);
    try {
      yield reducers.deleteCard(request);
      props.onDeleted?.(request.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't confirm card deletion.",
      );
    }
  });

  return { archive, remove, pending, error };
}
