import { css } from "@csslit/core";

// One viewBox unit is one CSS pixel. Straight 1px strokes sit on half pixels;
// filled dots occupy whole pixels.
const crisp = new Set([
  "plus",
  "board",
  "archive",
  "calendar",
  "grip",
  "more",
  "more-vertical",
  "exclamation",
  "trash",
]);

export function Icon(props: { name: string }) {
  const filled =
    props.name === "plus" ||
    props.name === "grip" ||
    props.name === "more" ||
    props.name === "more-vertical" ||
    props.name === "exclamation";
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 11 11"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      stroke-width="1"
      stroke-linecap="butt"
      stroke-linejoin="miter"
      shape-rendering={crisp.has(props.name) ? "crispEdges" : undefined}
      aria-hidden="true"
      class={css`
        margin: -1px;
        flex-shrink: 0;
      `}
    >
      <path d={paths[props.name] ?? paths.board} />
    </svg>
  );
}

// The 11px artwork bleeds 1px past its 9px layout box on each side.
export const paths: Record<string, string> = {
  plus: "M5 1h1v9H5zM1 5h9v1H1z",
  close: "M2.5 2.5l6 6M8.5 2.5l-6 6",
  board: "M1.5 1.5h3v8h-3zM6.5 1.5h3v6h-3z",
  search: "M6.5 6.5l3 3M7.5 4.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  chevron: "M4 2.5l3 3-3 3",
  down: "M2.5 4.5l3 3 3-3",
  activity: "M.5 5.5h2l2-3 2 6 2-3h2",
  comment:
    "M3 .5h5a2.5 2.5 0 0 1 2.5 2.5v3A2.5 2.5 0 0 1 8 8.5H5.5L4.5 10.5 3 8.5A2.5 2.5 0 0 1 .5 6V3A2.5 2.5 0 0 1 3 .5Z",
  grip: "M3 2h1v1H3zM7 2h1v1H7zM3 5h1v1H3zM7 5h1v1H7zM3 8h1v1H3zM7 8h1v1H7z",
  exclamation: "M5 1h1v6H5zM5 9h1v1H5z",
  more: "M2 5h1v1H2zM5 5h1v1H5zM8 5h1v1H8z",
  "more-vertical": "M5 2h1v1H5zM5 5h1v1H5zM5 8h1v1H5z",
  check: "M1.5 5.5 4 8l5.5-6",
  archive: "M.5 .5h10v4H.5zM1.5 4.5v6h8v-6M4 7.5h3",
  trash: "M1 2.5h9M3.5 2.5v-2h4v2M2.5 2.5v8h6v-8M4.5 4v4M6.5 4v4",
  restore: "M4.5 2.5 2 5l2.5 2.5M2 5h4.5a2 2 0 0 1 0 4H5",
  retry: "M9.5 4.5a4 4 0 1 0 0 3M9.5 .5v4h-4",
  arrow: "M1.5 5.5h8M7 3l2.5 2.5L7 8",
  leaf: "M9.5 1.5C4 1.5 1.5 4 2.5 8S9 9.5 9.5 1.5ZM2.5 9.5 8 3",
  flag: "M1.5 9.5v-8c2-1.5 4 1.5 7 0v5c-3 1.5-5-1.5-7 0",
  calendar: "M1.5 2.5h8v7h-8zM3.5 .5v3M7.5 .5v3M1.5 5.5h8",
  bolt: "M6.5 .5 1.5 6h4l-1 4.5 5-6h-4z",
  unplug: "M3.5 .5v3M7.5 .5v3M2.5 3.5h6v1a3 3 0 0 1-6 0zM5.5 7.5v1M5.5 9.5v1",
};
