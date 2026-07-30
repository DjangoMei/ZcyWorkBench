import assert from "node:assert/strict";
import test from "node:test";
import { hasDeletedRecords } from "../lib/backup.mjs";

test("editing or adding records does not create a deletion backup", () => {
  const previous = {
    schedule: [{ id: "one", title: "before" }],
    routines: [{ id: "wechat", items: [{ id: "sub-one", done: false }] }],
  };
  const next = {
    schedule: [
      { id: "one", title: "after" },
      { id: "two", title: "new" },
    ],
    routines: [{ id: "wechat", items: [{ id: "sub-one", done: true }] }],
  };

  assert.equal(hasDeletedRecords(previous, next), false);
});

test("removing a top-level record triggers a deletion backup", () => {
  const previous = { schedule: [{ id: "one" }], reminders: [{ id: "two" }] };
  const next = { schedule: [{ id: "one" }], reminders: [] };

  assert.equal(hasDeletedRecords(previous, next), true);
});

test("weekly removal of a nested routine item triggers a deletion backup", () => {
  const previous = {
    routines: [
      {
        id: "routine-wechat",
        items: [
          { id: "open", done: false },
          { id: "finished", done: true },
        ],
      },
    ],
  };
  const next = {
    routines: [
      {
        id: "routine-wechat",
        items: [{ id: "open", done: false }],
      },
    ],
  };

  assert.equal(hasDeletedRecords(previous, next), true);
});
