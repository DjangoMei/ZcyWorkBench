import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { BASE_PATH } from "../app/base-path";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const clientDirectory = resolve(root, "dist", "client");
      const basePathSegment = BASE_PATH.replace(/^\/+|\/+$/g, "");
      const basePathDirectory = resolve(clientDirectory, basePathSegment);
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      if (basePathSegment && (await exists(clientDirectory))) {
        await rm(basePathDirectory, { recursive: true, force: true });
        await mkdir(basePathDirectory, { recursive: true });

        for (const entry of await readdir(clientDirectory, {
          withFileTypes: true,
        })) {
          if (entry.name === basePathSegment || entry.name === "_headers") {
            continue;
          }

          await cp(
            resolve(clientDirectory, entry.name),
            resolve(basePathDirectory, entry.name),
            { recursive: entry.isDirectory() },
          );
        }

        const headersPath = resolve(clientDirectory, "_headers");
        const immutableAssetsRule = `${BASE_PATH}/assets/*\n  Cache-Control: public, max-age=31536000, immutable`;
        const headers = (await exists(headersPath))
          ? await readFile(headersPath, "utf8")
          : "";

        if (!headers.includes(`${BASE_PATH}/assets/*`)) {
          await writeFile(
            headersPath,
            `${headers.trimEnd()}\n${immutableAssetsRule}\n`,
          );
        }
      }

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}
