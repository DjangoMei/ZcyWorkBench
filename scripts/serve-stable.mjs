import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const defaultHost = process.env.HOST || "127.0.0.1";
const defaultPort = process.env.PORT || "4318";

function readServerAddress(args) {
  let host = defaultHost;
  let port = defaultPort;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--host" || argument === "--hostname" || argument === "-H") {
      host = args[index + 1] || host;
      index += 1;
    } else if (argument.startsWith("--host=")) {
      host = argument.slice("--host=".length);
    } else if (argument.startsWith("--hostname=")) {
      host = argument.slice("--hostname=".length);
    } else if (argument === "--port" || argument === "-p") {
      port = args[index + 1] || port;
      index += 1;
    } else if (argument.startsWith("--port=")) {
      port = argument.slice("--port=".length);
    }
  }

  const parsedPort = Number.parseInt(port, 10);
  if (!host || !Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(`Invalid server address: ${host}:${port}`);
  }

  return { host, port: String(parsedPort) };
}

let activeChild;
let stopping = false;

function run(command, args) {
  return new Promise((resolve, reject) => {
    activeChild = spawn(command, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        WRANGLER_LOG_PATH:
          process.env.WRANGLER_LOG_PATH || path.join(".wrangler", "wrangler.log"),
      },
      stdio: "inherit",
    });

    activeChild.once("error", reject);
    activeChild.once("exit", (code, signal) => {
      activeChild = undefined;
      if (code === 0 || stopping) {
        resolve();
        return;
      }
      reject(
        new Error(
          signal
            ? `${command} stopped by ${signal}`
            : `${command} exited with code ${code}`,
        ),
      );
    });
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    activeChild?.kill(signal);
  });
}

const { host, port } = readServerAddress(process.argv.slice(2));
const npmCli = process.env.npm_execpath;
const wranglerCli = path.join(
  projectRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

if (!npmCli || !existsSync(npmCli)) {
  throw new Error("Start this service through npm so the build command is available.");
}

await run(process.execPath, [npmCli, "run", "build"]);
await run(process.execPath, [
  wranglerCli,
  "dev",
  "--config",
  path.join("dist", "server", "wrangler.json"),
  "--ip",
  host,
  "--port",
  port,
  "--persist-to",
  path.join(".wrangler", "state"),
  "--show-interactive-dev-session=false",
]);
