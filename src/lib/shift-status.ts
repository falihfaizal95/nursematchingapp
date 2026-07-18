import type { Shift, Visit } from "@/lib/types";

export type LiveStatus = "scheduled" | "checked_in" | "completed" | "missed" | "cancelled";

const GRACE_MINUTES = 15;

// Derives the live-board status for a shift. "missed" is computed on read
// (start_time + grace period elapsed, no check-in yet) rather than a stored
// value, so the board is always accurate without a background job.
// Production note: add a scheduled function (Vercel Cron) that performs the
// same check server-side and pages the admin, since nobody may have the
// board open when a visit is missed.
export function deriveShiftStatus(shift: Shift, visit: Visit | undefined): LiveStatus {
  if (shift.status === "cancelled") return "cancelled";
  if (visit?.check_out_at) return "completed";
  if (visit?.check_in_at) return "checked_in";

  const graceDeadline = new Date(shift.start_time).getTime() + GRACE_MINUTES * 60_000;
  if (Date.now() > graceDeadline) return "missed";
  return "scheduled";
}

export const STATUS_STYLES: Record<LiveStatus, string> = {
  scheduled: "bg-stone-100 text-stone-700",
  checked_in: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  missed: "bg-red-100 text-red-700",
  cancelled: "bg-stone-100 text-stone-400 line-through",
};

export const STATUS_LABELS: Record<LiveStatus, string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  completed: "Completed",
  missed: "Missed",
  cancelled: "Cancelled",
};
