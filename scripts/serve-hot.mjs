import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const vinextCli = path.join(
  projectRoot,
  "node_modules",
  "vinext",
  "dist",
  "cli.js",
);
const child = spawn(
  process.execPath,
  [vinextCli, "dev", ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      ZCY_WORKBENCH_ENABLE_HMR: "true",
      WRANGLER_LOG_PATH:
        process.env.WRANGLER_LOG_PATH || path.join(".wrangler", "wrangler.log"),
    },
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  throw error;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
