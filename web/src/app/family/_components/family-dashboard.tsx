"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Send,
  NotebookPen,
  ImagePlus,
  MessageSquareText,
  Phone,
  CheckCircle2,
  Circle,
  TriangleAlert,
  MapPin,
  Flag,
  Footprints,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";
import type { AppUser, Agency, Patient, PatientUpdate, Visit } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { addFamilyUpdate } from "@/lib/family-updates";
import { deriveFamilyStatus, peaceOfMind, MOOD_LABEL, type FamilyStatus } from "@/lib/visit-status";
import { PhotoThumb } from "./photo-thumb";

type UpdateRow = PatientUpdate & { users: { full_name: string; role: string } };

const TONE: Record<FamilyStatus["tone"], { bg: string; ring: string; text: string; dot: string }> = {
  green: { bg: "from-emerald-500 to-teal-600", ring: "border-emerald-200", text: "text-white", dot: "bg-white" },
  blue: { bg: "from-blue-600 to-indigo-600", ring: "border-blue-200", text: "text-white", dot: "bg-white" },
  amber: { bg: "from-amber-500 to-orange-500", ring: "border-amber-200", text: "text-white", dot: "bg-white" },
  red: { bg: "from-red-500 to-rose-600", ring: "border-red-200", text: "text-white", dot: "bg-white" },
  slate: { bg: "from-slate-600 to-slate-700", ring: "border-slate-200", text: "text-white", dot: "bg-white" },
};

export function FamilyDashboard({
  patient,
  caregiver,
  agency,
  activeVisit,
  todayVisit,
  updates,
  profile,
}: {
  patient: Patient;
  caregiver: AppUser | null;
  agency: Agency;
  activeVisit: Visit | null;
  todayVisit: Visit | null;
  updates: UpdateRow[];
  profile: AppUser;
}) {
  const [active, setActive] = useState(activeVisit);
  const [today, setToday] = useState(todayVisit);
  const [feed, setFeed] = useState(updates);
  const firstName = patient.full_name.split(" ")[0];

  // Live visit changes: location pings, clock-in, clock-out.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`visits-${patient.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visits", filter: `patient_id=eq.${patient.id}` },
        (payload) => {
          const v = payload.new as Visit;
          if (!v?.id) return;
          setToday(v);
          setActive(v.status === "active" ? v : null);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patient.id]);

  // Live timeline.
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
          if (data) setFeed((prev) => [data as UpdateRow, ...prev.filter((u) => u.id !== data.id)]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patient.id]);

  const status = deriveFamilyStatus({
    patientFirstName: firstName,
    activeVisit: active,
    todayCompletedVisit: today && today.status === "completed" ? today : null,
    nextVisitAt: patient.next_visit_at,
  });

  const summaryVisit = active ?? (today && today.status === "completed" ? today : null);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-blue-600/20">
          {patient.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Caring for</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{patient.full_name}</h1>
        </div>
      </div>

      <StatusCard status={status} visit={active} caregiver={caregiver} />

      {summaryVisit && <PeaceOfMindCard visit={summaryVisit} live={!!active} />}

      {summaryVisit && <CareUpdateCard visit={summaryVisit} />}

      {caregiver && <CaregiverCard caregiver={caregiver} agency={agency} />}

      <Timeline feed={feed} />

      <AddUpdateForm patient={patient} profile={profile} onPosted={(u) => setFeed((prev) => [u, ...prev])} />
    </div>
  );
}

function StatusCard({
  status,
  visit,
  caregiver,
}: {
  status: FamilyStatus;
  visit: Visit | null;
  caregiver: AppUser | null;
}) {
  const tone = TONE[status.tone];
  const onSite = status.kind === "on_site";

  return (
    <div className={`overflow-hidden rounded-3xl border ${tone.ring} bg-white shadow-lg`}>
      <div className={`bg-gradient-to-br ${tone.bg} px-5 py-5 ${tone.text}`}>
        <div className="flex items-center gap-3">
          {onSite ? (
            <span className={`live-dot h-3 w-3 shrink-0 rounded-full ${tone.dot}`} />
          ) : status.kind === "completed" ? (
            <CheckCircle2 size={20} className="shrink-0" />
          ) : status.kind === "missed" ? (
            <TriangleAlert size={20} className="shrink-0" />
          ) : status.kind === "late" ? (
            <CalendarClock size={20} className="shrink-0" />
          ) : (
            <CalendarClock size={20} className="shrink-0" />
          )}
          <div>
            <p className="text-lg font-extrabold leading-tight">{status.headline}</p>
            {status.sub && <p className="text-sm font-medium opacity-90">{status.sub}</p>}
          </div>
        </div>
      </div>

      {onSite && visit && (
        <>
          <LiveMap visit={visit} />
          {caregiver?.phone && (
            <a
              href={`tel:${caregiver.phone}`}
              className="flex items-center justify-center gap-2 border-t border-slate-100 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
            >
              <Phone size={15} /> Call {caregiver.full_name.split(" ")[0]}
            </a>
          )}
        </>
      )}
    </div>
  );
}

function LiveMap({ visit }: { visit: Visit }) {
  const lat = visit.current_lat ?? visit.clock_in_lat;
  const lng = visit.current_lng ?? visit.clock_in_lng;
  const d = 0.004;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div>
      <iframe title="Live caregiver location" src={src} className="h-56 w-full border-0" />
      {visit.location_updated_at && (
        <p className="flex items-center gap-1 px-5 py-2 text-xs font-medium text-slate-400">
          <MapPin size={11} /> Location updated{" "}
          {new Date(visit.location_updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}

function PeaceOfMindCard({ visit, live }: { visit: Visit; live: boolean }) {
  const { items, allClear } = peaceOfMind(visit);
  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm ${
        visit.concern_flag ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className={visit.concern_flag ? "text-amber-600" : "text-emerald-600"} />
        <h2 className="text-base font-bold text-slate-900">
          {live ? "Today so far" : "Today's visit"}
          {allClear && !visit.concern_flag ? " — everything looks good" : ""}
        </h2>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm">
            {item.ok ? (
              <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
            ) : visit.concern_flag && item.label.toLowerCase().includes("concern") ? (
              <TriangleAlert size={17} className="shrink-0 text-amber-600" />
            ) : (
              <Circle size={17} className="shrink-0 text-slate-300" />
            )}
            <span className={item.ok ? "font-medium text-slate-700" : "text-slate-400"}>{item.label}</span>
          </li>
        ))}
      </ul>
      {visit.concern_flag && visit.concern_text && (
        <p className="mt-3 rounded-xl bg-amber-100/70 px-3.5 py-2.5 text-sm font-medium text-amber-800">
          {visit.concern_text}
        </p>
      )}
    </div>
  );
}

function CareUpdateCard({ visit }: { visit: Visit }) {
  const hasNote = !!visit.report?.trim();
  const hasPhoto = !!visit.photo_path;
  const hasPain = visit.pain_level !== null;
  if (!hasNote && !hasPhoto && !hasPain && !visit.mood) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-900">What happened today</h2>
      {hasPhoto && (
        <div className="mt-3">
          <PhotoThumb storagePath={visit.photo_path!} />
        </div>
      )}
      {hasNote && <p className="mt-3 text-[15px] leading-relaxed text-slate-700">{visit.report}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {visit.mood && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Mood: {MOOD_LABEL[visit.mood]}
          </span>
        )}
        {hasPain && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Pain: {visit.pain_level}/10
          </span>
        )}
      </div>
    </div>
  );
}

function CaregiverCard({ caregiver, agency }: { caregiver: AppUser; agency: Agency }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <Avatar user={caregiver} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Caregiver</p>
          <p className="truncate text-lg font-bold text-slate-900">{caregiver.full_name}</p>
          {caregiver.years_experience != null && (
            <p className="text-xs font-medium text-slate-500">
              {caregiver.years_experience} yr{caregiver.years_experience === 1 ? "" : "s"} experience
            </p>
          )}
        </div>
      </div>
      {caregiver.bio && <p className="mt-3 text-sm text-slate-600">{caregiver.bio}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={caregiver.phone ? `tel:${caregiver.phone}` : undefined}
          className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
            caregiver.phone
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
        >
          <Phone size={15} /> Call caregiver
        </a>
        <a
          href={agency.phone ? `tel:${agency.phone}` : undefined}
          className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
            agency.phone
              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              : "cursor-not-allowed border border-slate-100 bg-slate-50 text-slate-300"
          }`}
        >
          <Phone size={15} /> Call agency
        </a>
      </div>
    </div>
  );
}

function Avatar({ user }: { user: AppUser }) {
  const [url, setUrl] = useState<string | null>(() =>
    user.photo_url && user.photo_url.startsWith("http") ? user.photo_url : null,
  );
  useEffect(() => {
    if (!user.photo_url || user.photo_url.startsWith("http")) return;
    createClient()
      .storage.from("patient-photos")
      .createSignedUrl(user.photo_url, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [user.photo_url]);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={user.full_name} className="h-14 w-14 shrink-0 rounded-2xl object-cover" />;
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-lg font-bold text-blue-700">
      {user.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
    </div>
  );
}

const TIMELINE_META: Record<string, { label: string; icon: typeof NotebookPen; chip: string }> = {
  arrived: { label: "Arrived", icon: MapPin, chip: "bg-emerald-50 text-emerald-700" },
  task: { label: "Care", icon: CheckCircle2, chip: "bg-blue-50 text-blue-700" },
  completed: { label: "Shift complete", icon: Flag, chip: "bg-slate-100 text-slate-600" },
  concern: { label: "Concern", icon: TriangleAlert, chip: "bg-amber-50 text-amber-700" },
  shift_report: { label: "Note", icon: NotebookPen, chip: "bg-blue-50 text-blue-700" },
  visit_photo: { label: "Photo", icon: ImagePlus, chip: "bg-violet-50 text-violet-700" },
  family_photo: { label: "Family photo", icon: ImagePlus, chip: "bg-violet-50 text-violet-700" },
  family_note: { label: "Family note", icon: MessageSquareText, chip: "bg-amber-50 text-amber-700" },
};

function Timeline({ feed }: { feed: UpdateRow[] }) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
        <Footprints size={18} className="text-slate-400" /> Timeline
      </h2>
      {feed.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-400">
          Nothing here yet.
        </p>
      )}
      <div className="space-y-2.5">
        {feed.map((u) => {
          const meta = TIMELINE_META[u.type] ?? TIMELINE_META.task;
          const Icon = meta.icon;
          return (
            <div key={u.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.chip}`}>
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{u.body || meta.label}</p>
                  <p className="shrink-0 text-xs font-medium text-slate-400">
                    {new Date(u.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <p className="text-xs font-medium text-slate-400">
                  {u.users?.full_name}
                  {" · "}
                  {new Date(u.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
                {u.photo_path && (
                  <div className="mt-2">
                    <PhotoThumb storagePath={u.photo_path} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !file) return;
    setPosting(true);
    setError(null);
    try {
      const u = await addFamilyUpdate({
        patientId: patient.id,
        agencyId: patient.agency_id,
        authorId: profile.id,
        body,
        file,
      });
      onPosted({ ...u, users: { full_name: profile.full_name, role: profile.role } });
      setBody("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-bold text-slate-700">Add your own update</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Leave a note for the care team..."
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2.5 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
          <Camera size={15} className="text-blue-600" />
          {file ? file.name : "Attach photo"}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button
          type="submit"
          disabled={posting || (!body.trim() && !file)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          <Send size={14} /> {posting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
