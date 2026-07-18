import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useFamilyPatient } from "@/context/family-patient";
import { PatientSwitcher } from "@/components/patient-switcher";
import { PhotoThumb } from "@/components/photo-thumb";
import { EmptyState, LoadingScreen } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";
import type { Photo } from "@/lib/types";

export default function PhotosScreen() {
  const { selected, loading: patientLoading } = useFamilyPatient();
  const [photos, setPhotos] = useState<Photo[] | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    const { data } = await supabase
      .from("photos")
      .select("*")
      .eq("patient_id", selected.id)
      .order("created_at", { ascending: false });
    setPhotos((data ?? []) as Photo[]);
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
          <Text style={styles.title}>Photo timeline</Text>
          <Text style={styles.muted}>Shared by the care team for {selected.full_name}</Text>
        </View>

        {!photos ? (
          <LoadingScreen />
        ) : photos.length === 0 ? (
          <EmptyState text="No photos shared yet." />
        ) : (
          <View style={styles.grid}>
            {photos.map((p) => (
              <View key={p.id} style={{ gap: 4 }}>
                <PhotoThumb storagePath={p.storage_path} size={108} />
                <Text style={styles.date}>
                  {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "700", color: colors.stone900 },
  muted: { fontSize: 13, color: colors.stone500 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  date: { fontSize: 10, color: colors.stone400 },
});
