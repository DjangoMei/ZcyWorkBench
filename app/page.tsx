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
type StorageBackend = "api" | "remote" | "browser";

type WeatherState = {
  temperature: number;
  apparent: number;
  high: number;
  low: number;
  code: number;
} | null;

const LOCAL_API = "http://127.0.0.1:4174";
const REMOTE_API = withBasePath("/api/sync");
const BROWSER_STORAGE_KEY = "zcy-personal-workbench-v1";
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

const nerudaLines = [
  ["我喜欢你是寂静的，仿佛你消失了一样。", "《二十首情诗和一支绝望的歌》"],
  ["爱情太短，遗忘太长。", "《今夜我可以写》"],
  ["我要在你身上去做，春天在樱桃树上做的事情。", "《每一天你都与宇宙的光同在》"],
  ["你不像任何人，因为我爱你。", "《第十四首》"],
  ["我爱你，不知道怎样，也不知道何时，或者从何处开始。", "《一百首爱的十四行诗》"],
  ["在我荒瘠的土地上，你是最后的玫瑰。", "《二十首情诗和一支绝望的歌》"],
  ["你是我在沉默中守护的光。", "聂鲁达诗意摘记"],
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
    useState<StorageBackend>("api");
  const [storageMessage, setStorageMessage] = useState("正在连接个人资料库");
  const [ready, setReady] = useState(false);
  const [inspirationCategory, setInspirationCategory] =
    useState<InspirationCategory>("美");
  const [inspirationFilter, setInspirationFilter] = useState<
    InspirationCategory | "全部"
  >("全部");
  const [inspirationBusy, setInspirationBusy] = useState(false);
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

  const referenceDate = clock ?? new Date(0);
  const year = referenceDate.getFullYear();
  const currentWeek = getIsoWeek(referenceDate);
  const today = dateKey(referenceDate);
  const latestSunday = clock ? latestSundayKey(clock) : "";
  const isSunday = clock?.getDay() === 0;
  const festival = clock ? festivalFor(clock) : "";
  const quote = nerudaLines[
    Math.floor(new Date(today).getTime() / 86_400_000) % nerudaLines.length
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
    const isRemote = !["localhost", "127.0.0.1"].includes(
      window.location.hostname,
    );

    const connectRemoteSession = async () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const token = fragment.get("sync");
      if (!token) return;
      const response = await fetch(`${REMOTE_API}/session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("remote session unavailable");
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    };

    const source = isRemote ? REMOTE_API : `${LOCAL_API}/api/data`;
    connectRemoteSession()
      .then(() => fetch(source))
      .then(async (response) => {
        if (!response.ok) throw new Error("storage unavailable");
        const result = (await response.json()) as
          | Partial<WorkbenchData>
          | { data: Partial<WorkbenchData> };
        const saved =
          "data" in result && result.data ? result.data : result;
        const serverData = normalizeData(saved);
        const hasServerData =
          serverData.projects.length +
            serverData.schedule.length +
            serverData.reminders.length +
            serverData.inspirations.length >
          0;

        if (!isRemote && !hasServerData) {
          const legacy = window.localStorage.getItem(BROWSER_STORAGE_KEY);
          if (legacy) {
            const migrated = normalizeData(JSON.parse(legacy));
            await fetch(`${LOCAL_API}/api/data`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(migrated),
            });
            window.localStorage.removeItem(BROWSER_STORAGE_KEY);
            if (!cancelled) setData(migrated);
          } else if (!cancelled) {
            setData(serverData);
          }
        } else if (!cancelled) {
          setData(serverData);
        }

        if (!cancelled) {
          setStorageBackend(isRemote ? "remote" : "api");
          setStorage("saved");
          setStorageMessage(
            isRemote
              ? "已连接远端资料库"
              : "已保存到电脑 · 个人资料库",
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          const browserData = window.localStorage.getItem(BROWSER_STORAGE_KEY);
          if (browserData) {
            try {
              setData(normalizeData(JSON.parse(browserData)));
            } catch {
              window.localStorage.removeItem(BROWSER_STORAGE_KEY);
            }
          }
          setStorageBackend("browser");
          setStorage("saved");
          setStorageMessage("已保存在此浏览器");
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

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
    setStorageMessage(
      storageBackend === "remote" ? "正在同步远端" : "正在写入电脑",
    );
    const timer = window.setTimeout(() => {
      fetch(storageBackend === "remote" ? REMOTE_API : `${LOCAL_API}/api/data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((response) => {
          if (!response.ok) throw new Error("save failed");
          setStorage("saved");
          setStorageMessage(
            storageBackend === "remote"
              ? "已同步到远端资料库"
              : "已保存到电脑 · 个人资料库",
          );
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
        .sort(
          (a, b) =>
            Number(a.done) - Number(b.done) ||
            new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
        ),
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
        if (storage === "offline") {
          throw new Error("请先连接本地资料库后再上传图片。");
        }
        const response = await fetch(
          `${LOCAL_API}/api/upload?name=${encodeURIComponent(image.name)}`,
          {
            method: "POST",
            headers: { "Content-Type": image.type || "application/octet-stream" },
            body: image,
          },
        );
        if (!response.ok) throw new Error("图片保存失败");
        const result = (await response.json()) as {
          path: string;
          name: string;
        };
        imagePath = result.path;
        imageName = result.name;
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
      if (storageBackend === "browser") {
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
          .sort(
            (a, b) =>
              Number(a.done) - Number(b.done) ||
              new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
          )
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigateTo("today")}>
          <span className="brand-mark">序</span>
          <span>
            <strong>我的日程台</strong>
            <small>LOCAL DAYBOOK</small>
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
            <strong>{storage === "offline" ? "资料库未连接" : "本地资料库"}</strong>
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
            <span>NERUDA · 每日一句</span>
            <p>“{quote[0]}”</p>
            <small>{quote[1]}</small>
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
                            src={localFileUrl(item.imagePath)}
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
                          {Array.from({ length: 4 }, (_, songIndex) => (
                            <input
                              key={songIndex}
                              ref={
                                week === currentWeek && songIndex === 0
                                  ? musicFirstInputRef
                                  : undefined
                              }
                              value={entry?.songs[songIndex] || ""}
                              onChange={(event) =>
                                updateMusic(week, songIndex, event.target.value)
                              }
                              placeholder={
                                songIndex < 3 ? `歌名 ${songIndex + 1}` : "第四首（可选）"
                              }
                            />
                          ))}
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
                  .sort(
                    (a, b) =>
                      Number(a.done) - Number(b.done) ||
                      new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
                  )
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
                        src={localFileUrl(item.imagePath)}
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
