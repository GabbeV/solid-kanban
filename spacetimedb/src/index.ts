import {
  schema,
  table,
  t,
  SenderError,
  type ReducerCtx,
} from "spacetimedb/server";
import { validOrderKey, labels, priorities } from "../../src/domain/cards";

const board = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    title: t.string(),
    description: t.string(),
    color: t.string(),
  },
);

const column = table(
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
    columnId: t.string().index("btree"),
    title: t.string(),
    description: t.string(),
    position: t.f64(),
    label: t.string(),
    priority: t.string(),
    assignee: t.string(),
    due: t.string(),
    revision: t.u32(),
    archived: t.bool(),
    orderKey: t.string().default(""),
    // Existing databases require a manual migration to drop these unused columns.
    moveVersion: t.f64().default(0),
    moveId: t.string().default(""),
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

const receipt = table(
  { public: true },
  {
    id: t.string().primaryKey(),
    boardId: t.string().index("btree"),
    actor: t.string(),
    text: t.string(),
    createdAt: t.f64(),
  },
);

const db = schema({ board, column, card, comment, receipt });
export default db;
type Ctx = ReducerCtx<typeof db.schemaType>;

export const recentActivity = db.anonymousView(
  { name: "recent_activity", public: true },
  t.array(receipt.rowType),
  (ctx) =>
    Array.from(ctx.db.board.iter()).flatMap((board) =>
      Array.from(ctx.db.receipt.boardId.filter(board.id))
        .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
        .slice(0, 50),
    ),
);

const envelope = {
  operationId: t.string(),
  boardId: t.string(),
  actor: t.string(),
};

type Envelope = { operationId: string; boardId: string; actor: string };

function text(value: string, field: string, max: number, required = true) {
  const text = value.trim();
  if (required && !text) throw new SenderError(`${field} cannot be empty.`);
  if (text.length > max)
    throw new SenderError(`${field} must be ${max} characters or fewer.`);
  return text;
}

function begin(ctx: Ctx, args: Envelope, newBoard = false): boolean {
  text(args.operationId, "Operation ID", 80);
  text(args.actor, "Name", 32);
  const previous = ctx.db.receipt.id.find(args.operationId);
  if (previous) {
    if (previous.actor !== args.actor || previous.boardId !== args.boardId)
      throw new SenderError("This operation ID is already in use.");
    return false; // Idempotency: retries after an uncertain response never apply twice.
  }
  if (!newBoard && !ctx.db.board.id.find(args.boardId))
    throw new SenderError("This board no longer exists.");
  return true;
}

function confirm(ctx: Ctx, args: Envelope, message: string) {
  ctx.db.receipt.insert({
    id: args.operationId,
    boardId: args.boardId,
    actor: args.actor,
    text: message,
    createdAt: Number(ctx.timestamp.microsSinceUnixEpoch / 1000n),
  });
}

function getCard(ctx: Ctx, args: { id: string; boardId: string }) {
  const row = ctx.db.card.id.find(args.id);
  if (!row || row.boardId !== args.boardId)
    throw new SenderError("This card no longer exists.");
  return row;
}

export const createBoard = db.reducer(
  { ...envelope, title: t.string(), description: t.string() },
  (ctx, args) => {
    if (!begin(ctx, args, true)) return;
    const title = text(args.title, "Board title", 80);
    ctx.db.board.insert({
      id: text(args.boardId, "Board ID", 80),
      title,
      description: text(args.description, "Description", 500, false),
      color: "green",
    });
    ["Ideas", "To do", "In progress", "Done"].forEach((title, position) =>
      ctx.db.column.insert({
        id: `${args.boardId}-${position}`,
        boardId: args.boardId,
        title,
        position,
      }),
    );
    confirm(ctx, args, `created the board “${title}”`);
  },
);

export const renameBoard = db.reducer(
  { ...envelope, title: t.string(), description: t.string() },
  (ctx, args) => {
    if (!begin(ctx, args)) return;
    const row = ctx.db.board.id.find(args.boardId)!;
    ctx.db.board.id.update({
      ...row,
      title: text(args.title, "Board title", 80),
      description: text(args.description, "Description", 500, false),
    });
    confirm(ctx, args, "updated the board details");
  },
);

export const createColumn = db.reducer(
  { ...envelope, id: t.string(), title: t.string() },
  (ctx, args) => {
    if (!begin(ctx, args)) return;
    const position =
      Math.max(
        -1,
        ...Array.from(
          ctx.db.column.boardId.filter(args.boardId),
          (row) => row.position,
        ),
      ) + 1;
    ctx.db.column.insert({
      id: text(args.id, "Column ID", 80),
      boardId: args.boardId,
      title: text(args.title, "List title", 60),
      position,
    });
    confirm(ctx, args, `added the list “${args.title}”`);
  },
);

export const renameColumn = db.reducer(
  { ...envelope, id: t.string(), title: t.string() },
  (ctx, args) => {
    if (!begin(ctx, args)) return;
    const row = ctx.db.column.id.find(args.id);
    if (!row || row.boardId !== args.boardId)
      throw new SenderError("This list no longer exists.");
    ctx.db.column.id.update({
      ...row,
      title: text(args.title, "List title", 60),
    });
    confirm(ctx, args, `renamed a list to “${args.title}”`);
  },
);

export const createCard = db.reducer(
  {
    ...envelope,
    id: t.string(),
    columnId: t.string(),
    title: t.string(),
    orderKey: t.string(),
    description: t.string(),
    label: t.string(),
    priority: t.string(),
    assignee: t.string(),
    due: t.string(),
  },
  (ctx, args) => {
    if (!begin(ctx, args)) return;
    const target = ctx.db.column.id.find(args.columnId);
    if (!target || target.boardId !== args.boardId)
      throw new SenderError("This list no longer exists.");
    if (!validOrderKey(args.orderKey))
      throw new SenderError("Invalid card order key.");
    if (
      !labels.some((label) => label === args.label) ||
      !priorities.some((priority) => priority === args.priority)
    )
      throw new SenderError("Choose a valid label and priority.");
    if (args.due && !/^\d{4}-\d{2}-\d{2}$/.test(args.due))
      throw new SenderError("Choose a valid due date.");
    const fields = {
      id: text(args.id, "Card ID", 80),
      boardId: args.boardId,
      columnId: args.columnId,
      title: text(args.title, "Card title", 160),
      description: text(args.description, "Description", 6000, false),
      label: args.label,
      priority: args.priority,
      assignee: text(args.assignee, "Assignee", 32, false),
      due: args.due,
      orderKey: args.orderKey,
    };
    // A retry keeps the card ID, including after an uncertain successful save.
    // Apply its latest fields without inserting a duplicate card.
    const existing = ctx.db.card.id.find(fields.id);
    if (existing) {
      if (existing.boardId !== args.boardId)
        throw new SenderError("This card ID is already in use.");
      ctx.db.card.id.update({
        ...existing,
        ...fields,
        revision: existing.revision + 1,
      });
    } else {
      const position =
        Math.max(
          -1,
          ...Array.from(
            ctx.db.card.columnId.filter(args.columnId),
            (row) => row.position,
          ),
        ) + 1;
      ctx.db.card.insert({
        ...fields,
        position,
        revision: 0,
        archived: false,
        moveVersion: 0,
        moveId: "",
      });
    }
    confirm(ctx, args, `added “${args.title}”`);
  },
);

export const editCard = db.reducer(
  {
    ...envelope,
    id: t.string(),
    title: t.string(),
    description: t.string(),
    label: t.string(),
    priority: t.string(),
    assignee: t.string(),
    due: t.string(),
  },
  (ctx, args) => {
    if (!begin(ctx, args)) return;
    const row = getCard(ctx, args);
    if (row.archived)
      throw new SenderError(
        "This card was archived. Restore it before editing.",
      );
    if (
      !labels.some((label) => label === args.label) ||
      !priorities.some((priority) => priority === args.priority)
    )
      throw new SenderError("Choose a valid label and priority.");
    if (args.due && !/^\d{4}-\d{2}-\d{2}$/.test(args.due))
      throw new SenderError("Choose a valid due date.");
    ctx.db.card.id.update({
      ...row,
      title: text(args.title, "Card title", 160),
      description: text(args.description, "Description", 6000, false),
      label: args.label,
      priority: args.priority,
      assignee: text(args.assignee, "Assignee", 32, false),
      due: args.due,
      revision: row.revision + 1,
    });
    confirm(ctx, args, `edited “${args.title}”`);
  },
);

export const moveCard = db.reducer(
  {
    ...envelope,
    id: t.string(),
    columnId: t.string(),
    orderKey: t.string(),
  },
  (ctx, args) => {
    if (!begin(ctx, args)) return;
    const row = getCard(ctx, args);
    const target = ctx.db.column.id.find(args.columnId);
    if (!target || target.boardId !== args.boardId)
      throw new SenderError("The destination list no longer exists.");
    if (row.archived)
      throw new SenderError(
        "This card was archived. Restore it before moving.",
      );
    if (!validOrderKey(args.orderKey))
      throw new SenderError("Invalid card placement.");
    ctx.db.card.id.update({
      ...row,
      columnId: args.columnId,
      orderKey: args.orderKey,
    });
    confirm(ctx, args, `moved “${row.title}” to ${target.title}`);
  },
);

export const archiveCard = db.reducer(
  { ...envelope, id: t.string(), archived: t.bool() },
  (ctx, args) => {
    if (!begin(ctx, args)) return;
    const row = getCard(ctx, args);
    ctx.db.card.id.update({ ...row, archived: args.archived });
    confirm(
      ctx,
      args,
      `${args.archived ? "archived" : "restored"} “${row.title}”`,
    );
  },
);

export const addComment = db.reducer(
  { ...envelope, id: t.string(), cardId: t.string(), text: t.string() },
  (ctx, args) => {
    if (!begin(ctx, args)) return;
    const row = getCard(ctx, { id: args.cardId, boardId: args.boardId });
    ctx.db.comment.insert({
      id: text(args.id, "Comment ID", 80),
      boardId: args.boardId,
      cardId: args.cardId,
      author: args.actor,
      text: text(args.text, "Comment", 2000),
      createdAt: Number(ctx.timestamp.microsSinceUnixEpoch / 1000n),
    });
    confirm(ctx, args, `commented on “${row.title}”`);
  },
);

export const deleteCard = db.reducer(
  { ...envelope, id: t.string() },
  (ctx, args) => {
    // Deletion is also successful when an earlier attempt already removed it.
    if (!begin(ctx, args, true)) return;
    const row = ctx.db.card.id.find(args.id);
    if (row && row.boardId !== args.boardId)
      throw new SenderError("This card belongs to another board.");
    for (const comment of Array.from(
      ctx.db.comment.boardId.filter(args.boardId),
    )) {
      if (comment.cardId === args.id) ctx.db.comment.id.delete(comment.id);
    }
    if (row) ctx.db.card.id.delete(row.id);
    confirm(
      ctx,
      args,
      row ? `deleted “${row.title}”` : "confirmed card deletion",
    );
  },
);

export const deleteColumn = db.reducer(
  { ...envelope, id: t.string() },
  (ctx, args) => {
    if (!begin(ctx, args, true)) return;
    const row = ctx.db.column.id.find(args.id);
    if (row && row.boardId !== args.boardId)
      throw new SenderError("This list belongs to another board.");
    const cards = Array.from(ctx.db.card.columnId.filter(args.id));
    const cardIds = new Set(cards.map((card) => card.id));
    for (const comment of Array.from(
      ctx.db.comment.boardId.filter(args.boardId),
    )) {
      if (cardIds.has(comment.cardId)) ctx.db.comment.id.delete(comment.id);
    }
    for (const card of cards) ctx.db.card.id.delete(card.id);
    if (row) ctx.db.column.id.delete(row.id);
    confirm(
      ctx,
      args,
      row ? `deleted the list “${row.title}”` : "confirmed list deletion",
    );
  },
);

export const deleteBoard = db.reducer(envelope, (ctx, args) => {
  if (!begin(ctx, args, true)) return;
  const row = ctx.db.board.id.find(args.boardId);
  for (const comment of Array.from(ctx.db.comment.boardId.filter(args.boardId)))
    ctx.db.comment.id.delete(comment.id);
  for (const card of Array.from(ctx.db.card.boardId.filter(args.boardId)))
    ctx.db.card.id.delete(card.id);
  for (const column of Array.from(ctx.db.column.boardId.filter(args.boardId)))
    ctx.db.column.id.delete(column.id);
  for (const receipt of Array.from(ctx.db.receipt.boardId.filter(args.boardId)))
    ctx.db.receipt.id.delete(receipt.id);
  if (row) ctx.db.board.id.delete(row.id);
  // Keep this operation's receipt so retrying an uncertain response is safe.
  confirm(
    ctx,
    args,
    row ? `deleted the board “${row.title}”` : "confirmed board deletion",
  );
});

export const init = db.init((ctx) => {
  const seededAt = Number(ctx.timestamp.microsSinceUnixEpoch / 1000n);
  const crowdedCardDue = new Date(seededAt + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  ctx.db.board.insert({
    id: "studio",
    title: "A little more possible",
    description: "A shared space for the next good idea. Let's make it happen.",
    color: "green",
  });
  ctx.db.board.insert({
    id: "weekend",
    title: "The weekend project",
    description: "Small experiments, just for the joy of making.",
    color: "orange",
  });
  for (const boardId of ["studio", "weekend"]) {
    ["Ideas", "Up next", "In the making", "Made it"].forEach(
      (title, position) =>
        ctx.db.column.insert({
          id: `${boardId}-${position}`,
          boardId,
          title,
          position,
        }),
    );
  }
  const cards = [
    [
      "A calmer place to get things done",
      "Research",
      "0",
      "Maya",
      "Collect the small details that make a workspace feel welcoming. Think quiet colors, generous space, and helpful words.",
    ],
    [
      "What if planning felt like play?",
      "Design",
      "0",
      "",
      "Explore a few ideas. Nothing is too small to start with.",
    ],
    [
      "Talk to the people who will use it",
      "Research",
      "1",
      "Alex",
      "Listen first. Find out what gets in the way of a good day.",
    ],
    [
      "Write a friendlier first impression",
      "Content",
      "1",
      "Maya",
      "A warm welcome, a clear next step, and no unnecessary setup.",
    ],
    [
      "Make room for keyboard navigation",
      "Engineering",
      "1",
      "Sam",
      "Every interaction should work without a mouse. Include moving cards, opening details, and returning focus.",
    ],
    [
      "Bring the board to life",
      "Engineering",
      "2",
      "Sam",
      "Keep the experience immediate while making confirmation, failures, and retries visible.",
    ],
    [
      "Find our visual rhythm",
      "Design",
      "2",
      "Alex",
      "A small, thoughtful set of spacing, type, and color decisions.",
    ],
    [
      "Start with something real",
      "Engineering",
      "3",
      "Sam",
      "Real subscriptions. Real persistence. A shared board that stays in sync.",
    ],
    [
      "Leave the login at the door",
      "Design",
      "3",
      "Maya",
      "Choose a name and jump in. Change it whenever you like.",
    ],
  ];

  const positions = [0, 0, 0, 0];

  cards.forEach(([title, label, lane, assignee, description], i) =>
    ctx.db.card.insert({
      id: `welcome-${i}`,
      boardId: "studio",
      columnId: `studio-${lane}`,
      title,
      description,
      position: positions[Number(lane)]++,
      label,
      priority: i === 5 ? "High" : "Normal",
      assignee,
      due: i === 5 ? crowdedCardDue : "",
      revision: 0,
      archived: false,
      orderKey: "",
      moveVersion: 0,
      moveId: "",
    }),
  );

  const sampleComments: [cardId: string, author: string, text: string][] = [
    [
      "welcome-5",
      "Maya",
      "The saving state should be clear without blocking the card.",
    ],
    [
      "welcome-5",
      "Alex",
      "Let's check the layout with priority, a due date, comments, and an assignee together.",
    ],
    ["welcome-5", "Sam", "I'll try the crowded card at a narrow viewport too."],
    [
      "welcome-2",
      "Alex",
      "Three people mentioned wanting a simpler first step.",
    ],
    [
      "welcome-2",
      "Maya",
      "I can turn those notes into a shorter welcome flow.",
    ],
    ["welcome-6", "Sam", "The spacing scale is ready for review."],
  ];
  sampleComments.forEach(([cardId, author, text], i) =>
    ctx.db.comment.insert({
      id: `sample-comment-${i}`,
      boardId: "studio",
      cardId,
      author,
      text,
      createdAt: seededAt - (sampleComments.length - i) * 60 * 60 * 1000,
    }),
  );
});
