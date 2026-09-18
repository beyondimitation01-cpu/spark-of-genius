import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Streak — visual habit and streak tracker" },
      {
        name: "description",
        content:
          "Create habits, check off each day you show up, and watch your streaks grow. Daily reminders included, everything saved on your device.",
      },
      { property: "og:title", content: "Streak — visual habit tracker" },
      {
        property: "og:description",
        content:
          "Check off your habits every day, light up the dots, and never break the streak. Daily reminders included.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Category = "Health" | "Productivity" | "Wellbeing";

type Habit = {
  id: string;
  name: string;
  emoji: string;
  category: Category;
  done: string[]; // ISO days: YYYY-MM-DD
  reminder?: string; // HH:MM, optional per-habit reminder
};

const STORAGE_KEY = "streak:habits:v3";
const PREVIOUS_STORAGE_KEYS = ["streak:habits:v2", "streak:habits:v1"];
const REMINDER_KEY = "streak:reminder:v1";

const CATEGORIES: Category[] = ["Health", "Productivity", "Wellbeing"];

const HABIT_PRESETS: Array<Pick<Habit, "name" | "emoji" | "category">> = [
  { name: "Morning stretch", emoji: "🧘", category: "Health" },
  { name: "Drink water", emoji: "💧", category: "Health" },
  { name: "Take a walk", emoji: "🚶", category: "Health" },
  { name: "Plan my day", emoji: "🎯", category: "Productivity" },
  { name: "Read 20 minutes", emoji: "📚", category: "Productivity" },
  { name: "Write in my journal", emoji: "✍️", category: "Wellbeing" },
  { name: "Meditate", emoji: "🧘", category: "Wellbeing" },
  { name: "Sleep 8 hours", emoji: "😴", category: "Wellbeing" },
];

const DEFAULT_CATEGORIES: Record<string, Category> = {
  h1: "Productivity",
  h2: "Health",
  h3: "Wellbeing",
  h4: "Health",
  h5: "Health",
  h6: "Productivity",
  h7: "Productivity",
  h8: "Health",
};

const ENGLISH_DEFAULT_NAMES: Record<string, string> = {
  h1: "Read 20 minutes",
  h2: "Work out",
  h3: "Meditate",
  h4: "Drink 2 liters of water",
  h5: "Walk 10,000 steps",
  h6: "Write in my journal",
  h7: "Practice a skill",
  h8: "Sleep 8 hours",
};

const translateSavedHabit = (habit: Omit<Habit, "category"> & { category?: Category }): Habit => ({
  ...habit,
  name: ENGLISH_DEFAULT_NAMES[habit.id] ?? habit.name,
  category: habit.category ?? DEFAULT_CATEGORIES[habit.id] ?? "Productivity",
});

const EMOJIS = [
  "🔥",
  "📚",
  "🏃",
  "🧘",
  "💧",
  "🚶",
  "✍️",
  "🎯",
  "😴",
  "🥗",
  "🎸",
  "🌱",
  "🧹",
  "💊",
];

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const shiftDays = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};

function streakOf(done: string[]) {
  const set = new Set(done);
  let streak = 0;
  const start = set.has(dayKey(shiftDays(0))) ? 0 : set.has(dayKey(shiftDays(1))) ? 1 : -1;
  if (start === -1) return 0;
  for (let i = start; i < 400; i++) {
    if (set.has(dayKey(shiftDays(i)))) streak++;
    else break;
  }
  return streak;
}

function bestStreakOf(done: string[]) {
  const set = new Set(done);
  let best = 0;
  let run = 0;
  for (let i = 400; i >= 0; i--) {
    if (set.has(dayKey(shiftDays(i)))) {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

const DEFAULT_HABITS: Habit[] = [
  { id: "h1", name: "Read 20 minutes", emoji: "📚", category: "Productivity", done: [] },
  { id: "h2", name: "Work out", emoji: "🏃", category: "Health", done: [] },
  { id: "h3", name: "Meditate", emoji: "🧘", category: "Wellbeing", done: [] },
  { id: "h4", name: "Drink 2 liters of water", emoji: "💧", category: "Health", done: [] },
  { id: "h5", name: "Walk 10,000 steps", emoji: "🚶", category: "Health", done: [] },
  { id: "h6", name: "Write in my journal", emoji: "✍️", category: "Productivity", done: [] },
  { id: "h7", name: "Practice a skill", emoji: "🎯", category: "Productivity", done: [] },
  { id: "h8", name: "Sleep 8 hours", emoji: "😴", category: "Health", done: [] },
];

function Index() {
  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [category, setCategory] = useState<Category>("Health");
  const [categoryFilter, setCategoryFilter] = useState<"All" | Category>("All");
  const [reminder, setReminder] = useState<string>("");
  const [permission, setPermission] = useState<string>("default");
  const firedRef = useRef<string>("");

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ??
        PREVIOUS_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
      if (raw) {
        const savedHabits = (JSON.parse(raw) as Habit[]).map(translateSavedHabit);
        const savedIds = new Set(savedHabits.map((habit) => habit.id));
        const newActivities = DEFAULT_HABITS.filter((habit) => !savedIds.has(habit.id));
        setHabits([...savedHabits, ...newActivities]);
      }
      setReminder(localStorage.getItem(REMINDER_KEY) ?? "");
    } catch {
      /* ignore */
    }
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }, [habits, loaded]);

  const pendingToday = useMemo(
    () => habits.filter((h) => !h.done.includes(dayKey(shiftDays(0)))).length,
    [habits],
  );

  const visibleHabits = useMemo(
    () =>
      categoryFilter === "All"
        ? habits
        : habits.filter((habit) => habit.category === categoryFilter),
    [categoryFilter, habits],
  );

  // Daily reminder while the app is open
  useEffect(() => {
    if (!reminder || permission !== "granted") return;
    const tick = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const stamp = `${dayKey(now)} ${reminder}`;
      if (hhmm === reminder && firedRef.current !== stamp) {
        firedRef.current = stamp;
        new Notification("Streak", {
          body: pendingToday
            ? `You still have ${pendingToday} habit(s) to check off today. Don't break the streak.`
            : "All done for today. Keep it up!",
        });
      }
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, [reminder, permission, pendingToday]);

  const toggle = (id: string, key: string) =>
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              done: h.done.includes(key) ? h.done.filter((d) => d !== key) : [...h.done, key],
            }
          : h,
      ),
    );

  const addHabit = () => {
    const n = name.trim();
    if (!n) return;
    setHabits((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: n, emoji: emoji ?? "🔥", category, done: [] },
    ]);
    setName("");
  };

  const choosePreset = (preset: (typeof HABIT_PRESETS)[number]) => {
    setName(preset.name);
    setEmoji(preset.emoji);
    setCategory(preset.category);
  };

  const removeHabit = (id: string) => setHabits((prev) => prev.filter((h) => h.id !== id));

  const enableReminders = async (time: string) => {
    setReminder(time);
    localStorage.setItem(REMINDER_KEY, time);
    if (time && typeof Notification !== "undefined" && Notification.permission === "default") {
      const p = await Notification.requestPermission();
      setPermission(p);
    }
  };

  const totalStreak = habits.reduce((acc, h) => Math.max(acc, streakOf(h.done)), 0);
  const days = Array.from({ length: 35 }, (_, i) => dayKey(shiftDays(34 - i)));
  const today = dayKey(shiftDays(0));

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Build your streak
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Check off every day you show up. The dots light up and your streak grows.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card px-5 py-3 text-right">
            <p className="font-display text-3xl font-bold text-primary">{totalStreak}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              best active streak
            </p>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-border bg-card/60 p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Daily reminder
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="time"
              value={reminder}
              onChange={(e) => enableReminders(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            {reminder ? (
              <span className="text-sm text-muted-foreground">
                {permission === "granted"
                  ? `I'll remind you every day at ${reminder} while the app is open.`
                  : "Allow browser notifications to receive the reminder."}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Pick a time and I'll remind you every day.
              </span>
            )}
            {reminder && permission !== "granted" && (
              <button
                onClick={() => enableReminders(reminder)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Allow notifications
              </button>
            )}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2" aria-label="Filter activities by category">
          {(["All", ...CATEGORIES] as const).map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={categoryFilter === item ? "default" : "outline"}
              onClick={() => setCategoryFilter(item)}
              aria-pressed={categoryFilter === item}
            >
              {item}
              <span className="text-xs opacity-70">
                {item === "All"
                  ? habits.length
                  : habits.filter((habit) => habit.category === item).length}
              </span>
            </Button>
          ))}
        </div>

        <section className="mt-4 space-y-4">
          {visibleHabits.map((h) => {
            const streak = streakOf(h.done);
            const best = bestStreakOf(h.done);
            const doneToday = h.done.includes(today);
            return (
              <article key={h.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{h.emoji}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold">{h.name}</h3>
                        <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold uppercase text-secondary-foreground">
                          {h.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Current streak {streak} · best {best}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggle(h.id, today)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        doneToday
                          ? "bg-primary text-primary-foreground"
                          : "border border-input text-foreground hover:bg-secondary"
                      }`}
                    >
                      {doneToday ? "Done today" : "Check today"}
                    </button>
                    <button
                      onClick={() => removeHabit(h.id)}
                      aria-label={`Delete ${h.name}`}
                      className="rounded-xl border border-input px-3 py-2 text-sm text-muted-foreground transition hover:text-destructive"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-[repeat(35,minmax(0,1fr))] gap-1">
                  {days.map((d) => {
                    const on = h.done.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggle(h.id, d)}
                        aria-label={d}
                        title={d}
                        className={`aspect-square rounded-[4px] transition ${
                          on
                            ? "animate-pop bg-primary shadow-[0_0_10px_var(--primary)]"
                            : "bg-secondary hover:bg-muted"
                        } ${d === today ? "ring-1 ring-accent" : ""}`}
                      />
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-6 rounded-2xl border border-dashed border-border p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            New habit
          </h2>
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">Quick picks</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {HABIT_PRESETS.map((preset) => (
                <Button
                  key={`${preset.category}-${preset.name}`}
                  type="button"
                  size="sm"
                  variant={name === preset.name ? "secondary" : "outline"}
                  onClick={() => choosePreset(preset)}
                  aria-pressed={name === preset.name}
                >
                  <span aria-hidden="true">{preset.emoji}</span>
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
              placeholder="Or type your own habit"
              aria-label="Habit name"
              className="min-w-48 flex-1 rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
              aria-label="Habit category"
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`h-10 w-10 rounded-xl text-lg transition ${
                    emoji === e ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-secondary"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <button
              onClick={addHabit}
              className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Add
            </button>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Your habits are saved on this device.
        </p>
      </div>
    </main>
  );
}
