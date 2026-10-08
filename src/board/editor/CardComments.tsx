import type * as db from "#/module_bindings/types.ts";

import { css } from "@csslit/core";
import { For, Loading, Show, action, createOptimistic, createSignal, onSettled } from "solid-js";

import { tables } from "#/module_bindings/index.ts";
import { useName } from "#/name.tsx";
import { useReducers, useTable } from "#/spacetimedb.tsx";
import { colors, fontSize, lineHeight, space } from "#/theme.ts";
import { Avatar } from "#/ui/Avatar.tsx";
import { Input } from "#/ui/Input.tsx";
import { Notice } from "#/ui/Notice.tsx";
import { Skeleton } from "#/ui/Skeleton.tsx";
import { Spinner } from "#/ui/Spinner.tsx";
import { Textarea } from "#/ui/Textarea.tsx";

export function CardComments(props: { cardId: string; boardId: string }) {
  const comments = useTable(() =>
    tables.comment.where((comment) => comment.cardId.eq(props.cardId)),
  );
  const reducers = useReducers();
  const { name } = useName();
  const [comment, setComment] = createSignal("");
  const [expanded, setExpanded] = createSignal(false);
  const [commentPending, setCommentPending] = createOptimistic(false);
  const [commentError, setCommentError] = createSignal<string>();
  let previousComment: Parameters<typeof reducers.addComment>[0] | undefined;
  const addComment = action(function* (event: Event) {
    event.preventDefault();
    // This composer has one draft and one retry request. Keep its own send
    // serialized so a completion cannot clear text belonging to another send.
    if (commentPending()) return;
    const text = comment().trim();
    if (!text) return;
    // Retrying unchanged text reuses the comment ID so an uncertain response
    // cannot insert the same comment twice. Edited text starts a new submission.
    const request =
      previousComment?.text === text
        ? previousComment
        : {
            id: crypto.randomUUID(),
            boardId: props.boardId,
            cardId: props.cardId,
            actor: name(),
            text,
          };
    previousComment = request;
    setCommentPending(true);
    try {
      yield reducers.addComment(request);
      setCommentError(undefined);
      setComment("");
      previousComment = undefined;
    } catch {
      setCommentError("Comment not confirmed.");
    }
  });

  return (
    <section
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
      <form
        onSubmit={addComment}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) {
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }
        }}
        class={css`
          display: flex;
          align-items: flex-start;
          gap: ${space.sm}px;
        `}
      >
        <span
          class={css`
            height: ${fontSize.body + 2 * space.md}px;
            display: flex;
            align-items: center;
            flex: none;
          `}
        >
          <Avatar name={name()} />
        </span>
        <div
          class={css`
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: ${space.xs}px;
          `}
        >
          <Show
            when={expanded()}
            fallback={
              <Input
                aria-label="Write a comment"
                placeholder="Write a comment…"
                value={comment()}
                onInput={(event) => setComment(event.currentTarget.value)}
                onFocus={() => setExpanded(true)}
                maxlength={2e3}
              />
            }
          >
            <Textarea
              size="short"
              aria-label="Write a comment"
              value={comment()}
              onInput={(event) => setComment(event.currentTarget.value)}
              onBlur={(event) => {
                if (!event.currentTarget.value.trim() && !commentPending()) {
                  setComment("");
                  setExpanded(false);
                }
              }}
              ref={(element) =>
                onSettled(() => {
                  if (element.isConnected) element.focus();
                })
              }
              maxlength={2e3}
              placeholder="Write a comment…"
              required
              readonly={commentPending()}
            />
            <div
              class={css`
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: ${space.sm}px;
                min-height: ${fontSize.body}px;
                font-size: ${fontSize.caption}px;
                color: ${colors.muted};
              `}
            >
              <Show when={commentPending()}>
                <Spinner label="Sending comment" />
              </Show>
              <span>Ctrl/Cmd+Enter to send</span>
            </div>
          </Show>
          <Show when={commentError()}>
            <Notice role="alert">
              {commentError()} Your text is kept. Press Ctrl/Cmd+Enter to retry.
            </Notice>
          </Show>
        </div>
      </form>
      <Loading fallback={<CardCommentsSkeleton />}>
        <div>
          <For
            each={comments().toSorted((a, b) => b.createdAt - a.createdAt)}
            keyed={(item) => item.id}
            fallback={
              <p
                class={css`
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: ${2 * fontSize.body + 3 * space.sm}px;
                  padding: ${space.sm}px 0;
                  color: ${colors.muted};
                `}
              >
                <span>No comments yet</span>
              </p>
            }
          >
            {(item) => <Comment comment={item()} />}
          </For>
        </div>
      </Loading>
    </section>
  );
}

function Comment(props: { comment: db.Comment }) {
  return (
    <article
      class={css`
        display: flex;
        align-items: flex-start;
        gap: ${space.sm}px;
        font-size: ${fontSize.body}px;
        padding: ${space.sm}px 0;
      `}
    >
      <Avatar name={props.comment.author} />
      <div
        class={css`
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: ${space.sm}px;
        `}
      >
        <header
          class={css`
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: ${space.sm}px;
          `}
        >
          <strong
            class={css`
              overflow-wrap: anywhere;
            `}
          >
            {props.comment.author}
          </strong>
          <time
            datetime={new Date(props.comment.createdAt).toISOString()}
            class={css`
              display: flex;
              align-items: center;
              gap: ${space.sm}px;
              color: ${colors.muted};
              font-size: ${fontSize.caption}px;
              white-space: nowrap;
            `}
          >
            <span>·</span>
            <span>
              {new Date(props.comment.createdAt).toISOString().slice(11, 16)}
              {" UTC"}
            </span>
          </time>
        </header>
        <p
          class={css`
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            line-height: ${lineHeight.body}px;
          `}
        >
          {props.comment.text}
        </p>
      </div>
    </article>
  );
}

export function CardCommentsSkeleton() {
  return (
    <article
      aria-hidden="true"
      class={css`
        display: flex;
        align-items: flex-start;
        gap: ${space.sm}px;
        padding: ${space.sm}px 0;
        mask-image: linear-gradient(to bottom, black 35%, transparent 80%);
      `}
    >
      <Skeleton height={24} width={24} circle />
      <div
        class={css`
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: ${space.sm}px;
        `}
      >
        <header
          class={css`
            display: flex;
            align-items: center;
            gap: ${space.sm}px;
          `}
        >
          <Skeleton height={fontSize.body} width={80} />
          <Skeleton height={fontSize.caption} width={48} />
        </header>
        <Skeleton height={fontSize.body} width={340} />
      </div>
    </article>
  );
}
