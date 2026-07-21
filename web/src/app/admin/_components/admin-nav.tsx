"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, UserPlus, Loader2, type LucideIcon } from "lucide-react";

const nav = [
  { href: "/admin", label: "Active now", icon: LayoutDashboard },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/caregivers", label: "Caregivers", icon: UserPlus },
];

// Reads the pending state of its parent <Link> and swaps the icon for a
// spinner the instant the tab is clicked — immediate feedback while the
// next page's data is fetched on the server.
function NavItemBody({ label, icon: Icon, active }: { label: string; icon: LucideIcon; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? (
        <Loader2 size={17} className="animate-spin text-blue-600" />
      ) : (
        <Icon size={17} className={active ? "text-blue-600" : "text-slate-400"} />
      )}
      {label}
    </>
  );
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1">
      {nav.map((item) => {
        const active =
          pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] ${
              active
                ? "bg-blue-50 text-blue-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <NavItemBody label={item.label} icon={item.icon} active={active} />
          </Link>
        );
      })}
    </nav>
  );
}
