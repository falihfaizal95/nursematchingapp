import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { CalendarDays, User } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useFamilyPatient } from "@/context/family-patient";
import { PatientSwitcher } from "@/components/patient-switcher";
import { EmptyState, LoadingScreen } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import type { Shift } from "@/lib/types";

type Row = Shift & { users: { full_name: string } };

export default function CalendarScreen() {
  const { selected, loading: patientLoading } = useFamilyPatient();
  const [shifts, setShifts] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { data } = await supabase
      .from("shifts")
      .select("*, users!shifts_nurse_id_fkey(full_name)")
      .eq("patient_id", selected.id)
      .neq("status", "cancelled")
      .gte("start_time", yesterday.toISOString())
      .order("start_time")
      .limit(20);
    setShifts((data ?? []) as unknown as Row[]);
  }, [selected]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (patientLoading || !selected) return <LoadingScreen />;

  return (
    <ScrollView>
      <PatientSwitcher />
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View>
          <Text style={styles.title}>Upcoming visits</Text>
          <Text style={styles.muted}>Scheduled care for {selected.full_name}</Text>
        </View>

        {!shifts ? (
          <LoadingScreen />
        ) : shifts.length === 0 ? (
          <EmptyState text="No upcoming visits scheduled." />
        ) : (
          shifts.map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={styles.icon}>
                <CalendarDays size={18} color={colors.teal700} />
              </View>
              <View>
                <Text style={styles.day}>
                  {new Date(s.start_time).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </Text>
                <Text style={styles.muted}>
                  {new Date(s.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                  {new Date(s.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <User size={11} color={colors.stone400} />
                  <Text style={styles.nurse}>{s.users?.full_name}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "700", color: colors.stone900 },
  muted: { fontSize: 13, color: colors.stone500 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.tealBg,
    alignItems: "center",
    justifyContent: "center",
  },
  day: { fontSize: 14, fontWeight: "600", color: colors.stone900 },
  nurse: { fontSize: 11, color: colors.stone400 },
});
