import { Loading, action } from "solid-js";
import { render } from "@solidjs/web";
import { DbConnection, tables } from "../../src/module_bindings/index";
import {
  SpacetimeDBProvider,
  useReducers,
  useRow,
} from "../../src/spacetimedb";

const boardId = new URL(location.href).searchParams.get("board")!;
const builder = DbConnection.builder()
  .withUri("ws://127.0.0.1:3001")
  .withDatabaseName("solid-kanban")
  .onConnect((db) => {
    (window as any).fixtureDb = db;
  });

function Harness() {
  const reducers = useReducers();
  const board = useRow(
    () => tables.board,
    () => boardId,
  );
  const releases: Record<string, () => void> = {};
  const run = action(function* (title: string) {
    yield reducers.editBoard({
      boardId,
      actor: "Acknowledgment test",
      title,
      description: "",
    });
    yield new Promise<void>((resolve) => {
      releases[title] = resolve;
    });
  });
  const fail = action(function* () {
    yield reducers.moveCard({
      boardId,
      actor: "Acknowledgment test",
      id: "missing",
      laneId: boardId + "-0",
      orderKey: "8",
    });
  });
  const noop = action(function* () {
    yield reducers.deleteCard({
      boardId,
      actor: "Acknowledgment test",
      id: "already-gone",
    });
  });
  Object.assign(window, { fixture: { run, fail, noop, releases } });
  return (
    <Loading fallback={<p id="title">Loading</p>}>
      <p id="title">{board()?.title}</p>
    </Loading>
  );
}
function App() {
  return (
    <SpacetimeDBProvider connectionBuilder={builder}>
      <Harness />
    </SpacetimeDBProvider>
  );
}
render(() => <App />, document.getElementById("root")!);
