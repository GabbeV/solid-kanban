import type { CardState } from "../card-state";
import { Show, Loading } from "solid-js";
import { Dialog } from "#/ui/Dialog.tsx";
import { css } from "@csslit/core";
import { space, fontSize, lineHeight, colors } from "#/theme.ts";
import { CardEditorForm } from "./CardEditorForm";
import { CardComments } from "./CardComments";
import { CardEditorSkeleton } from "./CardEditorSkeleton";

// The no-comment editor's border-box heights at the two field-grid layouts.
// Dialog centers this baseline so loaded comments extend downward.
const baselineHeight = { wide: 660, phone: 792 };

export function CardEditor(props: {
  cardState: CardState;
  id: string;
  pending: boolean;
  onClose: () => void;
}) {
  const card = () => props.cardState.cards.find((card) => card.id === props.id);
  return (
    <Dialog
      title="Edit card"
      baselineHeight={baselineHeight}
      onClose={() => props.onClose()}
      returnFocus={() =>
        document.querySelector<HTMLElement>(
          `[data-card-id="${CSS.escape(props.id)}"] a`,
        )
      }
    >
      <Show when={!props.pending} fallback={<CardEditorSkeleton />}>
        <Loading fallback={<CardEditorSkeleton />}>
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
                  It may have been removed, or the link belongs to another
                  board.
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
        </Loading>
      </Show>
    </Dialog>
  );
}
