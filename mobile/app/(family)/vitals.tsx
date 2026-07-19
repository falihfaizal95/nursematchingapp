import { useCallback, useState } from "react";
import { View, Text, ScrollView, Dimensions, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { LineChart } from "react-native-chart-kit";
import { supabase } from "@/lib/supabase";
import { useFamilyPatient } from "@/context/family-patient";
import { PatientSwitcher } from "@/components/patient-switcher";
import { EmptyState, LoadingScreen } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import type { Vitals } from "@/lib/types";

const screenWidth = Dimensions.get("window").width - spacing.lg * 2 - spacing.lg * 2;

export default function VitalsScreen() {
  const { selected, loading: patientLoading } = useFamilyPatient();
  const [vitals, setVitals] = useState<Vitals[] | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const { data } = await supabase
      .from("vitals")
      .select("*")
      .eq("patient_id", selected.id)
      .gte("recorded_at", sixtyDaysAgo.toISOString())
      .order("recorded_at");
    setVitals((data ?? []) as Vitals[]);
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
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <View>
          <Text style={styles.title}>Vitals trends</Text>
          <Text style={styles.muted}>Last 60 days for {selected.full_name}</Text>
        </View>

        {!vitals ? (
          <LoadingScreen />
        ) : vitals.length === 0 ? (
          <EmptyState text="No vitals recorded yet." />
        ) : (
          <>
            <VitalChart title="Blood pressure" vitals={vitals} series={[{ key: "bp_systolic", color: colors.teal600, label: "Systolic" }, { key: "bp_diastolic", color: colors.amber600, label: "Diastolic" }]} />
            <VitalChart title="Heart rate (bpm)" vitals={vitals} series={[{ key: "heart_rate", color: colors.red600, label: "BPM" }]} />
            <VitalChart title="Glucose (mg/dL)" vitals={vitals} series={[{ key: "glucose", color: "#7c3aed", label: "mg/dL" }]} />
            <VitalChart title="Pain level (0-10)" vitals={vitals} series={[{ key: "pain_level", color: "#0891b2", label: "Pain" }]} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

function VitalChart({
  title,
  vitals,
  series,
}: {
  title: string;
  vitals: Vitals[];
  series: { key: keyof Vitals; color: string; label: string }[];
}) {
  const labels = vitals.map((v) =>
    new Date(v.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  );
  // Chart-kit gets unreadable with many x labels — thin them out.
  const step = Math.max(1, Math.floor(labels.length / 6));
  const thinnedLabels = labels.map((l, i) => (i % step === 0 ? l : ""));

  const datasets = series.map((s) => ({
    data: vitals.map((v) => (typeof v[s.key] === "number" ? (v[s.key] as number) : 0)),
    color: () => s.color,
    strokeWidth: 2,
  }));

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <LineChart
        data={{ labels: thinnedLabels, datasets }}
        width={screenWidth}
        height={180}
        withDots={false}
        withInnerLines={false}
        withOuterLines={false}
        chartConfig={{
          backgroundGradientFrom: colors.white,
          backgroundGradientTo: colors.white,
          decimalPlaces: 0,
          color: () => colors.stone400,
          labelColor: () => colors.stone400,
          propsForLabels: { fontSize: 10 },
        }}
        bezier
        style={{ marginLeft: -spacing.lg, marginTop: spacing.sm }}
      />
      <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.xs }}>
        {series.map((s) => (
          <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <Text style={styles.legendText}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "700", color: colors.stone900 },
  muted: { fontSize: 13, color: colors.stone500 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.lg,
    overflow: "hidden",
  },
  cardTitle: { fontSize: 13, fontWeight: "600", color: colors.stone700 },
  legendText: { fontSize: 11, color: colors.stone500 },
});
