import { Redirect } from "expo-router";
import { useAuth } from "@/context/auth";
import { LoadingScreen } from "@/components/ui";

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session) return <Redirect href="/login" />;
  if (!profile) return <LoadingScreen />;

  if (profile.role === "admin") return <Redirect href="/(admin)" />;
  if (profile.role === "nurse") return <Redirect href="/(nurse)" />;
  return <Redirect href="/(family)" />;
}
