import { Redirect } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { Pressable, View, Text } from "react-native";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  AlertTriangle,
  BarChart3,
  UserPlus,
  Heart,
  LogOut,
} from "lucide-react-native";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { LoadingScreen } from "@/components/ui";
import { colors } from "@/lib/theme";

export default function AdminLayout() {
  const { profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!profile) return <Redirect href="/login" />;
  if (profile.role !== "admin") return <Redirect href="/" />;

  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { color: colors.stone900 },
        drawerActiveTintColor: colors.teal600,
        drawerInactiveTintColor: colors.stone600,
        headerRight: () => (
          <Pressable onPress={() => supabase.auth.signOut()} hitSlop={10} style={{ marginRight: 16 }}>
            <LogOut size={18} color={colors.stone400} />
          </Pressable>
        ),
      }}
      drawerContent={(props) => (
        <View style={{ flex: 1, paddingTop: 60 }}>
          <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            <Text style={{ fontWeight: "700", fontSize: 16, color: colors.stone900 }}>{profile.full_name}</Text>
            <Text style={{ fontSize: 12, color: colors.stone500 }}>{profile.email}</Text>
          </View>
          {props.state.routes.map((route, i) => {
            const focused = props.state.index === i;
            const { options } = props.descriptors[route.key];
            const label = options.title ?? route.name;
            const Icon = ICONS[route.name];
            return (
              <Pressable
                key={route.key}
                onPress={() => props.navigation.navigate(route.name)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  backgroundColor: focused ? colors.tealBg : "transparent",
                }}
              >
                {Icon && <Icon size={18} color={focused ? colors.teal600 : colors.stone500} />}
                <Text style={{ color: focused ? colors.teal600 : colors.stone700, fontWeight: focused ? "600" : "400" }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      <Drawer.Screen name="index" options={{ title: "Live board" }} />
      <Drawer.Screen name="patients" options={{ title: "Patients", headerShown: false }} />
      <Drawer.Screen name="schedule" options={{ title: "Schedule" }} />
      <Drawer.Screen name="incidents" options={{ title: "Incidents" }} />
      <Drawer.Screen name="reports" options={{ title: "Reports" }} />
      <Drawer.Screen name="nurses" options={{ title: "Nurses" }} />
      <Drawer.Screen name="families" options={{ title: "Families" }} />
    </Drawer>
  );
}

const ICONS: Record<string, typeof LayoutDashboard> = {
  index: LayoutDashboard,
  patients: Users,
  schedule: CalendarClock,
  incidents: AlertTriangle,
  reports: BarChart3,
  nurses: UserPlus,
  families: Heart,
};
