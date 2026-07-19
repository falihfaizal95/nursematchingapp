import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { Plus } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { Badge, LoadingScreen, EmptyState } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import type { Patient } from "@/lib/types";

export default function PatientsListScreen() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("patients")
      .select("*")
      .eq("agency_id", profile.agency_id)
      .order("full_name");
    setPatients((data ?? []) as Patient[]);
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

  if (patients === null) return <LoadingScreen />;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Pressable style={styles.addButton} onPress={() => router.push("/(admin)/patients/new")}>
        <Plus size={16} color={colors.white} />
        <Text style={styles.addButtonText}>Add patient</Text>
      </Pressable>

      {patients.map((p) => (
        <Pressable key={p.id} style={styles.card} onPress={() => router.push(`/(admin)/patients/${p.id}`)}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.name}>{p.full_name}</Text>
            {!p.active && <Badge label="Inactive" bg={colors.stone100} fg={colors.stone500} />}
          </View>
          <Text style={styles.muted}>{p.primary_condition || "No condition on file"}</Text>
          <Text style={styles.mutedSmall}>{p.address}</Text>
        </Pressable>
      ))}
      {patients.length === 0 && <EmptyState text="No patients yet." />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.teal600,
    borderRadius: radius.md,
    paddingVertical: 12,
    marginBottom: spacing.xs,
  },
  addButtonText: { color: colors.white, fontWeight: "600", fontSize: 14 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.md,
  },
  name: { fontSize: 15, fontWeight: "600", color: colors.stone900 },
  muted: { fontSize: 13, color: colors.stone500, marginTop: 2 },
  mutedSmall: { fontSize: 11, color: colors.stone400, marginTop: 4 },
});
