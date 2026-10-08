import type { ParentProps } from "solid-js";

import { css } from "@csslit/core";

import { Sidebar } from "#/Sidebar.tsx";
import { breakpoints } from "#/theme.ts";

export function Layout(props: ParentProps) {
  return (
    <div
      class={css`
        height: 100dvh;
        display: grid;
        grid-template-columns: 208px minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr);
        @media (max-width: ${breakpoints.compact}px) {
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: auto minmax(0, 1fr);
        }
      `}
    >
      <Sidebar />
      <main
        class={css`
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          overflow: auto;
        `}
      >
        {props.children}
      </main>
    </div>
  );
}
