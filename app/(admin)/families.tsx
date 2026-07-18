import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { LoadingScreen, EmptyState } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";

type Row = {
  id: string;
  relationship: string | null;
  users: { full_name: string; email: string };
  patients: { id: string; full_name: string } | null;
};

export default function FamiliesScreen() {
  const { profile } = useAuth();
  const [links, setLinks] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("family_links")
      .select("*, users(*), patients(id, full_name)")
      .eq("patients.agency_id", profile.agency_id);
    setLinks((data ?? []) as unknown as Row[]);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!links) return <LoadingScreen />;
  const rows = links.filter((l) => l.patients);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      {rows.map((l) => (
        <Pressable key={l.id} style={styles.card} onPress={() => router.push(`/(admin)/patients/${l.patients!.id}`)}>
          <Text style={styles.name}>{l.users?.full_name}</Text>
          <Text style={styles.muted}>{l.users?.email}</Text>
          <Text style={styles.linkText}>
            {l.patients?.full_name} {l.relationship ? `· ${l.relationship}` : ""}
          </Text>
        </Pressable>
      ))}
      {rows.length === 0 && <EmptyState text="No family accounts yet. Invite one from a patient's page." />}
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
  name: { fontSize: 14, fontWeight: "600", color: colors.stone900 },
  muted: { fontSize: 12, color: colors.stone500 },
  linkText: { fontSize: 12, color: colors.teal700, marginTop: 4 },
});
