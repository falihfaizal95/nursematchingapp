import type { Shift, Visit } from "@/lib/types";

export type LiveStatus = "scheduled" | "checked_in" | "completed" | "missed" | "cancelled";

const GRACE_MINUTES = 15;

// Derives the live-board status for a shift. "missed" is computed on read
// (start_time + grace period elapsed, no check-in yet) rather than a stored
// value. Production note: add a scheduled Supabase Edge Function (pg_cron
// or a scheduled Function) that performs the same check server-side and
// pages the admin, since nobody may have the app open when a visit is missed.
export function deriveShiftStatus(shift: Shift, visit: Visit | undefined): LiveStatus {
  if (shift.status === "cancelled") return "cancelled";
  if (visit?.check_out_at) return "completed";
  if (visit?.check_in_at) return "checked_in";

  const graceDeadline = new Date(shift.start_time).getTime() + GRACE_MINUTES * 60_000;
  if (Date.now() > graceDeadline) return "missed";
  return "scheduled";
}

export const STATUS_COLORS: Record<LiveStatus, { bg: string; fg: string }> = {
  scheduled: { bg: "#F5F5F4", fg: "#57534E" },
  checked_in: { bg: "#DBEAFE", fg: "#1D4ED8" },
  completed: { bg: "#D1FAE5", fg: "#047857" },
  missed: { bg: "#FEE2E2", fg: "#B91C1C" },
  cancelled: { bg: "#F5F5F4", fg: "#A8A29E" },
};

export const STATUS_LABELS: Record<LiveStatus, string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  completed: "Completed",
  missed: "Missed",
  cancelled: "Cancelled",
};
