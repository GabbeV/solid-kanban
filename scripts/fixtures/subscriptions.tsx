import { Errored, For, Loading, createSignal } from "solid-js";
import { render } from "@solidjs/web";
import {
  ConnectionId,
  evaluateBooleanExpr,
  getQueryAccessorName,
  getQueryWhereClause,
  makeQueryBuilder,
  schema,
  table,
  t,
  type RowExpr,
  type RowTypedQuery,
} from "spacetimedb";
import {
  SpacetimeDBProvider,
  useReducers,
  useTable,
} from "../../src/spacetimedb";
import { tables } from "../../src/module_bindings/index";

type Query = Parameters<typeof evaluateBooleanExpr>[0];
type Row = { id: string; title: string; description: string; color: string };
type ReaderSpec = { id: string; query: RowTypedQuery<Row, any> };
// These alternative schemas exercise unique metadata without changing our DB.
// The fixture cache is still addressed as "board".
const metadataBoard = makeQueryBuilder(
  schema({
    board: table(
      { name: "board" },
      {
        id: t.string(),
        title: t.string().unique(),
        description: t.string(),
        color: t.string(),
      },
    ),
  }).schemaType,
).board;
const constraintBoard = makeQueryBuilder(
  schema({
    board: table(
      {
        name: "board",
        constraints: [{ constraint: "unique", columns: ["title"] }],
      },
      {
        id: t.string(),
        title: t.string(),
        description: t.string(),
        color: t.string(),
      },
    ),
  }).schemaType,
).board;
const initial: Row[] = [
  { id: "A", title: "One", description: "", color: "blue" },
  { id: "B", title: "Two", description: "", color: "blue" },
  { id: "C", title: "Three", description: "", color: "red" },
];
const registrations: {
  query: ReaderSpec["query"];
  active: boolean;
  unsubscribed: boolean;
  applied(): void;
  error(error: Error): void;
}[] = [];
let cached: Row[] = [];
const listeners = {
  insert: new Set<() => void>(),
  update: new Set<() => void>(),
  delete: new Set<() => void>(),
};
const refreshCache = () => {
  cached = initial.filter((row) =>
    registrations.some((entry) => {
      const where = getQueryWhereClause(entry.query);
      return (
        entry.active &&
        !entry.unsubscribed &&
        (!where || evaluateBooleanExpr(where, row))
      );
    }),
  );
};
const reducerCalls: { resolve(): void }[] = [];
const acknowledgments = new Set<
  (ctx: unknown, row: { sequence: bigint }) => void
>();
const db = {
  connectionId: new ConnectionId(1n),
  isActive: true,
  reducers: {
    moveCard: (args: { sequence: bigint }) =>
      new Promise<void>((resolve) =>
        reducerCalls.push({
          resolve() {
            for (const callback of acknowledgments) callback({}, args);
            resolve();
          },
        }),
      ),
  },
  db: {
    reducerAck: {
      onInsert: (callback: (ctx: unknown, row: { sequence: bigint }) => void) =>
        acknowledgments.add(callback),
      removeOnInsert: (
        callback: (ctx: unknown, row: { sequence: bigint }) => void,
      ) => acknowledgments.delete(callback),
    },
    board: {
      iter: () => cached.values(),
      onInsert: (callback: () => void) => listeners.insert.add(callback),
      onUpdate: (callback: () => void) => listeners.update.add(callback),
      onDelete: (callback: () => void) => listeners.delete.add(callback),
      removeOnInsert: (callback: () => void) =>
        listeners.insert.delete(callback),
      removeOnUpdate: (callback: () => void) =>
        listeners.update.delete(callback),
      removeOnDelete: (callback: () => void) =>
        listeners.delete.delete(callback),
    },
  },
  subscriptionBuilder() {
    let applied = () => {};
    let error = (_ctx: { event: Error }) => {};
    const builder = {
      onApplied(callback: typeof applied) {
        applied = callback;
        return builder;
      },
      onError(callback: typeof error) {
        error = callback;
        return builder;
      },
      subscribe(query: ReaderSpec["query"]) {
        if (getQueryAccessorName(query) === "reducerAck") {
          applied();
          return { isActive: () => true, unsubscribe() {} };
        }
        if (getQueryAccessorName(query) !== "board")
          throw new Error("Fixture supports boards only");
        const entry = {
          query,
          active: false,
          unsubscribed: false,
          applied() {
            entry.active = true;
            refreshCache();
            applied();
          },
          error(cause: Error) {
            entry.active = false;
            refreshCache();
            error({ event: cause });
          },
        };
        registrations.push(entry);
        return {
          isActive: () => entry.active && !entry.unsubscribed,
          unsubscribe() {
            if (entry.unsubscribed) throw new Error("Double unsubscribe");
            if (!entry.active) throw new Error("Unsubscribe before applied");
            entry.unsubscribed = true;
            refreshCache();
          },
        };
      },
    };
    return builder;
  },
  disconnect() {},
};
const builder = {
  autoConnect: true,
  onConnect(callback: (next: typeof db) => void) {
    this.connect = callback;
    return this;
  },
  onConnectError() {
    return this;
  },
  onDisconnect(callback: (next: typeof db, error: Error) => void) {
    this.disconnected = callback;
    return this;
  },
  connect: (_db: typeof db) => {},
  disconnected: (_db: typeof db, _error: Error) => {},
  build() {
    if (this.autoConnect) queueMicrotask(() => this.connect(db));
    return db;
  },
};

function Reader(props: ReaderSpec) {
  const rows = useTable(() => props.query);
  return <output id={props.id}>{JSON.stringify(rows())}</output>;
}

function Harness() {
  const [readers, setReaders] = createSignal<ReaderSpec[]>([]);
  const reducers = useReducers();
  Object.assign(window, {
    fixture: {
      add(
        id: string,
        predicate?: (row: RowExpr<any>) => Query,
        unique?: "metadata" | "constraint",
      ) {
        const table =
          unique === "metadata"
            ? metadataBoard
            : unique === "constraint"
              ? constraintBoard
              : tables.board;
        const query = predicate ? table.where(predicate) : table;
        setReaders((previous) => [...previous, { id, query }]);
      },
      remove(id: string) {
        setReaders((previous) => previous.filter((reader) => reader.id !== id));
      },
      apply(index: number) {
        registrations[index].applied();
      },
      error(index: number) {
        registrations[index].error(new Error("Subscription failed"));
      },
      update(id: string, title: string) {
        initial.find((row) => row.id === id)!.title = title;
        refreshCache();
        for (const callback of listeners.update) callback();
      },
      color(id: string, color: string) {
        initial.find((row) => row.id === id)!.color = color;
        refreshCache();
        for (const callback of listeners.update) callback();
      },
      registrations,
      listeners,
      reducerCalls,
      move: () =>
        reducers.moveCard({
          boardId: "test",
          id: "A",
          laneId: "test",
          orderKey: "test",
          actor: "Test",
        }),
      disconnect() {
        builder.autoConnect = false;
        db.isActive = false;
        for (const entry of registrations) entry.active = false;
        cached = [];
        builder.disconnected(db, new Error("Fixture disconnect"));
      },
      reconnect() {
        db.isActive = true;
        builder.connect(db);
      },
    },
  });
  return (
    <For each={readers()} keyed={(reader) => reader.id}>
      {(reader) => (
        <Errored
          fallback={(error) => (
            <output id={reader().id}>{String(error())}</output>
          )}
        >
          <Loading fallback={<output id={reader().id}>Pending</output>}>
            <Reader id={reader().id} query={reader().query} />
          </Loading>
        </Errored>
      )}
    </For>
  );
}

function App() {
  return (
    <SpacetimeDBProvider connectionBuilder={builder as never}>
      <Harness />
    </SpacetimeDBProvider>
  );
}
render(() => <App />, document.getElementById("root")!);
