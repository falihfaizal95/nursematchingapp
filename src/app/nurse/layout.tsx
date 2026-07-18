import Link from "next/link";
import { HeartHandshake, LogOut, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { signOut } from "@/app/login/actions";

export default async function NurseLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("nurse");

  return (
    <div className="flex min-h-dvh flex-col bg-stone-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
            <HeartHandshake size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-stone-900">{profile.full_name}</p>
            <p className="text-xs leading-tight text-stone-500">Today&apos;s visits</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/nurse/incident/new"
            className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700"
          >
            <TriangleAlert size={14} /> Report
          </Link>
          <form action={signOut}>
            <button className="text-stone-400" aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
