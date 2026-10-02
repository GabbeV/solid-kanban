import { css } from "@csslit/core";
import { fontSize, colors, radius, space } from "#/theme.ts";

export function CardEditorPlaceholder(props: {
  label: string;
  multiline?: boolean;
}) {
  return (
    <div
      class={css`
        display: flex;
        flex-direction: column;
        gap: ${space.sm}px;
        font-size: ${fontSize.body}px;
        color: ${colors.muted};
      `}
    >
      <span>{props.label}</span>
      <div
        class={[
          css`
            height: 33px;
            border: 1px solid transparent;
            border-radius: ${radius.control}px;
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
            animation: editor-loading 2.4s linear infinite;

            @keyframes editor-loading {
              from {
                background-position:
                  0 0,
                  0 0;
              }
              to {
                background-position:
                  0 0,
                  100% 0;
              }
            }
            @media (prefers-reduced-motion: reduce) {
              animation: none;
            }
          `,
          props.multiline &&
            css`
              height: 96px;
            `,
        ]}
      />
    </div>
  );
}
