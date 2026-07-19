import { redirect } from "next/navigation";

// Middleware sends authenticated users to their role's home before this
// ever renders; unauthenticated users land here only transiently.
export default function RootPage() {
  redirect("/login");
}
