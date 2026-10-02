import { css } from "@csslit/core";
import { Show, createUniqueId } from "solid-js";
import type { ViewCard } from "../cards";
import { createCardActions } from "../card/cardActions";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Notice } from "#/ui/Notice.tsx";
import { colors, radius, space } from "#/theme.ts";

export function CardMenu(props: {
  card: ViewCard;
  onRemoved: (id: string) => void;
}) {
  const moving = () => props.card.moving === true || props.card.saving === true;
  const actions = createCardActions({
    card: () => props.card,
    disabled: moving,
    onArchived: (id) => props.onRemoved(id),
    onDeleted: (id) => props.onRemoved(id),
  });
  const busy = () => moving() || actions.pending();
  const menuId = createUniqueId();
  let menu!: HTMLDivElement;

  const toggle = (event: MouseEvent & { currentTarget: HTMLButtonElement }) => {
    event.stopPropagation();
    // Toggle here so positioning runs immediately after opening. The native
    // popovertarget relationship keeps light-dismiss from closing it first.
    event.preventDefault();
    if (menu.matches(":popover-open")) {
      menu.hidePopover();
      return;
    }
    const trigger = event.currentTarget.getBoundingClientRect();
    menu.showPopover({ source: event.currentTarget });
    const bounds = menu.getBoundingClientRect();
    const left =
      trigger.left + bounds.width <= window.innerWidth - space.md
        ? trigger.left
        : trigger.right - bounds.width;
    menu.style.left = `${Math.max(space.md, Math.min(left, window.innerWidth - bounds.width - space.md))}px`;
    menu.style.top = `${Math.max(space.md, trigger.bottom + space.xs + bounds.height <= window.innerHeight - space.md ? trigger.bottom + space.xs : trigger.top - bounds.height - space.xs)}px`;
  };

  return (
    <>
      <Button
        variant="ghost"
        iconOnly
        pad="sm"
        aria-label={`Actions for ${props.card.title}`}
        aria-haspopup="menu"
        popovertarget={menuId}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={toggle}
      >
        <Show when={busy()} fallback={<Icon name="more-vertical" />}>
          <span
            class={css`
              width: 11px;
              height: 11px;
              margin: -1px;
              border: 1px solid ${colors.border};
              border-top-color: ${colors.accent};
              border-radius: 50%;
              animation: card-saving 0.8s linear infinite;
              @keyframes card-saving {
                to {
                  transform: rotate(360deg);
                }
              }
              @media (prefers-reduced-motion: reduce) {
                animation: none;
              }
            `}
          />
        </Show>
      </Button>
      <div
        id={menuId}
        ref={menu}
        popover="auto"
        role="menu"
        aria-label="Card actions"
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
          disabled={busy()}
          onClick={() => {
            menu.hidePopover();
            return actions.archive();
          }}
        >
          <Icon name="archive" />
          <span>Archive</span>
        </Button>
        <Button
          role="menuitem"
          variant="danger-ghost"
          align="start"
          disabled={busy()}
          onClick={() => {
            menu.hidePopover();
            return actions.remove();
          }}
        >
          <Icon name="trash" />
          <span>Delete</span>
        </Button>
        <Show when={actions.error() && !actions.pending()}>
          <Notice>{actions.error()}</Notice>
        </Show>
      </div>
    </>
  );
}
