import { css } from "@csslit/core";
import { For, createStore, untrack } from "solid-js";
import { labels, placementKey, priorities } from "../cards";
import { space, breakpoints } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Field } from "#/ui/Field.tsx";
import { Input } from "#/ui/Input.tsx";
import { Select } from "#/ui/Select.tsx";
import { Textarea } from "#/ui/Textarea.tsx";
import { Icon } from "#/ui/Icon.tsx";
import type { CardState, ViewCard } from "../card-state";
import { CardErrors } from "../CardErrors";
import { tables } from "#/module_bindings/index.ts";
import { useTable } from "#/spacetimedb.tsx";

export function CardEditorForm(props: {
  card: ViewCard;
  cardState: CardState;
  onClose: () => void;
}) {
  const lanes = useTable(() =>
    tables.lane.where((lane) => lane.boardId.eq(props.card.boardId)),
  );
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
          : placementKey(
              props.cardState.cards,
              props.card.id,
              draft.laneId,
              "",
            ),
    };
    const state = props.cardState;
    props.onClose();
    return card.createFailed
      ? state.retryCreateCard(card, true)
      : state.editCard(card, true);
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
        <Field label="Title">
          <Input
            autofocus
            value={draft.title}
            onInput={(event) => {
              const value = event.currentTarget.value;
              setDraft((draft) => {
                draft.title = value;
              });
            }}
            maxlength={160}
            required
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={draft.description}
            onInput={(event) => {
              const value = event.currentTarget.value;
              setDraft((draft) => {
                draft.description = value;
              });
            }}
            placeholder="Add a description…"
            maxlength={6e3}
          />
        </Field>
        <Field label="Lane">
          <Select
            value={draft.laneId}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDraft((draft) => {
                draft.laneId = value;
              });
            }}
          >
            <For each={[...lanes()].sort((a, b) => a.position - b.position)}>
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
              value={draft.label}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((draft) => {
                  draft.label = value;
                });
              }}
            >
              <For each={labels}>
                {(label) => (
                  <option value={label}>{label || "No label"}</option>
                )}
              </For>
            </Select>
          </Field>
          <Field label="Priority">
            <Select
              value={draft.priority}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((draft) => {
                  draft.priority = value;
                });
              }}
            >
              <For each={priorities}>
                {(priority) => <option>{priority}</option>}
              </For>
            </Select>
          </Field>
          <Field label="Assigned to">
            <Input
              value={draft.assignee}
              onInput={(event) => {
                const value = event.currentTarget.value;
                setDraft((draft) => {
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
              value={draft.dueDate}
              onInput={(event) => {
                const value = event.currentTarget.value;
                setDraft((draft) => {
                  draft.dueDate = value;
                });
              }}
            />
          </Field>
        </div>
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
            <Button
              type="submit"
              variant="primary"
              disabled={!changed() && !failed()}
            >
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
                if (await props.cardState.archiveCard(props.card))
                  props.onClose();
              }}
            >
              <Icon name="archive" />
              <span>Archive</span>
            </Button>
            <Button
              variant="danger"

              onClick={async () => {
                if (await props.cardState.deleteCard(props.card))
                  props.onClose();
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
