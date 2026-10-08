import type { CardState, ViewCard } from "#/board/card-state.ts";
import type * as db from "#/module_bindings/types.ts";
import type { StoreSetter } from "solid-js";

import { css } from "@csslit/core";
import { For, Show, createStore, untrack } from "solid-js";

import { CardErrors } from "#/board/CardErrors.tsx";
import { labels, placementKey, priorities } from "#/board/cards.ts";
import { CardComments } from "#/board/editor/CardComments.tsx";
import { tables } from "#/module_bindings/index.ts";
import { useTable } from "#/spacetimedb.tsx";
import { breakpoints, colors, fontSize, lineHeight, space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Dialog } from "#/ui/Dialog.tsx";
import { Field } from "#/ui/Field.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Input } from "#/ui/Input.tsx";
import { Select } from "#/ui/Select.tsx";
import { Textarea } from "#/ui/Textarea.tsx";

// The no-comment editor's border-box heights at the two field-grid layouts.
// Dialog centers this baseline so loaded comments extend downward.
const baselineHeight = { wide: 660, phone: 792 };

export function CardEditor(props: { cardState: CardState; id: string; onClose: () => void }) {
  const card = () => props.cardState.cards.find((card) => card.id === props.id);
  return (
    <Dialog
      title="Edit card"
      baselineHeight={baselineHeight}
      onClose={() => props.onClose()}
      returnFocus={() =>
        document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(props.id)}"] a`)
      }
    >
      <Show
        when={card()}
        fallback={
          <div
            class={css`
              display: flex;
              flex-direction: column;
              gap: ${space.sm}px;
            `}
          >
            <h3>This card isn't here</h3>
            <p
              class={css`
                font-size: ${fontSize.caption}px;
                line-height: ${lineHeight.caption}px;

                color: ${colors.muted};
              `}
            >
              It may have been removed, or the link belongs to another board.
            </p>
          </div>
        }
      >
        <CardEditorForm
          card={card()!}
          cardState={props.cardState}
          onClose={() => props.onClose()}
        />
        <div
          class={css`
            height: 1px;
            background: ${colors.border};
            margin: ${space.sm}px 0;
          `}
        />
        <CardComments cardId={props.id} boardId={card()!.boardId} />
      </Show>
    </Dialog>
  );
}

function CardEditorForm(props: { card: ViewCard; cardState: CardState; onClose: () => void }) {
  const lanes = useTable(() => tables.lane.where((lane) => lane.boardId.eq(props.card.boardId)));
  const [draft, setDraft] = createStore(
    untrack(() => ({
      laneId: props.card.laneId,
      title: props.card.title,
      description: props.card.description,
      label: props.card.label,
      priority: props.card.priority,
      assignee: props.card.assignee,
      dueDate: props.card.dueDate,
    })),
  );
  const failed = () =>
    props.card.moveFailed ||
    props.card.editFailed ||
    props.card.createFailed ||
    props.card.archiveFailed ||
    props.card.restoreFailed ||
    props.card.deleteFailed;
  const changed = () =>
    draft.laneId !== props.card.laneId ||
    draft.title !== props.card.title ||
    draft.description !== props.card.description ||
    draft.label !== props.card.label ||
    draft.priority !== props.card.priority ||
    draft.assignee !== props.card.assignee ||
    draft.dueDate !== props.card.dueDate;
  const save = (event: SubmitEvent) => {
    event.preventDefault();
    const card = {
      ...props.card,
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      assignee: draft.assignee.trim(),
      orderKey:
        draft.laneId === props.card.laneId
          ? props.card.orderKey
          : placementKey(props.cardState.cards, props.card.id, draft.laneId, ""),
    };
    const state = props.cardState;
    props.onClose();
    return card.createFailed ? state.retryCreateCard(card, true) : state.editCard(card, true);
  };
  const discardEdits = () => {
    const id = props.card.id;
    const state = props.cardState;
    props.onClose();
    state.discardCard(id);
  };

  return (
    <>
      <form
        onSubmit={save}
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.lg}px;
        `}
      >
        <CardFields draft={draft} setDraft={setDraft} lanes={lanes()} />
        <CardErrors card={props.card} variant="notice" />
        <div
          class={css`
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: ${space.sm}px;
          `}
        >
          <div
            class={css`
              display: flex;
              flex-wrap: wrap;
              gap: ${space.sm}px;
            `}
          >
            <Button type="submit" variant="primary" disabled={!changed() && !failed()}>
              <span>Save</span>
            </Button>
            <Button variant="ghost" onClick={discardEdits}>
              <span>Discard edits</span>
            </Button>
          </div>
          <div
            class={css`
              display: flex;
              flex-wrap: wrap;
              gap: ${space.sm}px;
            `}
          >
            <Button
              variant="danger"

              onClick={async () => {
                if (await props.cardState.archiveCard(props.card)) props.onClose();
              }}
            >
              <Icon name="archive" />
              <span>Archive</span>
            </Button>
            <Button
              variant="danger"

              onClick={async () => {
                if (await props.cardState.deleteCard(props.card)) props.onClose();
              }}
            >
              <Icon name="trash" />
              <span>Delete</span>
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

type CardDraft = Pick<
  db.Card,
  "laneId" | "title" | "description" | "label" | "priority" | "assignee" | "dueDate"
>;

function CardFields(props: {
  draft: CardDraft;
  setDraft: StoreSetter<CardDraft>;
  lanes: readonly db.Lane[];
}) {
  return (
    <>
      <Field label="Title">
        <Input
          autofocus
          value={props.draft.title}
          onInput={(event) => {
            const value = event.currentTarget.value;
            props.setDraft((draft) => {
              draft.title = value;
            });
          }}
          maxlength={160}
          required
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={props.draft.description}
          onInput={(event) => {
            const value = event.currentTarget.value;
            props.setDraft((draft) => {
              draft.description = value;
            });
          }}
          placeholder="Add a description…"
          maxlength={6e3}
        />
      </Field>
      <Field label="Lane">
        <Select
          value={props.draft.laneId}
          onChange={(event) => {
            const value = event.currentTarget.value;
            props.setDraft((draft) => {
              draft.laneId = value;
            });
          }}
        >
          <For each={[...props.lanes].sort((a, b) => a.position - b.position)}>
            {(lane) => <option value={lane.id}>{lane.title}</option>}
          </For>
        </Select>
      </Field>
      <div
        class={css`
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: ${space.lg}px;
          @media (max-width: ${breakpoints.phone}px) {
            grid-template-columns: minmax(0, 1fr);
          }
        `}
      >
        <Field label="Label">
          <Select
            value={props.draft.label}
            onChange={(event) => {
              const value = event.currentTarget.value;
              props.setDraft((draft) => {
                draft.label = value;
              });
            }}
          >
            <For each={labels}>
              {(label) => <option value={label}>{label || "No label"}</option>}
            </For>
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={props.draft.priority}
            onChange={(event) => {
              const value = event.currentTarget.value;
              props.setDraft((draft) => {
                draft.priority = value;
              });
            }}
          >
            <For each={priorities}>{(priority) => <option>{priority}</option>}</For>
          </Select>
        </Field>
        <Field label="Assigned to">
          <Input
            value={props.draft.assignee}
            onInput={(event) => {
              const value = event.currentTarget.value;
              props.setDraft((draft) => {
                draft.assignee = value;
              });
            }}
            placeholder="Name"
            maxlength={32}
          />
        </Field>
        <Field label="Due date">
          <Input
            type="date"
            value={props.draft.dueDate}
            onInput={(event) => {
              const value = event.currentTarget.value;
              props.setDraft((draft) => {
                draft.dueDate = value;
              });
            }}
          />
        </Field>
      </div>
    </>
  );
}
