import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import type { Card } from "#/module_bindings/types.ts";
import { Show } from "solid-js";
import { createCardActions } from "./cardActions";
import { Notice } from "#/ui/Notice.tsx";

export function ArchiveCardButton(props: {
  card: Card;
  onSaved?: () => void;
  disabled?: boolean;
}) {
  const actions = createCardActions({
    card: () => props.card,
    disabled: () => props.disabled === true,
    onArchived: () => props.onSaved?.(),
  });
  return (
    <>
      <Button
        variant={props.card.archived ? undefined : "danger"}
        disabled={actions.pending() || props.disabled}
        onClick={actions.archive}
      >
        <Icon name={props.card.archived ? "restore" : "archive"} />
        <span>
          {actions.error()
            ? "Retry"
            : props.card.archived
              ? "Restore"
              : "Archive"}
        </span>
      </Button>
      <Show when={actions.error() && !actions.pending()}>
        <Notice role="alert">{actions.error()}</Notice>
      </Show>
    </>
  );
}
