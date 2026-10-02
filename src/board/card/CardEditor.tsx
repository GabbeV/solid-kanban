import type { CardState } from "../cards";
import { Show, Loading } from "solid-js";
import { Dialog } from "#/ui/Dialog.tsx";
import { CardEditorContents } from "./CardEditorContents";
import { CardEditorSkeleton } from "./CardEditorSkeleton";

// The no-comment editor's border-box heights at the two field-grid layouts.
// Dialog centers this baseline so loaded comments extend downward.
const baselineHeight = { wide: 594, phone: 726 };

export function CardEditor(props: {
  cardState: CardState;
  id: string;
  pending: boolean;
  onClose: () => void;
}) {
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
          <CardEditorContents
            id={props.id}
            cardState={props.cardState}
            onClose={() => props.onClose()}
          />
        </Loading>
      </Show>
    </Dialog>
  );
}
