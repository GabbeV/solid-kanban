import type * as db from "#/module_bindings/types.ts";
import type { ParentProps } from "solid-js";

import { css } from "@csslit/core";
import { useParams } from "@solidjs/router";
import { For, Loading } from "solid-js";

import { tables } from "#/module_bindings/index.ts";
import { useTable } from "#/spacetimedb.tsx";
import { colors, fontSize, lineHeight, space } from "#/theme.ts";
import { Avatar } from "#/ui/Avatar.tsx";
import { Skeleton } from "#/ui/Skeleton.tsx";

export function Activity(props: ParentProps) {
  const params = useParams();

  return (
    <>
      <Loading on={params.boardId ?? "studio"} fallback={<ActivitySkeleton />}>
        <ActivityContents />
      </Loading>
      {props.children}
    </>
  );
}

function ActivitySkeleton() {
  return (
    <ol
      role="status"
      aria-label="Loading activity"
      class={css`
        max-width: 720px;
        max-height: 100%;
        margin: 0;
        overflow: clip;
        padding-top: ${space.md}px;
        mask-image: linear-gradient(to bottom, black 35%, transparent 80%);
      `}
    >
      <For each={Array.from({ length: 12 }, (_, row) => row)}>
        {(row) => (
          <li
            class={css`
              list-style: none;
              display: flex;
              gap: ${space.md}px;
              align-items: center;
              border-bottom: 1px solid ${colors.border};
              padding: ${space.md}px 0;
            `}
          >
            <Skeleton height={24} width={24} circle />
            <div
              class={css`
                display: flex;
                flex-direction: column;
                gap: ${space.sm}px;
                flex: 1;
                min-width: 0;
              `}
            >
              <Skeleton height={10} width={240 + (row % 3) * 40} />
              <Skeleton height={8} width={160} />
            </div>
          </li>
        )}
      </For>
    </ol>
  );
}

function ActivityContents() {
  const params = useParams();
  const boardId = () => params.boardId ?? "studio";
  const boardActivity = useTable(() =>
    tables.recentActivity.where((event) => event.boardId.eq(boardId())),
  );

  const activity = () =>
    [...boardActivity()].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));

  return (
    <>
      <ol
        class={css`
          max-width: 720px;
          margin: 0;
          padding-top: ${space.md}px;
        `}
      >
        <For
          each={activity()}
          keyed={(event) => event.id}
          fallback={
            <li
              class={css`
                list-style: none;
                display: flex;
                gap: ${space.md}px;
                align-items: center;
                font-size: ${fontSize.control}px;

                border-bottom: 1px solid ${colors.border};
                padding: ${space.md}px 0;
              `}
            >
              <span>No activity yet.</span>
            </li>
          }
        >
          {(event) => <ActivityEntry event={event()} />}
        </For>
      </ol>
    </>
  );
}

function ActivityEntry(props: { event: db.Activity }) {
  return (
    <li
      class={css`
        list-style: none;
        display: flex;
        gap: ${space.md}px;
        align-items: center;
        font-size: ${fontSize.control}px;

        border-bottom: 1px solid ${colors.border};
        padding: ${space.md}px 0;
      `}
    >
      <Avatar name={props.event.actor} />
      <div
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.sm}px;
        `}
      >
        <span
          class={css`
            line-height: ${lineHeight.control}px;
          `}
        >
          <strong>{props.event.actor}</strong> {props.event.text}
        </span>
        <small
          class={css`
            display: block;
            color: ${colors.muted};
            font-size: ${fontSize.caption}px;
            line-height: ${lineHeight.caption}px;
          `}
        >
          {new Date(props.event.createdAt).toISOString().replace("T", " · ").slice(0, 21)}
          {" UTC · confirmed"}
        </small>
      </div>
    </li>
  );
}
