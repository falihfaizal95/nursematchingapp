"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HeartHandshake, LayoutDashboard, Users, UserPlus, type LucideIcon } from "lucide-react";
import type { AppUser } from "@/lib/types";
import { signOut } from "@/app/login/actions";
import { warmAll } from "./admin-data";
import { ActiveView } from "./active-view";
import { PatientsView } from "./patients-view";
import { CaregiversView } from "./caregivers-view";

type TabKey = "active" | "patients" | "caregivers";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "active", label: "Active now", icon: LayoutDashboard },
  { key: "patients", label: "Patients", icon: Users },
  { key: "caregivers", label: "Caregivers", icon: UserPlus },
];

export function AdminShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onConsole = pathname === "/admin";

  const initialTab = (searchParams.get("tab") as TabKey) || "active";
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? initialTab : "active",
  );

  // Load all three tabs' data in parallel, once, so every tab is instant.
  useEffect(() => {
    warmAll();
  }, []);

  function selectTab(next: TabKey) {
    if (onConsole) {
      // Pure client state — no navigation, no server round-trip. Mirror to
      // the URL so the tab is shareable/refresh-safe, without a Next nav.
      setTab(next);
      const url = next === "active" ? "/admin" : `/admin?tab=${next}`;
      window.history.replaceState(window.history.state, "", url);
    } else {
      // Coming from a detail/sub page — do a real navigation back to the console.
      router.push(next === "active" ? "/admin" : `/admin?tab=${next}`);
    }
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20">
            <HeartHandshake size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Evoura</p>
            <p className="text-xs text-slate-500">Agency console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {TABS.map((t) => {
            const active = onConsole && tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon size={17} className={active ? "text-blue-600" : "text-slate-400"} />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 pt-4">
          <p className="px-3 text-sm font-semibold text-slate-900">{user.full_name}</p>
          <p className="px-3 text-xs text-slate-500">{user.email}</p>
          <form action={signOut}>
            <button className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 transition hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
          {onConsole ? (
            <div key={tab} className="page-enter">
              {tab === "active" && <ActiveView />}
              {tab === "patients" && <PatientsView />}
              {tab === "caregivers" && <CaregiversView />}
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
