import Link from "next/link";
import { HeartHandshake, LayoutDashboard, Users, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { signOut } from "@/app/login/actions";

const nav = [
  { href: "/admin", label: "Active now", icon: LayoutDashboard },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/caregivers", label: "Caregivers", icon: UserPlus },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("admin");

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 flex-col border-r border-stone-200 bg-white px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
            <HeartHandshake size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900">Harbor</p>
            <p className="text-xs text-stone-500">Agency console</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-stone-200 pt-4">
          <p className="px-3 text-sm font-medium text-stone-900">{profile.full_name}</p>
          <p className="px-3 text-xs text-stone-500">{profile.email}</p>
          <form action={signOut}>
            <button className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-100">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
