import { css } from "@csslit/core";
import { colors, radius } from "#/theme.ts";

export function Skeleton(props: {
  height: number;
  width?: number;
  circle?: boolean;
  radius?: keyof typeof radius;
  variant?: "border" | "background";
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        height: `${props.height}px`,
        width: props.width === undefined ? undefined : `${props.width}px`,
      }}
      class={[
        css`
          display: block;
          width: 100%;
          max-width: 100%;
          flex: none;
          border: 1px solid transparent;
          border-radius: ${radius.small}px;
          background:
            linear-gradient(${colors.soft}, ${colors.soft}) padding-box,
            linear-gradient(
                100deg,
                ${colors.border} 46%,
                ${colors.borderHover} 50%,
                ${colors.border} 54%
              )
              border-box;
          background-size:
            100% 100%,
            300% 100%;
          animation: skeleton-loading 2.4s linear infinite;

          @keyframes skeleton-loading {
            from {
              background-position: 0 0;
            }
            to {
              background-position: 100% 0;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            animation: none;
          }
        `,
        (props.height <= 16 ||
          props.circle ||
          props.variant === "background") &&
          css`
            background: linear-gradient(
              100deg,
              ${colors.soft} 40%,
              ${colors.hover} 50%,
              ${colors.soft} 60%
            );
            background-size: 300% 100%;
          `,
        props.radius === "control" &&
          css`
            border-radius: ${radius.control}px;
          `,
        props.radius === "card" &&
          css`
            border-radius: ${radius.card}px;
          `,
        props.radius === "dialog" &&
          css`
            border-radius: ${radius.dialog}px;
          `,
        props.circle &&
          css`
            border-radius: 50%;
          `,
      ]}
    />
  );
}
