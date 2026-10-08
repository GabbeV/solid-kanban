import type * as db from "#/module_bindings/types.ts";

import { useParams } from "@solidjs/router";
import { action, createOptimisticStore, createStore } from "solid-js";
import { SenderError } from "spacetimedb";

import { duplicateCardError } from "#/board/cards.ts";
import { tables } from "#/module_bindings/index.ts";
import { useName } from "#/name.tsx";
import { useReducers, useTable } from "#/spacetimedb.tsx";

export type ViewCard = db.Card & {
  moving?: boolean;
  saving?: boolean;
  moveFailed?: boolean;
  editFailed?: boolean;
  createFailed?: boolean;
  archiveFailed?: boolean;
  restoreFailed?: boolean;
  deleteFailed?: boolean;
};

export type CardFailure =
  | "createFailed"
  | "editFailed"
  | "moveFailed"
  | "archiveFailed"
  | "restoreFailed"
  | "deleteFailed";

const clearedFailures = {
  moveFailed: false,
  editFailed: false,
  createFailed: false,
  archiveFailed: false,
  restoreFailed: false,
  deleteFailed: false,
} satisfies Record<CardFailure, boolean>;

export type MoveRequest = {
  boardId: string;
  id: string;
  laneId: string;
  orderKey: string;
};

export type CardState = ReturnType<typeof createCardState>;

export function createCardState(archived = false) {
  const params = useParams();
  const boardId = () => params.boardId ?? "studio";
  const reducers = useReducers();
  const { name } = useName();

  const serverCards = useTable(() =>
    tables.card.where((card) => card.boardId.eq(boardId()).and(card.archived.eq(archived))),
  );

  // Keep reconciliation until the imperative setter follow-up in
  // https://github.com/solidjs/solid/issues/3743#issuecomment-5942237945 is fixed:
  // imperative writes can re-notify an untouched held key and join its action.
  const [localCards, setLocalCards] = createStore<ViewCard[]>((draft) => {
    const remoteCards = serverCards();

    return [
      ...remoteCards.map((remote) => {
        const previous = draft.find((card) => card.id === remote.id);
        const moveFailed =
          previous?.moveFailed === true &&
          (previous.laneId !== remote.laneId || previous.orderKey !== remote.orderKey);

        return {
          ...remote,
          // Existence confirms creation. Edit/move failures own unsaved values.
          ...(moveFailed && { moveFailed: true }),
          ...(previous?.editFailed && { editFailed: true }),
          ...(previous?.archiveFailed && { archiveFailed: true }),
          ...(previous?.restoreFailed && { restoreFailed: true }),
          ...(previous?.deleteFailed && { deleteFailed: true }),
          ...((moveFailed || previous?.editFailed) && {
            laneId: previous.laneId,
            orderKey: previous.orderKey,
          }),
          ...(previous?.editFailed && {
            title: previous.title,
            description: previous.description,
            label: previous.label,
            priority: previous.priority,
            assignee: previous.assignee,
            dueDate: previous.dueDate,
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

  const moveCard = action(function* (request: MoveRequest) {
    // Stage the clear for reconciliation; optimism retains the visible error
    // until the retry settles.
    setLocalCards((draft) => {
      const card = draft.find((item) => item.id === request.id);
      if (!card) return;

      card.moveFailed = false;
    });

    setOptimisticCards((draft) => {
      const card = draft.find((item) => item.id === request.id);
      if (!card) return;

      card.laneId = request.laneId;
      card.orderKey = request.orderKey;
      card.moveFailed = card.moveFailed === true;
      card.moving = true;
    });

    try {
      yield reducers.moveCard({ ...request, actor: name() });
    } catch {
      setLocalCards((draft) => {
        const card = draft.find((item) => item.id === request.id);
        if (!card) return;

        card.laneId = request.laneId;
        card.orderKey = request.orderKey;
        card.moveFailed = true;
      });
    }
  });

  const editCard = action(function* (input: ViewCard, clearErrors = false) {
    const fields = {
      laneId: input.laneId,
      orderKey: input.orderKey,
      title: input.title,
      description: input.description,
      label: input.label,
      priority: input.priority,
      assignee: input.assignee,
      dueDate: input.dueDate,
    };

    const request = {
      ...fields,
      boardId: input.boardId,
      id: input.id,
      actor: name(),
    };

    // Stage the clear for reconciliation; optimism retains the visible error
    // until the retry settles.
    setLocalCards((draft) => {
      const card = draft.find((card) => card.id === request.id);
      if (!card) return;

      if (clearErrors) Object.assign(card, clearedFailures);
      else {
        card.editFailed = false;
        card.moveFailed = false;
      }
    });

    setOptimisticCards((draft) => {
      const card = draft.find((card) => card.id === request.id);
      if (!card) return;

      const failures = clearErrors
        ? clearedFailures
        : {
            editFailed: card.editFailed === true,
            moveFailed: card.moveFailed === true,
          };

      Object.assign(card, fields, failures, { saving: true });
    });

    try {
      yield reducers.editCard(request);
    } catch {
      setLocalCards((draft) => {
        const card = draft.find((card) => card.id === request.id);
        if (!card) return;

        Object.assign(card, fields, { editFailed: true, moveFailed: false });
      });
    }
  });

  const createCard = action(function* (input: db.Card) {
    const card = { ...input };

    setOptimisticCards((draft) => {
      draft.push({ ...card, saving: true });
    });

    try {
      yield reducers.createCard({ ...card, actor: name() });
    } catch {
      setLocalCards((draft) => {
        const previous = draft.find((item) => item.id === card.id);
        // Keep any edits or moves made while creation was pending.
        if (previous) previous.createFailed = true;
        else draft.push({ ...card, createFailed: true });
      });
    }
  });

  const retryCreateCard = action(function* (input: ViewCard, clearErrors = false) {
    const card = { ...input, moving: false, saving: false };

    // A full save includes placement, so it supersedes a separate move retry.
    const retryEdit = clearErrors || card.editFailed === true;
    const retryMove = !retryEdit && card.moveFailed === true;

    setLocalCards((draft) => {
      const previous = draft.find((item) => item.id === card.id);
      if (!previous) return;

      if (clearErrors) Object.assign(previous, clearedFailures);
      else previous.createFailed = false;
    });

    setOptimisticCards((draft) => {
      const pending = {
        ...card,
        ...(clearErrors && clearedFailures),
        saving: true,
      };

      const previous = draft.find((item) => item.id === card.id);
      if (previous) Object.assign(previous, pending);
      else draft.push(pending);
    });

    const request = { ...card, actor: name() };

    // Pipeline creation before the existing edit/move action. A duplicate only
    // confirms existence; the later action still has to save the local changes.
    const creation = reducers.createCard(request);
    const update = retryEdit
      ? editCard(card, clearErrors)
      : retryMove
        ? moveCard(request)
        : undefined;

    try {
      yield creation;
    } catch (error) {
      if (!(error instanceof SenderError && error.message === duplicateCardError)) {
        setLocalCards((draft) => {
          const previous = draft.find((item) => item.id === card.id);
          if (previous) previous.createFailed = true;
          else draft.push({ ...card, createFailed: true });
        });
      }
    }

    if (update) yield update;
  });

  const archiveCard = action(function* (input: ViewCard, archived = true) {
    const request = {
      id: input.id,
      boardId: input.boardId,
      archived,
      actor: name(),
    };

    setOptimisticCards((draft) => {
      const card = draft.find((item) => item.id === request.id);
      if (card) card.saving = true;
    });

    try {
      yield reducers.archiveCard(request);
      removeCard(request.id);

      return true;
    } catch {
      setLocalCards((draft) => {
        const card = draft.find((item) => item.id === request.id);
        if (card) card[archived ? "archiveFailed" : "restoreFailed"] = true;
      });

      return false;
    }
  });

  const restoreCard = (card: ViewCard) => archiveCard(card, false);

  const deleteCard = action(function* (input: ViewCard) {
    const request = {
      id: input.id,
      boardId: input.boardId,
      actor: name(),
    };

    setOptimisticCards((draft) => {
      const card = draft.find((item) => item.id === request.id);
      if (card) card.saving = true;
    });

    try {
      yield reducers.deleteCard(request);
      removeCard(request.id);

      return true;
    } catch {
      setLocalCards((draft) => {
        const card = draft.find((item) => item.id === request.id);
        if (card) card.deleteFailed = true;
      });

      return false;
    }
  });

  const dismissError = (
    id: string,
    failure: Exclude<CardFailure, "createFailed" | "editFailed" | "moveFailed"> | "changes",
  ) => {
    const remote = serverCards().find((card) => card.id === id);

    setLocalCards((draft) => {
      const card = draft.find((item) => item.id === id);
      if (!card) return;

      if (failure === "changes") {
        if (!remote) draft.splice(draft.indexOf(card), 1);
        else
          Object.assign(card, remote, {
            createFailed: false,
            editFailed: false,
            moveFailed: false,
          });
      } else {
        card[failure] = false;
      }
    });
  };

  const removeCard = (id: string) => {
    // Also remove an unconfirmed creation that only exists in the client store.
    setLocalCards((draft) => {
      const index = draft.findIndex((card) => card.id === id);
      if (index !== -1) draft.splice(index, 1);
    });
  };

  const discardCard = (id: string) => {
    const remote = serverCards().find((card) => card.id === id);

    setLocalCards((draft) => {
      const index = draft.findIndex((card) => card.id === id);
      if (index === -1) return;

      if (remote) Object.assign(draft[index], remote, clearedFailures);
      else draft.splice(index, 1);
    });
  };

  return {
    cards,
    moveCard,
    editCard,
    createCard,
    retryCreateCard,
    archiveCard,
    restoreCard,
    deleteCard,
    dismissError,
    discardCard,
  };
}
