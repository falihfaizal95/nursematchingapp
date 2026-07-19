import { Redirect, Stack, router } from "expo-router";
import { Pressable } from "react-native";
import { TriangleAlert, LogOut } from "lucide-react-native";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { LoadingScreen } from "@/components/ui";
import { colors } from "@/lib/theme";

export default function NurseLayout() {
  const { profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!profile) return <Redirect href="/login" />;
  if (profile.role !== "nurse") return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { color: colors.stone900, fontSize: 17 },
        headerShadowVisible: true,
        contentStyle: { backgroundColor: colors.stone50 },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Today's visits",
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/(nurse)/incident/new")}
              hitSlop={10}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 4 }}
            >
              <TriangleAlert size={16} color={colors.red600} />
            </Pressable>
          ),
          headerLeft: () => (
            <Pressable
              onPress={() => supabase.auth.signOut()}
              hitSlop={10}
              style={{ marginLeft: 4 }}
            >
              <LogOut size={18} color={colors.stone400} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="visit/[id]" options={{ title: "Visit" }} />
      <Stack.Screen name="incident/new" options={{ title: "Report an incident", presentation: "modal" }} />
    </Stack>
  );
}
