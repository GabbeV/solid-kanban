import type { JSX } from "@solidjs/web";

import { css } from "@csslit/core";
import { omit } from "solid-js";

import { colors, fontSize, space } from "#/theme.ts";

export function Field(
  props: Omit<JSX.LabelHTMLAttributes<HTMLLabelElement>, "class"> & {
    label: string;
  },
) {
  return (
    <label
      {...omit(props, "label")}
      class={css`
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: ${space.sm}px;
        font-size: ${fontSize.body}px;

        color: ${colors.muted};
      `}
    >
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}
