import type { Visit, Mood } from "@/lib/types";

export type FamilyStatusKind = "on_site" | "completed" | "late" | "missed" | "scheduled" | "idle";

export interface FamilyStatus {
  kind: FamilyStatusKind;
  headline: string;
  sub: string | null;
  tone: "green" | "blue" | "amber" | "red" | "slate";
}

const LATE_GRACE_MIN = 15;
const MISSED_GRACE_MIN = 30;

export function deriveFamilyStatus(params: {
  patientFirstName: string;
  activeVisit: Visit | null;
  todayCompletedVisit: Visit | null;
  nextVisitAt: string | null;
  now?: number;
}): FamilyStatus {
  const { patientFirstName, activeVisit, todayCompletedVisit, nextVisitAt } = params;
  const now = params.now ?? Date.now();

  if (activeVisit) {
    return {
      kind: "on_site",
      headline: `Caregiver is with ${patientFirstName}`,
      sub: `Arrived at ${fmtTime(activeVisit.clock_in_at)}`,
      tone: "green",
    };
  }

  if (todayCompletedVisit?.clock_out_at) {
    return {
      kind: "completed",
      headline: "Today's visit is complete",
      sub: `Ended at ${fmtTime(todayCompletedVisit.clock_out_at)}`,
      tone: "blue",
    };
  }

  if (nextVisitAt) {
    const start = new Date(nextVisitAt).getTime();
    const minsLate = (now - start) / 60_000;

    if (minsLate >= MISSED_GRACE_MIN) {
      return {
        kind: "missed",
        headline: "No caregiver has checked in yet",
        sub: `Expected at ${fmtTime(nextVisitAt)} — we've alerted the agency`,
        tone: "red",
      };
    }
    if (minsLate >= LATE_GRACE_MIN) {
      return {
        kind: "late",
        headline: "Caregiver is running late",
        sub: `Expected at ${fmtTime(nextVisitAt)}`,
        tone: "amber",
      };
    }
    return {
      kind: "scheduled",
      headline: "Next visit scheduled",
      sub: fmtWhen(nextVisitAt),
      tone: "slate",
    };
  }

  return {
    kind: "idle",
    headline: "No visit scheduled",
    sub: "Check back when the next visit is booked.",
    tone: "slate",
  };
}

export const MOOD_LABEL: Record<Mood, string> = {
  great: "Great 😊",
  good: "Good 🙂",
  okay: "Okay 😐",
  unwell: "Not feeling well 😟",
};

export interface PeaceItem {
  label: string;
  ok: boolean;
}

// The "Peace of Mind" summary — turns a completed/active visit into the
// handful of yes/no answers a family actually wants.
export function peaceOfMind(visit: Visit): { items: PeaceItem[]; allClear: boolean } {
  const meals = [visit.ate_breakfast, visit.ate_lunch, visit.ate_dinner].filter(Boolean).length;
  const items: PeaceItem[] = [
    { label: "Caregiver arrived", ok: true },
    { label: "Medication given", ok: visit.medication_given },
    { label: meals > 0 ? `Meals eaten (${meals})` : "Meals", ok: meals > 0 },
    { label: visit.mood ? `Mood: ${MOOD_LABEL[visit.mood]}` : "Mood logged", ok: !!visit.mood },
    {
      label: visit.concern_flag ? "A concern was noted" : "No concerns reported",
      ok: !visit.concern_flag,
    },
  ];
  const allClear = items.every((i) => i.ok);
  return { items, allClear };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = fmtTime(iso);
  if (isToday) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return d.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
