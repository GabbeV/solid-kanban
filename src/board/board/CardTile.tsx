import { css } from "@csslit/core";
import { Show, untrack } from "solid-js";
import { useLocation } from "@solidjs/router";
import type { ViewCard } from "../cards";
import {
  colors,
  radius,
  space,
  fontSize,
  lineHeight,
  iconBox,
  motion,
} from "#/theme.ts";
import { Avatar } from "#/ui/Avatar.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { CardFlash } from "./CardFlash";
import { CardMenu } from "./CardMenu";
import { CardLabel } from "#/ui/CardLabel.tsx";
import { dialogState } from "#/nav.ts";

const cardMenuSize = iconBox.sm;

export function CardTile(props: {
  card: ViewCard;
  drag?: {
    activeId: () => string | undefined;
    pointerDown: (event: PointerEvent, id: string) => void;
    click: (event: MouseEvent) => void;
  };
  onRemoved?: (id: string) => void;
  onRetry?: () => void;
  onDiscard?: () => void;
  commentCount?: number;
}) {
  const location = useLocation();
  const failed = () =>
    props.card.moveFailed || props.card.editFailed || props.card.createFailed;
  // Workaround for https://github.com/solidjs/solid/issues/3706:
  // a keyed tile keeps the same ID even when its optimistic card value changes.
  const cardId = untrack(() => props.card.id);
  const dragging = () => props.drag?.activeId() === cardId;
  const hasFooter = () =>
    props.card.priority !== "Normal" ||
    (props.commentCount ?? 0) > 0 ||
    !!props.card.due ||
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
      <Show when={failed()}>
        <>
          <CardFlash tone="rejected" event={props.card.id} />
          <span
            class={css`
              position: absolute;
              top: 3px;
              right: 3px;
              z-index: 3;
              display: grid;
              place-items: center;
              width: ${cardMenuSize}px;
              height: ${cardMenuSize}px;
              border-radius: 4px;
              background: ${colors.paper};
              color: ${colors.rejectedMove};
              pointer-events: none;
              animation: card-rejected-actions ${motion.cardFeedbackMs}ms
                ease-out forwards;
              @keyframes card-rejected-actions {
                0%,
                80% {
                  opacity: 1;
                }
                100% {
                  opacity: 0;
                }
              }
              @media (prefers-reduced-motion: reduce) {
                animation-timing-function: step-end;
              }
            `}
          >
            <Icon name="exclamation" />
          </span>
        </>
      </Show>
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
          href={`/b/${props.card.boardId}/card/${props.card.id}${location.search}`}
          state={JSON.stringify(dialogState)}
          draggable="false"
        >
          {props.card.title}
        </a>
        <div
          class={css`
            position: absolute;
            top: 3px;
            right: 3px;
            display: grid;
            place-items: center;
            width: ${cardMenuSize}px;
            height: ${cardMenuSize}px;
            color: ${colors.handle};
          `}
        >
          <Show when={props.onRemoved} fallback={<Icon name="more-vertical" />}>
            <CardMenu
              card={props.card}
              onRemoved={(id) => props.onRemoved?.(id)}
            />
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
      <Show when={failed()}>
        <div
          role="status"
          class={css`
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: ${space.xs}px;
            padding: 7px;
            border: 1px solid ${colors.dangerBorder};
            border-radius: 7px;
            background: ${colors.dangerSurface};
            color: ${colors.danger};
            font-size: ${fontSize.body}px;
            cursor: default;
          `}
        >
          <Icon name="exclamation" />
          <span>
            {props.card.createFailed
              ? "Creation not confirmed."
              : props.card.editFailed
                ? "Changes not confirmed."
                : "Move not confirmed."}
          </span>
          <button
            type="button"
            data-move-action
            class={css`
              padding: ${space.xs}px;
              color: inherit;
              font-weight: 700;
              cursor: pointer;
            `}
            onClick={() => props.onRetry?.()}
          >
            Retry
          </button>
          <button
            type="button"
            data-move-action
            class={css`
              padding: ${space.xs}px;
              color: inherit;
              cursor: pointer;
            `}
            onClick={() => props.onDiscard?.()}
          >
            Discard
          </button>
        </div>
      </Show>
      <Show when={hasFooter()}>
        <hr
          class={css`
            width: 100%;
            margin: 0;
            border: 0;
            border-top: 1px solid ${colors.borderSubtle};
          `}
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
            <Show when={props.card.due}>
              <span
                class={css`
                  display: inline-flex;
                  align-items: center;
                  gap: ${space.xs}px;
                  padding: ${space.xs}px;
                `}
              >
                <Icon name="calendar" />
                <span>{props.card.due.slice(5)}</span>
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
