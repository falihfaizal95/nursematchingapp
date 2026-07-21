import { Suspense } from "react";
import { requireUser } from "@/lib/current-user";
import { AdminShell } from "./_components/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("admin");

  return (
    <Suspense>
      <AdminShell user={profile}>{children}</AdminShell>
    </Suspense>
  );
}
