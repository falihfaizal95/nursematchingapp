"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Send, MoonStar, NotebookPen, ImagePlus, MessageSquareText } from "lucide-react";
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
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-blue-600/20">
          {patient.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Caring for</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{patient.full_name}</h1>
          {caregiver && (
            <p className="text-sm font-medium text-slate-500">with caregiver {caregiver.full_name}</p>
          )}
        </div>
      </div>

      {visit ? (
        <LiveStatusCard visit={visit} caregiverName={caregiver?.full_name} />
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <MoonStar size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-700">No one is on shift right now</p>
            <p className="text-xs font-medium text-slate-400">
              You&apos;ll see a live map here the moment {caregiver?.full_name ?? "the caregiver"} clocks in.
            </p>
          </div>
        </div>
      )}

      <AddUpdateForm patient={patient} profile={profile} onPosted={(u) => setFeed((prev) => [u, ...prev])} />

      <div className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Timeline</h2>
        {feed.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-400">
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
    <div className="overflow-hidden rounded-2xl border border-emerald-200/60 bg-white shadow-lg shadow-emerald-600/10">
      <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3.5 text-white">
        <span className="live-dot h-2.5 w-2.5 shrink-0 rounded-full bg-white" />
        <p className="text-sm font-bold">
          {caregiverName ?? "Your caregiver"} is on-site
          <span className="ml-1.5 font-medium text-emerald-100">
            since{" "}
            {new Date(visit.clock_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        </p>
      </div>
      <iframe title="Live caregiver location" src={mapSrc} className="h-64 w-full border-0" />
      {visit.location_updated_at && (
        <p className="px-5 py-2.5 text-xs font-medium text-slate-400">
          Location updated{" "}
          {new Date(visit.location_updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
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
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder={`Share an update about ${patient.full_name.split(" ")[0]} — medication taken, a photo, a note...`}
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      />
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      <div className="mt-2.5 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100">
          <Camera size={15} className="text-blue-600" />
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
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          <Send size={14} />
          {posting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}

const TYPE_META = {
  shift_report: { label: "Shift report", icon: NotebookPen, chip: "bg-blue-50 text-blue-700" },
  family_photo: { label: "Photo", icon: ImagePlus, chip: "bg-violet-50 text-violet-700" },
  family_note: { label: "Note", icon: MessageSquareText, chip: "bg-amber-50 text-amber-700" },
} as const;

function UpdateCard({ update }: { update: UpdateRow }) {
  const meta = TYPE_META[update.type] ?? TYPE_META.family_note;
  const Icon = meta.icon;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-bold text-slate-900">{update.users?.full_name}</p>
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.chip}`}
          >
            <Icon size={10} />
            {meta.label}
          </span>
        </div>
        <p className="shrink-0 text-xs font-medium text-slate-400">
          {new Date(update.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      {update.body && <p className="mt-2 text-sm leading-relaxed text-slate-600">{update.body}</p>}
      {update.photo_path && (
        <div className="mt-3">
          <PhotoThumb storagePath={update.photo_path} />
        </div>
      )}
    </div>
  );
}
