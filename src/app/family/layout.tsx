import Link from "next/link";
import { HeartHandshake, Home, Activity, Images, CalendarDays, MessageCircle, LogOut } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { getLinkedPatients } from "@/lib/family";
import { signOut } from "@/app/login/actions";
import { PatientSwitcher } from "./_components/patient-switcher";

const nav = [
  { href: "/family", label: "Home", icon: Home },
  { href: "/family/vitals", label: "Vitals", icon: Activity },
  { href: "/family/photos", label: "Photos", icon: Images },
  { href: "/family/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/family/messages", label: "Messages", icon: MessageCircle },
];

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireUser("family");
  const patients = await getLinkedPatients(supabase, profile.id);

  return (
    <div className="min-h-dvh bg-[#FBF7F1]">
      <header className="border-b border-stone-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-600 text-white">
              <HeartHandshake size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">Harbor</p>
              <p className="text-xs text-stone-500">Family portal</p>
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
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100"
            >
              <item.icon size={15} />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
