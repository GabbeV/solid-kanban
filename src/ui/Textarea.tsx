import type { JSX } from "@solidjs/web";

import { css } from "@csslit/core";
import { omit } from "solid-js";

import { colors, control, lineHeight, radius } from "#/theme.ts";

export function Textarea(
  props: Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, "class"> & {
    size?: "compact" | "short";
  },
) {
  return (
    <textarea
      {...omit(props, "size")}
      class={[
        css`
          width: 100%;
          min-width: 0;
          border: 1px solid ${colors.border};
          border-radius: ${radius.control}px;
          background: ${colors.paper};
          padding: ${control.pad}px;
          color: ${colors.ink};
          font-size: ${control.fontSize}px;
          line-height: ${lineHeight.body}px;
          resize: vertical;
          min-height: 96px;
        `,
        props.size === "compact" &&
          css`
            min-height: 78px;
          `,
        props.size === "short" &&
          css`
            height: ${2 * lineHeight.body + 2 * (control.pad + 1)}px;
            min-height: ${2 * lineHeight.body + 2 * (control.pad + 1)}px;
          `,
      ]}
    />
  );
}
