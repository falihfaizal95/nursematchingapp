import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { createIncident } from "@/lib/nurse-actions";
import { Button, TextField, Label, LoadingScreen } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";

const TYPES = [
  { value: "fall", label: "Fall" },
  { value: "refusal", label: "Care refusal" },
  { value: "medication_error", label: "Medication error" },
  { value: "concern", label: "General concern" },
  { value: "other", label: "Other" },
];
const SEVERITIES = ["low", "medium", "high", "critical"];

export default function NewIncidentScreen() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [type, setType] = useState("concern");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("shifts")
      .select("patient_id, patients(full_name)")
      .eq("nurse_id", profile.id)
      .order("start_time", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const seen = new Map<string, string>();
        for (const row of data ?? []) {
          const r = row as unknown as { patient_id: string; patients: { full_name: string } };
          seen.set(r.patient_id, r.patients?.full_name);
        }
        const list = Array.from(seen.entries()).map(([id, full_name]) => ({ id, full_name }));
        setPatients(list);
        if (list.length) setPatientId(list[0].id);
      });
  }, [profile]);

  async function handleSubmit() {
    if (!patientId || !description.trim()) {
      Alert.alert("Missing info", "Choose a patient and describe what happened.");
      return;
    }
    setSubmitting(true);
    try {
      await createIncident({ patient_id: patientId, type, severity, description });
      router.back();
    } catch (e) {
      Alert.alert("Couldn't submit report", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} style={{ backgroundColor: colors.white }}>
      <Text style={styles.intro}>This immediately flags the agency for review.</Text>

      <View>
        <Label>Patient</Label>
        <View style={styles.chipRow}>
          {patients.map((p) => (
            <Chip key={p.id} label={p.full_name} selected={patientId === p.id} onPress={() => setPatientId(p.id)} />
          ))}
        </View>
      </View>

      <View>
        <Label>Type</Label>
        <View style={styles.chipRow}>
          {TYPES.map((t) => (
            <Chip key={t.value} label={t.label} selected={type === t.value} onPress={() => setType(t.value)} />
          ))}
        </View>
      </View>

      <View>
        <Label>Severity</Label>
        <View style={styles.chipRow}>
          {SEVERITIES.map((s) => (
            <Chip key={s} label={s} selected={severity === s} onPress={() => setSeverity(s)} tone={s === "critical" || s === "high" ? "danger" : "default"} />
          ))}
        </View>
      </View>

      <TextField
        label="What happened"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
        style={{ minHeight: 110, textAlignVertical: "top" }}
      />

      <Button title="Submit report" variant="danger" onPress={handleSubmit} loading={submitting} />
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  onPress,
  tone = "default",
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: "default" | "danger";
}) {
  const activeBg = tone === "danger" ? colors.red600 : colors.teal600;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? activeBg : colors.stone100 }]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.white : colors.stone700 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.stone500 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  chipText: { fontSize: 13, fontWeight: "500", textTransform: "capitalize" },
});
