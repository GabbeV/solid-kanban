import type { CardState, ViewCard } from "#/board/card-state.ts";

import { css } from "@csslit/core";
import { useLocation, useParams } from "@solidjs/router";
import { Show, createUniqueId, onCleanup } from "solid-js";

import { CardErrors } from "#/board/CardErrors.tsx";
import { CardLabel } from "#/board/CardLabel.tsx";
import { dialogState } from "#/nav.ts";
import { colors, fontSize, iconBox, lineHeight, radius, space } from "#/theme.ts";
import { Avatar } from "#/ui/Avatar.tsx";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Spinner } from "#/ui/Spinner.tsx";

const cardMenuSize = iconBox.sm;

export type CardDrag = {
  activeId: () => string | undefined;
  pointerDown: (event: PointerEvent, id: string) => void;
  click: (event: MouseEvent) => void;
};

export function Card(props: {
  card: ViewCard;
  drag?: CardDrag;
  cardState?: CardState;
  commentCount?: number;
}) {
  const location = useLocation();
  const params = useParams();
  const failed = () =>
    props.card.moveFailed ||
    props.card.editFailed ||
    props.card.createFailed ||
    props.card.archiveFailed ||
    props.card.restoreFailed ||
    props.card.deleteFailed;

  const dragging = () => props.drag?.activeId() === props.card.id;
  const hasFooter = () =>
    props.card.priority !== "Normal" ||
    (props.commentCount ?? 0) > 0 ||
    !!props.card.dueDate ||
    !!props.card.assignee;

  return (
    <article
      class={[
        css`
          position: relative;
          display: flex;
          flex-direction: column;
          gap: ${space.md}px;
          background: ${colors.paper};
          border: 1px solid ${colors.border};
          border-radius: ${radius.card}px;
          padding: 11px;
          box-shadow: 0 2px 2px ${colors.shadowSoft};
          user-select: none;
          cursor: grab;
          transition:
            border-color 0.15s,
            box-shadow 0.15s;
          @media (prefers-reduced-motion: reduce) {
            transition: none;
          }
          body:not(:has([data-dragging])) &:hover {
            border-color: ${colors.borderHover};
            box-shadow: 0 3px 8px ${colors.shadowHover};
          }

          &:has(a:focus-visible) {
            outline: 2px solid ${colors.focus};
            outline-offset: 2px;
          }
        `,
        failed() &&
          css`
            background: ${colors.dangerSurface};
            border-color: ${colors.dangerBorder};

            body:not(:has([data-dragging])) &:hover {
              border-color: ${colors.dangerBorder};
            }
          `,
        dragging() &&
          css`
            border-style: dashed;
            cursor: grabbing;
          `,
      ]}
      data-card-id={props.card.id}
      data-dragging={dragging() || undefined}
      onPointerDown={(event) => props.drag?.pointerDown(event, props.card.id)}
      onClick={(event) => props.drag?.click(event)}
    >
      <div
        class={css`
          display: flow-root;
          &::before {
            content: "";
            float: right;
            /* The menu bleeds into the top/right padding; the gap below
               provides clearance without increasing a short title's height. */
            width: ${cardMenuSize - space.sm}px;
            height: ${cardMenuSize - space.sm}px;
            margin-bottom: -${space.sm}px;
            margin-left: ${space.sm}px;
          }
        `}
      >
        <Show when={props.card.label}>
          <div
            class={css`
              display: flex;
              align-items: center;
              margin-bottom: ${space.md}px;
            `}
          >
            <CardLabel label={props.card.label} />
          </div>
        </Show>
        <a
          class={css`
            display: block;
            font-size: ${fontSize.control}px;
            line-height: ${lineHeight.control}px;

            font-weight: 560;
            letter-spacing: -0.01em;
            overflow-wrap: anywhere;
            body:not(:has([data-dragging])) &:hover {
              color: ${colors.accent};
            }
            &:focus-visible {
              outline: none;
            }
          `}
          href={`${params.boardId ? `/b/${props.card.boardId}` : ""}/card/${props.card.id}${location.search}`}
          state={JSON.stringify(dialogState)}
          draggable="false"
        >
          {props.card.title}
        </a>
        <div
          class={[
            css`
              position: absolute;
              top: 3px;
              right: 3px;
              display: grid;
              place-items: center;
              width: ${cardMenuSize}px;
              height: ${cardMenuSize}px;
              color: ${colors.handle};
            `,
            failed() &&
              css`
                color: ${colors.danger};
              `,
          ]}
        >
          <Show when={props.cardState} fallback={<Icon name="more-vertical" />}>
            <CardMenu card={props.card} cardState={props.cardState!} />
          </Show>
        </div>
        <Show when={props.card.description}>
          <p
            class={css`
              clear: both;
              margin-top: ${space.md}px;
              font-size: ${fontSize.body}px;
              line-height: ${lineHeight.body}px;

              color: ${colors.muted};
              display: -webkit-box;
              text-box-edge: text;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            `}
          >
            {props.card.description}
          </p>
        </Show>
      </div>
      <CardErrors card={props.card} cardState={props.cardState} />
      <Show when={hasFooter()}>
        <hr
          class={[
            css`
              width: 100%;
              margin: 0;
              border: 0;
              border-top: 1px solid ${colors.borderSubtle};
            `,
            failed() &&
              css`
                border-top-color: ${colors.dangerBorder};
              `,
          ]}
        />
        <div
          class={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: ${space.xs}px;
            font-size: ${fontSize.body}px;

            color: ${colors.muted};
          `}
        >
          <div
            class={css`
              display: flex;
              align-items: center;
              gap: ${space.xs}px;
              margin-inline-start: -${space.xs}px;
            `}
          >
            <Show when={props.card.priority !== "Normal"}>
              <span
                class={css`
                  display: inline-flex;
                  align-items: center;
                  gap: ${space.xs}px;
                  padding: ${space.xs}px;
                `}
                title={`${props.card.priority} priority`}
              >
                <Icon name="flag" />
                <span>{props.card.priority}</span>
              </span>
            </Show>
            <Show when={(props.commentCount ?? 0) > 0}>
              <span
                class={css`
                  display: inline-flex;
                  align-items: center;
                  gap: ${space.xs}px;
                  padding: ${space.xs}px;
                `}
                title="Comments"
              >
                <Icon name="comment" />
                <span>{props.commentCount}</span>
              </span>
            </Show>
            <Show when={props.card.dueDate}>
              <span
                class={css`
                  display: inline-flex;
                  align-items: center;
                  gap: ${space.xs}px;
                  padding: ${space.xs}px;
                `}
              >
                <Icon name="calendar" />
                <span>{props.card.dueDate.slice(5)}</span>
              </span>
            </Show>
          </div>
          <Show when={props.card.assignee}>
            <Avatar name={props.card.assignee} variant="compact" />
          </Show>
        </div>
      </Show>
    </article>
  );
}

function CardMenu(props: { card: ViewCard; cardState: CardState }) {
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

  onCleanup(() => menu?.ownerDocument.removeEventListener("pointerdown", dismissOutside, true));

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
        ref={(element) => {
          menu = element;
        }}
        popover="auto"
        role="menu"
        aria-label="Card actions"
        onBeforeToggle={(event) => {
          const document = event.currentTarget.ownerDocument;
          if (event.newState === "open")
            document.addEventListener("pointerdown", dismissOutside, true);
          else document.removeEventListener("pointerdown", dismissOutside, true);
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
