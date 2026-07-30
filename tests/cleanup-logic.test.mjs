import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanAttendanceRecords,
  cleanCompletedSchedules,
  cleanExpiredReminders,
  cleanWeeklyRoutines,
} from "../lib/cleanup.mjs";

const now = new Date("2026-07-29T10:00:00+08:00");

test("past unfinished work is never deleted", () => {
  const items = [
    {
      id: "unfinished-yesterday",
      datetime: "2026-07-28T09:00",
      done: false,
      createdAt: "2026-07-28T01:00:00Z",
    },
    {
      id: "finished-yesterday",
      datetime: "2026-07-28T09:00",
      done: true,
      completedAt: "2026-07-28T02:00:00Z",
    },
  ];

  assert.deepEqual(
    cleanCompletedSchedules(items, now).map((item) => item.id),
    ["unfinished-yesterday", "finished-yesterday"],
  );
});

test("only work completed for a full three days is deleted", () => {
  const items = [
    { id: "recent", done: true, completedAt: "2026-07-27T02:00:01Z" },
    { id: "expired", done: true, completedAt: "2026-07-26T01:59:59Z" },
    { id: "legacy-without-completion-time", done: true, createdAt: "2025-01-01" },
  ];

  assert.deepEqual(
    cleanCompletedSchedules(items, now).map((item) => item.id),
    ["recent", "legacy-without-completion-time"],
  );
});

test("reminders expire by date while undated notes remain", () => {
  const items = [
    { id: "past", datetime: "2026-07-28T23:00" },
    { id: "today", datetime: "2026-07-29T08:00" },
    { id: "future", datetime: "2026-07-30T08:00" },
    { id: "undated", datetime: "" },
  ];

  assert.deepEqual(
    cleanExpiredReminders(items, "2026-07-29").map((item) => item.id),
    ["today", "future", "undated"],
  );
});

test("weekly cleanup removes completed items but carries unfinished items forward", () => {
  const routines = [
    {
      id: "routine-wechat",
      done: true,
      items: [
        { id: "open", done: false, weekKey: "2026-W30" },
        { id: "done", done: true, weekKey: "2026-W30" },
      ],
    },
  ];

  assert.deepEqual(cleanWeeklyRoutines(routines, "2026-W31"), [
    {
      id: "routine-wechat",
      done: false,
      items: [{ id: "open", done: false, weekKey: "2026-W31" }],
    },
  ]);
});

test("attendance keeps last month through the 15th and clears it on the 16th", () => {
  const records = [
    { id: "previous", date: "2026-06-30" },
    { id: "current", date: "2026-07-01" },
    { id: "undated", date: "" },
  ];

  assert.equal(cleanAttendanceRecords(records, "2026-07-15").length, 3);
  assert.deepEqual(
    cleanAttendanceRecords(records, "2026-07-16").map((item) => item.id),
    ["current", "undated"],
  );
});
