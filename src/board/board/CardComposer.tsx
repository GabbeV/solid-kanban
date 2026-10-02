import { css } from "@csslit/core";
import { Show, createSignal, flush, onSettled } from "solid-js";
import type { Column } from "../../module_bindings/types";
import { control, colors, radius, space } from "#/theme.ts";
import { Icon } from "#/ui/Icon.tsx";
import { Input } from "#/ui/Input.tsx";
import type { CardState } from "../cards";
import { placementKey } from "#/domain/cards.ts";
import { useName } from "#/name.tsx";

export function CardComposer(
  props: { column: Column } & Pick<CardState, "cards" | "createCard">,
) {
  const { name } = useName();
  const [open, setOpen] = createSignal(false);
  const [title, setTitle] = createSignal("");
  let button: HTMLButtonElement | undefined;
  let input: HTMLInputElement | undefined;
  const close = () => {
    setOpen(false);
    onSettled(() => button?.focus());
  };
  const add = (event: SubmitEvent) => {
    event.preventDefault();
    const text = title().trim();
    if (!text) return;
    const id = crypto.randomUUID();
    const card = {
      id,
      boardId: props.column.boardId,
      columnId: props.column.id,
      title: text,
      description: "",
      label: "",
      priority: "Normal",
      assignee: name(),
      due: "",
      position: 0,
      revision: 0,
      archived: false,
      orderKey: placementKey(
        props.cards,
        id,
        props.column.id,
        "",
        crypto.randomUUID().replaceAll("-", ""),
      ),
      moveVersion: 0,
      moveId: "",
    };
    setTitle("");
    // Commit the input reset before the creation action holds its update.
    flush();
    input?.focus();
    void props.createCard(card);
  };

  return (
    <>
      <Show
        when={open()}
        fallback={
          <button
            ref={button}
            class={css`
              width: 100%;
              display: flex;
              align-items: center;
              gap: ${space.xs}px;
              text-align: left;
              padding: ${space.md}px;
              font-size: ${control.fontSize}px;

              color: ${colors.handle};
              border-radius: ${radius.small}px;
              body:not(:has([data-dragging])) &:hover {
                background: ${colors.hover};
                color: ${colors.ink};
              }
            `}
            onClick={() => setOpen(true)}
          >
            <Icon name="plus" />
            <span>Add a card</span>
          </button>
        }
      >
        <form
          class={css`
            min-width: 0;
          `}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
          onSubmit={add}
        >
          <Input
            type="text"
            aria-label={`New card in ${props.column.title}`}
            placeholder="Title"
            value={title()}
            onInput={(event) => setTitle(event.currentTarget.value)}
            onBlur={(event) => {
              if (!event.currentTarget.value.trim()) {
                setTitle("");
                setOpen(false);
              }
            }}
            maxlength={160}
            required
            ref={(element) => {
              input = element;
              onSettled(() => element.focus());
            }}
            autofocus
          />
        </form>
      </Show>
    </>
  );
}
