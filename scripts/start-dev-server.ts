import { existsSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const workDir = path.join(root, "work");
if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

const logPath = path.join(workDir, "dev-server.log");
const pidPath = path.join(workDir, "dev-server.pid");
const out = openSync(logPath, "a");
const err = openSync(logPath, "a");

const nodeBinDir = "/Users/aaa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin";
const binDir = "/Users/aaa/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin";

const child = spawn("pnpm", ["dev", "--hostname", "127.0.0.1", "--port", "3001"], {
  cwd: root,
  detached: true,
  stdio: ["ignore", out, err],
  env: {
    ...process.env,
    PATH: `${nodeBinDir}:${binDir}:${process.env.PATH ?? ""}`
  }
});

child.unref();
writeFileSync(pidPath, String(child.pid));
console.log(`Started dev server pid ${child.pid}`);
