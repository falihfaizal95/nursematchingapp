import { HeartHandshake, LogOut } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { getLinkedPatients } from "@/lib/family-patient";
import { signOut } from "@/app/login/actions";
import { PatientSwitcher } from "./_components/patient-switcher";

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireUser("family");
  const patients = await getLinkedPatients(supabase, profile.id);

  return (
    <div className="min-h-dvh bg-[#FBF7F1]">
      <header className="border-b border-stone-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-600 text-white">
              <HeartHandshake size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">Harbor</p>
              <p className="text-xs text-stone-500">Family</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {patients.length > 1 && <PatientSwitcher patients={patients} />}
            <form action={signOut}>
              <button className="text-stone-400" aria-label="Sign out">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
