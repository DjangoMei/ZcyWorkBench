"use client";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  cleanAttendanceRecords,
  cleanCompletedSchedules,
  cleanExpiredReminders,
  cleanWeeklyRoutines,
} from "../lib/cleanup.mjs";
import { withBasePath } from "./base-path";
import { additionalDailyLines } from "./additional-daily-lines";

type Section =
  | "today"
  | "schedule"
  | "loosememo"
  | "projects"
  | "daily"
  | "wechat"
  | "expense"
  | "music"
  | "attendance"
  | "reminders"
  | "meetings"
  | "social"
  | "checkin"
  | "life"
  | "inspiration";

type Project = {
  id: string;
  name: string;
  summary: string;
  progress: number;
  progressText?: string;
  url: string;
  due: string;
};

type ScheduleItem = {
  id: string;
  title: string;
  datetime: string;
  kind: "工作" | "生活" | "临时";
  done: boolean;
  createdAt: string;
  completedAt?: string;
};

type Routine = {
  id: string;
  title: string;
  cycle: string;
  done: boolean;
  items: RoutineSubItem[];
};

type RoutineSubItem = {
  id: string;
  text: string;
  done: boolean;
  weekKey: string;
  completedAt?: string;
};

type MusicEntry = {
  week: number;
  songs: string[];
};

type AttendanceType = "迟到" | "调休" | "休假" | "公出" | "漏打卡" | "其他";

type AttendanceRecord = {
  id: string;
  date: string;
  type: AttendanceType;
  note: string;
  createdAt: string;
};

type LooseMemo = {
  id: string;
  text: string;
  createdAt: string;
};

type Reminder = {
  id: string;
  type: "meeting" | "social";
  title: string;
  datetime: string;
  person: string;
  location: string;
  done: boolean;
};

type Birthday = {
  id: string;
  name: string;
  calendar: "solar" | "lunar";
  month: number;
  day: number;
  note: string;
};

type InspirationCategory = "美" | "情" | "业" | "家";

type Inspiration = {
  id: string;
  category: InspirationCategory;
  content: string;
  tag: string;
  link: string;
  imagePath: string;
  imageName: string;
  createdAt: string;
};

type WorkbenchData = {
  projects: Project[];
  schedule: ScheduleItem[];
  routines: Routine[];
  music: MusicEntry[];
  attendance: AttendanceRecord[];
  looseMemos: LooseMemo[];
  reminders: Reminder[];
  birthdays: Birthday[];
  inspirations: Inspiration[];
  checkins: Record<string, boolean>;
  exercise: Record<string, boolean>;
  lastSundayCleanup: string;
};

type StorageState = "connecting" | "saved" | "saving" | "offline";
type StorageBackend = "cloud" | "local" | "browser";
type CloudGateState = "checking" | "locked" | "error" | "ready";

type WeatherState = {
  temperature: number;
  apparent: number;
  high: number;
  low: number;
  code: number;
} | null;

const LOCAL_API = "http://127.0.0.1:4174";
const CLOUD_SYNC_API = withBasePath("/api/sync");
const CLOUD_SYNC_SESSION_API = `${CLOUD_SYNC_API}/session`;
const BROWSER_STORAGE_KEY = "zcy-personal-workbench-v1";
const AUTO_SAVE_INTERVAL_MS = 30_000;
const attendanceTypes: AttendanceType[] = [
  "迟到",
  "调休",
  "休假",
  "公出",
  "漏打卡",
  "其他",
];

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: "today", label: "今日总览", icon: "⌂" },
  { id: "projects", label: "项目工作", icon: "◇" },
  { id: "music", label: "广播音乐", icon: "♫" },
  { id: "attendance", label: "考勤异常", icon: "◴" },
  { id: "reminders", label: "提醒日历", icon: "◷" },
  { id: "life", label: "生活提示", icon: "♡" },
  { id: "inspiration", label: "灵感碎片", icon: "✦" },
];

const routineSeeds: Routine[] = [
  { id: "routine-music", title: "广播音乐", cycle: "每周更新", done: false, items: [] },
  { id: "routine-meeting", title: "周例会", cycle: "每周", done: false, items: [] },
  { id: "routine-wechat", title: "官微", cycle: "本周发布清单", done: false, items: [] },
  { id: "routine-expense", title: "报销", cycle: "本周报销清单", done: false, items: [] },
];

const initialData: WorkbenchData = {
  projects: [],
  schedule: [],
  routines: routineSeeds,
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

const categoryMeta: Record<
  InspirationCategory,
  { subtitle: string; color: string }
> = {
  美: { subtitle: "美妆 · 穿搭 · 视觉", color: "peach" },
  情: { subtitle: "情绪 · 日常 · 关系", color: "lilac" },
  业: { subtitle: "工作 · 知识 · 技能", color: "blue" },
  家: { subtitle: "家庭 · 孩子 · 生活", color: "green" },
};

const xhsDailyLineNotes = {
  cracks:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a6eb87e0000000028003b48?xsec_token=ABbRIDBStMZAKYgGNChifEvBpWQF9Gg8oOlBOjLh3U2v8%3D&xsec_source=pc_user",
  summer:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a6b1be40000000028033758?xsec_token=AB412rZxqBGDzDgbpf6i4d6t8dA9UC-UxCB3rjLp8hTbY%3D&xsec_source=pc_user",
  recovery:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a5dd236000000000c015517?xsec_token=AB899umdCm9XhD50tKKO-CxWF9N1i7UvzUNpZk42zsEtI%3D&xsec_source=pc_user",
  trees:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a5658740000000007028bbf?xsec_token=ABHKmaKyMhBmIpotVbNC0huzWWMz-WDQa_urYNvLPJp80%3D&xsec_source=pc_user",
  spring:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a50f9d300000000070298a0?xsec_token=ABmYCOKu0o5u1ecN6Zwvd4PqwPffhVhXhxYykRyYxykwM%3D&xsec_source=pc_user",
  rain:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a4fbddf0000000021020cd5?xsec_token=ABFUoY9laZsaSphTLuWQjOfdn7UtqklZqt7q1Rf6lwgWg%3D&xsec_source=pc_user",
  soul:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a4bc9d400000000070217b1?xsec_token=ABvdoYsJy6ZmzGCSRrkfgdtiXGO1vQWUhckC4VuSOPx6E%3D&xsec_source=pc_user",
  solitude:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a4a7200000000002101772f?xsec_token=ABLsijLgbVBxt-gca9k1iugYnjiFWEti2U1tYLc1SBQ3E%3D&xsec_source=pc_user",
  love:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a4922880000000008024d42?xsec_token=ABJfWZHspuDf0_Rw-GvKwILHYmIdjwcgledS5fJcBKj9w%3D&xsec_source=pc_user",
  living:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a474d040000000007024b6b?xsec_token=ABVnaLHcwJllS02ui-vqAc-9oEBKOF9hsHhYaucDlE9rc%3D&xsec_source=pc_user",
  truth:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a2010870000000022008dc9?xsec_token=AB4E4_UpGfmD5_b3mn0Vvz193XVI2L0VsRHFIbW95Tfuw%3D&xsec_source=pc_user",
  ordinary:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a1e8952000000002100ba21?xsec_token=ABbpuX5UrqLcy_6U9fQJFbXDUOCWu2LxFbJLPjYRDK-RM%3D&xsec_source=pc_user",
  self:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a03c95a000000000702d284?xsec_token=ABCyfV9N08e_B0y4KdzUQpTDJL22WX1pPmG8EgI4dnKiM%3D&xsec_source=pc_user",
  someday:
    "https://www.xiaohongshu.com/user/profile/652012110000000024014637/6a02d5a300000000080253f8?xsec_token=ABrAZcYHOl32hOydN2s2bwVeEeGirvPBiB9cats6p7RAk%3D&xsec_source=pc_user",
} as const;

const dailyLines = [
  ...additionalDailyLines,
  {
    text: "人间的事，只要生机不灭，暂被阻抑，终有抬头的日子。",
    credit: "丰子恺",
    source: "《生机》",
    href: xhsDailyLineNotes.cracks,
  },
  {
    text: "唯静，才能观照万物，对人间生活充满盎然的兴致。",
    credit: "汪曾祺",
    source: "《无事此静坐》",
    href: xhsDailyLineNotes.cracks,
  },
  {
    text: "接受苦难，接受残缺。接受墙的存在。",
    credit: "史铁生",
    source: "《墙下短记》",
    href: xhsDailyLineNotes.cracks,
  },
  {
    text: "人的一生要千方百计，让自己在虚无的人生里，活得比时间具体。",
    credit: "曹韵",
    source: "《住在电影里的人》",
    href: xhsDailyLineNotes.summer,
  },
  {
    text: "只要我走着，花不敢不开。",
    credit: "曹韵",
    source: "《住在电影里的人》",
    href: xhsDailyLineNotes.summer,
  },
  {
    text: "生活，有一种大病初愈的美。",
    credit: "禾秀",
    source: "《请拿走我一身荆棘·雨后》",
    href: xhsDailyLineNotes.recovery,
  },
  {
    text: "人的一生总得有一些时刻，允许自己飞起来。",
    credit: "禾秀",
    source: "《请拿走我一身荆棘·蝴蝶（两则）》",
    href: xhsDailyLineNotes.recovery,
  },
  {
    text: "低能量就去看树吧，呼吸都变得轻盈了。",
    credit: "斯塔福德",
    source: "《那些活了很久很久的树》",
    href: xhsDailyLineNotes.trees,
  },
  {
    text: "不要以现在的心情去规定未来。",
    credit: "片山恭一",
    source: "作品摘录",
    href: xhsDailyLineNotes.trees,
  },
  {
    text: "我曾见的生命，都只是行过，无所谓完成。",
    credit: "木心",
    source: "《鱼丽之宴》",
    href: xhsDailyLineNotes.trees,
  },
  {
    text: "我与旧我，隔着一场大雪。雪融之后，便是春天。",
    credit: "孟歌浅",
    source: "《又见春天·新生》",
    href: xhsDailyLineNotes.spring,
  },
  {
    text: "你只管向春天走去，沿途的花，自会盖过眼底的雨。",
    credit: "孟歌浅",
    source: "《又见春天·向春天走去》",
    href: xhsDailyLineNotes.spring,
  },
  {
    text: "在这个染上严重忧郁症的城市，我写了一首大雨滂沱的诗。",
    credit: "洛夫",
    source: "《我的城市》",
    href: xhsDailyLineNotes.rain,
  },
  {
    text: "人必须先跟自己发生关联。",
    credit: "欧文·亚隆",
    source: "《当尼采哭泣》",
    href: xhsDailyLineNotes.rain,
  },
  {
    text: "总有些人，对生活要求极高，又无法忍受生活的愚蠢和粗暴。",
    credit: "赫尔曼·黑塞",
    source: "《荒原狼》",
    href: xhsDailyLineNotes.rain,
  },
  {
    text: "我们间歇性地拥有灵魂。",
    credit: "维斯瓦娃·辛波斯卡",
    source: "《小谈灵魂》",
    href: xhsDailyLineNotes.soul,
  },
  {
    text: "敞开的门不会一直敞开。",
    credit: "《致命女人》",
    source: "剧集台词",
    href: xhsDailyLineNotes.soul,
  },
  {
    text: "我必须试着变得柔软，而非坚硬；温柔，而非冷漠。",
    credit: "琼·安德森",
    source: "《海边一年》",
    href: xhsDailyLineNotes.soul,
  },
  {
    text: "孤独的人有他们自己的泥沼。",
    credit: "张爱玲",
    source: "作品摘录",
    href: xhsDailyLineNotes.solitude,
  },
  {
    text: "往往是相爱的人爱闹意见，反而是不相干的人能互相容忍。",
    credit: "张爱玲",
    source: "《留情》",
    href: xhsDailyLineNotes.solitude,
  },
  {
    text: "太剧烈的快乐与悲哀，一样需要远离人群。",
    credit: "张爱玲",
    source: "《半生缘》",
    href: xhsDailyLineNotes.solitude,
  },
  {
    text: "美妙人生的关键，在于你能迷上什么东西。",
    credit: "刘慈欣",
    source: "《球状闪电》",
    href: xhsDailyLineNotes.love,
  },
  {
    text: "我的理想生活，是拥有一周逛一次花店的时间和心理上的余裕。",
    credit: "山内麻里子",
    source: "作品摘录",
    href: xhsDailyLineNotes.love,
  },
  {
    text: "不是我在料理植物，而是植物在料理我。",
    credit: "沈熹微",
    source: "《在人群中消失的日子》",
    href: xhsDailyLineNotes.love,
  },
  {
    text: "幸福就蕴藏在一个吻、一次散步和对晚餐的期待之中。",
    credit: "迈克尔·坎宁安",
    source: "作品摘录",
    href: xhsDailyLineNotes.love,
  },
  {
    text: "一个人的口味要宽一点，杂一点。",
    credit: "汪曾祺",
    source: "《老味道》",
    href: xhsDailyLineNotes.love,
  },
  {
    text: "一定要爱着点什么，它让我们变得坚韧、宽容、充盈。",
    credit: "汪曾祺",
    source: "《生活是很好玩的》",
    href: xhsDailyLineNotes.love,
  },
  {
    text: "我存在着，我在生活，我将生活下去。",
    credit: "鲁迅",
    source: "《“这也是生活”……》",
    href: xhsDailyLineNotes.living,
  },
  {
    text: "早上醒来，充分地好好活着一天；最近我只留心这件事。",
    credit: "太宰治",
    source: "《小说灯笼》",
    href: xhsDailyLineNotes.truth,
  },
  {
    text: "等我睡足了觉，一切都会好起来。",
    credit: "奥特莎·莫什费格",
    source: "《我想睡上一整年》",
    href: xhsDailyLineNotes.truth,
  },
  {
    text: "我对一切伟大的东西总有点格格不入。",
    credit: "汪曾祺",
    source: "《野鸭子飞得高高的》",
    href: xhsDailyLineNotes.ordinary,
  },
  {
    text: "更进一步安于微小，安于平常。",
    credit: "汪曾祺",
    source: "《野鸭子飞得高高的》",
    href: xhsDailyLineNotes.ordinary,
  },
  {
    text: "我对自己的认识晦暗不明，如共犯般隐秘。",
    credit: "玛格丽特·尤瑟纳尔",
    source: "《哈德良回忆录》",
    href: xhsDailyLineNotes.self,
  },
  {
    text: "比痛苦更持久且尖利伤人的，是抱有期望的等待。",
    credit: "约翰·伯格",
    source: "《我们在此相遇》",
    href: xhsDailyLineNotes.self,
  },
  {
    text: "我知道的东西谁都可以知道；而我的心却为我所独有。",
    credit: "歌德",
    source: "《少年维特的烦恼》",
    href: xhsDailyLineNotes.self,
  },
  {
    text: "连痛苦本身也会枯萎凋零。",
    credit: "赫尔曼·黑塞",
    source: "《精神与爱欲》",
    href: xhsDailyLineNotes.someday,
  },
  {
    text: "没有人能了解我的全部，爱我的全部；我只有我自己。",
    credit: "西蒙娜·德·波伏娃",
    source: "《青春手记》",
    href: xhsDailyLineNotes.someday,
  },
  {
    text: "我希望尽快见到你，和你聊天。",
    credit: "崔恩荣",
    source: "《对我无害之人》",
    href: xhsDailyLineNotes.someday,
  },
];

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function latestSundayKey(date: Date) {
  const sunday = new Date(date);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return dateKey(sunday);
}

function defaultLocalDateTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function scheduleCreatedAtTime(item: ScheduleItem) {
  const createdAt = new Date(item.createdAt).getTime();
  if (!Number.isNaN(createdAt)) return createdAt;

  const fallback = new Date(item.datetime).getTime();
  return Number.isNaN(fallback) ? 0 : fallback;
}

function compareScheduleNewestFirst(a: ScheduleItem, b: ScheduleItem) {
  return (
    Number(a.done) - Number(b.done) ||
    scheduleCreatedAtTime(b) - scheduleCreatedAtTime(a)
  );
}

function normalizeSongTitle(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("zh-CN");
}

function countPreviousSongOccurrences(
  music: MusicEntry[],
  title: string,
  currentWeek: number,
  currentIndex: number,
) {
  const normalizedTitle = normalizeSongTitle(title);
  if (!normalizedTitle) return 0;

  return music.reduce(
    (count, entry) =>
      count +
      entry.songs.reduce(
        (entryCount, song, index) =>
          entryCount +
          Number(
            normalizeSongTitle(song) === normalizedTitle &&
              (entry.week < currentWeek ||
                (entry.week === currentWeek && index < currentIndex)),
          ),
        0,
      ),
    0,
  );
}

function getIsoWeek(date: Date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const weekOne = new Date(target.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((target.getTime() - weekOne.getTime()) / 86_400_000 -
        3 +
        ((weekOne.getDay() + 6) % 7)) /
        7,
    )
  );
}

function getWeeksInYear(year: number) {
  return getIsoWeek(new Date(year, 11, 28));
}

function getWeekStart(year: number, week: number) {
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7);
  return monday;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "未设置时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (!value || Number.isNaN(date.getTime())) return "日期未定";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function monthDayFor(date: Date, calendar: Birthday["calendar"]) {
  if (calendar === "solar") {
    return { month: date.getMonth() + 1, day: date.getDate() };
  }
  const parts = new Intl.DateTimeFormat("en-u-ca-chinese", {
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  return {
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function nextBirthdayDate(birthday: Birthday, from: Date) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  for (let offset = 0; offset <= 380; offset += 1) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    const monthDay = monthDayFor(candidate, birthday.calendar);
    if (monthDay.month === birthday.month && monthDay.day === birthday.day) {
      return { date: candidate, days: offset };
    }
  }
  return null;
}

function safeUrl(value: string) {
  if (!value.trim()) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function localFileUrl(path: string) {
  return `${LOCAL_API}/files/${path
    .split(/[\\/]/)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function cloudFileUrl(path: string) {
  return `${CLOUD_SYNC_API}/file/${path
    .split(/[\\/]/)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function remoteImagePath(filename: string) {
  const extension = filename.match(/\.[a-z0-9]{1,10}$/i)?.[0]?.toLowerCase() || "";
  return `灵感图片/${uid()}${extension}`;
}

function weatherCopy(code: number) {
  if (code === 0) return { icon: "☀", text: "晴朗" };
  if (code <= 3) return { icon: "◒", text: "多云" };
  if ([45, 48].includes(code)) return { icon: "≋", text: "有雾" };
  if (code <= 57) return { icon: "☂", text: "细雨" };
  if (code <= 67) return { icon: "☂", text: "有雨" };
  if (code <= 77) return { icon: "❄", text: "有雪" };
  if (code <= 82) return { icon: "☔", text: "阵雨" };
  return { icon: "ϟ", text: "雷雨" };
}

function festivalFor(date: Date) {
  const key = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  const fixed: Record<string, string> = {
    "01-01": "元旦",
    "02-14": "情人节",
    "03-08": "妇女节",
    "04-23": "世界读书日",
    "05-01": "劳动节",
    "05-04": "青年节",
    "06-01": "儿童节",
    "07-01": "建党节",
    "08-01": "建军节",
    "09-10": "教师节",
    "10-01": "国庆节",
    "12-25": "圣诞节",
  };
  if (fixed[key]) return fixed[key];

  try {
    const lunar = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      month: "long",
      day: "numeric",
    }).format(date);
    const lunarFestivals: [string, string][] = [
      ["正月初一", "春节"],
      ["正月十五", "元宵节"],
      ["五月初五", "端午节"],
      ["八月十五", "中秋节"],
      ["九月初九", "重阳节"],
      ["腊月初八", "腊八节"],
    ];
    return lunarFestivals.find(([needle]) => lunar.includes(needle))?.[1] || "";
  } catch {
    return "";
  }
}

function normalizeData(raw: Partial<WorkbenchData> & { tempTasks?: unknown[] }) {
  const { tempTasks: _legacyTempTasks, ...cleanRaw } = raw;
  const legacyTasks = Array.isArray(raw.tempTasks)
    ? raw.tempTasks.map((item) => {
        const task = item as {
          id?: string;
          text?: string;
          done?: boolean;
          createdAt?: string;
        };
        return {
          id: task.id || uid(),
          title: task.text || "未命名日程",
          datetime: task.createdAt || new Date().toISOString(),
          kind: "临时" as const,
          done: Boolean(task.done),
          createdAt: task.createdAt || new Date().toISOString(),
        };
      })
    : [];

  const music = Array.isArray(raw.music)
    ? raw.music.map((entry) => {
        const old = entry as MusicEntry & { song?: string };
        return {
          week: Number(old.week),
          songs: Array.isArray(old.songs)
            ? old.songs.slice(0, 4)
            : old.song
              ? [old.song]
              : [],
        };
      })
    : [];

  const inspirations = Array.isArray(raw.inspirations)
    ? raw.inspirations.map((item) => ({
        ...item,
        link: item.link || "",
        imagePath: item.imagePath || "",
        imageName: item.imageName || "",
      }))
    : [];

  return {
    ...initialData,
    ...cleanRaw,
    schedule: Array.isArray(raw.schedule) ? raw.schedule : legacyTasks,
    routines: Array.isArray(raw.routines)
      ? raw.routines.map((routine) => {
          const seed = routineSeeds.find((item) => item.id === routine.id);
          return {
            ...routine,
            title: seed?.title || routine.title,
            cycle: seed?.cycle || routine.cycle,
            items: Array.isArray(routine.items) ? routine.items : [],
          };
        })
      : routineSeeds,
    music,
    inspirations,
  } as WorkbenchData;
}

function DreamButterfly({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`dream-butterfly ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      <img
        src={withBasePath(
          small ? "/butterfly-lower.png" : "/butterfly-upper.png",
        )}
        alt=""
      />
    </span>
  );
}

export default function Home() {
  const [active, setActive] = useState<Section>("today");
  const [data, setData] = useState<WorkbenchData>(initialData);
  const [clock, setClock] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherState>(null);
  const [storage, setStorage] = useState<StorageState>("connecting");
  const [storageBackend, setStorageBackend] =
    useState<StorageBackend>("cloud");
  const [storageMessage, setStorageMessage] = useState("正在连接云端资料库");
  const [ready, setReady] = useState(false);
  const [cloudGate, setCloudGate] = useState<CloudGateState>("checking");
  const [cloudGateMessage, setCloudGateMessage] = useState("");
  const [cloudUnlocking, setCloudUnlocking] = useState(false);
  const [initialLoadAttempt, setInitialLoadAttempt] = useState(0);
  const [inspirationCategory, setInspirationCategory] =
    useState<InspirationCategory>("美");
  const [inspirationFilter, setInspirationFilter] = useState<
    InspirationCategory | "全部"
  >("全部");
  const [inspirationBusy, setInspirationBusy] = useState(false);
  const [newMusicInputKey, setNewMusicInputKey] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<{
    kind:
      | "schedule"
      | "reminder"
      | "routine"
      | "looseMemo"
      | "attendance"
      | "project";
    id: string;
    parentId?: string;
  } | null>(null);
  const [toast, setToast] = useState("");
  const currentWeekRef = useRef<HTMLDivElement>(null);
  const musicFirstInputRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef(data);
  const lastSavedPayloadRef = useRef("");
  const cloudSavePendingRef = useRef(false);
  const cloudSaveInFlightRef = useRef(false);

  dataRef.current = data;

  const referenceDate = clock ?? new Date(0);
  const year = referenceDate.getFullYear();
  const currentWeek = getIsoWeek(referenceDate);
  const today = dateKey(referenceDate);
  const latestSunday = clock ? latestSundayKey(clock) : "";
  const isSunday = clock?.getDay() === 0;
  const festival = clock ? festivalFor(clock) : "";
  const quote = dailyLines[
    Math.floor(new Date(today).getTime() / 86_400_000) % dailyLines.length
  ];

  useEffect(() => {
    setClock(new Date());
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.history.replaceState(
      { ...window.history.state, workbenchSection: "today" },
      "",
    );
    const handleBack = (event: PopStateEvent) => {
      const section = event.state?.workbenchSection as Section | undefined;
      setActive(section || "today");
    };
    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=22.5431&longitude=114.0579&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=1",
    )
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return;
        setWeather({
          temperature: Math.round(result.current.temperature_2m),
          apparent: Math.round(result.current.apparent_temperature),
          high: Math.round(result.daily.temperature_2m_max[0]),
          low: Math.round(result.daily.temperature_2m_min[0]),
          code: result.current.weather_code,
        });
      })
      .catch(() => setWeather(null));
    return () => {
      cancelled = true;
    };
  }, [today]);

  useEffect(() => {
    let cancelled = false;
    const isLocal = ["localhost", "127.0.0.1"].includes(
      window.location.hostname,
    );

    async function loadInitialData() {
      setReady(false);
      setStorage("connecting");

      if (isLocal) {
        setStorageBackend("local");
        setCloudGate("ready");
        setStorageMessage("正在连接电脑资料库");
        try {
          const response = await fetch(`${LOCAL_API}/api/data`);
          if (!response.ok) throw new Error("local storage unavailable");
          const saved = (await response.json()) as Partial<WorkbenchData>;
          let nextData = normalizeData(saved);
          const hasServerData =
            nextData.projects.length +
              nextData.schedule.length +
              nextData.reminders.length +
              nextData.inspirations.length >
            0;

          if (!hasServerData) {
            const legacy = window.localStorage.getItem(BROWSER_STORAGE_KEY);
            if (legacy) {
              nextData = normalizeData(JSON.parse(legacy));
              await fetch(`${LOCAL_API}/api/data`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nextData),
              });
              window.localStorage.removeItem(BROWSER_STORAGE_KEY);
            }
          }

          if (cancelled) return;
          setData(nextData);
          lastSavedPayloadRef.current = JSON.stringify(nextData);
          setStorage("saved");
          setStorageMessage("已保存到电脑 · 个人资料库");
          setReady(true);
        } catch {
          if (cancelled) return;
          const browserData = window.localStorage.getItem(BROWSER_STORAGE_KEY);
          let nextData = initialData;
          if (browserData) {
            try {
              nextData = normalizeData(JSON.parse(browserData));
            } catch {
              window.localStorage.removeItem(BROWSER_STORAGE_KEY);
            }
          }
          setData(nextData);
          lastSavedPayloadRef.current = JSON.stringify(nextData);
          setStorageBackend("browser");
          setStorage("saved");
          setStorageMessage("已保存在此浏览器");
          setReady(true);
        }
        return;
      }

      setStorageBackend("cloud");
      setCloudGate("checking");
      setStorageMessage("正在读取云端资料");
      try {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const fragmentToken = fragment.get("sync");
        if (fragmentToken) {
          const session = await fetch(CLOUD_SYNC_SESSION_API, {
            method: "POST",
            credentials: "same-origin",
            headers: { Authorization: `Bearer ${fragmentToken}` },
          });
          if (!session.ok) throw new Error("cloud session unavailable");
          window.history.replaceState(
            window.history.state,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
        }

        const response = await fetch(CLOUD_SYNC_API, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (response.status === 401) {
          if (!cancelled) {
            setCloudGate("locked");
            setStorage("offline");
            setStorageMessage("云端资料库已锁定");
          }
          return;
        }

        let nextData: WorkbenchData;
        if (response.status === 404) {
          const legacy = window.localStorage.getItem(BROWSER_STORAGE_KEY);
          nextData = legacy
            ? normalizeData(JSON.parse(legacy))
            : normalizeData(initialData);

          if (legacy) {
            const migration = await fetch(CLOUD_SYNC_API, {
              method: "PUT",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(nextData),
            });
            if (!migration.ok) throw new Error("cloud migration failed");
            window.localStorage.removeItem(BROWSER_STORAGE_KEY);
          }
        } else {
          if (!response.ok) throw new Error("cloud storage unavailable");
          const saved = (await response.json()) as {
            data: Partial<WorkbenchData>;
          };
          nextData = normalizeData(saved.data);
        }

        if (cancelled) return;
        setData(nextData);
        lastSavedPayloadRef.current = JSON.stringify(nextData);
        cloudSavePendingRef.current = false;
        setCloudGate("ready");
        setCloudGateMessage("");
        setStorage("saved");
        setStorageMessage("已从云端载入 · 每 30 秒自动保存");
        setReady(true);
      } catch {
        if (cancelled) return;
        setCloudGate("error");
        setCloudGateMessage("暂时无法连接云端，请检查网络后重试。");
        setStorage("offline");
        setStorageMessage("云端连接失败");
      }
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [initialLoadAttempt]);

  useEffect(() => {
    if (!ready) return;

    const serialized = JSON.stringify(data);

    if (storageBackend === "cloud") {
      if (serialized === lastSavedPayloadRef.current) return;
      cloudSavePendingRef.current = true;
      setStorage("saving");
      setStorageMessage("有更改，将在 30 秒内自动保存");
      return;
    }

    if (storageBackend === "browser") {
      const timer = window.setTimeout(() => {
        try {
          window.localStorage.setItem(
            BROWSER_STORAGE_KEY,
            JSON.stringify(data),
          );
          setStorage("saved");
          setStorageMessage("已保存在此浏览器");
        } catch {
          setStorage("offline");
          setStorageMessage("浏览器存储空间不足");
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }

    setStorage("saving");
    setStorageMessage("正在写入电脑");
    const timer = window.setTimeout(() => {
      fetch(`${LOCAL_API}/api/data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((response) => {
          if (!response.ok) throw new Error("save failed");
          lastSavedPayloadRef.current = serialized;
          setStorage("saved");
          setStorageMessage("已保存到电脑 · 个人资料库");
        })
        .catch(() => {
          try {
            window.localStorage.setItem(
              BROWSER_STORAGE_KEY,
              JSON.stringify(data),
            );
            setStorageBackend("browser");
            setStorage("saved");
            setStorageMessage("已切换为浏览器存储");
          } catch {
            setStorage("offline");
            setStorageMessage("保存失败");
          }
        });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [data, ready, storageBackend]);

  useEffect(() => {
    if (!ready || storageBackend !== "cloud") return;
    let disposed = false;

    async function saveCloudNow() {
      if (
        !cloudSavePendingRef.current ||
        cloudSaveInFlightRef.current
      ) {
        return;
      }

      const serialized = JSON.stringify(dataRef.current);
      if (serialized === lastSavedPayloadRef.current) {
        cloudSavePendingRef.current = false;
        return;
      }

      cloudSaveInFlightRef.current = true;
      if (!disposed) {
        setStorage("saving");
        setStorageMessage("正在自动保存到云端");
      }

      try {
        const response = await fetch(CLOUD_SYNC_API, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: serialized,
        });
        if (response.status === 401) {
          cloudSavePendingRef.current = true;
          if (!disposed) {
            setReady(false);
            setCloudGate("locked");
            setStorage("offline");
            setStorageMessage("云端会话已过期");
          }
          return;
        }
        if (!response.ok) throw new Error("cloud save failed");

        lastSavedPayloadRef.current = serialized;
        cloudSavePendingRef.current =
          JSON.stringify(dataRef.current) !== serialized;
        if (!disposed) {
          setStorage(cloudSavePendingRef.current ? "saving" : "saved");
          setStorageMessage(
            cloudSavePendingRef.current
              ? "又有新更改，将继续自动保存"
              : `已自动保存到云端 · ${new Intl.DateTimeFormat("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date())}`,
          );
        }
      } catch {
        cloudSavePendingRef.current = true;
        if (!disposed) {
          setStorage("offline");
          setStorageMessage("网络中断，将自动重试保存");
        }
      } finally {
        cloudSaveInFlightRef.current = false;
      }
    }

    const interval = window.setInterval(
      () => void saveCloudNow(),
      AUTO_SAVE_INTERVAL_MS,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") void saveCloudNow();
    };
    const handleBeforeUnload = () => {
      if (!cloudSavePendingRef.current) return;
      void fetch(CLOUD_SYNC_API, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataRef.current),
        keepalive: true,
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [ready, storageBackend]);

  const unlockCloud = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const token = String(new FormData(form).get("syncKey") || "").trim();
    setCloudUnlocking(true);
    setCloudGateMessage("");
    try {
      const response = await fetch(CLOUD_SYNC_SESSION_API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error("invalid sync key");
      form.reset();
      setCloudGate("checking");
      setStorage("connecting");
      setStorageMessage("正在读取云端资料");
      setInitialLoadAttempt((current) => current + 1);
    } catch {
      setCloudGateMessage("同步密钥不正确，请重新输入。");
    } finally {
      setCloudUnlocking(false);
    }
  };

  const retryCloudLoad = () => {
    setCloudGate("checking");
    setCloudGateMessage("");
    setInitialLoadAttempt((current) => current + 1);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (
      !ready ||
      !latestSunday ||
      (data.lastSundayCleanup === latestSunday && !isSunday)
    ) {
      return;
    }

    setData((current) => {
      // The first run after this feature is installed establishes a safe
      // baseline so existing local lists are never deleted by an upgrade.
      if (!current.lastSundayCleanup) {
        return { ...current, lastSundayCleanup: latestSunday };
      }

      const hasCompletedItems = current.routines.some(
        (routine) => routine.done || routine.items.some((item) => item.done),
      );
      if (
        current.lastSundayCleanup === latestSunday &&
        !hasCompletedItems
      ) {
        return current;
      }

      const weekKey = `${year}-W${String(currentWeek).padStart(2, "0")}`;
      return {
        ...current,
        routines: cleanWeeklyRoutines(current.routines, weekKey),
        lastSundayCleanup: latestSunday,
      };
    });
  }, [
    currentWeek,
    data.lastSundayCleanup,
    data.routines,
    isSunday,
    latestSunday,
    ready,
    year,
  ]);

  useEffect(() => {
    if (!ready || today === "1970-01-01") return;

    setData((current) => {
      const schedule = cleanCompletedSchedules(current.schedule, new Date());
      const reminders = cleanExpiredReminders(current.reminders, today);

      if (
        schedule.length === current.schedule.length &&
        reminders.length === current.reminders.length
      ) {
        return current;
      }

      return { ...current, schedule, reminders };
    });
  }, [ready, today]);

  useEffect(() => {
    if (!ready || today === "1970-01-01") return;
    setData((current) => {
      const attendance = cleanAttendanceRecords(current.attendance, today);
      return attendance.length === current.attendance.length
        ? current
        : { ...current, attendance };
    });
  }, [ready, today]);

  const upcomingSchedule = useMemo(
    () =>
      data.schedule
        .filter((item) => !item.done)
        .sort(
          (a, b) =>
            new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
        ),
    [data.schedule],
  );

  const todaySchedule = useMemo(
    () =>
      data.schedule
        .filter((item) => {
          const itemDate = new Date(item.datetime);
          return !Number.isNaN(itemDate.getTime()) && dateKey(itemDate) <= today;
        })
        .sort(compareScheduleNewestFirst),
    [data.schedule, today],
  );

  const upcomingReminders = useMemo(
    () =>
      data.reminders
        .filter((item) => !item.done)
        .sort(
          (a, b) =>
            new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
        ),
    [data.reminders],
  );

  const currentMusic = data.music.find((entry) => entry.week === currentWeek);
  const currentWeekKey = `${year}-W${String(currentWeek).padStart(2, "0")}`;
  const currentMonthKey = today.slice(0, 7);
  const monthlyAttendance = data.attendance.filter(
    (record) => record.date.slice(0, 7) === currentMonthKey,
  );
  const monthlyLateCount = monthlyAttendance.filter(
    (record) => record.type === "迟到",
  ).length;
  const upcomingBirthdays = useMemo(() => {
    if (!clock) return [];
    return data.birthdays
      .map((birthday) => {
        const upcoming = nextBirthdayDate(birthday, clock);
        return upcoming ? { birthday, ...upcoming } : null;
      })
      .filter(
        (
          item,
        ): item is {
          birthday: Birthday;
          date: Date;
          days: number;
        } => Boolean(item && item.days <= 10),
      )
      .sort((a, b) => a.days - b.days);
  }, [today, data.birthdays]);

  const updateMusic = (week: number, index: number, value: string) => {
    setData((current) => {
      const existing = current.music.find((entry) => entry.week === week);
      const songs = [...(existing?.songs || [])];
      while (songs.length < 4) songs.push("");
      songs[index] = value;
      const next = existing
        ? current.music.map((entry) =>
            entry.week === week ? { ...entry, songs } : entry,
          )
        : [...current.music, { week, songs }];
      return { ...current, music: next };
    });
  };

  const addAttendance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date") || today);
    const type = String(form.get("type") || "迟到") as AttendanceType;
    if (!date) return;
    setData((current) => ({
      ...current,
      attendance: [
        ...current.attendance,
        {
          id: uid(),
          date,
          type,
          note: String(form.get("note") || "").trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    event.currentTarget.reset();
    const dateInput = event.currentTarget.elements.namedItem(
      "date",
    ) as HTMLInputElement | null;
    if (dateInput) dateInput.value = today;
    setToast(`${date} · ${type}已登记`);
  };

  const addLooseMemo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("text") || "").trim();
    if (!text) return;
    setData((current) => ({
      ...current,
      looseMemos: [
        { id: uid(), text, createdAt: new Date().toISOString() },
        ...current.looseMemos,
      ],
    }));
    event.currentTarget.reset();
    setToast("备忘已保存");
  };

  const addSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    setData((current) => ({
      ...current,
      schedule: [
        ...current.schedule,
        {
          id: uid(),
          title,
          datetime: String(form.get("datetime") || new Date().toISOString()),
          kind: String(form.get("kind") || "临时") as ScheduleItem["kind"],
          done: false,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    event.currentTarget.reset();
    const datetime = event.currentTarget.elements.namedItem(
      "datetime",
    ) as HTMLInputElement | null;
    if (datetime) datetime.value = defaultLocalDateTime();
    setToast("日程已写入个人资料库");
  };

  const addProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    setData((current) => ({
      ...current,
      projects: [
        ...current.projects,
        {
          id: uid(),
          name,
          summary: String(form.get("summary") || "").trim(),
          progress: 0,
          progressText: String(form.get("progressText") || "").trim(),
          url: String(form.get("url") || "").trim(),
          due: String(form.get("due") || ""),
        },
      ],
    }));
    event.currentTarget.reset();
    setToast("项目已添加");
  };

  const addRoutineItem = (
    event: FormEvent<HTMLFormElement>,
    routineId: string,
  ) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("text") || "").trim();
    if (!text) return;
    const weekKey = `${year}-W${String(currentWeek).padStart(2, "0")}`;
    setData((current) => ({
      ...current,
      routines: current.routines.map((routine) =>
        routine.id === routineId
          ? {
              ...routine,
              items: [
                ...routine.items,
                { id: uid(), text, done: false, weekKey },
              ],
            }
          : routine,
      ),
    }));
    event.currentTarget.reset();
  };

  const toggleRoutineItem = (routineId: string, itemId: string) => {
    setData((current) => ({
      ...current,
      routines: current.routines.map((routine) =>
        routine.id === routineId
          ? {
              ...routine,
              items: routine.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      done: !item.done,
                      weekKey: !item.done ? currentWeekKey : item.weekKey,
                      completedAt: !item.done ? new Date().toISOString() : "",
                    }
                  : item,
              ),
            }
          : routine,
      ),
    }));
  };

  const toggleScheduleItem = (itemId: string) => {
    setData((current) => ({
      ...current,
      schedule: current.schedule.map((item) => {
        if (item.id !== itemId) return item;
        const done = !item.done;
        return {
          ...item,
          done,
          completedAt: done ? new Date().toISOString() : "",
        };
      }),
    }));
  };

  const addReminder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const datetime = String(form.get("datetime") || "");
    if (!title) return;
    setData((current) => ({
      ...current,
      reminders: [
        ...current.reminders,
        {
          id: uid(),
          type: String(form.get("type")) as Reminder["type"],
          title,
          datetime,
          person: String(form.get("person") || "").trim(),
          location: String(form.get("location") || "").trim(),
          done: false,
        },
      ],
    }));
    event.currentTarget.reset();
    setToast("提醒已添加");
  };

  const saveScheduleEdit = (
    event: FormEvent<HTMLFormElement>,
    itemId: string,
  ) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const datetime = String(form.get("datetime") || "");
    if (!title || !datetime) return;
    setData((current) => ({
      ...current,
      schedule: current.schedule.map((item) =>
        item.id === itemId
          ? {
              ...item,
              title,
              datetime,
              kind: String(form.get("kind") || "临时") as ScheduleItem["kind"],
            }
          : item,
      ),
    }));
    setEditingRecord(null);
    setToast("日程修改已保存");
  };

  const saveReminderEdit = (
    event: FormEvent<HTMLFormElement>,
    itemId: string,
  ) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const datetime = String(form.get("datetime") || "");
    if (!title) return;
    setData((current) => ({
      ...current,
      reminders: current.reminders.map((item) =>
        item.id === itemId
          ? {
              ...item,
              type: String(form.get("type") || "meeting") as Reminder["type"],
              title,
              datetime,
              person: String(form.get("person") || "").trim(),
              location: String(form.get("location") || "").trim(),
            }
          : item,
      ),
    }));
    setEditingRecord(null);
    setToast("提醒修改已保存");
  };

  const saveRoutineItemEdit = (
    event: FormEvent<HTMLFormElement>,
    routineId: string,
    itemId: string,
  ) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("text") || "").trim();
    if (!text) return;
    setData((current) => ({
      ...current,
      routines: current.routines.map((routine) =>
        routine.id === routineId
          ? {
              ...routine,
              items: routine.items.map((item) =>
                item.id === itemId ? { ...item, text } : item,
              ),
            }
          : routine,
      ),
    }));
    setEditingRecord(null);
    setToast("事项修改已保存");
  };

  const saveLooseMemoEdit = (
    event: FormEvent<HTMLFormElement>,
    memoId: string,
  ) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("text") || "").trim();
    if (!text) return;
    setData((current) => ({
      ...current,
      looseMemos: current.looseMemos.map((memo) =>
        memo.id === memoId ? { ...memo, text } : memo,
      ),
    }));
    setEditingRecord(null);
    setToast("备忘修改已保存");
  };

  const saveAttendanceEdit = (
    event: FormEvent<HTMLFormElement>,
    recordId: string,
  ) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date") || "");
    if (!date) return;
    setData((current) => ({
      ...current,
      attendance: current.attendance.map((record) =>
        record.id === recordId
          ? {
              ...record,
              date,
              type: String(form.get("type") || "迟到") as AttendanceType,
              note: String(form.get("note") || "").trim(),
            }
          : record,
      ),
    }));
    setEditingRecord(null);
    setToast("考勤记录修改已保存");
  };

  const saveProjectEdit = (
    event: FormEvent<HTMLFormElement>,
    projectId: string,
  ) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    setData((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              name,
              summary: String(form.get("summary") || "").trim(),
              due: String(form.get("due") || ""),
              url: String(form.get("url") || "").trim(),
              progress: project.progress || 0,
              progressText: String(form.get("progressText") || "").trim(),
            }
          : project,
      ),
    }));
    setEditingRecord(null);
    setToast("项目修改已保存");
  };

  const addBirthday = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    setData((current) => ({
      ...current,
      birthdays: [
        ...current.birthdays,
        {
          id: uid(),
          name,
          calendar: String(form.get("calendar")) as Birthday["calendar"],
          month: Number(form.get("month")),
          day: Number(form.get("day")),
          note: String(form.get("note") || "").trim(),
        },
      ],
    }));
    event.currentTarget.reset();
    setToast("生日已记录");
  };

  const addInspiration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const content = String(form.get("content") || "").trim();
    const link = safeUrl(String(form.get("link") || ""));
    const image = form.get("image");
    if (!content && !link && !(image instanceof File && image.size)) return;

    setInspirationBusy(true);
    let imagePath = "";
    let imageName = "";
    try {
      if (image instanceof File && image.size) {
        if (storageBackend === "browser") {
          throw new Error("浏览器存储模式暂不支持图片上传。");
        }
        const targetPath = remoteImagePath(image.name);
        const response =
          storageBackend === "cloud"
            ? await fetch(cloudFileUrl(targetPath), {
                method: "PUT",
                credentials: "same-origin",
                headers: {
                  "Content-Type": image.type || "application/octet-stream",
                },
                body: image,
              })
            : await fetch(
                `${LOCAL_API}/api/upload?name=${encodeURIComponent(image.name)}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": image.type || "application/octet-stream",
                  },
                  body: image,
                },
              );
        if (!response.ok) throw new Error("图片保存失败");
        const result = (await response.json()) as {
          path?: string;
          name?: string;
          key?: string;
        };
        imagePath = result.key || result.path || targetPath;
        imageName = result.name || image.name;
      }

      setData((current) => ({
        ...current,
        inspirations: [
          {
            id: uid(),
            category: inspirationCategory,
            content,
            tag: String(form.get("tag") || "").trim(),
            link,
            imagePath,
            imageName,
            createdAt: new Date().toISOString(),
          },
          ...current.inspirations,
        ],
      }));
      formElement.reset();
      setInspirationCategory("美");
      setToast("灵感已收进个人资料库");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "保存失败");
    } finally {
      setInspirationBusy(false);
    }
  };

  const exportInspirations = async (format: "json" | "markdown") => {
    try {
      if (storageBackend !== "local") {
        const filename =
          format === "markdown" ? "灵感碎片.md" : "灵感碎片.json";
        const content =
          format === "markdown"
            ? [
                "# 灵感碎片导出",
                "",
                ...data.inspirations.map((item, index) =>
                  [
                    `## ${index + 1}. ${item.category} · ${item.tag || "无标签"}`,
                    "",
                    item.content,
                    item.link ? `- 链接：${item.link}` : "",
                    `- 创建时间：${item.createdAt}`,
                    "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                ),
              ].join("\n")
            : `${JSON.stringify(
                {
                  exportedAt: new Date().toISOString(),
                  format: "zcy-inspiration-v1",
                  inspirations: data.inspirations,
                },
                null,
                2,
              )}\n`;
        const url = URL.createObjectURL(
          new Blob([content], {
            type:
              format === "markdown"
                ? "text/markdown;charset=utf-8"
                : "application/json;charset=utf-8",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        setToast(`已导出 ${filename}`);
        return;
      }

      const response = await fetch(`${LOCAL_API}/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, inspirations: data.inspirations }),
      });
      if (!response.ok) throw new Error("export failed");
      const result = (await response.json()) as {
        url: string;
        filename: string;
      };
      window.open(`${LOCAL_API}${result.url}`, "_blank", "noopener,noreferrer");
      setToast(`已导出 ${result.filename}，同时保存在“导出”文件夹`);
    } catch {
      setToast("导出失败，请确认本地资料服务已启动");
    }
  };

  const removeById = (
    key:
      | "projects"
      | "schedule"
      | "reminders"
      | "birthdays"
      | "inspirations"
      | "attendance"
      | "looseMemos",
    id: string,
  ) => {
    setData((current) => ({
      ...current,
      [key]: current[key].filter((item) => item.id !== id),
    }));
  };

  const navigateTo = (section: Section) => {
    if (section === active) return;
    window.history.pushState(
      { ...window.history.state, workbenchSection: section },
      "",
    );
    setActive(section);
  };

  const goToCurrentWeek = () => {
    navigateTo("music");
    window.setTimeout(() => {
      currentWeekRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      musicFirstInputRef.current?.focus();
    }, 80);
  };

  const homeCardNavigation = (section: Section) => ({
    role: "link",
    tabIndex: 0,
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("button, input, select, textarea, label, a, form")) return;
      navigateTo(section);
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        navigateTo(section);
      }
    },
  });

  const weatherMeta = weather ? weatherCopy(weather.code) : null;
  const filteredInspirations =
    inspirationFilter === "全部"
      ? data.inspirations
      : data.inspirations.filter(
          (item) => item.category === inspirationFilter,
        );

  const quickInspirationForm = (compact = false) => (
    <form
      className={`inspiration-form ${compact ? "compact-form" : ""}`}
      onSubmit={addInspiration}
    >
      <div className="category-picker" aria-label="灵感分类">
        {(Object.keys(categoryMeta) as InspirationCategory[]).map((category) => (
          <button
            type="button"
            key={category}
            className={inspirationCategory === category ? "active" : ""}
            onClick={() => setInspirationCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <textarea
        name="content"
        rows={compact ? 2 : 4}
        placeholder="这一刻想到什么？文字、一个念头或待研究的问题…"
      />
      <div className="form-line">
        <input name="tag" placeholder="标签（可选）" />
        <input name="link" inputMode="url" placeholder="粘贴链接（可选）" />
      </div>
      <div className="form-bottom">
        <label className="file-button">
          <input name="image" type="file" accept="image/*" />
          <span>⊕ 添加图片</span>
        </label>
        <button className="primary-button" type="submit" disabled={inspirationBusy}>
          {inspirationBusy ? "正在保存…" : "收进灵感库"}
        </button>
      </div>
    </form>
  );

  const renderRoutineHomeCard = (
    routineId: "routine-wechat" | "routine-expense",
    title: string,
    label: string,
  ) => {
    const routine = data.routines.find((item) => item.id === routineId);
    const items =
      routine?.items
        .filter((item) => !item.done || item.weekKey === currentWeekKey)
        .sort((a, b) => Number(a.done) - Number(b.done)) || [];
    return (
      <section
        className={`home-mini-card home-clickable routine-home-card ${routineId}`}
        {...homeCardNavigation(
          routineId === "routine-wechat" ? "wechat" : "expense",
        )}
      >
        <div className="home-card-head">
          <div>
            <span>{label}</span>
            <h2>{title}</h2>
          </div>
          <small>第 {currentWeek} 周</small>
        </div>
        <div className="home-mini-list">
          {items.map((item) => (
            <label
              className={`home-check-row ${item.done ? "done" : ""}`}
              key={item.id}
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleRoutineItem(routineId, item.id)}
              />
              <span>✓</span>
              <strong>{item.text}</strong>
            </label>
          ))}
          {!items.length && <p className="home-empty-line">本周还没有内容</p>}
        </div>
        <form
          className="home-one-line-form"
          onSubmit={(event) => addRoutineItem(event, routineId)}
        >
          <input
            name="text"
            placeholder={
              routineId === "routine-wechat" ? "添加发布内容" : "添加报销事项"
            }
          />
          <button type="submit" aria-label={`添加${title}`}>
            ＋
          </button>
        </form>
      </section>
    );
  };

  const renderRoutineDetailPage = (
    routineId: "routine-wechat" | "routine-expense",
    title: string,
    subtitle: string,
  ) => {
    const routine = data.routines.find((item) => item.id === routineId);
    const items =
      routine?.items
        .filter((item) => !item.done || item.weekKey === currentWeekKey)
        .sort((a, b) => Number(a.done) - Number(b.done)) || [];
    return (
      <div className="inner-page focused-detail-page">
        <div className="page-title">
          <div>
            <span className="section-label">WEEK {currentWeek}</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <section className="glass-panel standalone-checklist">
          <form onSubmit={(event) => addRoutineItem(event, routineId)}>
            <input
              name="text"
              placeholder={routineId === "routine-wechat" ? "填写本周发布内容" : "填写报销事项"}
            />
            <button className="primary-button" type="submit">
              添加
            </button>
          </form>
          <div>
            {items.map((item) =>
              editingRecord?.kind === "routine" &&
              editingRecord.id === item.id &&
              editingRecord.parentId === routineId ? (
                <form
                  className="inline-text-edit"
                  key={item.id}
                  onSubmit={(event) =>
                    saveRoutineItemEdit(event, routineId, item.id)
                  }
                >
                  <input name="text" required defaultValue={item.text} />
                  <button type="button" onClick={() => setEditingRecord(null)}>
                    取消
                  </button>
                  <button className="primary-button" type="submit">
                    保存
                  </button>
                </form>
              ) : (
                <article className={item.done ? "done" : ""} key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleRoutineItem(routineId, item.id)}
                    />
                    <span>✓</span>
                    <strong>{item.text}</strong>
                  </label>
                  <div className="record-actions">
                    <button
                      onClick={() =>
                        setEditingRecord({
                          kind: "routine",
                          id: item.id,
                          parentId: routineId,
                        })
                      }
                    >
                      编辑
                    </button>
                    <button
                      onClick={() =>
                        setData((current) => ({
                          ...current,
                          routines: current.routines.map((entry) =>
                            entry.id === routineId
                              ? {
                                  ...entry,
                                  items: entry.items.filter(
                                    (subitem) => subitem.id !== item.id,
                                  ),
                                }
                              : entry,
                          ),
                        }))
                      }
                      aria-label={`删除${item.text}`}
                    >
                      ×
                    </button>
                  </div>
                </article>
              ),
            )}
            {!items.length && <p className="home-empty-line">本周还没有内容</p>}
          </div>
        </section>
      </div>
    );
  };

  const renderReminderDetailPage = (
    type: Reminder["type"],
    title: string,
    subtitle: string,
  ) => {
    const items = [...data.reminders]
      .filter((item) => item.type === type)
      .sort(
        (a, b) =>
          Number(a.done) - Number(b.done) ||
          (new Date(a.datetime).getTime() || Number.MAX_SAFE_INTEGER) -
            (new Date(b.datetime).getTime() || Number.MAX_SAFE_INTEGER),
      );
    return (
      <div className="inner-page focused-detail-page">
        <div className="page-title">
          <div>
            <span className="section-label">
              {type === "meeting" ? "MEETING MEMO" : "SOCIAL MEMO"}
            </span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <section className="glass-panel">
          <form className="wide-form reminder-form" onSubmit={addReminder}>
            <input name="type" type="hidden" value={type} />
            <input name="title" required placeholder="内容" />
            <input name="datetime" type="datetime-local" aria-label="日期与时间（可选）" />
            <input name="person" placeholder="相关的人（可选）" />
            <input name="location" placeholder="地点（可选）" />
            <button className="primary-button" type="submit">
              添加
            </button>
          </form>
        </section>
        <div className="record-list">
          {items.map((item) =>
            editingRecord?.kind === "reminder" && editingRecord.id === item.id ? (
              <form
                className="record-edit-form reminder-record-edit"
                key={item.id}
                onSubmit={(event) => saveReminderEdit(event, item.id)}
              >
                <input name="type" type="hidden" value={type} />
                <input name="title" required defaultValue={item.title} />
                <input
                  name="datetime"
                  type="datetime-local"
                  defaultValue={item.datetime.slice(0, 16)}
                />
                <input name="person" defaultValue={item.person} placeholder="相关的人" />
                <input name="location" defaultValue={item.location} placeholder="地点" />
                <div className="record-edit-actions">
                  <button type="button" onClick={() => setEditingRecord(null)}>
                    取消
                  </button>
                  <button className="primary-button" type="submit">
                    保存
                  </button>
                </div>
              </form>
            ) : (
              <article className={`record-row ${item.done ? "done" : ""}`} key={item.id}>
                <button
                  className="record-check"
                  onClick={() =>
                    setData((current) => ({
                      ...current,
                      reminders: current.reminders.map((entry) =>
                        entry.id === item.id ? { ...entry, done: !entry.done } : entry,
                      ),
                    }))
                  }
                >
                  {item.done ? "✓" : ""}
                </button>
                <span className="date-chip">{formatDateTime(item.datetime)}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {[item.person, item.location].filter(Boolean).join(" · ") ||
                      "信息待补充"}
                  </small>
                </div>
                <div className="record-actions">
                  <button
                    onClick={() =>
                      setEditingRecord({ kind: "reminder", id: item.id })
                    }
                  >
                    编辑
                  </button>
                  <button onClick={() => removeById("reminders", item.id)}>×</button>
                </div>
              </article>
            ),
          )}
          {!items.length && <p className="home-empty-line">还没有记录</p>}
        </div>
      </div>
    );
  };

  const renderScheduleDetailPage = () => (
    <div className="inner-page focused-detail-page">
      <div className="page-title">
        <div>
          <span className="section-label">TODAY&apos;S WORK</span>
          <h1>今日工作清单</h1>
          <p>完成项即时沉底，并在完成三天后自动清理。</p>
        </div>
      </div>
      <section className="glass-panel">
        <form className="quick-schedule-form" onSubmit={addSchedule}>
          <input name="title" required placeholder="添加一项工作" />
          <input
            name="datetime"
            type="datetime-local"
            defaultValue={clock ? defaultLocalDateTime() : ""}
          />
          <select name="kind" defaultValue="工作">
            <option>工作</option>
            <option>生活</option>
            <option>临时</option>
          </select>
          <button className="round-add" type="submit">
            ＋
          </button>
        </form>
      </section>
      <div className="record-list">
        {[...data.schedule]
          .sort(compareScheduleNewestFirst)
          .map((item) =>
            editingRecord?.kind === "schedule" && editingRecord.id === item.id ? (
              <form
                className="record-edit-form schedule-record-edit"
                key={item.id}
                onSubmit={(event) => saveScheduleEdit(event, item.id)}
              >
                <select name="kind" defaultValue={item.kind}>
                  <option>工作</option>
                  <option>生活</option>
                  <option>临时</option>
                </select>
                <input name="title" required defaultValue={item.title} />
                <input
                  name="datetime"
                  required
                  type="datetime-local"
                  defaultValue={item.datetime.slice(0, 16)}
                />
                <div className="record-edit-actions">
                  <button type="button" onClick={() => setEditingRecord(null)}>
                    取消
                  </button>
                  <button className="primary-button" type="submit">
                    保存
                  </button>
                </div>
              </form>
            ) : (
              <article className={`record-row ${item.done ? "done" : ""}`} key={item.id}>
                <button
                  className="record-check"
                  onClick={() => toggleScheduleItem(item.id)}
                >
                  {item.done ? "✓" : ""}
                </button>
                <span className="date-chip">{formatDateTime(item.datetime)}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.kind}日程</small>
                </div>
                <div className="record-actions">
                  <button
                    onClick={() =>
                      setEditingRecord({ kind: "schedule", id: item.id })
                    }
                  >
                    编辑
                  </button>
                  <button onClick={() => removeById("schedule", item.id)}>×</button>
                </div>
              </article>
            ),
          )}
        {!data.schedule.length && <p className="home-empty-line">今天还没有工作项</p>}
      </div>
    </div>
  );

  const cloudGateOverlay =
    storageBackend === "cloud" && !ready ? (
      <div className="cloud-gate-shell">
        <section className="cloud-gate-card" aria-live="polite">
          <span className="cloud-gate-mark" aria-hidden="true">序</span>
          <span className="section-label">CLOUD DAYBOOK</span>
          <h1>我的日程台</h1>
          {cloudGate === "locked" ? (
            <>
              <p>输入云同步密钥，即可读取服务器中保存的日程与记录。</p>
              <form className="cloud-unlock-form" onSubmit={unlockCloud}>
                <label htmlFor="sync-key">云同步密钥</label>
                <input
                  id="sync-key"
                  name="syncKey"
                  type="password"
                  minLength={32}
                  required
                  autoComplete="current-password"
                  placeholder="请输入同步密钥"
                  disabled={cloudUnlocking}
                />
                <button className="primary-button" type="submit" disabled={cloudUnlocking}>
                  {cloudUnlocking ? "正在验证…" : "解锁并读取云端资料"}
                </button>
              </form>
              <small className="cloud-gate-note">
                验证成功后，本设备会保持登录 30 天；密钥不会写入网页代码。
              </small>
            </>
          ) : cloudGate === "error" ? (
            <>
              <p>{cloudGateMessage || "暂时无法连接云端。"}</p>
              <button className="primary-button" type="button" onClick={retryCloudLoad}>
                重新连接
              </button>
            </>
          ) : (
            <>
              <p>正在从服务器读取最新资料，请稍候。</p>
              <span className="cloud-loading-bar" aria-hidden="true" />
            </>
          )}
          {cloudGateMessage && cloudGate === "locked" && (
            <small className="cloud-gate-error" role="alert">{cloudGateMessage}</small>
          )}
        </section>
      </div>
    ) : null;

  return (
    <main className="app-shell">
      {cloudGateOverlay}
      <aside className="sidebar">
        <button className="brand" onClick={() => navigateTo("today")}>
          <span className="brand-mark">序</span>
          <span>
            <strong>我的日程台</strong>
            <small>{storageBackend === "cloud" ? "CLOUD DAYBOOK" : "LOCAL DAYBOOK"}</small>
          </span>
        </button>

        <nav className="section-nav" aria-label="主要板块">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={active === item.id ? "active" : ""}
              onClick={() => navigateTo(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={`storage-card ${storage}`}>
          <span className="storage-dot" />
          <div>
            <strong>
              {storageBackend === "cloud"
                ? "云端资料库"
                : storage === "offline"
                  ? "资料库未连接"
                  : "本地资料库"}
            </strong>
            <small>{storageMessage}</small>
          </div>
        </div>
        <div className="sidebar-butterfly">
          <DreamButterfly />
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="today-lockup">
            <span className="day-number">
              {clock ? String(clock.getDate()).padStart(2, "0") : "--"}
            </span>
            <div>
              <strong>
                {clock
                  ? new Intl.DateTimeFormat("zh-CN", {
                      year: "numeric",
                      month: "long",
                    }).format(clock)
                  : "正在读取日期"}
              </strong>
              <span>
                {clock
                  ? new Intl.DateTimeFormat("zh-CN", {
                      weekday: "long",
                    }).format(clock)
                  : "星期"}
                <i>·</i>
                {festival || "寻常的一天"}
              </span>
            </div>
          </div>

          <div className="clock-weather">
            <div className="clock">
              {clock
                ? new Intl.DateTimeFormat("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  }).format(clock)
                : "--:--:--"}
            </div>
            <div className="weather">
              <span className="weather-icon">{weatherMeta?.icon || "◌"}</span>
              <div>
                <strong>
                  {weather ? `${weather.temperature}°` : "天气读取中"}
                </strong>
                <small>
                  深圳 ·{" "}
                  {weather
                    ? `${weatherMeta?.text} ${weather.low}°—${weather.high}°`
                    : "广东"}
                </small>
              </div>
            </div>
          </div>

          <div className="daily-line">
            <span>DAILY VERSE · 今日一句</span>
            <p>“{quote.text}”</p>
            <a href={quote.href} target="_blank" rel="noreferrer">
              {quote.credit} · {quote.source}
            </a>
          </div>

          <div className="top-butterfly" aria-hidden="true">
            <span className="top-orb orb-blue" />
            <span className="top-orb orb-lilac" />
            <div className="top-butterfly-copy">
              <small>SOFTLY, BUT SURELY</small>
              <strong>让今天轻盈一点</strong>
            </div>
            <DreamButterfly />
          </div>
        </header>

        <div className={`content ${active === "today" ? "home-content" : ""}`}>
          {false && (
            <div className="home-grid">
              <section className="glass-panel schedule-panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">QUICK SCHEDULE</span>
                    <h2>随手加日程</h2>
                  </div>
                  <button className="text-button" onClick={() => navigateTo("reminders")}>
                    看全部 →
                  </button>
                </div>
                <form className="quick-schedule-form" onSubmit={addSchedule}>
                  <input name="title" required placeholder="现在记下一件要做的事…" />
                  <input
                    name="datetime"
                    type="datetime-local"
                    defaultValue={clock ? defaultLocalDateTime() : ""}
                    aria-label="日程时间"
                  />
                  <select name="kind" aria-label="日程分类" defaultValue="工作">
                    <option>工作</option>
                    <option>生活</option>
                    <option>临时</option>
                  </select>
                  <button className="round-add" type="submit" aria-label="添加日程">
                    ＋
                  </button>
                </form>
                <div className="compact-list">
                  {upcomingSchedule.slice(0, 4).map((item) => (
                    <label className="compact-item" key={item.id}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleScheduleItem(item.id)}
                      />
                      <span className="soft-check">✓</span>
                      <span className="item-copy">
                        <strong>{item.title}</strong>
                        <small>{formatDateTime(item.datetime)}</small>
                      </span>
                      <em>{item.kind}</em>
                    </label>
                  ))}
                  {!upcomingSchedule.length && (
                    <div className="mini-empty">今天还很轻盈，先写下第一件事吧。</div>
                  )}
                </div>
              </section>

              <section className="glass-panel broadcast-panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">WEEKLY RADIO</span>
                    <h2>第 {currentWeek} 周歌单</h2>
                  </div>
                  <span className="butterfly" aria-hidden="true">ʚɞ</span>
                </div>
                <p className="panel-note">每周 3–4 首，只写歌名就好。</p>
                <div className="song-stack">
                  {Array.from({ length: 4 }, (_, index) => (
                    <label key={index}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <input
                        value={currentMusic?.songs[index] || ""}
                        onChange={(event) =>
                          updateMusic(currentWeek, index, event.target.value)
                        }
                        placeholder={
                          index < 3 ? "写下歌名" : "第四首（可选）"
                        }
                      />
                    </label>
                  ))}
                </div>
                <button className="double-click-tip" onDoubleClick={goToCurrentWeek}>
                  双击这里，也可直达全年第 {currentWeek} 周
                </button>
              </section>

              <section className="glass-panel inspiration-panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">IDEA FRAGMENTS</span>
                    <h2>随手收灵感</h2>
                  </div>
                  <div className="header-actions">
                    <button onClick={() => exportInspirations("json")}>导出 JSON</button>
                    <button onClick={() => navigateTo("inspiration")}>打开灵感库 →</button>
                  </div>
                </div>
                <div className="inspiration-home-layout">
                  {quickInspirationForm(true)}
                  <div className="latest-inspirations">
                    {data.inspirations.map((item) => (
                      <article
                        className={`idea-preview ${categoryMeta[item.category].color}`}
                        key={item.id}
                      >
                        {item.imagePath && (
                          <img
                            src={
                              storageBackend === "cloud"
                                ? cloudFileUrl(item.imagePath)
                                : localFileUrl(item.imagePath)
                            }
                            alt={item.imageName || "灵感图片"}
                          />
                        )}
                        <div>
                          <span>{item.category}</span>
                          <p>{item.content || item.link}</p>
                        </div>
                      </article>
                    ))}
                    {!data.inspirations.length && (
                      <div className="idea-placeholder">
                        <span>✦</span>
                        <p>文字、图片与链接都会在这里留下可检索的线索。</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="glance-stack">
                <button className="glance-card project-glance" onClick={() => navigateTo("projects")}>
                  <span>◇</span>
                  <div>
                    <small>项目工作</small>
                    <strong>{data.projects.length ? `${data.projects.length} 个项目` : "待添加"}</strong>
                  </div>
                  <em>→</em>
                </button>
                <button className="glance-card reminder-glance" onClick={() => navigateTo("reminders")}>
                  <span>◷</span>
                  <div>
                    <small>近期提醒</small>
                    <strong>
                      {upcomingReminders[0]?.title || "没有临近提醒"}
                    </strong>
                  </div>
                  <em>
                    {upcomingReminders[0]
                      ? formatDateTime(upcomingReminders[0].datetime)
                      : "轻松"}
                  </em>
                </button>
                <button className="glance-card life-glance" onClick={() => navigateTo("life")}>
                  <span>♡</span>
                  <div>
                    <small>今日生活</small>
                    <strong>
                      {data.checkins[today] ? "今天已经打卡" : "记得照顾自己"}
                    </strong>
                  </div>
                  <em>→</em>
                </button>
                <button className="glance-card routine-glance" onClick={() => navigateTo("daily")}>
                  <span>↻</span>
                  <div>
                    <small>日常工作</small>
                    <strong>{routineSeeds.map((item) => item.title).join(" · ")}</strong>
                  </div>
                  <em>→</em>
                </button>
              </section>
            </div>
          )}

          {active === "today" && (
            <div className="home-bento">
              <div className="work-memo-split">
                <section
                  className="glass-panel home-clickable today-work-panel"
                  {...homeCardNavigation("schedule")}
                >
                <div className="home-card-head">
                  <div>
                    <span>TODAY&apos;S WORK</span>
                    <h2>今日工作清单</h2>
                  </div>
                  <small>
                    {todaySchedule.filter((item) => !item.done).length} 项待处理
                  </small>
                </div>
                <form
                  className="quick-schedule-form home-quick-schedule"
                  onSubmit={addSchedule}
                >
                  <input name="title" required placeholder="随手加一条日程…" />
                  <input
                    name="datetime"
                    type="datetime-local"
                    defaultValue={clock ? defaultLocalDateTime() : ""}
                    aria-label="日程时间"
                  />
                  <select name="kind" aria-label="日程分类" defaultValue="工作">
                    <option>工作</option>
                    <option>生活</option>
                    <option>临时</option>
                  </select>
                  <button className="round-add" type="submit" aria-label="添加日程">
                    ＋
                  </button>
                </form>
                <div className="today-work-list">
                  {todaySchedule.map((item) => (
                    <label className="compact-item" key={item.id}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleScheduleItem(item.id)}
                      />
                      <span className="soft-check">✓</span>
                      <span className="item-copy">
                        <strong>{item.title}</strong>
                        <small>{formatDateTime(item.datetime)}</small>
                      </span>
                      <em>{item.kind}</em>
                    </label>
                  ))}
                  {!todaySchedule.length && (
                    <div className="mini-empty">今天的清单还是空的。</div>
                  )}
                </div>
                <button
                  className="panel-footer-link"
                  onClick={() => navigateTo("schedule")}
                >
                  查看全部日程 →
                </button>
                </section>
                <section
                  className="glass-panel home-clickable loose-memo-panel"
                  {...homeCardNavigation("loosememo")}
                >
                  <div className="home-card-head">
                    <div>
                      <span>QUICK MEMO</span>
                      <h2>随手备忘</h2>
                    </div>
                    <small>{data.looseMemos.length} 条</small>
                  </div>
                  <form className="loose-memo-home-form" onSubmit={addLooseMemo}>
                    <textarea
                      name="text"
                      rows={3}
                      placeholder="近期或长期、暂时不好分类的事情…"
                    />
                    <button className="primary-button" type="submit">
                      记下
                    </button>
                  </form>
                  <div className="loose-memo-preview">
                    {data.looseMemos.map((memo) => (
                      <p key={memo.id}>{memo.text}</p>
                    ))}
                    {!data.looseMemos.length && (
                      <p className="home-empty-line">这里可以放任何纯文字备忘</p>
                    )}
                  </div>
                </section>
              </div>

              {renderRoutineHomeCard("routine-wechat", "官微", "WECHAT")}
              {renderRoutineHomeCard("routine-expense", "报销", "EXPENSE")}

              <section
                className="home-mini-card home-clickable memo-card meeting-memo"
                {...homeCardNavigation("meetings")}
              >
                <div className="home-card-head">
                  <div>
                    <span>MEETING MEMO</span>
                    <h2>会议备忘</h2>
                  </div>
                  <button onClick={() => navigateTo("meetings")}>＋</button>
                </div>
                <div className="memo-list">
                  {upcomingReminders
                    .filter((item) => item.type === "meeting")
                    .map((item) => (
                      <button key={item.id} onClick={() => navigateTo("meetings")}>
                        <strong>{item.title}</strong>
                        <small>{formatDateTime(item.datetime)}</small>
                      </button>
                    ))}
                  {!upcomingReminders.some((item) => item.type === "meeting") && (
                    <p className="home-empty-line">暂无会议备忘</p>
                  )}
                </div>
              </section>

              <section
                className="home-mini-card home-clickable memo-card social-memo"
                {...homeCardNavigation("social")}
              >
                <div className="home-card-head">
                  <div>
                    <span>SOCIAL MEMO</span>
                    <h2>社交备忘</h2>
                  </div>
                  <button onClick={() => navigateTo("social")}>＋</button>
                </div>
                <div className="memo-list">
                  {upcomingReminders
                    .filter((item) => item.type === "social")
                    .map((item) => (
                      <button key={item.id} onClick={() => navigateTo("social")}>
                        <strong>{item.title}</strong>
                        <small>{formatDateTime(item.datetime)}</small>
                      </button>
                    ))}
                  {!upcomingReminders.some((item) => item.type === "social") && (
                    <p className="home-empty-line">暂无社交备忘</p>
                  )}
                </div>
              </section>

              <div className="radio-attendance-stack">
                <button
                  className="home-mini-card music-shortcut"
                  onClick={goToCurrentWeek}
                >
                  <DreamButterfly small />
                  <span className="music-disc">♫</span>
                  <div>
                    <small>WEEKLY RADIO</small>
                    <strong>第 {currentWeek} 周广播</strong>
                    <em>{currentMusic?.songs.filter(Boolean).length || 0} 首歌</em>
                  </div>
                </button>
                <section
                  className="home-mini-card home-clickable attendance-shortcut"
                  {...homeCardNavigation("attendance")}
                >
                  <div>
                    <small>ATTENDANCE</small>
                    <strong>今日考勤异常</strong>
                    <em>本月迟到 {monthlyLateCount} 次</em>
                  </div>
                  <form onSubmit={addAttendance}>
                    <select name="type" defaultValue="迟到" aria-label="今日考勤异常类型">
                      {attendanceTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <button type="submit">登记</button>
                  </form>
                </section>
              </div>

              <section
                className={`home-mini-card home-clickable checkin-shortcut ${
                  data.checkins[today] ? "checked" : ""
                }`}
                {...homeCardNavigation("checkin")}
              >
                <button
                  className="checkin-toggle"
                  type="button"
                  aria-label={data.checkins[today] ? "取消今日打卡" : "完成今日打卡"}
                  onClick={() =>
                    setData((current) => ({
                      ...current,
                      checkins: {
                        ...current.checkins,
                        [today]: !current.checkins[today],
                      },
                    }))
                  }
                >
                  {data.checkins[today] ? "✓" : "日"}
                </button>
                <div>
                  <small>DAILY CHECK-IN</small>
                  <strong>
                    {data.checkins[today] ? "今日已打卡" : "今日打卡"}
                  </strong>
                  <em>
                    {data.checkins[today] ? "今天也留下了记号" : "轻轻点一下完成"}
                  </em>
                </div>
              </section>

              <section
                className="home-mini-card home-clickable inspiration-quick-card"
                {...homeCardNavigation("inspiration")}
              >
                <div className="home-card-head">
                  <div>
                    <span>QUICK IDEA</span>
                    <h2>记灵感</h2>
                  </div>
                  <button onClick={() => navigateTo("inspiration")}>
                    图片 / 链接 →
                  </button>
                </div>
                <form className="home-inspiration-form" onSubmit={addInspiration}>
                  <div className="category-picker">
                    {(Object.keys(categoryMeta) as InspirationCategory[]).map(
                      (category) => (
                        <button
                          type="button"
                          key={category}
                          className={
                            inspirationCategory === category ? "active" : ""
                          }
                          onClick={() => setInspirationCategory(category)}
                        >
                          {category}
                        </button>
                      ),
                    )}
                  </div>
                  <input
                    name="content"
                    required
                    placeholder="一句话记下此刻的想法…"
                  />
                  <button className="round-add" type="submit" aria-label="保存灵感">
                    ＋
                  </button>
                </form>
              </section>

              <button
                className="home-mini-card project-home-card"
                onClick={() => navigateTo("projects")}
              >
                <div className="home-card-head">
                  <div>
                    <span>PROJECTS</span>
                    <h2>项目工作</h2>
                  </div>
                  <small>{data.projects.length} 个项目</small>
                </div>
                <div className="project-home-list">
                  {data.projects.map((project) => (
                    <div key={project.id}>
                      <strong>{project.name}</strong>
                      <p>
                        {project.progressText ||
                          (project.progress
                            ? `已完成 ${project.progress}%`
                            : "尚未填写当前进度")}
                      </p>
                    </div>
                  ))}
                  {!data.projects.length && (
                    <p className="home-empty-line">还没有进行中的项目</p>
                  )}
                </div>
              </button>

              <section
                className="home-mini-card home-clickable upcoming-home-card"
                {...homeCardNavigation("reminders")}
              >
                <div className="home-card-head">
                  <div>
                    <span>UPCOMING</span>
                    <h2>近期提醒</h2>
                  </div>
                  <small>查看全部 →</small>
                </div>
                <div className="upcoming-home-list">
                  {upcomingBirthdays.map(({ birthday, date, days }) => (
                    <button
                      className="birthday-home-alert"
                      key={birthday.id}
                      onClick={() => navigateTo("life")}
                    >
                      <span>生</span>
                      <strong>
                        {birthday.name}
                        {days === 0 ? "今天生日" : `还有 ${days} 天生日`}
                      </strong>
                      <small>
                        {birthday.calendar === "solar" ? "阳历" : "农历"} ·{" "}
                        {formatDateOnly(dateKey(date))}
                      </small>
                    </button>
                  ))}
                  {upcomingReminders.map((item) => (
                    <div key={item.id}>
                      <span>{item.type === "meeting" ? "会" : "约"}</span>
                      <strong>{item.title}</strong>
                      <small>{formatDateTime(item.datetime)}</small>
                    </div>
                  ))}
                  {!upcomingBirthdays.length && !upcomingReminders.length && (
                    <p className="home-empty-line">近期没有提醒</p>
                  )}
                </div>
              </section>
            </div>
          )}

          {active === "schedule" && renderScheduleDetailPage()}
          {active === "loosememo" && (
            <div className="inner-page focused-detail-page">
              <div className="page-title">
                <div>
                  <span className="section-label">PLAIN TEXT MEMOS</span>
                  <h1>随手备忘</h1>
                  <p>不需要分类、时间或地点，先把事情留在这里。</p>
                </div>
              </div>
              <section className="glass-panel loose-memo-detail">
                <form onSubmit={addLooseMemo}>
                  <textarea
                    name="text"
                    rows={4}
                    placeholder="写下近期或长期的备忘…"
                  />
                  <button className="primary-button" type="submit">
                    保存备忘
                  </button>
                </form>
                <div>
                  {data.looseMemos.map((memo) =>
                    editingRecord?.kind === "looseMemo" &&
                    editingRecord.id === memo.id ? (
                      <form
                        className="inline-text-edit"
                        key={memo.id}
                        onSubmit={(event) => saveLooseMemoEdit(event, memo.id)}
                      >
                        <input name="text" required defaultValue={memo.text} />
                        <button type="button" onClick={() => setEditingRecord(null)}>
                          取消
                        </button>
                        <button className="primary-button" type="submit">
                          保存
                        </button>
                      </form>
                    ) : (
                      <article key={memo.id}>
                        <p>{memo.text}</p>
                        <div className="record-actions">
                          <button
                            onClick={() =>
                              setEditingRecord({ kind: "looseMemo", id: memo.id })
                            }
                          >
                            编辑
                          </button>
                          <button onClick={() => removeById("looseMemos", memo.id)}>
                            ×
                          </button>
                        </div>
                      </article>
                    ),
                  )}
                  {!data.looseMemos.length && (
                    <p className="home-empty-line">还没有备忘</p>
                  )}
                </div>
              </section>
            </div>
          )}
          {active === "wechat" &&
            renderRoutineDetailPage(
              "routine-wechat",
              "官微",
              "本周需要发布的内容。勾选后沉底，周日清理已完成项。",
            )}
          {active === "expense" &&
            renderRoutineDetailPage(
              "routine-expense",
              "报销",
              "本周需要处理的报销事项。勾选后沉底，周日清理已完成项。",
            )}
          {active === "meetings" &&
            renderReminderDetailPage(
              "meeting",
              "会议备忘",
              "日期、相关人员和地点都可以稍后再补充。",
            )}
          {active === "social" &&
            renderReminderDetailPage(
              "social",
              "社交备忘",
              "先记下事情本身，不确定的日期和地点无需填写。",
            )}
          {active === "checkin" && (
            <div className="inner-page focused-detail-page">
              <div className="page-title">
                <div>
                  <span className="section-label">DAILY CHECK-IN</span>
                  <h1>今日打卡</h1>
                  <p>给今天留下一个轻轻的记号。</p>
                </div>
              </div>
              <button
                className={`life-card standalone-checkin ${
                  data.checkins[today] ? "checked" : ""
                }`}
                onClick={() =>
                  setData((current) => ({
                    ...current,
                    checkins: {
                      ...current.checkins,
                      [today]: !current.checkins[today],
                    },
                  }))
                }
              >
                <span>{data.checkins[today] ? "✓" : "日"}</span>
                <strong>{data.checkins[today] ? "今天已经打卡" : "完成今日打卡"}</strong>
                <small>{today}</small>
              </button>
            </div>
          )}

          {active === "projects" && (
            <div className="inner-page">
              <div className="page-title">
                <div>
                  <span className="section-label">PROJECTS</span>
                  <h1>项目工作</h1>
                  <p>把正在推进的事情放在同一张地图上。</p>
                </div>
              </div>
              <section className="glass-panel">
                <form className="wide-form" onSubmit={addProject}>
                  <input name="name" required placeholder="项目名称" />
                  <input name="summary" placeholder="一句话说明" />
                  <input name="due" type="date" aria-label="截止日期" />
                  <input name="url" inputMode="url" placeholder="在线表格 / 资料链接" />
                  <input
                    name="progressText"
                    placeholder="当前进度，例如：等待确认 / 正在修改"
                  />
                  <button className="primary-button" type="submit">添加项目</button>
                </form>
              </section>
              <div className="project-grid">
                {data.projects.map((project) =>
                  editingRecord?.kind === "project" &&
                  editingRecord.id === project.id ? (
                    <form
                      className="project-card project-edit-card"
                      key={project.id}
                      onSubmit={(event) => saveProjectEdit(event, project.id)}
                    >
                      <input name="name" required defaultValue={project.name} />
                      <input name="summary" defaultValue={project.summary} />
                      <input name="due" type="date" defaultValue={project.due} />
                      <input name="url" defaultValue={project.url} placeholder="资料链接" />
                      <input
                        name="progressText"
                        defaultValue={
                          project.progressText ||
                          (project.progress ? `已完成 ${project.progress}%` : "")
                        }
                        placeholder="当前进度"
                      />
                      <div className="record-edit-actions">
                        <button type="button" onClick={() => setEditingRecord(null)}>
                          取消
                        </button>
                        <button className="primary-button" type="submit">
                          保存
                        </button>
                      </div>
                    </form>
                  ) : (
                    <article className="project-card" key={project.id}>
                      <div className="project-card-head">
                        <span>◇</span>
                        <div className="record-actions">
                          <button
                            onClick={() =>
                              setEditingRecord({ kind: "project", id: project.id })
                            }
                          >
                            编辑
                          </button>
                          <button onClick={() => removeById("projects", project.id)}>
                            ×
                          </button>
                        </div>
                      </div>
                      <h3>{project.name}</h3>
                      <p>{project.summary || "暂无说明"}</p>
                      <div className="project-progress-note">
                        <span>当前进度</span>
                        <strong>
                          {project.progressText ||
                            (project.progress
                              ? `已完成 ${project.progress}%`
                              : "尚未填写")}
                        </strong>
                      </div>
                      <footer>
                        <span>{project.due || "未设截止日"}</span>
                        {safeUrl(project.url) && (
                          <a href={safeUrl(project.url)} target="_blank" rel="noreferrer">
                            打开资料 ↗
                          </a>
                        )}
                      </footer>
                    </article>
                  ),
                )}
              </div>
            </div>
          )}

          {active === "daily" && (
            <div className="inner-page">
              <div className="page-title">
                <div>
                  <span className="section-label">ROUTINES</span>
                  <h1>日常工作</h1>
                  <p>不用反复记住，让固定节奏自己浮现。</p>
                </div>
              </div>
              <div className="routine-grid">
                {data.routines.map((routine, index) => (
                  <article
                    className={`routine-card color-${index} ${routine.done ? "done" : ""} ${
                      ["routine-wechat", "routine-expense"].includes(routine.id)
                        ? "has-sublist"
                        : ""
                    }`}
                    key={routine.id}
                  >
                    <div className="routine-main">
                      <button
                        className="routine-toggle"
                        onClick={() =>
                          setData((current) => ({
                            ...current,
                            routines: current.routines.map((entry) =>
                              entry.id === routine.id
                                ? { ...entry, done: !entry.done }
                                : entry,
                            ),
                          }))
                        }
                        aria-label={`切换${routine.title}完成状态`}
                      >
                        {routine.done ? "✓" : navItems[index + 3]?.icon || "✦"}
                      </button>
                      <div>
                        <strong>{routine.title}</strong>
                        <small>{routine.cycle}</small>
                      </div>
                      {!["routine-wechat", "routine-expense"].includes(routine.id) && (
                        <em>{routine.done ? "今天已完成" : "点击图标完成"}</em>
                      )}
                    </div>

                    {["routine-wechat", "routine-expense"].includes(routine.id) && (
                      <div className="routine-sublist">
                        <div className="sublist-title">
                          <span>第 {currentWeek} 周</span>
                          <small>
                            {
                              routine.items.filter(
                                (item) =>
                                  item.weekKey ===
                                  `${year}-W${String(currentWeek).padStart(2, "0")}`,
                              ).length
                            }{" "}
                            项
                          </small>
                        </div>
                        <div className="sublist-items">
                          {routine.items
                            .filter(
                              (item) =>
                                item.weekKey ===
                                `${year}-W${String(currentWeek).padStart(2, "0")}`,
                            )
                            .sort((a, b) => Number(a.done) - Number(b.done))
                            .map((item) => (
                              <label
                                className={`sublist-item ${item.done ? "done" : ""}`}
                                key={item.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={item.done}
                                  onChange={() =>
                                    setData((current) => ({
                                      ...current,
                                      routines: current.routines.map((entry) =>
                                        entry.id === routine.id
                                          ? {
                                              ...entry,
                                              items: entry.items.map((subitem) =>
                                                subitem.id === item.id
                                                  ? {
                                                      ...subitem,
                                                      done: !subitem.done,
                                                    }
                                                  : subitem,
                                              ),
                                            }
                                          : entry,
                                      ),
                                    }))
                                  }
                                />
                                <span>✓</span>
                                <strong>{item.text}</strong>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    setData((current) => ({
                                      ...current,
                                      routines: current.routines.map((entry) =>
                                        entry.id === routine.id
                                          ? {
                                              ...entry,
                                              items: entry.items.filter(
                                                (subitem) => subitem.id !== item.id,
                                              ),
                                            }
                                          : entry,
                                      ),
                                    }));
                                  }}
                                  aria-label={`删除${item.text}`}
                                >
                                  ×
                                </button>
                              </label>
                            ))}
                        </div>
                        <form
                          className="sublist-form"
                          onSubmit={(event) => addRoutineItem(event, routine.id)}
                        >
                          <input
                            name="text"
                            placeholder={
                              routine.id === "routine-wechat"
                                ? "填写本周要发布的内容"
                                : "填写本周要报销的事项"
                            }
                          />
                          <button type="submit">＋</button>
                        </form>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}

          {active === "music" && (
            <div className="inner-page music-page">
              <div className="page-title">
                <div>
                  <span className="section-label">WEEKLY RADIO · {year}</span>
                  <h1>广播音乐</h1>
                  <p>每周留下 3–4 首歌名。顶部广播入口双击即可回到本周。</p>
                </div>
              </div>
              <div className="music-only-layout">
                <section className="glass-panel radio-detail-panel">
                  <div className="panel-head">
                    <div>
                      <span className="section-label">WEEKLY RADIO · {year}</span>
                      <h2>每周广播</h2>
                    </div>
                    <small>每周 3–4 首歌名</small>
                  </div>
                  <div className="music-table">
                    {Array.from({ length: getWeeksInYear(year) }, (_, index) => {
                      const week = index + 1;
                      const start = getWeekStart(year, week);
                      const end = new Date(start);
                      end.setDate(start.getDate() + 6);
                      const entry = data.music.find((item) => item.week === week);
                      return (
                        <div
                          className={`music-row ${week === currentWeek ? "current" : ""}`}
                          key={week}
                          ref={week === currentWeek ? currentWeekRef : undefined}
                        >
                          <div className="week-cell">
                            <strong>W{String(week).padStart(2, "0")}</strong>
                            <span>
                              {start.getMonth() + 1}.{start.getDate()}—
                              {end.getMonth() + 1}.{end.getDate()}
                            </span>
                            {week === currentWeek && <em>本周</em>}
                          </div>
                          {Array.from({ length: 4 }, (_, songIndex) => {
                            const song = entry?.songs[songIndex] || "";
                            const previousCount = countPreviousSongOccurrences(
                              data.music,
                              song,
                              week,
                              songIndex,
                            );
                            const inputKey = `${week}-${songIndex}`;
                            const isAddingSong = newMusicInputKey === inputKey;
                            const occurrenceNumber = previousCount + 1;
                            return (
                              <label
                                className="music-song-field"
                                key={songIndex}
                              >
                                <input
                                  ref={
                                    week === currentWeek && songIndex === 0
                                      ? musicFirstInputRef
                                      : undefined
                                  }
                                  value={song}
                                  onFocus={() => {
                                    if (!normalizeSongTitle(song)) {
                                      setNewMusicInputKey(inputKey);
                                    }
                                  }}
                                  onBlur={() =>
                                    setNewMusicInputKey((current) =>
                                      current === inputKey ? null : current,
                                    )
                                  }
                                  onChange={(event) =>
                                    updateMusic(
                                      week,
                                      songIndex,
                                      event.target.value,
                                    )
                                  }
                                  placeholder={
                                    songIndex < 3
                                      ? `歌名 ${songIndex + 1}`
                                      : "第四首（可选）"
                                  }
                                />
                                {normalizeSongTitle(song) && (
                                  <span
                                    className={`song-reuse-count ${previousCount > 0 ? "reused" : ""}`}
                                    aria-live={isAddingSong ? "polite" : undefined}
                                  >
                                    {isAddingSong
                                      ? `此前出现过${previousCount}次`
                                      : `第${occurrenceNumber}次`}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </section>

              </div>
            </div>
          )}

          {active === "attendance" && (
            <div className="inner-page focused-detail-page">
              <div className="page-title">
                <div>
                  <span className="section-label">MONTHLY ATTENDANCE</span>
                  <h1>考勤异常记录</h1>
                  <p>每月 16 日自动清理上月记录。</p>
                </div>
              </div>
              <section className="glass-panel attendance-detail-panel">
                <div className="attendance-stats">
                  <div>
                    <span>本月异常</span>
                    <strong>{monthlyAttendance.length}</strong>
                  </div>
                  <div>
                    <span>本月迟到</span>
                    <strong>{monthlyLateCount}</strong>
                  </div>
                </div>
                <form className="attendance-form" onSubmit={addAttendance}>
                  <input name="date" type="date" required defaultValue={today} />
                  <select name="type" defaultValue="迟到" aria-label="考勤异常类型">
                    {attendanceTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                  <input name="note" placeholder="备注（可选）" />
                  <button className="primary-button" type="submit">
                    登记异常
                  </button>
                </form>
                <div className="attendance-records">
                  {[...data.attendance]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((record) =>
                      editingRecord?.kind === "attendance" &&
                      editingRecord.id === record.id ? (
                        <form
                          className="attendance-form attendance-inline-edit"
                          key={record.id}
                          onSubmit={(event) =>
                            saveAttendanceEdit(event, record.id)
                          }
                        >
                          <input name="date" type="date" required defaultValue={record.date} />
                          <select name="type" defaultValue={record.type}>
                            {attendanceTypes.map((type) => (
                              <option key={type}>{type}</option>
                            ))}
                          </select>
                          <input name="note" defaultValue={record.note} />
                          <div className="record-edit-actions">
                            <button type="button" onClick={() => setEditingRecord(null)}>
                              取消
                            </button>
                            <button className="primary-button" type="submit">
                              保存
                            </button>
                          </div>
                        </form>
                      ) : (
                        <article key={record.id}>
                          <span>{record.type}</span>
                          <div>
                            <strong>{formatDateOnly(record.date)}</strong>
                            <small>{record.note || "无备注"}</small>
                          </div>
                          <div className="record-actions">
                            <button
                              onClick={() =>
                                setEditingRecord({
                                  kind: "attendance",
                                  id: record.id,
                                })
                              }
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => removeById("attendance", record.id)}
                              aria-label={`删除${record.date}的${record.type}记录`}
                            >
                              ×
                            </button>
                          </div>
                        </article>
                      ),
                    )}
                  {!data.attendance.length && (
                    <p className="home-empty-line">还没有考勤异常记录</p>
                  )}
                </div>
              </section>
            </div>
          )}

          {active === "reminders" && (
            <div className="inner-page">
              <div className="page-title">
                <div>
                  <span className="section-label">CALENDAR & REMINDERS</span>
                  <h1>提醒日历</h1>
                  <p>会议、见面和需要提前想起来的事。</p>
                </div>
              </div>
              <section className="glass-panel">
                <form className="wide-form reminder-form" onSubmit={addReminder}>
                  <select name="type" defaultValue="meeting" aria-label="提醒类型">
                    <option value="meeting">会议</option>
                    <option value="social">社交</option>
                  </select>
                  <input name="title" required placeholder="提醒内容" />
                  <input
                    name="datetime"
                    type="datetime-local"
                    aria-label="日期与时间（可选）"
                  />
                  <input name="person" placeholder="相关的人（可选）" />
                  <input name="location" placeholder="地点（可选）" />
                  <button className="primary-button" type="submit">添加提醒</button>
                </form>
              </section>
              <div className="record-list">
                {[...data.schedule]
                  .sort(compareScheduleNewestFirst)
                  .map((item) =>
                    editingRecord?.kind === "schedule" &&
                    editingRecord.id === item.id ? (
                      <form
                        className="record-edit-form schedule-record-edit"
                        key={item.id}
                        onSubmit={(event) => saveScheduleEdit(event, item.id)}
                      >
                        <select name="kind" defaultValue={item.kind} aria-label="日程分类">
                          <option>工作</option>
                          <option>生活</option>
                          <option>临时</option>
                        </select>
                        <input name="title" required defaultValue={item.title} />
                        <input
                          name="datetime"
                          required
                          type="datetime-local"
                          defaultValue={item.datetime.slice(0, 16)}
                        />
                        <div className="record-edit-actions">
                          <button type="button" onClick={() => setEditingRecord(null)}>
                            取消
                          </button>
                          <button className="primary-button" type="submit">
                            保存
                          </button>
                        </div>
                      </form>
                    ) : (
                      <article
                        className={`record-row ${item.done ? "done" : ""}`}
                        key={item.id}
                      >
                        <button
                          className="record-check"
                          onClick={() => toggleScheduleItem(item.id)}
                        >
                          {item.done ? "✓" : ""}
                        </button>
                        <span className="date-chip">{formatDateTime(item.datetime)}</span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.kind}日程</small>
                        </div>
                        <div className="record-actions">
                          <button
                            onClick={() =>
                              setEditingRecord({ kind: "schedule", id: item.id })
                            }
                          >
                            编辑
                          </button>
                          <button onClick={() => removeById("schedule", item.id)}>×</button>
                        </div>
                      </article>
                    ),
                  )}
                {[...data.reminders]
                  .sort(
                    (a, b) =>
                      Number(a.done) - Number(b.done) ||
                      new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
                  )
                  .map((item) =>
                    editingRecord?.kind === "reminder" &&
                    editingRecord.id === item.id ? (
                      <form
                        className="record-edit-form reminder-record-edit"
                        key={item.id}
                        onSubmit={(event) => saveReminderEdit(event, item.id)}
                      >
                        <select name="type" defaultValue={item.type} aria-label="提醒类型">
                          <option value="meeting">会议</option>
                          <option value="social">社交</option>
                        </select>
                        <input name="title" required defaultValue={item.title} />
                        <input
                          name="datetime"
                          type="datetime-local"
                          defaultValue={item.datetime.slice(0, 16)}
                        />
                        <input
                          name="person"
                          defaultValue={item.person}
                          placeholder="相关的人（可选）"
                        />
                        <input
                          name="location"
                          defaultValue={item.location}
                          placeholder="地点（可选）"
                        />
                        <div className="record-edit-actions">
                          <button type="button" onClick={() => setEditingRecord(null)}>
                            取消
                          </button>
                          <button className="primary-button" type="submit">
                            保存
                          </button>
                        </div>
                      </form>
                    ) : (
                      <article
                        className={`record-row ${item.done ? "done" : ""}`}
                        key={item.id}
                      >
                        <button
                          className="record-check"
                          onClick={() =>
                            setData((current) => ({
                              ...current,
                              reminders: current.reminders.map((entry) =>
                                entry.id === item.id
                                  ? { ...entry, done: !entry.done }
                                  : entry,
                              ),
                            }))
                          }
                        >
                          {item.done ? "✓" : ""}
                        </button>
                        <span className="date-chip">{formatDateTime(item.datetime)}</span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>
                            {item.type === "meeting" ? "会议" : "社交"}
                            {[item.person, item.location].filter(Boolean).join(" · ")}
                          </small>
                        </div>
                        <div className="record-actions">
                          <button
                            onClick={() =>
                              setEditingRecord({ kind: "reminder", id: item.id })
                            }
                          >
                            编辑
                          </button>
                          <button onClick={() => removeById("reminders", item.id)}>×</button>
                        </div>
                      </article>
                    ),
                  )}
              </div>
            </div>
          )}

          {active === "life" && (
            <div className="inner-page">
              <div className="page-title">
                <div>
                  <span className="section-label">LIFE NOTES</span>
                  <h1>生活提示</h1>
                  <p>照顾身体，也记得那些重要的日子。</p>
                </div>
              </div>
              <div className="life-grid">
                <button
                  className={`life-card daily-checkin ${data.checkins[today] ? "checked" : ""}`}
                  onClick={() =>
                    setData((current) => ({
                      ...current,
                      checkins: {
                        ...current.checkins,
                        [today]: !current.checkins[today],
                      },
                    }))
                  }
                >
                  <span>{data.checkins[today] ? "✓" : "日"}</span>
                  <strong>{data.checkins[today] ? "今天已打卡" : "今日打卡"}</strong>
                  <small>给平常的一天一个轻轻的记号</small>
                </button>
                <button
                  className={`life-card exercise-card ${data.exercise[today] ? "checked" : ""}`}
                  onClick={() =>
                    setData((current) => ({
                      ...current,
                      exercise: {
                        ...current.exercise,
                        [today]: !current.exercise[today],
                      },
                    }))
                  }
                >
                  <span>{data.exercise[today] ? "✓" : "动"}</span>
                  <strong>周一 · 周四运动</strong>
                  <small>{data.exercise[today] ? "今天已经动起来了" : "点击记录今天的运动"}</small>
                </button>
              </div>
              <section className="glass-panel birthday-section">
                <div className="panel-head">
                  <div>
                    <span className="section-label">BIRTHDAYS</span>
                    <h2>生日记录</h2>
                  </div>
                </div>
                <form className="wide-form birthday-form" onSubmit={addBirthday}>
                  <input name="name" required placeholder="姓名" />
                  <select name="calendar" defaultValue="solar">
                    <option value="solar">阳历</option>
                    <option value="lunar">农历</option>
                  </select>
                  <input name="month" type="number" min="1" max="12" required placeholder="月" />
                  <input name="day" type="number" min="1" max="31" required placeholder="日" />
                  <input name="note" placeholder="备注" />
                  <button className="primary-button" type="submit">记录生日</button>
                </form>
                <div className="birthday-grid">
                  {data.birthdays.map((item) => (
                    <article className="birthday-card" key={item.id}>
                      <span>{item.name.slice(0, 1)}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>
                          {item.calendar === "solar" ? "阳历" : "农历"} {item.month} 月 {item.day} 日
                          {item.note ? ` · ${item.note}` : ""}
                        </small>
                      </div>
                      <button onClick={() => removeById("birthdays", item.id)}>×</button>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}

          {active === "inspiration" && (
            <div className="inner-page inspiration-page">
              <div className="page-title">
                <div>
                  <span className="section-label">IDEA FRAGMENTS</span>
                  <h1>灵感碎片</h1>
                  <p>按分类留下文字、图片和链接，随时导出给 AI 继续整理。</p>
                </div>
                <div className="page-actions">
                  <button onClick={() => exportInspirations("markdown")}>导出 Markdown</button>
                  <button className="primary-button" onClick={() => exportInspirations("json")}>
                    导出 JSON
                  </button>
                </div>
              </div>
              <section className="glass-panel inspiration-create">
                {quickInspirationForm()}
              </section>
              <div className="filter-row">
                {(["全部", "美", "情", "业", "家"] as const).map((category) => (
                  <button
                    key={category}
                    className={inspirationFilter === category ? "active" : ""}
                    onClick={() => setInspirationFilter(category)}
                  >
                    {category}
                    <span>
                      {category === "全部"
                        ? data.inspirations.length
                        : data.inspirations.filter(
                            (item) => item.category === category,
                          ).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="masonry">
                {filteredInspirations.map((item) => (
                  <article
                    className={`inspiration-note ${categoryMeta[item.category].color}`}
                    key={item.id}
                  >
                    {item.imagePath && (
                      <img
                        src={
                          storageBackend === "cloud"
                            ? cloudFileUrl(item.imagePath)
                            : localFileUrl(item.imagePath)
                        }
                        alt={item.imageName || "灵感图片"}
                      />
                    )}
                      <header>
                        <span>{item.category}</span>
                        <small>{formatDateTime(item.createdAt)}</small>
                      </header>
                    {item.content && <p>{item.content}</p>}
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noreferrer">
                        {item.link.replace(/^https?:\/\//, "").slice(0, 42)} ↗
                      </a>
                    )}
                    <footer>
                      <span>{item.tag ? `# ${item.tag}` : categoryMeta[item.category].subtitle}</span>
                      <button onClick={() => removeById("inspirations", item.id)}>×</button>
                    </footer>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
