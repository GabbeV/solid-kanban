import { css } from "@csslit/core";
import { For, Show, createStore, untrack } from "solid-js";
import { labels, priorities } from "#/domain/cards.ts";
import { space, breakpoints } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Field } from "#/ui/Field.tsx";
import { Input } from "#/ui/Input.tsx";
import { Notice } from "#/ui/Notice.tsx";
import { Select } from "#/ui/Select.tsx";
import { Textarea } from "#/ui/Textarea.tsx";
import { Icon } from "#/ui/Icon.tsx";
import type { CardState, ViewCard } from "../cards";
import { createCardActions } from "./cardActions";

export function CardEditorForm(
  props: { card: ViewCard; onClose: () => void } & Pick<
    CardState,
    "editCard" | "createCard" | "removeCard"
  >,
) {
  const [draft, setDraft] = createStore(
    untrack(() => ({
      title: props.card.title,
      description: props.card.description,
      label: props.card.label,
      priority: props.card.priority,
      assignee: props.card.assignee,
      due: props.card.due,
    })),
  );
  const saving = () => props.card.saving === true;
  const actions = createCardActions({
    card: () => props.card,
    disabled: saving,
    onArchived: (id) => {
      props.removeCard(id);
      props.onClose();
    },
    onDeleted: (id) => {
      props.removeCard(id);
      props.onClose();
    },
  });
  const pending = () => saving() || actions.pending();
  const failed = () => props.card.editFailed || props.card.createFailed;
  const changed = () =>
    draft.title !== props.card.title ||
    draft.description !== props.card.description ||
    draft.label !== props.card.label ||
    draft.priority !== props.card.priority ||
    draft.assignee !== props.card.assignee ||
    draft.due !== props.card.due;
  const save = (event: SubmitEvent) => {
    event.preventDefault();
    if (pending()) return;
    const card = {
      ...props.card,
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      assignee: draft.assignee.trim(),
    };
    setDraft((draft) => {
      draft.title = card.title;
      draft.description = card.description;
      draft.assignee = card.assignee;
    });
    return card.createFailed ? props.createCard(card) : props.editCard(card);
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
            disabled={pending()}
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
            disabled={pending()}
          />
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
              disabled={pending()}
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
              disabled={pending()}
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
              disabled={pending()}
            />
          </Field>
          <Field label="Due date">
            <Input
              type="date"
              value={draft.due}
              onInput={(event) => {
                const value = event.currentTarget.value;
                setDraft((draft) => {
                  draft.due = value;
                });
              }}
              disabled={pending()}
            />
          </Field>
        </div>
        <Show when={failed() && !pending()}>
          <Notice role="alert">
            {props.card.createFailed
              ? "Creation not confirmed."
              : "Changes not confirmed."}{" "}
            Your values are kept. Retry saving to confirm them.
          </Notice>
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
          <Button
            type="submit"
            variant="primary"
            disabled={pending() || (!changed() && !failed())}
          >
            <span>{failed() ? "Retry saving" : "Save"}</span>
          </Button>
          <div
            class={css`
              display: flex;
              flex-wrap: wrap;
              gap: ${space.sm}px;
            `}
          >
            <Button
              variant="danger"
              disabled={pending()}
              onClick={actions.archive}
            >
              <Icon name="archive" />
              <span>Archive</span>
            </Button>
            <Button
              variant="danger"
              disabled={pending()}
              onClick={actions.remove}
            >
              <Icon name="trash" />
              <span>Delete</span>
            </Button>
          </div>
        </div>
      </form>
      <Show when={actions.error() && !actions.pending()}>
        <Notice role="alert">{actions.error()}</Notice>
      </Show>
    </>
  );
}
