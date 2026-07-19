"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, Camera, Send } from "lucide-react";
import type { AppUser, Patient, PatientUpdate, Visit } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { addFamilyUpdate } from "@/lib/family-updates";
import { PhotoThumb } from "./photo-thumb";

type UpdateRow = PatientUpdate & { users: { full_name: string; role: string } };

export function FamilyDashboard({
  patient,
  caregiver,
  activeVisit,
  updates,
  profile,
}: {
  patient: Patient;
  caregiver: AppUser | null;
  activeVisit: Visit | null;
  updates: UpdateRow[];
  profile: AppUser;
}) {
  const [visit, setVisit] = useState(activeVisit);
  const [feed, setFeed] = useState(updates);

  // Live location: subscribe to updates on the active visit row so the map
  // pin moves without the family needing to refresh.
  useEffect(() => {
    if (!visit) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`visit-${visit.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "visits", filter: `id=eq.${visit.id}` },
        (payload) => setVisit(payload.new as Visit),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit?.id]);

  // Live feed: new shift reports / family updates appear without a refresh.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`updates-${patient.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "patient_updates", filter: `patient_id=eq.${patient.id}` },
        async (payload) => {
          const { data } = await supabase
            .from("patient_updates")
            .select("*, users(full_name, role)")
            .eq("id", payload.new.id)
            .single();
          if (data) setFeed((prev) => [data as UpdateRow, ...prev]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patient.id]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500">Caring for</p>
        <h1 className="text-2xl font-semibold text-stone-900">{patient.full_name}</h1>
        {caregiver && <p className="text-sm text-stone-500">Caregiver: {caregiver.full_name}</p>}
      </div>

      {visit ? (
        <LiveStatusCard visit={visit} caregiverName={caregiver?.full_name} />
      ) : (
        <div className="rounded-3xl border border-stone-200 bg-white p-5 text-center">
          <p className="text-sm text-stone-500">No one is currently clocked in.</p>
        </div>
      )}

      <AddUpdateForm patient={patient} profile={profile} onPosted={(u) => setFeed((prev) => [u, ...prev])} />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">Timeline</h2>
        {feed.length === 0 && (
          <p className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
            Nothing here yet.
          </p>
        )}
        {feed.map((u) => (
          <UpdateCard key={u.id} update={u} />
        ))}
      </div>
    </div>
  );
}

function LiveStatusCard({ visit, caregiverName }: { visit: Visit; caregiverName?: string }) {
  const lat = visit.current_lat ?? visit.clock_in_lat;
  const lng = visit.current_lng ?? visit.clock_in_lng;
  const delta = 0.004;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
      <div className="flex items-center gap-2 bg-teal-600 px-4 py-2.5 text-sm font-medium text-white">
        <Radio size={14} className="animate-pulse" />
        {caregiverName ?? "Your caregiver"} is on-site — clocked in since{" "}
        {new Date(visit.clock_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </div>
      <iframe
        title="Live caregiver location"
        src={mapSrc}
        className="h-64 w-full border-0"
        loading="lazy"
      />
      {visit.location_updated_at && (
        <p className="px-4 py-2 text-xs text-stone-400">
          Location updated {new Date(visit.location_updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}

function AddUpdateForm({
  patient,
  profile,
  onPosted,
}: {
  patient: Patient;
  profile: AppUser;
  onPosted: (u: UpdateRow) => void;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !file) return;
    setPosting(true);
    setError(null);
    try {
      const update = await addFamilyUpdate({
        patientId: patient.id,
        agencyId: patient.agency_id,
        authorId: profile.id,
        body,
        file,
      });
      onPosted({ ...update, users: { full_name: profile.full_name, role: profile.role } });
      setBody("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post update.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-3xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-medium text-stone-700">Add an update</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Medication taken, a photo, a quick note..."
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-stone-500">
          <Camera size={15} />
          {file ? file.name : "Attach photo"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="submit"
          disabled={posting || (!body.trim() && !file)}
          className="flex items-center gap-1.5 rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Send size={14} />
          {posting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}

function UpdateCard({ update }: { update: UpdateRow }) {
  const isReport = update.type === "shift_report";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-900">
          {update.users?.full_name}
          <span className="ml-1.5 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase text-stone-500">
            {isReport ? "Shift report" : update.type === "family_photo" ? "Photo" : "Note"}
          </span>
        </p>
        <p className="text-xs text-stone-400">
          {new Date(update.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      {update.body && <p className="mt-1.5 text-sm text-stone-700">{update.body}</p>}
      {update.photo_path && (
        <div className="mt-2">
          <PhotoThumb storagePath={update.photo_path} />
        </div>
      )}
    </div>
  );
}
