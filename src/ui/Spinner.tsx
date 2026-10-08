import { css } from "@csslit/core";
import { colors } from "#/theme.ts";

export function Spinner(props: { variant?: "danger"; label?: string }) {
  return (
    <span
      role={props.label ? "status" : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : "true"}
      class={[
        css`
          display: inline-block;
          width: 11px;
          height: 11px;
          margin: -1px;
          flex: none;
          border: 1px solid ${colors.border};
          border-top-color: ${colors.accent};
          border-radius: 50%;
          animation: spinner 0.8s linear infinite;
          @keyframes spinner {
            to {
              transform: rotate(360deg);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            animation: none;
          }
        `,
        props.variant === "danger" &&
          css`
            border-color: ${colors.dangerBorder};
            border-top-color: ${colors.danger};
          `,
      ]}
    />
  );
}
