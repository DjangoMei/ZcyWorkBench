export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function usableDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function recordDateKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const parsed = usableDate(value);
  if (!parsed) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 未完成工作永远保留；只有明确记录了完成时间、且已完成满 72 小时的工作才清理。
 */
export function cleanCompletedSchedules(items, now = new Date()) {
  const nowTime = now.getTime();
  return items.filter((item) => {
    if (!item.done) return true;
    const completedAt = usableDate(item.completedAt);
    if (!completedAt) return true;
    return nowTime - completedAt.getTime() < THREE_DAYS_MS;
  });
}

/**
 * 普通日程提醒在日期过去后清理；没有填写日期的会议/社交备忘永久保留。
 */
export function cleanExpiredReminders(items, todayKey) {
  return items.filter((item) => {
    const itemDateKey = recordDateKey(item.datetime);
    return !itemDateKey || itemDateKey >= todayKey;
  });
}

/**
 * 周清理只移除已勾选项，所有未完成项都会继续保留到下一周。
 */
export function cleanWeeklyRoutines(routines, currentWeekKey) {
  return routines.map((routine) => ({
    ...routine,
    done: false,
    items: routine.items
      .filter((item) => !item.done)
      .map((item) => ({ ...item, weekKey: currentWeekKey })),
  }));
}

/**
 * 每月 16 日起移除上月及更早的考勤异常；1—15 日不做月度清理。
 */
export function cleanAttendanceRecords(records, todayKey) {
  const day = Number(todayKey.slice(8, 10));
  if (!Number.isFinite(day) || day < 16) return records;
  const currentMonth = todayKey.slice(0, 7);
  return records.filter(
    (record) => !record.date || record.date.slice(0, 7) >= currentMonth,
  );
}
