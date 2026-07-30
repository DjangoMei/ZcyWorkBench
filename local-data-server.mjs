import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasDeletedRecords } from "./lib/backup.mjs";

const PORT = 4174;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(ROOT, "个人资料库");
const IMAGE_ROOT = path.join(DATA_ROOT, "灵感图片");
const EXPORT_ROOT = path.join(DATA_ROOT, "导出");
const BACKUP_ROOT = path.join(DATA_ROOT, "三日备份");
const DATA_FILE = path.join(DATA_ROOT, "data.json");
const BACKUP_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

const emptyData = {
  projects: [],
  schedule: [],
  routines: [
    { id: "routine-music", title: "广播音乐", cycle: "每周更新", done: false, items: [] },
    { id: "routine-meeting", title: "周例会", cycle: "每周", done: false, items: [] },
    { id: "routine-wechat", title: "官微", cycle: "本周发布清单", done: false, items: [] },
    { id: "routine-expense", title: "报销", cycle: "本周报销清单", done: false, items: [] },
  ],
  music: [],
  attendance: [],
  looseMemos: [],
  reminders: [],
  birthdays: [],
  inspirations: [],
  checkins: {},
  exercise: {},
  lastSundayCleanup: "",
};

await mkdir(IMAGE_ROOT, { recursive: true });
await mkdir(EXPORT_ROOT, { recursive: true });
await mkdir(BACKUP_ROOT, { recursive: true });
try {
  await access(DATA_FILE);
} catch {
  await writeFile(DATA_FILE, `${JSON.stringify(emptyData, null, 2)}\n`, "utf8");
}

function corsHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  };
}

function send(response, status, body, contentType) {
  response.writeHead(status, corsHeaders(contentType));
  response.end(body);
}

async function readBody(request, maxBytes = 25 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("文件过大");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function safeFileName(value) {
  const parsed = path.parse(value || "image");
  const base = parsed.name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  const ext = parsed.ext.toLowerCase().replace(/[^.\w]/g, "").slice(0, 10);
  return `${base || "image"}-${Date.now()}-${randomUUID().slice(0, 6)}${ext}`;
}

async function pruneExpiredBackups(now = Date.now()) {
  const entries = await readdir(BACKUP_ROOT, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const filePath = path.join(BACKUP_ROOT, entry.name);
        const info = await stat(filePath);
        if (now - info.mtimeMs > BACKUP_RETENTION_MS) {
          await unlink(filePath);
        }
      }),
  );
}

async function saveDataWithBackup(nextData) {
  const previousText = await readFile(DATA_FILE, "utf8");
  const previousData = JSON.parse(previousText);

  if (hasDeletedRecords(previousData, nextData)) {
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");
    const backupFile = path.join(
      BACKUP_ROOT,
      `删除前备份-${stamp}-${randomUUID().slice(0, 6)}.json`,
    );
    await writeFile(backupFile, previousText, "utf8");
  }

  const temporary = `${DATA_FILE}.tmp`;
  await writeFile(temporary, `${JSON.stringify(nextData, null, 2)}\n`, "utf8");
  await rename(temporary, DATA_FILE);
  await pruneExpiredBackups();
}

let saveQueue = Promise.resolve();

function asMarkdown(inspirations) {
  const rows = inspirations.map((item, index) => {
    const image = item.imagePath ? `个人资料库/${item.imagePath}` : "";
    return [
      `## ${index + 1}. ${item.category || "未分类"} · ${item.tag || "无标签"}`,
      "",
      item.content || "",
      "",
      item.link ? `- 链接：${item.link}` : "",
      image ? `- 本地图片：${image}` : "",
      `- 创建时间：${item.createdAt || ""}`,
      "",
    ]
      .filter((line) => line !== "")
      .join("\n");
  });
  return [
    "# 灵感碎片导出",
    "",
    `导出时间：${new Date().toISOString()}`,
    "",
    ...rows,
  ].join("\n\n");
}

const server = createServer(async (request, response) => {
  if (!request.url) return send(response, 404, "Not found", "text/plain");
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);

  try {
    if (request.method === "OPTIONS") {
      return send(response, 204, "");
    }

    if (request.method === "GET" && url.pathname === "/api/data") {
      return send(response, 200, await readFile(DATA_FILE));
    }

    if (request.method === "PUT" && url.pathname === "/api/data") {
      const body = await readBody(request, 8 * 1024 * 1024);
      const parsed = JSON.parse(body.toString("utf8"));
      saveQueue = saveQueue
        .catch(() => undefined)
        .then(() => saveDataWithBackup(parsed));
      await saveQueue;
      return send(response, 200, JSON.stringify({ ok: true }));
    }

    if (request.method === "POST" && url.pathname === "/api/upload") {
      const filename = safeFileName(url.searchParams.get("name") || "image");
      const body = await readBody(request);
      await writeFile(path.join(IMAGE_ROOT, filename), body);
      return send(
        response,
        200,
        JSON.stringify({
          name: filename,
          path: `灵感图片/${filename}`,
        }),
      );
    }

    if (request.method === "POST" && url.pathname === "/api/export") {
      const body = JSON.parse((await readBody(request)).toString("utf8"));
      const format = body.format === "markdown" ? "markdown" : "json";
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const filename =
        format === "markdown"
          ? `灵感碎片-${stamp}.md`
          : `灵感碎片-${stamp}.json`;
      const content =
        format === "markdown"
          ? asMarkdown(body.inspirations || [])
          : `${JSON.stringify(
              {
                exportedAt: new Date().toISOString(),
                format: "zcy-inspiration-v1",
                inspirations: body.inspirations || [],
              },
              null,
              2,
            )}\n`;
      await writeFile(path.join(EXPORT_ROOT, filename), content, "utf8");
      return send(
        response,
        200,
        JSON.stringify({
          filename,
          url: `/files/${encodeURIComponent("导出")}/${encodeURIComponent(filename)}`,
        }),
      );
    }

    if (request.method === "GET" && url.pathname.startsWith("/files/")) {
      const relative = decodeURIComponent(url.pathname.slice("/files/".length));
      const filePath = path.resolve(DATA_ROOT, relative);
      const rootPath = path.resolve(DATA_ROOT);
      if (!filePath.startsWith(`${rootPath}${path.sep}`)) {
        return send(response, 403, "Forbidden", "text/plain; charset=utf-8");
      }
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("Not found");
      const extension = path.extname(filePath).toLowerCase();
      const mime =
        {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
          ".json": "application/json; charset=utf-8",
          ".md": "text/markdown; charset=utf-8",
        }[extension] || "application/octet-stream";
      response.writeHead(200, {
        ...corsHeaders(mime),
        "Content-Disposition": ["json", ".md"].includes(extension)
          ? `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`
          : "inline",
      });
      response.end(await readFile(filePath));
      return;
    }

    return send(response, 404, "Not found", "text/plain; charset=utf-8");
  } catch (error) {
    return send(
      response,
      500,
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`本地资料服务已启动：http://127.0.0.1:${PORT}`);
  console.log(`资料目录：${DATA_ROOT}`);
});
