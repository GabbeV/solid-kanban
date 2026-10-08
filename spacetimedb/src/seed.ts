import type { Ctx } from "./index";
import { orderDigits } from "../../src/primitives/ordered-key";

export function seed(ctx: Ctx) {
  const seededAt = Number(ctx.timestamp.microsSinceUnixEpoch / 1000n);
  const crowdedCardDueDate = new Date(seededAt + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  ctx.db.board.insert({
    id: "studio",
    title: "A little more possible",
    description: "A shared space for the next good idea. Let's make it happen.",
    color: "blue",
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
        ctx.db.lane.insert({
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

  const orders = [0, 0, 0, 0];

  cards.forEach(([title, label, lane, assignee, description], i) =>
    ctx.db.card.insert({
      id: `welcome-${i}`,
      boardId: "studio",
      laneId: `studio-${lane}`,
      title,
      description,
      label,
      priority: i === 5 ? "High" : "Normal",
      assignee,
      dueDate: i === 5 ? crowdedCardDueDate : "",
      archived: false,
      orderKey: orderDigits[++orders[Number(lane)] * 8],
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
}
