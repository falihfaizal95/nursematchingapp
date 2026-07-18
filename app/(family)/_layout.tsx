import { Redirect, Tabs } from "expo-router";
import { Pressable } from "react-native";
import { Home, Activity, Images, CalendarDays, MessageCircle, LogOut } from "lucide-react-native";
import { useAuth } from "@/context/auth";
import { FamilyPatientProvider } from "@/context/family-patient";
import { supabase } from "@/lib/supabase";
import { LoadingScreen } from "@/components/ui";
import { colors } from "@/lib/theme";

export default function FamilyLayout() {
  const { profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!profile) return <Redirect href="/login" />;
  if (profile.role !== "family") return <Redirect href="/" />;

  return (
    <FamilyPatientProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.teal600,
          tabBarInactiveTintColor: colors.stone400,
          headerStyle: { backgroundColor: colors.cream },
          headerTitleStyle: { color: colors.stone900 },
          sceneStyle: { backgroundColor: colors.cream },
          headerRight: () => (
            <Pressable onPress={() => supabase.auth.signOut()} hitSlop={10} style={{ marginRight: 16 }}>
              <LogOut size={18} color={colors.stone400} />
            </Pressable>
          ),
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
        <Tabs.Screen name="vitals" options={{ title: "Vitals", tabBarIcon: ({ color, size }) => <Activity color={color} size={size} /> }} />
        <Tabs.Screen name="photos" options={{ title: "Photos", tabBarIcon: ({ color, size }) => <Images color={color} size={size} /> }} />
        <Tabs.Screen name="calendar" options={{ title: "Calendar", tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} />
        <Tabs.Screen name="messages" options={{ title: "Messages", tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
      </Tabs>
    </FamilyPatientProvider>
  );
}
