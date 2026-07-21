import { HeartHandshake, LogOut } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { getLinkedPatients } from "@/lib/family-patient";
import { signOut } from "@/app/login/actions";
import { PatientSwitcher } from "./_components/patient-switcher";

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireUser("family");
  const patients = await getLinkedPatients(supabase, profile.id);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-blue-50/70 via-slate-50 to-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20">
              <HeartHandshake size={18} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">Evoura</p>
              <p className="text-xs font-medium leading-tight text-slate-400">Family</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {patients.length > 1 && <PatientSwitcher patients={patients} />}
            <form action={signOut}>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Sign out"
              >
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
