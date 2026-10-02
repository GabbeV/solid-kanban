import { css } from "@csslit/core";
import type { JSX } from "@solidjs/web";
import { colors, radius, fontSize, lineHeight } from "#/theme.ts";

export function Notice(
  props: Omit<JSX.HTMLAttributes<HTMLDivElement>, "class">,
) {
  return (
    <div
      {...props}
      role={props.role ?? "alert"}
      class={css`
        border: 1px solid ${colors.dangerBorder};
        border-radius: ${radius.control}px;
        padding: 11px;
        background: ${colors.dangerSurface};
        color: ${colors.danger};
        font-size: ${fontSize.body}px;
        line-height: ${lineHeight.body}px;
      `}
    />
  );
}
