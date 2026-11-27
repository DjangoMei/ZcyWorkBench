import assert from "node:assert/strict";
import test from "node:test";
import { applyInspirationEdit } from "../lib/inspiration-edit.mjs";
import { hasDeletedRecords } from "../lib/backup.mjs";

const original = { id: "original", createdAt: "2026-11-26T08:00:00Z", category: "美",
  content: "旧内容", tag: "旧标签", link: "https://example.com", imagePath: "images/old.png", imageName: "old.png", extra: "preserved" };

test("editing preserves id, creation time, images and unknown metadata without adding a second record", () => {
  const next = applyInspirationEdit(original, { ...original, id: "changed", createdAt: "changed", category: "业", content: " 新内容 ", tag: " 新标签 " }, "2026-11-27T08:00:00Z");
  assert.equal(next.id, original.id);
  assert.equal(next.createdAt, original.createdAt);
  assert.equal(next.imagePath, original.imagePath);
  assert.equal(next.extra, original.extra);
  assert.equal(next.content, "新内容");
  assert.equal(next.tag, "新标签");
  assert.equal(next.updatedAt, "2026-11-27T08:00:00Z");
  assert.equal(original.content, "旧内容");
  assert.equal(hasDeletedRecords({ inspirations: [original] }, { inspirations: [next] }), false);
});

test("images and links may be replaced or detached without changing the source record", () => {
  const replace = applyInspirationEdit(original, { ...original, imagePath: "images/new.png", imageName: "new.png", link: "" }, "now");
  assert.equal(replace.imagePath, "images/new.png");
  assert.equal(replace.link, "");
  const remove = applyInspirationEdit(original, { ...original, imagePath: "", imageName: "" }, "now");
  assert.equal(remove.imagePath, "");
  assert.equal(original.imagePath, "images/old.png");
});
