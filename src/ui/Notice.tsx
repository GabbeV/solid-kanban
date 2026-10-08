import type { JSX } from "@solidjs/web";

import { css } from "@csslit/core";

import { colors, fontSize, lineHeight, radius } from "#/theme.ts";

export function Notice(props: Omit<JSX.HTMLAttributes<HTMLDivElement>, "class">) {
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
