import { HeartHandshake, LogOut } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { signOut } from "@/app/login/actions";

export default async function CaregiverLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("caregiver");

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20">
              <HeartHandshake size={18} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">{profile.full_name}</p>
              <p className="text-xs font-medium leading-tight text-slate-400">Caregiver</p>
            </div>
          </div>
          <form action={signOut}>
            <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
