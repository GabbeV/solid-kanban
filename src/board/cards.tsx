import { action, createOptimisticStore, createStore } from "solid-js";
import { useParams } from "@solidjs/router";
import { tables } from "#/module_bindings/index.ts";
import type { Card } from "#/module_bindings/types.ts";
import { useName } from "#/name.tsx";
import { useReducers, useTable } from "#/spacetimedb.tsx";

export type ViewCard = Card & {
  moving?: boolean;
  saving?: boolean;
  moveFailed?: boolean;
  editFailed?: boolean;
  createFailed?: boolean;
};

export type CardState = ReturnType<typeof createCards>;

export function createCards() {
  const params = useParams();
  const boardId = () => params.boardId ?? "studio";
  const reducers = useReducers();
  const { name } = useName();
  const serverCards = useTable(() =>
    tables.card.where((card) =>
      card.boardId.eq(boardId()).and(card.archived.eq(false)),
    ),
  );
  const [localCards, setLocalCards] = createStore<ViewCard[]>((draft) => {
    const remoteCards = serverCards();
    return [
      ...remoteCards.map((remote) => {
        const previous = draft.find((card) => card.id === remote.id);
        // Workaround for https://github.com/solidjs/solid/issues/3743:
        // keep failure flags present as false; deleting them can join
        // reconciliation to an unrelated pending action.
        return {
          ...remote,
          moveFailed: previous?.moveFailed === true,
          editFailed: previous?.editFailed === true,
          createFailed: previous?.createFailed === true,
          ...((previous?.moveFailed || previous?.createFailed) && {
            columnId: previous.columnId,
            orderKey: previous.orderKey,
          }),
          ...((previous?.editFailed || previous?.createFailed) && {
            title: previous.title,
            description: previous.description,
            label: previous.label,
            priority: previous.priority,
            assignee: previous.assignee,
            due: previous.due,
          }),
        };
      }),
      ...draft.filter(
        (card) =>
          card.boardId === boardId() &&
          card.createFailed &&
          !remoteCards.some((remote) => remote.id === card.id),
      ),
    ];
  }, []);
  const [cards, setOptimisticCards] = createOptimisticStore(localCards);

  const editCard = action(function* (input: ViewCard) {
    const fields = {
      title: input.title,
      description: input.description,
      label: input.label,
      priority: input.priority,
      assignee: input.assignee,
      due: input.due,
    };
    const request = {
      ...fields,
      operationId: crypto.randomUUID(),
      boardId: input.boardId,
      id: input.id,
      actor: name(),
    };
    setLocalCards((draft) => {
      const card = draft.find((card) => card.id === request.id);
      if (card) card.editFailed = false;
    });
    setOptimisticCards((draft) => {
      const card = draft.find((card) => card.id === request.id);
      if (!card) return;
      Object.assign(card, fields, { editFailed: false, saving: true });
    });
    try {
      yield reducers.editCard(request);
    } catch {
      setLocalCards((draft) => {
        const card = draft.find((card) => card.id === request.id);
        if (!card) return;
        Object.assign(card, fields, { editFailed: true });
      });
    }
  });

  const createCard = action(function* (input: ViewCard) {
    const card: ViewCard = {
      ...input,
      // A failed creation keeps its values, not other in-flight indicators.
      moving: false,
      saving: false,
      moveFailed: false,
      editFailed: false,
      createFailed: false,
    };
    setLocalCards((draft) => {
      const previous = draft.find((item) => item.id === card.id);
      if (previous) previous.createFailed = false;
    });
    setOptimisticCards((draft) => {
      const previous = draft.find((item) => item.id === card.id);
      if (previous) Object.assign(previous, card, { saving: true });
      else draft.push({ ...card, saving: true });
    });
    try {
      yield reducers.createCard({
        operationId: crypto.randomUUID(),
        actor: name(),
        id: card.id,
        boardId: card.boardId,
        columnId: card.columnId,
        orderKey: card.orderKey,
        title: card.title,
        description: card.description,
        label: card.label,
        priority: card.priority,
        assignee: card.assignee,
        due: card.due,
      });
    } catch {
      setLocalCards((draft) => {
        const previous = draft.find((item) => item.id === card.id);
        if (previous) Object.assign(previous, card, { createFailed: true });
        else draft.push({ ...card, createFailed: true });
      });
    }
  });

  const removeCard = (id: string) => {
    // Also remove an unconfirmed creation that only exists in the client store.
    setLocalCards((draft) => {
      const index = draft.findIndex((card) => card.id === id);
      if (index !== -1) draft.splice(index, 1);
    });
  };

  return {
    serverCards,
    localCards,
    setLocalCards,
    cards,
    setOptimisticCards,
    editCard,
    createCard,
    removeCard,
  };
}
