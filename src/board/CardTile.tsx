import { css } from "@csslit/core";
import { Show } from "solid-js";
import { useLocation, useParams } from "@solidjs/router";
import type { ViewCard, CardState } from "./card-state";
import {
  colors,
  radius,
  space,
  fontSize,
  lineHeight,
  iconBox,
} from "#/theme.ts";
import { Avatar } from "#/ui/Avatar.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { CardMenu } from "./CardMenu";
import { CardErrors } from "./CardErrors";
import { CardLabel } from "#/board/CardLabel.tsx";
import { dialogState } from "#/nav.ts";

const cardMenuSize = iconBox.sm;

export type CardDrag = {
  activeId: () => string | undefined;
  pointerDown: (event: PointerEvent, id: string) => void;
  click: (event: MouseEvent) => void;
};

export function CardTile(props: {
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
