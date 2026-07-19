import { HeartHandshake } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { signOut } from "@/app/login/actions";

export default async function CaregiverLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("caregiver");

  return (
    <div className="flex min-h-dvh flex-col bg-stone-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
            <HeartHandshake size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-stone-900">{profile.full_name}</p>
            <p className="text-xs leading-tight text-stone-500">Caregiver</p>
          </div>
        </div>
        <form action={signOut}>
          <button className="text-xs font-medium text-stone-400">Sign out</button>
        </form>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
