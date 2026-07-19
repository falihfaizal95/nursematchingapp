import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useFocusEffect, Link } from "expo-router";
import { AlertTriangle, MapPinOff } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { deriveShiftStatus, STATUS_COLORS, STATUS_LABELS, type LiveStatus } from "@/lib/shift-status";
import { Badge, LoadingScreen } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import type { Shift, Patient, Visit, AppUser, Incident } from "@/lib/types";

type Row = Shift & { patients: Patient; users: AppUser; visits: Visit[] };
type IncidentRow = Incident & { patients: { full_name: string } };

export default function AdminLiveBoard() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [openIncidents, setOpenIncidents] = useState<IncidentRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [{ data: shifts }, { data: incidents }] = await Promise.all([
      supabase
        .from("shifts")
        .select("*, patients(*), users!shifts_nurse_id_fkey(*), visits(*)")
        .eq("agency_id", profile.agency_id)
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .order("start_time"),
      supabase
        .from("incidents")
        .select("*, patients(full_name)")
        .eq("agency_id", profile.agency_id)
        .eq("status", "open")
        .order("created_at", { ascending: false }),
    ]);

    setRows((shifts ?? []) as unknown as Row[]);
    setOpenIncidents((incidents ?? []) as unknown as IncidentRow[]);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (rows === null) return <LoadingScreen />;

  const counts: Record<LiveStatus, number> = { scheduled: 0, checked_in: 0, completed: 0, missed: 0, cancelled: 0 };
  for (const row of rows) counts[deriveShiftStatus(row, row.visits?.[0])]++;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View>
        <Text style={styles.title}>Today&apos;s visits</Text>
        <Text style={styles.muted}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        {(Object.keys(counts) as LiveStatus[]).map((s) => (
          <View key={s} style={styles.statCard}>
            <Text style={styles.statNumber}>{counts[s]}</Text>
            <Text style={styles.statLabel}>{STATUS_LABELS[s]}</Text>
          </View>
        ))}
      </View>

      {openIncidents.length > 0 && (
        <View style={styles.incidentBanner}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <AlertTriangle size={15} color={colors.red700} />
            <Text style={styles.incidentTitle}>Open incidents need review</Text>
          </View>
          {openIncidents.map((inc) => (
            <Link key={inc.id} href="/(admin)/incidents" style={styles.incidentLink}>
              {inc.patients?.full_name} — {inc.type.replace("_", " ")} ({inc.severity})
            </Link>
          ))}
        </View>
      )}

      <View style={{ gap: spacing.sm }}>
        {rows.map((row) => {
          const visit = row.visits?.[0];
          const status = deriveShiftStatus(row, visit);
          const c = STATUS_COLORS[status];
          return (
            <View key={row.id} style={styles.visitRow}>
              <View>
                <Text style={styles.visitTime}>
                  {new Date(row.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.visitPatient}>{row.patients?.full_name}</Text>
                <Text style={styles.muted}>{row.users?.full_name}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Badge label={STATUS_LABELS[status]} bg={c.bg} fg={c.fg} />
                {visit?.check_in_flagged && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <MapPinOff size={11} color={colors.amber700} />
                    <Text style={styles.flagText}>{Math.round(visit.check_in_distance_m ?? 0)}m away</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
        {rows.length === 0 && <Text style={styles.muted}>No visits scheduled today.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700", color: colors.stone900 },
  muted: { fontSize: 13, color: colors.stone500 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: {
    width: "31%",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.md,
  },
  statNumber: { fontSize: 22, fontWeight: "700", color: colors.stone900 },
  statLabel: { fontSize: 11, color: colors.stone500 },
  incidentBanner: {
    backgroundColor: colors.red50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.red100,
    padding: spacing.md,
  },
  incidentTitle: { fontSize: 13, fontWeight: "600", color: colors.red700 },
  incidentLink: { fontSize: 12, color: colors.red700, textDecorationLine: "underline", marginTop: 2 },
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.md,
  },
  visitTime: { fontSize: 13, color: colors.stone600, width: 64 },
  visitPatient: { fontSize: 14, fontWeight: "600", color: colors.stone900 },
  flagText: { fontSize: 10, color: colors.amber700, fontWeight: "600" },
});
