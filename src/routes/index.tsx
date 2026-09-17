import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

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

type Habit = {
  id: string;
  name: string;
  emoji: string;
  done: string[]; // ISO days: YYYY-MM-DD
};

const STORAGE_KEY = "streak:habits:v1";
const REMINDER_KEY = "streak:reminder:v1";

const EMOJIS = ["🔥", "📚", "🏃", "🧘", "💧", "🎸", "🌱", "✍️", "🥗", "😴"];

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
  { id: "h1", name: "Read 20 minutes", emoji: "📚", done: [] },
  { id: "h2", name: "Work out", emoji: "🏃", done: [] },
  { id: "h3", name: "Meditate", emoji: "🧘", done: [] },
];

function Index() {
  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [reminder, setReminder] = useState<string>("");
  const [permission, setPermission] = useState<string>("default");
  const firedRef = useRef<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHabits(JSON.parse(raw) as Habit[]);
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
      { id: crypto.randomUUID(), name: n, emoji: emoji ?? "🔥", done: [] },
    ]);
    setName("");
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
              Streak
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

        <section className="mt-6 space-y-4">
          {habits.map((h) => {
            const streak = streakOf(h.done);
            const best = bestStreakOf(h.done);
            const doneToday = h.done.includes(today);
            return (
              <article key={h.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{h.emoji}</span>
                    <div>
                      <h3 className="font-display text-lg font-semibold">{h.name}</h3>
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
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
              placeholder="Drink 2 liters of water"
              className="min-w-48 flex-1 rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
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
