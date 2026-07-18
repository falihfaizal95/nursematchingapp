import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { CalendarClock, Sparkles, ChevronRight } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useFamilyPatient } from "@/context/family-patient";
import { getWeeklyCareScore } from "@/lib/care-score";
import { PatientSwitcher } from "@/components/patient-switcher";
import { LoadingScreen } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import type { AppUser, VisitTask, VisitNote, Shift } from "@/lib/types";

type LastVisit = {
  id: string;
  check_out_at: string;
  users: AppUser;
  visit_notes: VisitNote[];
  visit_tasks: (VisitTask & { care_tasks: { label: string } })[];
};

export default function FamilyHome() {
  const { selected, loading: patientLoading } = useFamilyPatient();
  const [lastVisit, setLastVisit] = useState<LastVisit | null>(null);
  const [careScore, setCareScore] = useState<Awaited<ReturnType<typeof getWeeklyCareScore>> | null>(null);
  const [nextShift, setNextShift] = useState<(Shift & { users: { full_name: string } }) | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!selected) return;
    const [{ data: visit }, score, { data: shift }] = await Promise.all([
      supabase
        .from("visits")
        .select("*, users!visits_nurse_id_fkey(*), visit_notes(*), visit_tasks(*, care_tasks(*))")
        .eq("patient_id", selected.id)
        .eq("status", "completed")
        .order("check_out_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getWeeklyCareScore(supabase, selected.id),
      supabase
        .from("shifts")
        .select("*, users!shifts_nurse_id_fkey(full_name)")
        .eq("patient_id", selected.id)
        .eq("status", "scheduled")
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(1)
        .maybeSingle(),
    ]);
    setLastVisit((visit as unknown as LastVisit) ?? null);
    setCareScore(score);
    setNextShift((shift as unknown as (Shift & { users: { full_name: string } })) ?? null);
  }, [selected]);

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

  if (patientLoading || !selected) return <LoadingScreen />;

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <PatientSwitcher />
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <View>
          <Text style={styles.caption}>Caring for</Text>
          <Text style={styles.title}>{selected.full_name}</Text>
        </View>

        <View style={styles.scoreCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Sparkles size={14} color={colors.tealLight} />
            <Text style={styles.scoreCaption}>This week</Text>
          </View>
          <Text style={styles.scoreNumber}>{careScore?.score ?? "—"}</Text>
          <Text style={styles.scoreLabel}>care score</Text>
          {careScore && (
            <Text style={styles.scoreDetail}>
              {careScore.visitsCompleted}/{careScore.visitsScheduled} visits ·{" "}
              {careScore.tasksCompleted}/{careScore.tasksTotal} tasks done
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Latest visit</Text>
          {lastVisit ? (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.muted}>
                {new Date(lastVisit.check_out_at).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                · by {lastVisit.users?.full_name}
              </Text>
              <Text style={styles.visitSummary}>{lastVisit.visit_notes?.[0]?.summary || "Visit completed"}</Text>
              <Text style={styles.muted}>
                {lastVisit.visit_tasks?.filter((t) => t.completed).length}/{lastVisit.visit_tasks?.length || 0} care
                tasks completed
              </Text>
            </View>
          ) : (
            <Text style={styles.muted}>No visits recorded yet.</Text>
          )}
        </View>

        {nextShift && (
          <View style={styles.nextVisitBanner}>
            <CalendarClock size={20} color={colors.amber700} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nextVisitTitle}>
                Next visit{" "}
                {new Date(nextShift.start_time).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })}
              </Text>
              <Text style={styles.nextVisitSubtitle}>with {nextShift.users?.full_name}</Text>
            </View>
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          <QuickLink title="Vitals trends" subtitle="See how things have changed over time" onPress={() => router.push("/(family)/vitals")} />
          <QuickLink title="Photo timeline" subtitle="Wound progress and care moments" onPress={() => router.push("/(family)/photos")} />
          <QuickLink title="Upcoming visits" subtitle="This week's schedule" onPress={() => router.push("/(family)/calendar")} />
          <QuickLink title="Message the agency" subtitle="Ask a question, anytime" onPress={() => router.push("/(family)/messages")} />
        </View>
      </View>
    </ScrollView>
  );
}

function QuickLink({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickLink} onPress={onPress}>
      <View>
        <Text style={styles.quickLinkTitle}>{title}</Text>
        <Text style={styles.muted}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={colors.stone300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, color: colors.stone500 },
  title: { fontSize: 22, fontWeight: "700", color: colors.stone900 },
  scoreCard: {
    backgroundColor: colors.teal700,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  scoreCaption: { color: colors.tealLight, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  scoreNumber: { color: colors.white, fontSize: 40, fontWeight: "700", marginTop: 6 },
  scoreLabel: { color: colors.tealLight, fontSize: 13 },
  scoreDetail: { color: colors.tealLight, fontSize: 11, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.lg,
  },
  cardLabel: { fontSize: 11, fontWeight: "600", color: colors.stone400, textTransform: "uppercase" },
  muted: { fontSize: 13, color: colors.stone500 },
  visitSummary: { fontSize: 15, fontWeight: "600", color: colors.stone900, marginVertical: 4 },
  nextVisitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.amber50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.amber100,
    padding: spacing.md,
  },
  nextVisitTitle: { fontSize: 13, fontWeight: "600", color: colors.amber800 },
  nextVisitSubtitle: { fontSize: 12, color: colors.amber700 },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.md,
  },
  quickLinkTitle: { fontSize: 14, fontWeight: "600", color: colors.stone900 },
});
