import { requireUser } from "@/lib/current-user";
import { getSelectedPatient } from "@/lib/family";
import { sendMessage } from "@/lib/actions/messages";
import type { AppUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { supabase, profile } = await requireUser("family");
  const { patient: patientParam } = await searchParams;
  const patient = await getSelectedPatient(supabase, profile.id, patientParam);

  const { data: messages } = await supabase
    .from("messages")
    .select("*, users(*)")
    .eq("patient_id", patient.id)
    .order("created_at");

  async function action(formData: FormData) {
    "use server";
    await sendMessage(patient.id, formData);
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-stone-900">Messages</h1>
        <p className="text-sm text-stone-500">Direct line to the care team for {patient.full_name}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4">
        {(messages ?? []).map((m) => {
          const sender = (m as unknown as { users: AppUser }).users;
          const isMe = sender?.id === profile.id;
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${isMe ? "bg-teal-600 text-white" : "bg-stone-100 text-stone-800"}`}>
                {!isMe && <p className="text-xs font-medium opacity-70">{sender?.full_name}</p>}
                <p>{m.body}</p>
                <p className={`mt-1 text-[10px] ${isMe ? "text-teal-100" : "text-stone-400"}`}>
                  {new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        {(messages ?? []).length === 0 && (
          <p className="py-8 text-center text-stone-400">Say hello to the care team.</p>
        )}
      </div>

      <form action={action} className="mt-3 flex gap-2">
        <input
          name="body"
          required
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-stone-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        <button className="rounded-full bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700">
          Send
        </button>
      </form>
    </div>
  );
}
