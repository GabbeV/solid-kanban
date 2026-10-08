import { css } from "@csslit/core";
import { Show, createUniqueId, onCleanup } from "solid-js";
import type { ViewCard, CardState } from "./card-state";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Spinner } from "#/ui/Spinner.tsx";
import { colors, radius, space } from "#/theme.ts";

export function CardMenu(props: { card: ViewCard; cardState: CardState }) {
  const moving = () => props.card.moving === true || props.card.saving === true;
  const failed = () =>
    props.card.moveFailed ||
    props.card.editFailed ||
    props.card.createFailed ||
    props.card.archiveFailed ||
    props.card.restoreFailed ||
    props.card.deleteFailed;
  const menuId = createUniqueId();
  let menu!: HTMLDivElement;
  let trigger!: HTMLButtonElement;

  const dismissOutside = (event: PointerEvent) => {
    const path = event.composedPath();
    if (!path.includes(menu) && !path.includes(trigger)) menu.hidePopover();
  };
  onCleanup(() =>
    menu?.ownerDocument.removeEventListener(
      "pointerdown",
      dismissOutside,
      true,
    ),
  );

  const toggle = (event: MouseEvent & { currentTarget: HTMLButtonElement }) => {
    event.stopPropagation();
    // Toggle here so positioning runs immediately after opening. The native
    // popovertarget relationship keeps light-dismiss from closing it first.
    event.preventDefault();
    if (menu.matches(":popover-open")) {
      menu.hidePopover();
      return;
    }
    trigger = event.currentTarget;
    const triggerBounds = trigger.getBoundingClientRect();
    menu.showPopover({ source: trigger });
    const bounds = menu.getBoundingClientRect();
    const left =
      triggerBounds.left + bounds.width <= window.innerWidth - space.md
        ? triggerBounds.left
        : triggerBounds.right - bounds.width;
    menu.style.left = `${Math.max(space.md, Math.min(left, window.innerWidth - bounds.width - space.md))}px`;
    menu.style.top = `${Math.max(space.md, triggerBounds.bottom + space.xs + bounds.height <= window.innerHeight - space.md ? triggerBounds.bottom + space.xs : triggerBounds.top - bounds.height - space.xs)}px`;
  };

  return (
    <>
      <Button
        variant={failed() ? "danger-ghost" : "ghost"}
        iconOnly
        pad="sm"
        aria-label={`Actions for ${props.card.title}`}
        aria-haspopup="menu"
        popovertarget={menuId}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={toggle}
      >
        <Show when={moving()} fallback={<Icon name="more-vertical" />}>
          <Spinner variant={failed() ? "danger" : undefined} />
        </Show>
      </Button>
      <div
        id={menuId}
        ref={menu}
        popover="auto"
        role="menu"
        aria-label="Card actions"
        onBeforeToggle={(event) => {
          const document = event.currentTarget.ownerDocument;
          if (event.newState === "open")
            document.addEventListener("pointerdown", dismissOutside, true);
          else
            document.removeEventListener("pointerdown", dismissOutside, true);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        class={css`
          position: fixed;
          inset: auto;
          margin: 0;
          width: 180px;
          max-width: calc(100% - ${space.md * 2}px);
          max-height: calc(100% - ${space.md * 2}px);
          overflow: auto;
          padding: ${space.xs - 1}px;
          border: 1px solid ${colors.border};
          border-radius: ${radius.control}px;
          background: ${colors.paper};
          color: ${colors.ink};
          box-shadow: 0 4px 16px ${colors.shadowDialog};
          cursor: default;
          &:popover-open {
            display: flex;
            flex-direction: column;
          }
        `}
      >
        <Button
          role="menuitem"
          variant="ghost"
          align="start"

          onClick={() => {
            menu.hidePopover();
            return props.cardState.archiveCard(props.card);
          }}
        >
          <Icon name="archive" />
          <span>Archive</span>
        </Button>
        <Button
          role="menuitem"
          variant="danger-ghost"
          align="start"

          onClick={() => {
            menu.hidePopover();
            return props.cardState.deleteCard(props.card);
          }}
        >
          <Icon name="trash" />
          <span>Delete</span>
        </Button>
      </div>
    </>
  );
}
