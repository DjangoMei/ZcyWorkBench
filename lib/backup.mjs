const TOP_LEVEL_RECORD_LISTS = [
  "projects",
  "schedule",
  "attendance",
  "looseMemos",
  "reminders",
  "birthdays",
  "inspirations",
];

function collectRecordKeys(data) {
  const keys = new Set();

  for (const listName of TOP_LEVEL_RECORD_LISTS) {
    const records = Array.isArray(data?.[listName]) ? data[listName] : [];
    for (const record of records) {
      if (record?.id) keys.add(`${listName}:${record.id}`);
    }
  }

  const routines = Array.isArray(data?.routines) ? data.routines : [];
  for (const routine of routines) {
    const items = Array.isArray(routine?.items) ? routine.items : [];
    for (const item of items) {
      if (item?.id) keys.add(`routine:${routine.id}:${item.id}`);
    }
  }

  return keys;
}

/**
 * 只要新数据比旧数据少了任何一条有 id 的记录，就视为删除并触发删除前备份。
 */
export function hasDeletedRecords(previousData, nextData) {
  const previousKeys = collectRecordKeys(previousData);
  const nextKeys = collectRecordKeys(nextData);
  return [...previousKeys].some((key) => !nextKeys.has(key));
}
