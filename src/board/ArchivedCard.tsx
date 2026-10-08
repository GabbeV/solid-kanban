import { css } from "@csslit/core";
import { Show } from "solid-js";
import { space, breakpoints, colors, fontSize, lineHeight } from "#/theme.ts";
import { Icon } from "#/ui/Icon.tsx";
import { Button } from "#/ui/Button.tsx";
import { CardLabel } from "./CardLabel";
import { CardErrors } from "./CardErrors";
import type { CardState, ViewCard } from "./card-state";

export function ArchivedCard(props: {
  card: ViewCard;
  cardState: CardState;
  laneTitle?: string;
}) {
  return (
    <article
      aria-label={props.card.title}
      class={css`
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: ${space.sm}px ${space.lg}px;
        min-width: 0;
        padding: 15px;
        border-bottom: 1px solid ${colors.borderSubtle};
        &:last-child {
          border-bottom: 0;
        }
        @media (max-width: ${breakpoints.phone}px) {
          padding: 11px;
          column-gap: ${space.md}px;
        }
      `}
    >
      <div
        class={css`
          grid-column: 1;
          grid-row: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: ${space.sm}px;
          @media (max-width: ${breakpoints.phone}px) {
            grid-column: 1 / -1;
          }
        `}
      >
        <h3
          class={css`
            font-size: ${fontSize.control}px;
            line-height: ${lineHeight.control}px;

            font-weight: 600;
            letter-spacing: -0.01em;
            overflow-wrap: anywhere;
          `}
        >
          {props.card.title}
        </h3>
        <Show when={props.card.description}>
          <p
            class={css`
              display: -webkit-box;
              text-box-edge: text;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
              overflow-wrap: anywhere;
              font-size: ${fontSize.body}px;
              line-height: ${lineHeight.body}px;

              color: ${colors.muted};
            `}
          >
            {props.card.description}
          </p>
        </Show>
      </div>
      <div
        class={css`
          grid-column: 1;
          grid-row: 2;
          min-width: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: ${space.sm}px ${space.md}px;
          font-size: ${fontSize.caption}px;

          color: ${colors.muted};
        `}
      >
        <span
          class={css`
            display: inline-flex;
            align-items: center;
            gap: ${space.xs}px;
            min-width: 0;
            overflow-wrap: anywhere;
            line-height: ${lineHeight.caption}px;
          `}
          title="Original lane"
        >
          <Icon name="board" />
          <span
            class={css`
              min-width: 0;
            `}
          >
            {props.laneTitle}
          </span>
        </span>
        <Show when={props.card.label}>
          <CardLabel label={props.card.label} />
        </Show>
        <Show when={props.card.assignee}>
          <span
            class={css`
              overflow-wrap: anywhere;
              min-width: 0;
              line-height: ${lineHeight.caption}px;
            `}
          >
            {props.card.assignee}
          </span>
        </Show>
      </div>
      <div
        class={css`
          grid-column: 2;
          grid-row: 1 / span 2;
          justify-self: end;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: ${space.sm}px;
          min-width: 0;
          max-width: 180px;
          @media (max-width: ${breakpoints.phone}px) {
            grid-row: 2;
          }
        `}
      >
        <Button
          variant={props.card.restoreFailed ? "danger" : undefined}

          onClick={() => props.cardState.restoreCard(props.card)}
        >
          <Icon name="restore" />
          <span>Restore</span>
        </Button>
        <CardErrors card={props.card} cardState={props.cardState} />
      </div>
    </article>
  );
}
