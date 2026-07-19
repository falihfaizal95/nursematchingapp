import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { Badge, LoadingScreen, EmptyState } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import type { Incident } from "@/lib/types";

type Row = Incident & { patients: { full_name: string }; users: { full_name: string } };

const SEVERITY_COLORS: Record<string, { bg: string; fg: string }> = {
  low: { bg: colors.stone100, fg: colors.stone700 },
  medium: { bg: colors.amber100, fg: colors.amber800 },
  high: { bg: "#FFEDD5", fg: "#9A3412" },
  critical: { bg: colors.red100, fg: colors.red700 },
};

export default function IncidentsScreen() {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("incidents")
      .select("*, patients(full_name), users!incidents_nurse_id_fkey(full_name)")
      .eq("agency_id", profile.agency_id)
      .order("created_at", { ascending: false });
    setIncidents((data ?? []) as unknown as Row[]);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function updateStatus(id: string, status: "reviewed" | "resolved") {
    await supabase.from("incidents").update({ status }).eq("id", id);
    load();
  }

  if (!incidents) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {incidents.map((inc) => {
        const sev = SEVERITY_COLORS[inc.severity];
        return (
          <View key={inc.id} style={styles.card}>
            <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
              <Badge label={inc.severity} bg={sev.bg} fg={sev.fg} />
              <Text style={styles.type}>{inc.type.replace("_", " ")}</Text>
            </View>
            <Text style={styles.patient}>{inc.patients?.full_name}</Text>
            <Text style={styles.description}>{inc.description}</Text>
            <Text style={styles.muted}>
              Reported by {inc.users?.full_name} · {new Date(inc.created_at).toLocaleString()}
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm }}>
              <Badge label={inc.status} bg={colors.stone100} fg={colors.stone600} />
              {inc.status !== "resolved" && (
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  {inc.status === "open" && (
                    <Pressable onPress={() => updateStatus(inc.id, "reviewed")}>
                      <Text style={styles.actionLink}>Mark reviewed</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => updateStatus(inc.id, "resolved")}>
                    <Text style={styles.actionLink}>Mark resolved</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        );
      })}
      {incidents.length === 0 && <EmptyState text="No incidents reported." />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.md,
  },
  type: { fontSize: 11, color: colors.stone400, textTransform: "uppercase" },
  patient: { fontSize: 15, fontWeight: "600", color: colors.stone900, marginTop: 6 },
  description: { fontSize: 13, color: colors.stone600, marginTop: 2 },
  muted: { fontSize: 11, color: colors.stone400, marginTop: 6 },
  actionLink: { fontSize: 12, fontWeight: "600", color: colors.teal700 },
});
