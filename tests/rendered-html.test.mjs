import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/zcyworkbench/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the finished personal schedule dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>我的日程台<\/title>/);
  assert.match(html, /今日总览/);
  assert.match(html, /今日工作清单/);
  assert.match(html, /官微/);
  assert.match(html, /报销/);
  assert.match(html, /会议备忘/);
  assert.match(html, /社交备忘/);
  assert.match(html, /今日打卡/);
  assert.match(html, /项目工作/);
  assert.match(html, /近期提醒/);
  assert.match(html, /随手加一条日程/);
  assert.match(html, /一句话记下此刻的想法/);
  assert.doesNotMatch(html, /今天也按自己的节奏，慢慢完成/);
  assert.doesNotMatch(html, /codex-preview|Building your site/);
});

test("packages and serves the app under /zcyworkbench", async () => {
  const [config, basePath, page, layout, worker, headers] = await Promise.all([
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/base-path.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/_headers", import.meta.url), "utf8"),
    access(new URL("../dist/client/zcyworkbench/assets", import.meta.url)),
  ]);

  assert.match(config, /basePath:\s*BASE_PATH/);
  assert.match(basePath, /BASE_PATH\s*=\s*"\/zcyworkbench"/);
  assert.match(basePath, /LEGACY_BASE_PATH\s*=\s*"\/ZcyWorkBench"/);
  assert.match(basePath, /pathname\.startsWith\(`\$\{LEGACY_BASE_PATH\}\//);
  assert.match(page, /withBasePath\(/);
  assert.match(layout, /\$\{BASE_PATH\}\/og\.png/);
  assert.match(worker, /Location:\s*`\$\{canonicalPath\}\$\{url\.search\}`/);
  assert.match(headers, /\/zcyworkbench\/assets\/\*/);
});

test("loads server state and autosaves cloud changes on a fixed interval", async () => {
  const [page, worker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AUTO_SAVE_INTERVAL_MS\s*=\s*30_000/);
  assert.match(page, /fetch\(CLOUD_SYNC_API/);
  assert.match(page, /credentials:\s*"same-origin"/);
  assert.match(page, /setInterval\([\s\S]*AUTO_SAVE_INTERVAL_MS/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /keepalive:\s*true/);
  assert.match(worker, /SYNC_SESSION_PATH/);
  assert.match(worker, /HttpOnly; SameSite=Strict/);
  assert.match(worker, /env\.DB\.batch\(statements\)/);
});

test("orders today's work by completion state and newest creation time", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /function compareScheduleNewestFirst/);
  assert.match(page, /Number\(a\.done\) - Number\(b\.done\)/);
  assert.match(
    page,
    /scheduleCreatedAtTime\(b\) - scheduleCreatedAtTime\(a\)/,
  );
  assert.ok(
    page.match(/\.sort\(compareScheduleNewestFirst\)/g)?.length >= 3,
    "the homepage and schedule detail views should use the same ordering",
  );
});
