import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useFamilyPatient } from "@/context/family-patient";
import { colors, radius, spacing } from "@/lib/theme";

export function PatientSwitcher() {
  const { patients, selected, setSelectedId } = useFamilyPatient();
  if (patients.length < 2) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {patients.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => setSelectedId(p.id)}
          style={[styles.chip, selected?.id === p.id && styles.chipActive]}
        >
          <Text style={[styles.chipText, selected?.id === p.id && styles.chipTextActive]}>{p.full_name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  chipActive: { backgroundColor: colors.teal600, borderColor: colors.teal600 },
  chipText: { fontSize: 13, color: colors.stone600, fontWeight: "500" },
  chipTextActive: { color: colors.white },
});
