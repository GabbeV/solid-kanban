import { css } from "@csslit/core";
import type { JSX } from "@solidjs/web";
import { onSettled, onCleanup } from "solid-js";
import {
  colors,
  radius,
  space,
  fontSize,
  lineHeight,
  breakpoints,
} from "#/theme.ts";
import { Icon } from "./Icon";
import { Button } from "./Button";

export function Dialog(props: {
  title: string;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
  /** Center this height, then let taller content extend down into the scroll. */
  baselineHeight?: { wide: number; phone: number };
  children: JSX.Element;
}) {
  let element!: HTMLDialogElement;
  let disposed = false;
  function dismiss() {
    if (!element?.open) return;
    element.close();
    const returnFocus = props.returnFocus;
    if (returnFocus)
      onSettled(() => {
        // Resolve after removal: live updates may have replaced the opener.
        if (!document.querySelector("dialog[open]"))
          returnFocus()?.focus({ preventScroll: true });
      });
  }
  function close() {
    dismiss();
    props.onClose();
  }
  onCleanup(() => {
    disposed = true;
    dismiss();
  });
  return (
    <dialog
      class={css`
        inset: 0;
        box-sizing: border-box;
        width: 100%;
        height: 100dvh;
        max-width: none;
        max-height: none;
        margin: 0;
        border: 0;
        padding: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        background: transparent;
        &::backdrop {
          background: ${colors.overlay};
          backdrop-filter: blur(3px);
        }
      `}
      ref={(el) => {
        element = el;
        // The route owns this dialog's presence. The native API requires a
        // connected node, so open after insertion, without waiting for actions.
        onSettled(() => {
          if (!disposed && el.isConnected) el.showModal();
        });
      }}
      aria-label={props.title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div
        class={[
          css`
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            min-height: 100%;
            padding: ${space.lg}px ${space.md}px;
          `,
          props.baselineHeight &&
            css`
              justify-content: flex-start;
              padding-top: max(
                ${space.lg}px,
                calc((100dvh - var(--dialog-baseline-wide)) / 2)
              );
              @media (max-width: ${breakpoints.phone}px) {
                padding-top: max(
                  ${space.lg}px,
                  calc((100dvh - var(--dialog-baseline-phone)) / 2)
                );
              }
            `,
        ]}
        style={
          props.baselineHeight
            ? {
                "--dialog-baseline-wide": `${props.baselineHeight.wide}px`,
                "--dialog-baseline-phone": `${props.baselineHeight.phone}px`,
              }
            : undefined
        }
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div
          class={css`
            flex: none;
            width: 640px;
            max-width: 100%;
            min-width: 0;
            border: 1px solid ${colors.border};
            border-radius: ${radius.dialog}px;
            color: ${colors.ink};
            background: ${colors.paper};
            box-shadow: 0 30px 100px ${colors.shadowDialog};
          `}
        >
          <header
            class={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: ${space.md}px;
              padding: 15px;
              border-bottom: 1px solid ${colors.border};
            `}
          >
            <h2
              class={css`
                min-width: 0;
                overflow-wrap: anywhere;
                font-size: ${fontSize.dialogTitle}px;
                line-height: ${lineHeight.dialogTitle}px;
              `}
            >
              {props.title}
            </h2>
            <Button
              variant="ghost"
              iconOnly
              bleed
              aria-label="Close dialog"
              onClick={close}
            >
              <Icon name="close" />
            </Button>
          </header>
          <div
            class={css`
              padding: 15px;
              display: flex;
              flex-direction: column;
              gap: ${space.lg}px;
            `}
          >
            {props.children}
          </div>
        </div>
      </div>
    </dialog>
  );
}
