import type { ReducerCtx } from "spacetimedb/server";

import { SenderError, schema, t, table } from "spacetimedb/server";

import { duplicateCardError, labels, priorities } from "#/board/cards.ts";
import { validOrderKey } from "#/primitives/ordered-key.ts";
import { seed } from "#/server/seed.ts";

const board = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    title: t.string(),
    description: t.string(),
    color: t.string(),
  },
);

const lane = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    boardId: t.string().index("btree"),
    title: t.string(),
    position: t.f64(),
  },
);

const card = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    boardId: t.string().index("btree"),
    laneId: t.string().index("btree"),
    title: t.string(),
    description: t.string(),
    label: t.string(),
    priority: t.string(),
    assignee: t.string(),
    dueDate: t.string(),
    archived: t.bool(),
    orderKey: t.string(),
  },
);

const comment = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    boardId: t.string().index("btree"),
    cardId: t.string().index("btree"),
    author: t.string(),
    text: t.string(),
    createdAt: t.f64(),
  },
);

const activity = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    boardId: t.string().index("btree"),
    actor: t.string(),
    text: t.string(),
    createdAt: t.f64(),
  },
);

const reducerAck = table(
  { public: true, event: true },
  {
    connectionId: t.connectionId().index("btree"),
    sequence: t.u64(),
  },
);

const db = schema({ board, lane, card, comment, activity, reducerAck });
export default db;
export type Ctx = ReducerCtx<typeof db.schemaType>;

export const recentActivity = db.anonymousView(
  { name: "recent_activity", public: true },
  t.array(activity.rowType),
  (ctx) =>
    Array.from(ctx.db.board.iter()).flatMap((board) =>
      Array.from(ctx.db.activity.boardId.filter(board.id))
        .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
        .slice(0, 50),
    ),
);

const envelope = {
  sequence: t.u64(),
  boardId: t.string(),
  actor: t.string(),
};

type Envelope = { boardId: string; actor: string; sequence: bigint };

function text(value: string, field: string, max: number, required = true) {
  const text = value.trim();
  if (required && !text) throw new SenderError(`${field} cannot be empty.`);
  if (text.length > max) throw new SenderError(`${field} must be ${max} characters or fewer.`);
  return text;
}

function validate(ctx: Ctx, args: Envelope, requireBoard = true) {
  text(args.actor, "Name", 32);
  if (requireBoard && !ctx.db.board.id.find(args.boardId))
    throw new SenderError("This board no longer exists.");
}

function acknowledge(ctx: Ctx, args: Envelope) {
  if (ctx.connectionId === null) throw new SenderError("A client connection is required.");
  // The event is delivered only if this entire reducer transaction commits.
  ctx.db.reducerAck.insert({
    connectionId: ctx.connectionId,
    sequence: args.sequence,
  });
}

function logActivity(ctx: Ctx, args: Envelope, message: string) {
  ctx.db.activity.insert({
    id: ctx.newUuidV7().toString(),
    boardId: args.boardId,
    actor: args.actor,
    text: message,
    createdAt: Number(ctx.timestamp.microsSinceUnixEpoch / 1000n),
  });
}

function getCard(ctx: Ctx, args: { id: string; boardId: string }) {
  const row = ctx.db.card.id.find(args.id);
  if (!row || row.boardId !== args.boardId) throw new SenderError("This card no longer exists.");
  return row;
}

export const createBoard = db.reducer(
  { ...envelope, title: t.string(), description: t.string() },
  (ctx, args) => {
    validate(ctx, args, false);
    acknowledge(ctx, args);
    const title = text(args.title, "Title", 80);
    const fields = {
      id: text(args.boardId, "Board ID", 80),
      title,
      description: text(args.description, "Description", 500, false),
    };
    const existing = ctx.db.board.id.find(fields.id);
    if (existing) {
      ctx.db.board.id.update({ ...existing, ...fields });
    } else {
      ctx.db.board.insert({ ...fields, color: "blue" });
      ["Ideas", "To do", "In progress", "Done"].forEach((title, position) =>
        ctx.db.lane.insert({
          id: `${args.boardId}-${position}`,
          boardId: args.boardId,
          title,
          position,
        }),
      );
    }
    logActivity(ctx, args, `created the board “${title}”`);
  },
);

export const editBoard = db.reducer(
  { ...envelope, title: t.string(), description: t.string() },
  (ctx, args) => {
    validate(ctx, args);
    acknowledge(ctx, args);
    const row = ctx.db.board.id.find(args.boardId)!;
    ctx.db.board.id.update({
      ...row,
      title: text(args.title, "Title", 80),
      description: text(args.description, "Description", 500, false),
    });
    logActivity(ctx, args, "updated the board details");
  },
);

export const createLane = db.reducer(
  { ...envelope, id: t.string(), title: t.string() },
  (ctx, args) => {
    validate(ctx, args);
    acknowledge(ctx, args);
    const fields = {
      id: text(args.id, "Lane ID", 80),
      boardId: args.boardId,
      title: text(args.title, "Lane title", 60),
    };
    const existing = ctx.db.lane.id.find(fields.id);
    if (existing) {
      if (existing.boardId !== args.boardId)
        throw new SenderError("This lane ID is already in use.");
      ctx.db.lane.id.update({ ...existing, ...fields });
    } else {
      const position =
        Math.max(
          -1,
          ...Array.from(ctx.db.lane.boardId.filter(args.boardId), (row) => row.position),
        ) + 1;
      ctx.db.lane.insert({ ...fields, position });
    }
    logActivity(ctx, args, `added the lane “${args.title}”`);
  },
);

export const renameLane = db.reducer(
  { ...envelope, id: t.string(), title: t.string() },
  (ctx, args) => {
    validate(ctx, args);
    acknowledge(ctx, args);
    const row = ctx.db.lane.id.find(args.id);
    if (!row || row.boardId !== args.boardId) throw new SenderError("This lane no longer exists.");
    ctx.db.lane.id.update({
      ...row,
      title: text(args.title, "Lane title", 60),
    });
    logActivity(ctx, args, `renamed a lane to “${args.title}”`);
  },
);

export const createCard = db.reducer(
  {
    ...envelope,
    id: t.string(),
    laneId: t.string(),
    title: t.string(),
    orderKey: t.string(),
    description: t.string(),
    label: t.string(),
    priority: t.string(),
    assignee: t.string(),
    dueDate: t.string(),
  },
  (ctx, args) => {
    validate(ctx, args);
    acknowledge(ctx, args);
    const target = ctx.db.lane.id.find(args.laneId);
    if (!target || target.boardId !== args.boardId)
      throw new SenderError("This lane no longer exists.");
    if (!validOrderKey(args.orderKey)) throw new SenderError("Invalid card order key.");
    if (
      !labels.some((label) => label === args.label) ||
      !priorities.some((priority) => priority === args.priority)
    )
      throw new SenderError("Choose a valid label and priority.");
    if (args.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(args.dueDate))
      throw new SenderError("Choose a valid due date.");
    const fields = {
      id: text(args.id, "Card ID", 80),
      boardId: args.boardId,
      laneId: args.laneId,
      title: text(args.title, "Card title", 160),
      description: text(args.description, "Description", 6000, false),
      label: args.label,
      priority: args.priority,
      assignee: text(args.assignee, "Assignee", 32, false),
      dueDate: args.dueDate,
      orderKey: args.orderKey,
    };
    const existing = ctx.db.card.id.find(fields.id);
    if (existing) {
      if (existing.boardId !== args.boardId)
        throw new SenderError("This card ID is already in use.");
      // A late creation must never overwrite a newer edit or move after reconnect.
      throw new SenderError(duplicateCardError);
    }
    ctx.db.card.insert({ ...fields, archived: false });
    logActivity(ctx, args, `added “${args.title}”`);
  },
);

export const editCard = db.reducer(
  {
    ...envelope,
    id: t.string(),
    laneId: t.string(),
    orderKey: t.string(),
    title: t.string(),
    description: t.string(),
    label: t.string(),
    priority: t.string(),
    assignee: t.string(),
    dueDate: t.string(),
  },
  (ctx, args) => {
    validate(ctx, args);
    acknowledge(ctx, args);
    const row = getCard(ctx, args);
    if (row.archived) throw new SenderError("This card was archived. Restore it before editing.");
    const target = ctx.db.lane.id.find(args.laneId);
    if (!target || target.boardId !== args.boardId)
      throw new SenderError("The destination lane no longer exists.");
    if (!validOrderKey(args.orderKey)) throw new SenderError("Invalid card placement.");
    if (
      !labels.some((label) => label === args.label) ||
      !priorities.some((priority) => priority === args.priority)
    )
      throw new SenderError("Choose a valid label and priority.");
    if (args.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(args.dueDate))
      throw new SenderError("Choose a valid due date.");
    ctx.db.card.id.update({
      ...row,
      laneId: args.laneId,
      orderKey: args.orderKey,
      title: text(args.title, "Card title", 160),
      description: text(args.description, "Description", 6000, false),
      label: args.label,
      priority: args.priority,
      assignee: text(args.assignee, "Assignee", 32, false),
      dueDate: args.dueDate,
    });
    logActivity(ctx, args, `edited “${args.title}”`);
  },
);

export const moveCard = db.reducer(
  {
    ...envelope,
    id: t.string(),
    laneId: t.string(),
    orderKey: t.string(),
  },
  (ctx, args) => {
    validate(ctx, args);
    acknowledge(ctx, args);
    const row = getCard(ctx, args);
    const target = ctx.db.lane.id.find(args.laneId);
    if (!target || target.boardId !== args.boardId)
      throw new SenderError("The destination lane no longer exists.");
    if (row.archived) throw new SenderError("This card was archived. Restore it before moving.");
    if (!validOrderKey(args.orderKey)) throw new SenderError("Invalid card placement.");
    ctx.db.card.id.update({
      ...row,
      laneId: args.laneId,
      orderKey: args.orderKey,
    });
    logActivity(ctx, args, `moved “${row.title}” to ${target.title}`);
  },
);

export const archiveCard = db.reducer(
  { ...envelope, id: t.string(), archived: t.bool() },
  (ctx, args) => {
    validate(ctx, args);
    acknowledge(ctx, args);
    const row = getCard(ctx, args);
    ctx.db.card.id.update({ ...row, archived: args.archived });
    logActivity(ctx, args, `${args.archived ? "archived" : "restored"} “${row.title}”`);
  },
);

export const addComment = db.reducer(
  { ...envelope, id: t.string(), cardId: t.string(), text: t.string() },
  (ctx, args) => {
    validate(ctx, args);
    acknowledge(ctx, args);
    const row = getCard(ctx, { id: args.cardId, boardId: args.boardId });
    const fields = {
      id: text(args.id, "Comment ID", 80),
      boardId: args.boardId,
      cardId: args.cardId,
      author: args.actor,
      text: text(args.text, "Comment", 2000),
    };
    const existing = ctx.db.comment.id.find(fields.id);
    if (existing) {
      if (existing.boardId !== args.boardId || existing.cardId !== args.cardId)
        throw new SenderError("This comment ID is already in use.");
      return;
    }
    ctx.db.comment.insert({
      ...fields,
      createdAt: Number(ctx.timestamp.microsSinceUnixEpoch / 1000n),
    });
    logActivity(ctx, args, `commented on “${row.title}”`);
  },
);

export const deleteCard = db.reducer({ ...envelope, id: t.string() }, (ctx, args) => {
  // Deletion is also successful when an earlier attempt already removed it.
  validate(ctx, args, false);
  acknowledge(ctx, args);
  const row = ctx.db.card.id.find(args.id);
  if (row && row.boardId !== args.boardId)
    throw new SenderError("This card belongs to another board.");
  for (const comment of Array.from(ctx.db.comment.boardId.filter(args.boardId))) {
    if (comment.cardId === args.id) ctx.db.comment.id.delete(comment.id);
  }
  if (row) ctx.db.card.id.delete(row.id);
  if (row) logActivity(ctx, args, `deleted “${row.title}”`);
});

export const deleteLane = db.reducer({ ...envelope, id: t.string() }, (ctx, args) => {
  validate(ctx, args, false);
  acknowledge(ctx, args);
  const row = ctx.db.lane.id.find(args.id);
  if (row && row.boardId !== args.boardId)
    throw new SenderError("This lane belongs to another board.");
  const cards = Array.from(ctx.db.card.laneId.filter(args.id));
  const cardIds = new Set(cards.map((card) => card.id));
  for (const comment of Array.from(ctx.db.comment.boardId.filter(args.boardId))) {
    if (cardIds.has(comment.cardId)) ctx.db.comment.id.delete(comment.id);
  }
  for (const card of cards) ctx.db.card.id.delete(card.id);
  if (row) ctx.db.lane.id.delete(row.id);
  if (row) logActivity(ctx, args, `deleted the lane “${row.title}”`);
});

export const deleteBoard = db.reducer(envelope, (ctx, args) => {
  validate(ctx, args, false);
  acknowledge(ctx, args);
  const row = ctx.db.board.id.find(args.boardId);
  for (const comment of Array.from(ctx.db.comment.boardId.filter(args.boardId)))
    ctx.db.comment.id.delete(comment.id);
  for (const card of Array.from(ctx.db.card.boardId.filter(args.boardId)))
    ctx.db.card.id.delete(card.id);
  for (const lane of Array.from(ctx.db.lane.boardId.filter(args.boardId)))
    ctx.db.lane.id.delete(lane.id);
  for (const event of Array.from(ctx.db.activity.boardId.filter(args.boardId)))
    ctx.db.activity.id.delete(event.id);
  if (row) ctx.db.board.id.delete(row.id);
});

export const init = db.init(seed);
