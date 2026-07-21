import { redirect } from "next/navigation";

// The caregivers list now lives in the client-side console tab. Keep this
// path working for old bookmarks by redirecting into it.
export default function CaregiversListRedirect() {
  redirect("/admin?tab=caregivers");
}
