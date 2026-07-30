import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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
