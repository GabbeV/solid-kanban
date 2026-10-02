import { css } from "@csslit/core";
import { Show } from "solid-js";
import { space, fontSize, lineHeight, colors } from "#/theme.ts";
import type { CardState } from "../cards";
import { CardEditorForm } from "./CardEditorForm";
import { CardComments } from "./CardComments";

export function CardEditorContents(props: {
  id: string;
  cardState: CardState;
  onClose: () => void;
}) {
  const card = () => props.cardState.cards.find((card) => card.id === props.id);
  return (
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
        editCard={props.cardState.editCard}
        createCard={props.cardState.createCard}
        removeCard={props.cardState.removeCard}
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
  );
}
