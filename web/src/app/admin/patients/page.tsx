import { redirect } from "next/navigation";

// The patients list now lives in the client-side console tab. Keep this
// path working for old bookmarks by redirecting into it.
export default function PatientsListRedirect() {
  redirect("/admin?tab=patients");
}
