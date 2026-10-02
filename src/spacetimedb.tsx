import {
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
} from "solid-js";
import {
  evaluateBooleanExpr,
  getQueryAccessorName,
  getQueryWhereClause,
  BooleanExpr,
  type ColumnBuilder,
  type RowTypedQuery,
  type TableRef,
} from "spacetimedb";
import {
  DbConnection,
  reducers as reducerDefinitions,
  type SubscriptionHandle,
} from "./module_bindings/index.js";
import { SyncPromise } from "./primitives/syncpromise";
import type { JSX } from "@solidjs/web";

type AnyQuery = RowTypedQuery<any, any>;
type AnyTable = TableRef<any> & AnyQuery;
type QueryRow<Q extends AnyQuery> =
  Q extends RowTypedQuery<infer Row, any> ? Row : never;

type PrimaryKeyName<T extends AnyTable> = {
  [K in keyof T["columns"] & string]: T["columns"][K] extends ColumnBuilder<
    any,
    any,
    infer Metadata
  >
    ? Metadata extends { isPrimaryKey: true }
      ? K
      : never
    : never;
}[keyof T["columns"] & string];

type PrimaryKeyValue<T extends AnyTable> =
  PrimaryKeyName<T> extends keyof QueryRow<T>
    ? QueryRow<T>[PrimaryKeyName<T>]
    : never;

type ConnectionSession = {
  db: DbConnection;
  reducers: DbConnection["reducers"];
  subscriptions: Set<SharedSubscription>;
};

type Predicate = BooleanExpr<any>["data"];
type Comparison = Extract<Predicate, { left: unknown }>;
type Term = { comparison: Comparison; negated: boolean };

function andDNF(left: Term[][], right: Term[][]): Term[][] {
  return left.flatMap((a) => right.map((b) => [...a, ...b]));
}

// An OR of ANDs. An empty conjunction is true; no alternatives is false.
function toDNF(predicate: Predicate, negated = false): Term[][] {
  if (predicate.type === "not") return toDNF(predicate.clause, !negated);
  if (predicate.type === "and" || predicate.type === "or") {
    const clauses = predicate.clauses.map((clause) => toDNF(clause, negated));
    if ((predicate.type === "or") !== negated) return clauses.flat();
    return clauses.reduce(andDNF, [[]]);
  }
  if (predicate.type === "ne") {
    return [[{ comparison: { ...predicate, type: "eq" }, negated: !negated }]];
  }
  // Keep negation explicit rather than assuming, for example, !(x > y)
  // equals x <= y. Comparisons we cannot prove remain potentially satisfiable.
  return [[{ comparison: predicate, negated }]];
}

function valueKey(value: Comparison["left"]): string {
  return JSON.stringify(
    value.type === "column"
      ? ["column", value.table, value.columnName]
      : ["literal", value.value],
    // SDK identity/UUID/timestamp/connection literals contain a bigint field.
    (_key, value) =>
      typeof value === "bigint" ? ["bigint", String(value)] : value,
  );
}

function isContradictory(terms: Term[]): boolean {
  const signs = new Map<string, boolean>();
  const equalities = new Map<string, string>();
  const reversed = {
    eq: "eq",
    ne: "ne",
    gt: "lt",
    lt: "gt",
    gte: "lte",
    lte: "gte",
  } as const;
  for (const { comparison, negated } of terms) {
    let left = valueKey(comparison.left);
    let right = valueKey(comparison.right);
    let operator = comparison.type;
    if (left > right) {
      [left, right] = [right, left];
      operator = reversed[operator];
    }
    const key = JSON.stringify([operator, left, right]);
    if (signs.has(key) && signs.get(key) !== negated) return true;
    signs.set(key, negated);

    if (negated || operator !== "eq") continue;
    const column =
      comparison.left.type === "column" ? comparison.left : comparison.right;
    const literal =
      comparison.left.type === "literal" ? comparison.left : comparison.right;
    if (column.type !== "column" || literal.type !== "literal") continue;
    const columnKey = valueKey(column);
    const literalKey = valueKey(literal);
    if (equalities.has(columnKey) && equalities.get(columnKey) !== literalKey)
      return true;
    equalities.set(columnKey, literalKey);
  }
  return false;
}

export function isQueryCovered(
  query: AnyQuery,
  existing: readonly AnyQuery[],
): boolean {
  const table = getQueryAccessorName(query);
  const matching = existing.filter(
    (other) => getQueryAccessorName(other) === table,
  );
  if (matching.length === 0) return false;
  const predicates = matching.map(getQueryWhereClause);
  if (predicates.some((predicate) => !predicate)) return true;
  const requested = getQueryWhereClause(query);
  // new AND NOT(existing₁ OR existing₂ ...) = new AND NOT(existing₁) AND ...
  const counterexamples = predicates.reduce(
    (branches, predicate) => andDNF(branches, toDNF(predicate!.data, true)),
    requested ? toDNF(requested.data) : [[]],
  );
  return counterexamples.every(isContradictory);
}

type SharedSubscription = {
  query: AnyQuery;
  applied: boolean;
  ready: SyncPromise<void>;
  readers: Set<(error: unknown) => void>;
  handle?: SubscriptionHandle;
};

function cachedUniqueRows(
  session: ConnectionSession,
  query: AnyQuery,
): Record<string, any>[] | undefined {
  const where = getQueryWhereClause(query);
  if (!where) return;
  const table = ("table" in query ? query.table : query) as AnyTable;
  const unique = new Set(
    Object.entries(table.columns)
      .filter(([, column]) => {
        const metadata = (column as ColumnBuilder<any, any, any>)
          .columnMetadata;
        return metadata.isPrimaryKey || metadata.isUnique;
      })
      .map(([name]) => name),
  );
  for (const constraint of table.constraints as readonly {
    constraint: string;
    columns: readonly string[];
  }[]) {
    if (constraint.constraint === "unique" && constraint.columns.length === 1)
      unique.add(constraint.columns[0]);
  }
  const cache = session.db.db[
    getQueryAccessorName(query) as keyof typeof session.db.db
  ] as { iter(): Iterable<Record<string, any>> };
  const rows = Array.from(cache.iter());
  const witnesses: Record<string, any>[] = [];
  for (const branch of toDNF(where.data)) {
    if (isContradictory(branch)) continue;
    let witness: Record<string, any> | undefined;
    for (const { comparison, negated } of branch) {
      if (negated || comparison.type !== "eq") continue;
      const column =
        comparison.left.type === "column" ? comparison.left : comparison.right;
      const literal =
        comparison.left.type === "literal" ? comparison.left : comparison.right;
      if (
        column.type !== "column" ||
        literal.type !== "literal" ||
        !unique.has(column.column)
      )
        continue;
      witness = rows.find((row) =>
        evaluateBooleanExpr(new BooleanExpr(comparison), row),
      );
      if (witness) break;
    }
    if (!witness) return;
    // Only the unique equality must match. If the rest of this branch rejects
    // the cached row, uniqueness proves that branch's answer is empty.
    witnesses.push(witness);
  }
  return witnesses;
}

function retainSubscription(
  session: ConnectionSession,
  query: AnyQuery,
  onError: (error: unknown) => void,
): { ready: SyncPromise<void>; applied: SyncPromise<void>; release(): void } {
  const available = Array.from(session.subscriptions);
  const applied = available.filter((entry) => entry.applied);
  const single = applied.find((entry) => isQueryCovered(query, [entry.query]));
  let covering = single
    ? [single]
    : applied.filter(
        (entry) =>
          getQueryAccessorName(entry.query) === getQueryAccessorName(query),
      );
  const covered = isQueryCovered(
    query,
    covering.map((entry) => entry.query),
  );
  if (!covered) {
    // Equivalent pending queries can share the same initial acknowledgement.
    const pending = available.find(
      (entry) =>
        !entry.applied &&
        isQueryCovered(query, [entry.query]) &&
        isQueryCovered(entry.query, [query]),
    );
    covering = pending ? [pending] : [];
  }

  if (covering.length === 0) {
    const entry: SharedSubscription = {
      query,
      applied: false,
      ready: new SyncPromise<void>(),
      readers: new Set(),
    };
    entry.handle = session.db
      .subscriptionBuilder()
      .onApplied(() => {
        entry.applied = true;
        // A reader may have unmounted before the subscription was applied.
        if (entry.readers.size === 0) {
          entry.handle?.unsubscribe();
          return;
        }
        entry.ready.resolve(undefined);
      })
      .onError((ctx) => {
        session.subscriptions.delete(entry);
        const error = ctx.event ?? new Error("SpacetimeDB subscription failed");
        entry.ready.reject(error);
        for (const fail of Array.from(entry.readers)) fail(error);
      })
      .subscribe(query);
    session.subscriptions.add(entry);
    covering = [entry];
  }

  let borrowed: SharedSubscription[] = [];
  let snapshotKnown = false;
  if (!covered) {
    const witnesses = cachedUniqueRows(session, query);
    if (witnesses) {
      const suppliers = witnesses.map((row) =>
        applied.find((entry) => {
          if (getQueryAccessorName(entry.query) !== getQueryAccessorName(query))
            return false;
          const where = getQueryWhereClause(entry.query);
          return !where || evaluateBooleanExpr(where, row);
        }),
      );
      // Do not borrow rows left in the cache by an unsubscribing reader.
      if (suppliers.every((entry) => entry !== undefined)) {
        borrowed = Array.from(new Set(suppliers));
        snapshotKnown = true;
      }
    }
  }
  // Retaining every covering entry keeps the cache complete even if the
  // components which originally subscribed unmount.
  const retained = [...covering, ...borrowed];
  for (const entry of retained) entry.readers.add(onError);
  const releaseEntries = (entries: SharedSubscription[]) => {
    for (const entry of entries) {
      if (!entry.readers.delete(onError) || entry.readers.size !== 0) continue;
      session.subscriptions.delete(entry);
      if (entry.handle?.isActive()) entry.handle.unsubscribe();
    }
  };
  // A cached unique match proves the initial snapshot, not ongoing coverage.
  // Keep its suppliers until our own subscription takes over.
  if (borrowed.length > 0)
    covering[0].ready.then(
      () => releaseEntries(borrowed),
      () => releaseEntries(borrowed),
    );
  // Union coverage only uses applied entries; all their readiness is settled.
  const ready = snapshotKnown
    ? SyncPromise.resolve(undefined)
    : covering[0].ready;
  let released = false;
  return {
    ready,
    applied: covering[0].ready,
    release() {
      if (released) return;
      released = true;
      releaseEntries(retained);
    },
  };
}

const SpacetimeDBContext =
  createContext<Accessor<Promise<ConnectionSession>>>();

function createSession(
  db: DbConnection,
  disconnected: Promise<void>,
): ConnectionSession {
  const pending = new Set<(error: Error) => void>();
  let disconnectError: Error | undefined;
  void disconnected.then(() => {
    disconnectError = new Error(
      "Disconnected before reducer confirmation; the outcome is unknown.",
    );
    for (const reject of pending) reject(disconnectError);
    pending.clear();
  });

  const reducers = Object.fromEntries(
    Object.entries(db.reducers).map(([name, reducer]) => [
      name,
      (args: unknown) =>
        new Promise<void>((resolve, reject) => {
          if (disconnectError || !db.isActive) {
            reject(
              disconnectError ?? new Error("SpacetimeDB is disconnected."),
            );
            return;
          }

          pending.add(reject);
          try {
            Reflect.apply(reducer, db.reducers, [args]).then(
              () => {
                pending.delete(reject);
                resolve();
              },
              (error: unknown) => {
                pending.delete(reject);
                reject(error);
              },
            );
          } catch (error) {
            pending.delete(reject);
            reject(error);
          }
        }),
    ]),
  ) as DbConnection["reducers"];

  return { db, reducers, subscriptions: new Set() };
}

function getPrimaryKey(
  table: TableRef<any>,
): [string, ColumnBuilder<any, any, any>] | undefined {
  return Object.entries(table.columns).find(
    ([, column]) =>
      (column as ColumnBuilder<any, any, any>).columnMetadata.isPrimaryKey,
  ) as [string, ColumnBuilder<any, any, any>] | undefined;
}

function readRows<Q extends AnyQuery>(
  connection: DbConnection,
  query: Q,
): readonly QueryRow<Q>[] {
  const table = connection.db[
    getQueryAccessorName(query) as keyof typeof connection.db
  ] as { iter(): Iterable<QueryRow<Q>> };
  const where = getQueryWhereClause(query);
  const rows = Array.from(table.iter());
  return where
    ? rows.filter((row) =>
        evaluateBooleanExpr(where, row as Record<string, any>),
      )
    : rows;
}

function serverRows<Q extends AnyQuery>(
  connection: Promise<ConnectionSession>,
  query: Q,
): Promise<readonly QueryRow<Q>[]> {
  return connection.then(
    (current) =>
      new Promise<readonly QueryRow<Q>[]>((resolve, reject) => {
        const subscription = retainSubscription(current, query, reject);
        subscription.ready.then(() => {
          try {
            resolve(readRows(current.db, query));
          } catch (error) {
            reject(error);
          }
        }, reject);
      }),
  );
}

export function SpacetimeDBProvider(props: {
  connectionBuilder: ReturnType<typeof DbConnection.builder>;
  children: JSX.Element;
}) {
  // JSX props are accessors; read the builder only once so callbacks and build
  // belong to the same instance.
  const builder = props.connectionBuilder;
  let waiting = Promise.withResolvers<ConnectionSession>();
  let lost = Promise.withResolvers<void>();
  const [connection, setConnection] = createSignal(waiting.promise);

  if (import.meta.env.SSR) {
    let attempt: DbConnection | undefined;
    builder
      .onConnect((next) => waiting.resolve(createSession(next, lost.promise)))
      .onConnectError((_ctx, error) => waiting.reject(error))
      .onDisconnect(() => {
        lost.resolve();
        waiting.reject(new Error("SpacetimeDB disconnected while connecting."));
      });
    attempt = builder.build();
    onCleanup(() => {
      lost.resolve();
      attempt?.disconnect();
    });
    return (
      <SpacetimeDBContext value={connection}>
        {props.children}
      </SpacetimeDBContext>
    );
  }

  let attempt: DbConnection | undefined;
  let latestToken: string | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 1_000;
  let disposed = false;

  const buildConnection = () => {
    try {
      if (latestToken !== undefined) builder.withToken(latestToken);
      attempt = builder.build();
    } catch (error) {
      waiting.reject(error);
    }
  };

  const scheduleReconnect = () => {
    if (disposed || retryTimer !== undefined) return;
    const delay = retryDelay;
    retryDelay = Math.min(retryDelay * 2, 30_000);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      buildConnection();
    }, delay);
  };

  builder
    .onConnect((next, _identity, token) => {
      if (disposed || next !== attempt) return;
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      latestToken = token;
      retryDelay = 1_000;
      const session = createSession(next, lost.promise);
      waiting.resolve(session);
      setConnection(Promise.resolve(session));
    })
    .onConnectError((ctx) => {
      if (disposed || ctx !== attempt || attempt.isDisconnectRequested) return;
      scheduleReconnect();
    })
    .onDisconnect((ctx) => {
      if (disposed || ctx !== attempt) return;
      lost.resolve();
      if (attempt.isDisconnectRequested) return;
      lost = Promise.withResolvers<void>();
      waiting = Promise.withResolvers<ConnectionSession>();
      setConnection(waiting.promise);
      scheduleReconnect();
    });

  buildConnection();
  onCleanup(() => {
    disposed = true;
    lost.resolve();
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    attempt?.disconnect();
  });

  return (
    <SpacetimeDBContext value={connection}>{props.children}</SpacetimeDBContext>
  );
}

export function useSpacetimeDB() {
  const connection = useContext(SpacetimeDBContext);
  if (!connection) throw new Error("SpacetimeDBProvider is missing");
  return connection;
}

export function useReducers(): DbConnection["reducers"] {
  const connection = useSpacetimeDB();
  return Object.fromEntries(
    Object.keys(reducerDefinitions).map((name) => [
      name,
      async (args: unknown) => {
        const session = await connection();
        const reducer = session.reducers[name as keyof typeof session.reducers];
        return Reflect.apply(reducer, session.reducers, [args]);
      },
    ]),
  ) as DbConnection["reducers"];
}

export function useTable<Q extends AnyQuery>(
  query: () => Q,
): Accessor<readonly QueryRow<Q>[]> {
  const connection = useSpacetimeDB();
  const source = createMemo(() => {
    const current = query();
    if ("sourceQuery" in (current as object)) {
      throw new Error("useTable does not support semijoin queries");
    }

    const ready = connection();
    if (import.meta.env.SSR) return () => serverRows(ready, current);

    const [rows, setRows] = createSignal<readonly QueryRow<Q>[] | Error>();
    // Resolve the first snapshot in the subscription callback's update.
    const first = new SyncPromise<readonly QueryRow<Q>[]>();
    let disposed = false;
    let initialized = false;
    let publicationQueued = false;
    let subscription: ReturnType<typeof retainSubscription> | undefined;
    let detach = () => {};

    const fail = (cause: unknown) => {
      if (disposed) return;
      publicationQueued = false;
      const error =
        cause instanceof Error
          ? cause
          : new Error("SpacetimeDB subscription failed");
      setRows(error);
      if (!initialized) first.reject(error);
      detach();
      subscription?.release();
    };

    void ready
      .then((session) => {
        if (disposed) return;
        const db = session.db;
        const table = db.db[
          getQueryAccessorName(current) as keyof typeof db.db
        ] as {
          onInsert(callback: () => void): void;
          onDelete(callback: () => void): void;
          onUpdate(callback: () => void): void;
          removeOnInsert(callback: () => void): void;
          removeOnDelete(callback: () => void): void;
          removeOnUpdate(callback: () => void): void;
        };
        const publishRows = () => {
          if (disposed) return;
          try {
            const next = readRows(db, current);
            setRows(next);
            if (!initialized) {
              initialized = true;
              first.resolve(next);
            }
          } catch (error) {
            fail(error);
          }
        };
        const queuePublication = () => {
          if (disposed || publicationQueued) return;
          publicationQueued = true;
          // Temporary timing workaround for SpacetimeDB 2.10.1: row callbacks run
          // before the native reducer Promise resolves. Our session wrapper and
          // async useReducers add two more Promise reactions. Three microtasks put
          // these writes before action resumption, but their Solid flush after it,
          // allowing the action to adopt the cache update. This depends on the
          // current Promise chain; remove once synchronous reducer callbacks or
          // explicit external-delivery entanglement are available.
          queueMicrotask(() =>
            queueMicrotask(() =>
              queueMicrotask(() => {
                if (!publicationQueued) return;
                publicationQueued = false;
                publishRows();
              }),
            ),
          );
        };
        detach = () => {
          table.removeOnInsert(queuePublication);
          table.removeOnDelete(queuePublication);
          table.removeOnUpdate(queuePublication);
        };

        subscription = retainSubscription(session, current, fail);
        // A cached unique row proves only the initial snapshot. Start streaming
        // cache changes once our subscription applies, so a supplier losing the
        // row during handoff cannot publish an incomplete result.
        if (subscription.ready !== subscription.applied)
          subscription.ready.then(publishRows, fail);
        subscription.applied.then(() => {
          if (disposed) return;
          table.onInsert(queuePublication);
          table.onDelete(queuePublication);
          table.onUpdate(queuePublication);
          publishRows();
        }, fail);
      })
      .catch(fail);

    onCleanup(() => {
      disposed = true;
      detach();
      subscription?.release();
    });

    return () => {
      const value = rows();
      if (value instanceof Error) throw value;
      return value ?? first;
    };
  });

  return createMemo<readonly QueryRow<Q>[]>(() => source()(), {
    ssrSource: "hybrid",
  });
}

export function useRow<T extends AnyTable>(
  table: () => T,
  primaryKey: () => PrimaryKeyValue<T>,
): Accessor<QueryRow<T> | undefined> {
  const rows = useTable(() => {
    const current = table();
    const key = getPrimaryKey(current);
    if (!key)
      throw new Error(`Table ${current.accessorName} has no primary key`);
    const [columnName] = key;
    const value = primaryKey();
    return (current as any).where((row: any) =>
      row[columnName].eq(value),
    ) as AnyQuery;
  });
  return createMemo(() => rows()[0] as QueryRow<T> | undefined);
}
