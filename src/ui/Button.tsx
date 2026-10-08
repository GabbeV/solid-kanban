import { css } from "@csslit/core";
import { dynamic, type JSX } from "@solidjs/web";
import { useNavigate } from "@solidjs/router";
import { action, createOptimistic, omit } from "solid-js";
import {
  colors,
  radius,
  buttonPad,
  buttonText,
  lineHeight,
  space,
} from "#/theme.ts";

export type ButtonVariant =
  "default" | "primary" | "danger" | "ghost" | "danger-ghost" | "text";
export type ButtonPad = keyof typeof buttonPad;
export type ButtonFont = keyof typeof buttonText | "inherit";
export type ButtonBleed =
  | "block"
  | "inline"
  | "block-start"
  | "block-end"
  | "inline-start"
  | "inline-end";

type ButtonStyles = {
  variant?: ButtonVariant;
  /** Padding on all sides. Defaults to `md` (`text` defaults to `xs`). */
  pad?: ButtonPad;
  /** Label type scale. Defaults to `control` (`text` defaults to `inherit`). */
  font?: ButtonFont;
  /** Alignment of the button contents. Defaults to centered. */
  align?: "start" | "center";
  /** Square single-icon button; box size follows the 9px icon + pad + border. */
  iconOnly?: boolean;
  /**
   * Negative margins of pad + border on the chosen logical edges.
   * `true` bleeds on every edge; arrays combine directions.
   */
  bleed?: boolean | ButtonBleed | readonly ButtonBleed[];
};

export type ButtonProps = ButtonStyles &
  (
    | (Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class"> & {
        href?: undefined;
      })
    | (Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "class" | "href"> & {
        href: string;
      })
  );

export function Button(props: ButtonProps) {
  const [pending, setPending] = createOptimistic(false);
  const navigate = props.href === undefined ? undefined : useNavigate();
  const buttonClick = action(function* (
    event: Parameters<JSX.EventHandler<HTMLButtonElement, MouseEvent>>[0],
  ) {
    if (props.href !== undefined) return;
    setPending(true);
    const handler = props.onClick;
    const result =
      typeof handler === "function"
        ? handler(event)
        : handler?.[0](handler[1], event);
    const button = event.currentTarget;
    if (!event.defaultPrevented && button.type === "submit" && button.form) {
      // Start the native submit (including validation) in the flag's update,
      // rather than letting the browser's default action start a later update.
      event.preventDefault();
      button.form.requestSubmit(button);
    }
    yield result;
  });
  const anchorClick = action(function* (
    event: Parameters<JSX.EventHandler<HTMLAnchorElement, MouseEvent>>[0],
  ) {
    if (props.href === undefined) return;
    setPending(true);
    const handler = props.onClick;
    const result =
      typeof handler === "function"
        ? handler(event)
        : handler?.[0](handler[1], event);
    const anchor = event.currentTarget;
    const url = new URL(anchor.href);
    if (
      navigate &&
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !anchor.target &&
      !anchor.hasAttribute("download") &&
      !anchor.rel.split(/\s+/).includes("external") &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === window.location.origin
    ) {
      // Navigate here: a microtask flush can separate native event listeners.
      // The flag and navigation must start in the same action slice.
      event.preventDefault();
      const state = anchor.getAttribute("state");
      navigate(url.pathname + url.search + url.hash, {
        resolve: false,
        replace: anchor.hasAttribute("replace"),
        scroll: !anchor.hasAttribute("noscroll"),
        state: state ? JSON.parse(state) : undefined,
      });
    }
    yield result;
  });
  const Element = dynamic(() => (props.href === undefined ? "button" : "a"));
  const elementProps = () =>
    props.href === undefined
      ? {
          ...omit(
            props,
            "variant",
            "pad",
            "font",
            "align",
            "iconOnly",
            "bleed",
            "onClick",
          ),
          onClick: buttonClick,
          type: props.type ?? "button",
        }
      : {
          ...omit(
            props,
            "variant",
            "pad",
            "font",
            "align",
            "iconOnly",
            "bleed",
            "onClick",
          ),
          onClick: anchorClick,
        };
  const variant = () => props.variant ?? "default";
  const borderless = () =>
    variant() === "ghost" ||
    variant() === "danger-ghost" ||
    variant() === "text";
  const padKey = (): ButtonPad =>
    props.pad ?? (variant() === "text" ? "xs" : "md");
  const fontKey = (): ButtonFont =>
    props.font ?? (variant() === "text" ? "inherit" : "control");
  const bleeds = (direction: ButtonBleed) =>
    props.bleed === true ||
    props.bleed === direction ||
    (Array.isArray(props.bleed) && props.bleed.includes(direction));

  return (
    <Element
      {...elementProps()}
      class={[
        css`
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: ${space.sm}px;
          border-radius: ${radius.control}px;
          border: 1px solid ${colors.border};
          background: ${colors.paper};
          color: ${colors.ink};
          font-weight: 550;
          white-space: nowrap;
          user-select: none;
          flex-shrink: 0;
          min-width: 0;
          padding: var(--button-padding);
          --button-border: 1px;
          --button-shimmer-surface: ${colors.soft};
          --button-shimmer-highlight: ${colors.hover};
          --button-shimmer-border: ${colors.border};
          --button-shimmer-border-highlight: ${colors.borderHover};
        `,
        props.align === "start" &&
          css`
            justify-content: flex-start;
            text-align: left;
          `,
        padKey() === "none" &&
          css`
            --button-padding: ${buttonPad.none}px;
          `,
        padKey() === "xs" &&
          css`
            --button-padding: ${buttonPad.xs}px;
          `,
        padKey() === "sm" &&
          css`
            --button-padding: ${buttonPad.sm}px;
          `,
        padKey() === "md" &&
          css`
            --button-padding: ${buttonPad.md}px;
          `,
        padKey() === "lg" &&
          css`
            --button-padding: ${buttonPad.lg}px;
          `,
        fontKey() === "caption" &&
          css`
            font-size: ${buttonText.caption}px;
          `,
        fontKey() === "body" &&
          css`
            font-size: ${buttonText.body}px;
          `,
        fontKey() === "control" &&
          css`
            font-size: ${buttonText.control}px;
          `,
        fontKey() === "dialogTitle" &&
          css`
            font-size: ${buttonText.dialogTitle}px;
          `,
        fontKey() === "inherit" &&
          css`
            font: inherit;
          `,
        variant() !== "text" &&
          variant() !== "ghost" &&
          variant() !== "danger-ghost" &&
          css`
            body:not(:has([data-dragging])) &:hover:not(:disabled) {
              background: ${colors.soft};
              border-color: ${colors.borderHover};
            }
          `,
        variant() === "primary" &&
          css`
            background: ${colors.primary};
            color: ${colors.paper};
            border-color: ${colors.primary};

            body:not(:has([data-dragging])) &:hover:not(:disabled) {
              background: ${colors.primaryHover};
              border-color: ${colors.primaryHover};
            }
          `,
        (variant() === "danger" || variant() === "danger-ghost") &&
          css`
            --button-shimmer-surface: ${colors.dangerSurface};
            --button-shimmer-highlight: ${colors.dangerBorder};
            --button-shimmer-border: ${colors.dangerBorder};
            --button-shimmer-border-highlight: ${colors.danger};
          `,
        variant() === "danger" &&
          css`
            color: ${colors.danger};

            &[aria-pressed="true"],
            body:not(:has([data-dragging]))
              &[aria-pressed="true"]:hover:not(:disabled) {
              background: ${colors.dangerSurface};
              border-color: ${colors.dangerBorder};
            }
          `,
        variant() === "ghost" &&
          css`
            border-color: transparent;
            background: transparent;
            color: ${colors.muted};

            &[aria-current="page"] {
              color: ${colors.ink};
              background: ${colors.hover};
              font-weight: 600;
            }

            body:not(:has([data-dragging])) &:hover:not(:disabled) {
              color: ${colors.ink};
              background: ${colors.hover};
              border-color: transparent;
            }
          `,
        variant() === "danger-ghost" &&
          css`
            border-color: transparent;
            background: transparent;
            color: ${colors.danger};

            body:not(:has([data-dragging])) &:hover:not(:disabled) {
              background: ${colors.dangerBorder};
            }
          `,
        variant() === "text" &&
          css`
            display: inline;
            min-height: 0;
            height: auto;
            border: 0;
            border-radius: 0;
            background: transparent;
            color: inherit;
            font-weight: 650;
            line-height: ${lineHeight.body}px;
            white-space: normal;
            text-decoration: underline;
            text-align: left;
            flex-shrink: 1;
            --button-border: 0px;
            --button-padding: ${space.xs}px;
          `,
        props.iconOnly &&
          css`
            width: calc(
              9px + 2 * (var(--button-padding) + var(--button-border))
            );
            height: calc(
              9px + 2 * (var(--button-padding) + var(--button-border))
            );
            display: inline-grid;
            place-items: center;
          `,
        (bleeds("block") || bleeds("block-start")) &&
          css`
            margin-block-start: calc(
              -1 * (var(--button-padding) + var(--button-border))
            );
          `,
        (bleeds("block") || bleeds("block-end")) &&
          css`
            margin-block-end: calc(
              -1 * (var(--button-padding) + var(--button-border))
            );
          `,
        (bleeds("inline") || bleeds("inline-start")) &&
          css`
            margin-inline-start: calc(
              -1 * (var(--button-padding) + var(--button-border))
            );
          `,
        (bleeds("inline") || bleeds("inline-end")) &&
          css`
            margin-inline-end: calc(
              -1 * (var(--button-padding) + var(--button-border))
            );
          `,
        pending() &&
          borderless() &&
          css`
            --button-shimmer-background: linear-gradient(
              100deg,
              var(--button-shimmer-surface) 40%,
              var(--button-shimmer-highlight) 50%,
              var(--button-shimmer-surface) 60%
            );
            animation: button-background-pending 2.4s linear 150ms infinite;

            @keyframes button-background-pending {
              from,
              to {
                background-color: transparent;
                background-image: var(--button-shimmer-background);
                background-size: 300% 100%;
              }
              from {
                background-position: 0 0;
              }
              to {
                background-position: 100% 0;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              animation-delay: 0s;
              animation-play-state: paused;
            }
          `,
        pending() &&
          css`
            &,
            &:disabled {
              cursor: progress;
            }
          `,
        pending() &&
          !borderless() &&
          css`
            &::after {
              content: "";
              position: absolute;
              inset: calc(-1 * var(--button-border));
              border-radius: inherit;
              pointer-events: none;
              opacity: 0;
              animation: button-pending 2.4s linear 150ms infinite;
              padding: 1px;
              background: linear-gradient(
                100deg,
                var(--button-shimmer-border) 46%,
                var(--button-shimmer-border-highlight) 50%,
                var(--button-shimmer-border) 54%
              );
              background-size: 300% 100%;
              mask:
                linear-gradient(#fff, #fff) content-box,
                linear-gradient(#fff, #fff);
              mask-composite: exclude;
            }

            @keyframes button-pending {
              from {
                opacity: 1;
                background-position: 0 0;
              }
              to {
                opacity: 1;
                background-position: 100% 0;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              &::after {
                animation: none;
                opacity: 1;
              }
            }
          `,
      ]}
    />
  );
}
