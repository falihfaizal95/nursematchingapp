"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { recordAudit } from "@/lib/audit";

// Creates one shift, or a series of recurring shifts on selected weekdays
// for N weeks (simple recurrence — no external rrule library needed for MVP).
export async function createShift(formData: FormData) {
  const { supabase, profile } = await requireUser("admin");

  const patientId = String(formData.get("patient_id") || "");
  const nurseId = String(formData.get("nurse_id") || "");
  const startDate = String(formData.get("start_date") || ""); // yyyy-mm-dd
  const startTime = String(formData.get("start_time") || ""); // HH:mm
  const endTime = String(formData.get("end_time") || "");
  const weeks = Number(formData.get("weeks") || 1);
  const weekdays = formData.getAll("weekdays").map(Number); // 0=Sun..6=Sat

  const rows: { agency_id: string; patient_id: string; nurse_id: string; start_time: string; end_time: string }[] = [];

  const base = new Date(`${startDate}T00:00:00`);
  const daySet = weekdays.length ? new Set(weekdays) : new Set([base.getDay()]);

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(base);
      day.setDate(day.getDate() + w * 7 + d);
      if (!daySet.has(day.getDay())) continue;
      if (day < base) continue;

      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const start = new Date(day);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(day);
      end.setHours(eh, em, 0, 0);

      rows.push({
        agency_id: profile.agency_id,
        patient_id: patientId,
        nurse_id: nurseId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
    }
  }

  const { error } = await supabase.from("shifts").insert(rows);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    agencyId: profile.agency_id,
    userId: profile.id,
    action: "create",
    entityType: "shift_series",
    metadata: { patient_id: patientId, nurse_id: nurseId, count: rows.length },
  });

  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}

export async function cancelShift(shiftId: string) {
  const { supabase, profile } = await requireUser("admin");
  const { error } = await supabase.from("shifts").update({ status: "cancelled" }).eq("id", shiftId);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    agencyId: profile.agency_id,
    userId: profile.id,
    action: "cancel",
    entityType: "shift",
    entityId: shiftId,
  });

  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
}

export async function updateIncidentStatus(incidentId: string, status: "reviewed" | "resolved") {
  const { supabase, profile } = await requireUser("admin");
  const { error } = await supabase.from("incidents").update({ status }).eq("id", incidentId);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    agencyId: profile.agency_id,
    userId: profile.id,
    action: "update_status",
    entityType: "incident",
    entityId: incidentId,
    metadata: { status },
  });

  revalidatePath("/admin/incidents");
}
