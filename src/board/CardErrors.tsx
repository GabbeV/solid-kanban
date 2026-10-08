import type { CardFailure, CardState, ViewCard } from "#/board/card-state.ts";

import { css } from "@csslit/core";
import { For, Show } from "solid-js";

import { colors, fontSize, lineHeight, radius, space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";

export function CardErrors(props: { card: ViewCard; cardState?: CardState; variant?: "notice" }) {
  const failures = [
    {
      flag: "changes",
      label: "changes",
      message: "Changes not confirmed",
      visible: () => props.card.createFailed || props.card.editFailed || props.card.moveFailed,
      retry: () =>
        props.card.createFailed
          ? props.cardState?.retryCreateCard(props.card)
          : props.card.editFailed
            ? props.cardState?.editCard(props.card)
            : props.cardState?.moveCard({
                boardId: props.card.boardId,
                id: props.card.id,
                laneId: props.card.laneId,
                orderKey: props.card.orderKey,
              }),
    },
    {
      flag: "archiveFailed",
      label: "archive",
      message: "Archive not confirmed",
      visible: () => props.card.archiveFailed,
      retry: () => props.cardState?.archiveCard(props.card),
    },
    {
      flag: "restoreFailed",
      label: "restore",
      message: "Restore not confirmed",
      visible: () => props.card.restoreFailed,
      retry: () => props.cardState?.restoreCard(props.card),
    },
    {
      flag: "deleteFailed",
      label: "deletion",
      message: "Deletion not confirmed",
      visible: () => props.card.deleteFailed,
      retry: () => props.cardState?.deleteCard(props.card),
    },
  ] satisfies {
    flag: Exclude<CardFailure, "createFailed" | "editFailed" | "moveFailed"> | "changes";
    label: string;
    message: string;
    visible: () => boolean | undefined;
    retry: () => unknown;
  }[];
  const visible = () => failures.filter((failure) => failure.visible());

  return (
    <Show when={visible().length}>
      <div
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.md}px;
          min-width: 0;
        `}
      >
        <For each={visible()} keyed={(failure) => failure.flag}>
          {(failure) => (
            <div
              role={props.variant === "notice" ? "alert" : "status"}
              class={[
                css`
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: ${space.sm}px;
                  font-size: ${fontSize.body}px;
                  color: ${colors.danger};
                  cursor: default;
                `,
                props.variant === "notice" &&
                  css`
                    border: 1px solid ${colors.dangerBorder};
                    border-radius: ${radius.control}px;
                    padding: ${space.md - 1}px;
                    background: ${colors.dangerSurface};
                  `,
              ]}
            >
              <span
                class={css`
                  min-width: 0;
                  line-height: ${lineHeight.body}px;
                `}
              >
                {failure().message}
              </span>
              <Show when={props.cardState}>
                <div
                  class={css`
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                    gap: ${space.xs}px;
                  `}
                >
                  <Button
                    variant="danger-ghost"
                    iconOnly
                    pad="sm"
                    bleed="block"
                    aria-label={`Retry ${failure().label}`}
                    title={`Retry ${failure().label}`}
                    data-move-action

                    onClick={() => failure().retry()}
                  >
                    <Icon name="retry" />
                  </Button>
                  <Button
                    variant="danger-ghost"
                    iconOnly
                    pad="sm"
                    bleed={["block", "inline-end"]}
                    aria-label={`${failure().flag === "changes" ? "Discard" : "Dismiss"} ${failure().label}`}
                    title={`${failure().flag === "changes" ? "Discard" : "Dismiss"} ${failure().label}`}
                    data-move-action

                    onClick={() => props.cardState?.dismissError(props.card.id, failure().flag)}
                  >
                    <Icon name="close" />
                  </Button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
