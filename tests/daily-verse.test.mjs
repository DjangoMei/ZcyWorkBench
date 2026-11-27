import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createDailyVersePicker, shenzhenDayNumber } from "../lib/daily-verse.mjs";

const page = (await readFile(new URL("../app/page.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const additional = (await readFile(new URL("../app/additional-daily-lines.ts", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const additionalPool = runInNewContext("(" + additional.match(/additionalDailyLines: AdditionalDailyLine\[\] = (\[[\s\S]*\]);/)[1] + ")", { note: id => id });
const lines = runInNewContext("(" + page.match(/const dailyLines = (\[[\s\S]*?\n\]);/)[1] + ")", {
  additionalDailyLines: additionalPool, xhsDailyLineNotes: new Proxy({}, { get: () => "test-source" }),
});
const seasonMeta = runInNewContext("(" + page.match(/> = (\{\n  spring:[\s\S]*?\n\});/)[1] + ")");
const seasons = Object.keys(seasonMeta);
const seasonForDate = date => {
  const month = date.getUTCMonth() + 1;
  return month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
};
const seasonForLine = line => seasons.find(s => seasonMeta[s].keywords.test(line.text)) ??
  seasons.find(s => seasonMeta[s].keywords.test(line.source)) ?? null;

test("real poetry pool alternates authors through season and year boundaries", () => {
  const pick = createDailyVersePicker(lines, seasonForDate, seasonForLine);
  let previous;
  const seen = new Set();
  for (let day = Date.UTC(2026, 0, 1); day < Date.UTC(2029, 0, 1); day += 86_400_000) {
    const { quote, season } = pick(new Date(day));
    assert.notEqual(quote.credit, previous, new Date(day).toISOString());
    assert.ok(seasonForLine(quote) === null || seasonForLine(quote) === season);
    assert.ok(quote.source && quote.href);
    previous = quote.credit;
    seen.add(quote.text);
  }
  assert.ok(seen.size > 90, "rotation must use the broad pool, not a small subset");
});

test("refreshes, out-of-order visits and separate devices agree on the day's verse", () => {
  const first = createDailyVersePicker(lines, seasonForDate, seasonForLine);
  const second = createDailyVersePicker(lines, seasonForDate, seasonForLine);
  const today = new Date("2026-11-27T08:00:00+08:00");
  const expected = first(today);
  first(new Date("2027-03-02T12:00:00+08:00"));
  assert.deepEqual(first(today), expected);
  assert.deepEqual(second(today), expected);
  assert.deepEqual(first(new Date("2026-11-27T23:59:59+08:00")), expected);
  assert.equal(shenzhenDayNumber(new Date("2026-11-26T16:00:00Z")), shenzhenDayNumber(today));
});

test("imbalanced authors still alternate and each author's verses rotate", () => {
  const pool = Array.from({ length: 8 }, (_, n) => ({ credit: "A", text: String(n), source: "test" }));
  pool.push({ credit: "B", text: "B", source: "test" });
  const pick = createDailyVersePicker(pool, () => "winter", () => null);
  const seen = new Set();
  let previous;
  for (let n = 0; n < 16; n++) {
    const { quote } = pick(new Date(Date.UTC(2026, 0, 1 + n)));
    assert.notEqual(quote.credit, previous);
    previous = quote.credit;
    if (quote.credit === "A") seen.add(quote.text);
  }
  assert.equal(seen.size, 8);
});

test("a single eligible author remains usable and an empty pool fails explicitly", () => {
  const quote = { credit: "A", text: "one", source: "test" };
  assert.equal(createDailyVersePicker([quote], () => "winter", () => null)(new Date()).quote, quote);
  assert.throws(() => createDailyVersePicker([], () => "winter", () => null));
});
