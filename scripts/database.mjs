import { existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const local = resolve(root, ".tools/spacetime/spacetimedb-cli");
const executable =
  process.env.SPACETIME_BIN ?? (existsSync(local) ? local : "spacetime");
const tasks = {
  start: [
    "start",
    "--listen-addr",
    "127.0.0.1:3001",
    "--data-dir",
    ".spacetime/data",
    "--non-interactive",
  ],
  publish: [
    "publish",
    "--server",
    "http://127.0.0.1:3001",
    "--module-path",
    "spacetimedb",
    "--yes=skip-login",
    "--delete-data=never",
    "solid-kanban",
  ],
  generate: [
    "generate",
    "--lang",
    "typescript",
    "--module-path",
    "spacetimedb",
    "--out-dir",
    "src/module_bindings",
    "--yes",
  ],
};
const args = tasks[process.argv[2]];
if (!args) throw new Error("Use start, publish, or generate.");
mkdirSync(resolve(root, ".spacetime"), { recursive: true });
const child = spawn(executable, ["--root-dir", ".spacetime", ...args], {
  cwd: root,
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error(
    `Could not start SpacetimeDB. Install CLI 2.10.1 or set SPACETIME_BIN. ${error.message}`,
  );
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
