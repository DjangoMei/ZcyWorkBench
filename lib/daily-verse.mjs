const DAY_MS = 86_400_000;
const EPOCH_DAY = Date.UTC(2020, 0, 1) / DAY_MS;
const calendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
});

export function shenzhenDayNumber(date) {
  const parts = Object.fromEntries(calendar.formatToParts(date).map(({ type, value }) => [type, value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY_MS;
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

/**
 * Deterministic, calendar-based rotation: no browser storage or random refreshes.
 * Least-recently-shown authors go first; each author's own verses rotate too.
 * Keep history across season/year boundaries so yesterday's author stays excluded
 * whenever another season-appropriate author is available.
 * @template {{credit: string, text: string, source: string}} T
 * @template {string} S
 * @param {T[]} lines
 * @param {(date: Date) => S} seasonForDate Receives UTC civil dates.
 * @param {(line: T) => S | null} seasonForLine
 */
export function createDailyVersePicker(lines, seasonForDate, seasonForLine) {
  if (!lines.length) throw new Error("Daily verse pool must not be empty");
  const entries = lines.map(line => ({
    line, author: line.credit.trim().normalize("NFKC"),
    key: line.credit + "\u0000" + line.text + "\u0000" + line.source,
    season: seasonForLine(line),
  }));
  /** @type {Map<number, {season: S, quote: T}>} */
  const history = new Map();
  const authorLastSeen = new Map();
  const verseLastSeen = new Map();
  let nextDay = EPOCH_DAY;

  function choose(day, authorsSeen = authorLastSeen, versesSeen = verseLastSeen) {
    const season = seasonForDate(new Date(day * DAY_MS));
    // Neutral verses stay eligible all year; keep explicitly seasonal text in season.
    const pool = entries.filter(entry => entry.season === null || entry.season === season);
    if (!pool.length) throw new Error("No season-appropriate daily verse");
    const authors = [...new Set(pool.map(entry => entry.author))];
    authors.sort((a, b) =>
      (authorsSeen.get(a) ?? -Infinity) - (authorsSeen.get(b) ?? -Infinity) ||
      hash(day + a) - hash(day + b) || (a < b ? -1 : a > b ? 1 : 0));
    const candidates = pool.filter(entry => entry.author === authors[0]);
    candidates.sort((a, b) =>
      (versesSeen.get(a.key) ?? -Infinity) - (versesSeen.get(b.key) ?? -Infinity) ||
      hash(day + a.key) - hash(day + b.key) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return { season, entry: candidates[0] };
  }

  return date => {
    const day = shenzhenDayNumber(date);
    // The initial server placeholder is 1970, before the rotation epoch.
    if (day < EPOCH_DAY) {
      const selected = choose(day, new Map(), new Map());
      return { season: selected.season, quote: selected.entry.line };
    }
    for (; nextDay <= day; nextDay++) {
      const selected = choose(nextDay);
      authorLastSeen.set(selected.entry.author, nextDay);
      verseLastSeen.set(selected.entry.key, nextDay);
      history.set(nextDay, { season: selected.season, quote: selected.entry.line });
    }
    const result = history.get(day);
    if (!result) throw new Error("Invalid daily verse date");
    return result;
  };
}
