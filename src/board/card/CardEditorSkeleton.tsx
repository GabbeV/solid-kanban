import { css } from "@csslit/core";
import { colors, breakpoints, fontSize, space } from "#/theme.ts";
import { useName } from "#/name.tsx";
import { Avatar } from "#/ui/Avatar.tsx";
import { Input } from "#/ui/Input.tsx";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { CardEditorPlaceholder } from "./CardEditorPlaceholder";
import { CardCommentsSkeleton } from "./CardCommentsSkeleton";

export function CardEditorSkeleton() {
  const { name } = useName();
  return (
    <div
      data-editor-loading
      aria-hidden="true"
      class={css`
        display: flex;
        flex-direction: column;
        gap: ${space.lg}px;
      `}
    >
      <CardEditorPlaceholder label="Title" />
      <CardEditorPlaceholder label="Description" multiline />
      <div
        class={css`
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: ${space.lg}px;
          @media (max-width: ${breakpoints.phone}px) {
            grid-template-columns: minmax(0, 1fr);
          }
        `}
      >
        <CardEditorPlaceholder label="Label" />
        <CardEditorPlaceholder label="Priority" />
        <CardEditorPlaceholder label="Assigned to" />
        <CardEditorPlaceholder label="Due date" />
      </div>
      <div
        class={css`
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: ${space.sm}px;
        `}
      >
        <Button variant="primary" disabled>
          <span>Save</span>
        </Button>
        <div
          class={css`
            display: flex;
            flex-wrap: wrap;
            gap: ${space.sm}px;
          `}
        >
          <Button variant="danger" disabled>
            <Icon name="archive" />
            <span>Archive</span>
          </Button>
          <Button variant="danger" disabled>
            <Icon name="trash" />
            <span>Delete</span>
          </Button>
        </div>
      </div>
      <div
        class={css`
          height: 1px;
          background: ${colors.border};
          margin: ${space.sm}px 0;
        `}
      />
      <div
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.md}px;
        `}
      >
        <h3
          class={css`
            font-size: ${fontSize.control}px;
            font-weight: 550;
          `}
        >
          Comments
        </h3>
        <div
          class={css`
            display: flex;
            align-items: center;
            gap: ${space.sm}px;
          `}
        >
          <Avatar name={name()} />
          <Input
            aria-label="Write a comment"
            placeholder="Write a comment…"
            disabled
          />
        </div>
        <CardCommentsSkeleton />
      </div>
    </div>
  );
}
