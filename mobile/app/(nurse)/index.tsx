import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { MapPin, Clock } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { deriveShiftStatus, STATUS_COLORS, STATUS_LABELS } from "@/lib/shift-status";
import type { Shift, Patient, Visit } from "@/lib/types";
import { Badge, Button, EmptyState, LoadingScreen } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import { checkIn } from "@/lib/nurse-actions";

type Row = Shift & { patients: Patient; visits: Visit[] };

export default function NurseSchedule() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("shifts")
      .select("*, patients(*), visits(*)")
      .eq("nurse_id", profile.id)
      .neq("status", "cancelled")
      .gte("start_time", startOfDay.toISOString())
      .lte("start_time", endOfDay.toISOString())
      .order("start_time");

    setRows((data ?? []) as unknown as Row[]);
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

  async function handleCheckIn(shiftId: string) {
    setCheckingInId(shiftId);
    try {
      const visitId = await checkIn(shiftId);
      router.push(`/(nurse)/visit/${visitId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckingInId(null);
    }
  }

  if (rows === null) return <LoadingScreen />;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {rows.map((row) => {
        const visit = row.visits?.[0];
        const status = deriveShiftStatus(row, visit);
        const statusColor = STATUS_COLORS[status];

        return (
          <View key={row.id} style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.patientName}>{row.patients?.full_name}</Text>
                <View style={styles.metaRow}>
                  <Clock size={13} color={colors.stone500} />
                  <Text style={styles.metaText}>
                    {new Date(row.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                    {new Date(row.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <MapPin size={12} color={colors.stone400} />
                  <Text style={styles.metaTextSmall}>{row.patients?.address}</Text>
                </View>
              </View>
              <Badge label={STATUS_LABELS[status]} bg={statusColor.bg} fg={statusColor.fg} />
            </View>

            <View style={{ marginTop: spacing.md }}>
              {!visit && (
                <Button
                  title="Check in"
                  onPress={() => handleCheckIn(row.id)}
                  loading={checkingInId === row.id}
                />
              )}
              {visit && visit.status === "in_progress" && (
                <Button title="Continue visit" onPress={() => router.push(`/(nurse)/visit/${visit.id}`)} />
              )}
              {visit && visit.status === "completed" && (
                <Button
                  title="View summary"
                  variant="ghost"
                  onPress={() => router.push(`/(nurse)/visit/${visit.id}`)}
                />
              )}
            </View>
          </View>
        );
      })}
      {rows.length === 0 && <EmptyState text="No visits scheduled for today." />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.lg,
  },
  patientName: { fontSize: 16, fontWeight: "600", color: colors.stone900 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  metaText: { fontSize: 13, color: colors.stone500 },
  metaTextSmall: { fontSize: 12, color: colors.stone400 },
});
