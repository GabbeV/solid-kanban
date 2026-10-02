import { css } from "@csslit/core";
import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { colors, radius, control, space } from "#/theme.ts";

// UA dropdown arrow via data-URI (currentColor cannot be used in background-image).
const chevronDown = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 11 11' fill='none'%3E%3Cpath d='M2.5 4.5l3 3 3-3' stroke='%236b7c93' stroke-width='1' stroke-linecap='butt' stroke-linejoin='miter'/%3E%3C/svg%3E")`;

export function Select(
  props: Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, "class"> & {
    fitContent?: boolean;
  },
) {
  return (
    <select
      {...omit(props, "fitContent")}
      class={[
        css`
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          min-width: 0;
          height: 33px;
          border: 1px solid ${colors.border};
          border-radius: ${radius.control}px;
          background-color: ${colors.paper};
          background-image: ${chevronDown};
          background-repeat: no-repeat;
          background-position: right ${control.pad}px center;
          background-size: 11px 11px;
          padding: ${control.pad}px;
          padding-right: ${space.md + 11 + space.sm}px;
          color: ${colors.ink};
          font-size: ${control.fontSize}px;
          cursor: pointer;
          accent-color: ${colors.accent};

          body:not(:has([data-dragging])) &:hover:not(:disabled) {
            border-color: ${colors.borderHover};
          }

          &:disabled {
            opacity: 0.55;
            cursor: default;
          }

          /* Chrome 134+: brand the open picker. Firefox stable still uses the
             native popup under appearance: none until base-select ships by default. */
          @supports (appearance: base-select) {
            appearance: base-select;
            align-items: center;

            &::picker-icon {
              /* Keep the authored chevron and its reserved space in both modes. */
              display: none;
            }

            &::picker(select) {
              appearance: base-select;
              border: 1px solid ${colors.border};
              border-radius: ${radius.control}px;
              background: ${colors.paper};
              color: ${colors.ink};
              box-shadow: 0 10px 28px ${colors.shadowDialog};
              margin-top: ${space.xs}px;
              padding: 3px;
              font-size: ${control.fontSize}px;
            }
          }
        `,
        props.fitContent &&
          css`
            width: auto;
            field-sizing: content;
          `,
      ]}
    />
  );
}
