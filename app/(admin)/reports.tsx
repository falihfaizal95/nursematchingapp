import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { format, startOfWeek } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { LoadingScreen, EmptyState } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";

type VisitRow = {
  check_in_at: string;
  check_out_at: string;
  patients: { full_name: string };
  users: { full_name: string };
};

export default function ReportsScreen() {
  const { profile } = useAuth();
  const [byWeekPatient, setByWeekPatient] = useState<Map<string, Map<string, number>> | null>(null);
  const [byWeekNurse, setByWeekNurse] = useState<Map<string, Map<string, number>>>(new Map());
  const [weeks, setWeeks] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const { data } = await supabase
      .from("visits")
      .select("check_in_at, check_out_at, patients(full_name), users!visits_nurse_id_fkey(full_name)")
      .eq("agency_id", profile.agency_id)
      .eq("status", "completed")
      .gte("check_in_at", eightWeeksAgo.toISOString());

    const rows = (data ?? []) as unknown as VisitRow[];
    const patientMap = new Map<string, Map<string, number>>();
    const nurseMap = new Map<string, Map<string, number>>();

    for (const v of rows) {
      if (!v.check_in_at || !v.check_out_at) continue;
      const hours = (new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 3_600_000;
      const week = format(startOfWeek(new Date(v.check_in_at)), "MMM d");

      const pm = patientMap.get(week) ?? new Map();
      const pname = v.patients?.full_name ?? "Unknown";
      pm.set(pname, (pm.get(pname) ?? 0) + hours);
      patientMap.set(week, pm);

      const nm = nurseMap.get(week) ?? new Map();
      const nname = v.users?.full_name ?? "Unknown";
      nm.set(nname, (nm.get(nname) ?? 0) + hours);
      nurseMap.set(week, nm);
    }

    setByWeekPatient(patientMap);
    setByWeekNurse(nurseMap);
    setWeeks(Array.from(patientMap.keys()).sort());
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!byWeekPatient) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Text style={styles.intro}>Hours delivered per week — the basis for billing and payroll.</Text>
      <ReportTable title="Hours per patient" weeks={weeks} data={byWeekPatient} />
      <ReportTable title="Hours per nurse" weeks={weeks} data={byWeekNurse} />
    </ScrollView>
  );
}

function ReportTable({ title, weeks, data }: { title: string; weeks: string[]; data: Map<string, Map<string, number>> }) {
  if (weeks.length === 0) {
    return (
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <EmptyState text="No completed visits in the last 8 weeks." />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {weeks.map((w) => {
          const entries = Array.from(data.get(w)?.entries() ?? []);
          return (
            <View key={w} style={styles.card}>
              <Text style={styles.week}>Week of {w}</Text>
              {entries.map(([name, hours]) => (
                <View key={name} style={styles.row}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.hours}>{hours.toFixed(1)}h</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.stone500 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.stone900 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.md,
  },
  week: { fontSize: 12, fontWeight: "600", color: colors.stone400, marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  name: { fontSize: 13, color: colors.stone700 },
  hours: { fontSize: 13, color: colors.stone900, fontWeight: "600" },
});
