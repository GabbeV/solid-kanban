import { css } from "@csslit/core";
import {
  For,
  Loading,
  Show,
  action,
  createOptimistic,
  createSignal,
  onSettled,
} from "solid-js";
import { tables } from "#/module_bindings/index.ts";
import type { AddCommentParams } from "#/module_bindings/types/reducers.ts";
import { useReducers, useTable } from "#/spacetimedb.tsx";
import { useName } from "#/name.tsx";
import { colors, fontSize, lineHeight, space } from "#/theme.ts";
import { Avatar } from "#/ui/Avatar.tsx";
import { Input } from "#/ui/Input.tsx";
import { Notice } from "#/ui/Notice.tsx";
import { Textarea } from "#/ui/Textarea.tsx";
import { CardCommentsSkeleton } from "./CardCommentsSkeleton";

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
  let previousComment: AddCommentParams | undefined;
  const addComment = action(function* (event: Event) {
    event.preventDefault();
    if (commentPending()) return;
    const text = comment().trim();
    if (!text) return;
    // Retrying unchanged text reuses the operation ID so an uncertain response
    // cannot insert the same comment twice. Edited text starts a new submission.
    const request =
      previousComment?.text === text
        ? previousComment
        : {
            id: crypto.randomUUID(),
            operationId: crypto.randomUUID(),
            boardId: props.boardId,
            cardId: props.cardId,
            actor: name(),
            text,
          };
    previousComment = request;
    setCommentPending(true);
    setCommentError(undefined);
    try {
      yield reducers.addComment(request);
      setComment("");
      previousComment = undefined;
    } catch (cause) {
      setCommentError(
        cause instanceof Error
          ? cause.message
          : "Couldn't confirm your comment.",
      );
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
          if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey) &&
            !event.isComposing
          ) {
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
                <span
                  role="status"
                  aria-label="Sending comment"
                  class={css`
                    width: 11px;
                    height: 11px;
                    margin: -1px;
                    flex: none;
                    border: 1px solid ${colors.border};
                    border-top-color: ${colors.accent};
                    border-radius: 50%;
                    animation: comment-sending 0.8s linear infinite;
                    @keyframes comment-sending {
                      to {
                        transform: rotate(360deg);
                      }
                    }
                    @media (prefers-reduced-motion: reduce) {
                      animation: none;
                    }
                  `}
                />
              </Show>
              <span>Ctrl/Cmd+Enter to send</span>
            </div>
          </Show>
          <Show when={commentError() && !commentPending()}>
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
            {(item) => (
              <article
                class={css`
                  display: flex;
                  align-items: flex-start;
                  gap: ${space.sm}px;
                  font-size: ${fontSize.body}px;
                  padding: ${space.sm}px 0;
                `}
              >
                <Avatar name={item().author} />
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
                      {item().author}
                    </strong>
                    <time
                      datetime={new Date(item().createdAt).toISOString()}
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
                        {new Date(item().createdAt).toISOString().slice(11, 16)}
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
                    {item().text}
                  </p>
                </div>
              </article>
            )}
          </For>
        </div>
      </Loading>
    </section>
  );
}
