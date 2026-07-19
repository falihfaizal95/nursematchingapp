import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Check, Camera, LogOut, MapPinOff } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { toggleVisitTask, saveVitals, saveVisitNote, checkOut } from "@/lib/nurse-actions";
import { uploadVisitPhoto } from "@/lib/photos";
import { PhotoThumb } from "@/components/photo-thumb";
import { Button, TextField, LoadingScreen, EmptyState } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import type { Visit, Patient, VisitTask, CareTask, Vitals, VisitNote, Photo } from "@/lib/types";

type TaskRow = VisitTask & { care_tasks: CareTask };
type VisitWithPatient = Visit & { patients: Patient };

export default function VisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<VisitWithPatient | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [note, setNote] = useState<VisitNote | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const load = useCallback(async () => {
    const [{ data: v }, { data: vt }, { data: vitalsRow }, { data: noteRow }, { data: photoRows }] =
      await Promise.all([
        supabase.from("visits").select("*, patients(*)").eq("id", id).single(),
        supabase.from("visit_tasks").select("*, care_tasks(*)").eq("visit_id", id),
        supabase.from("vitals").select("*").eq("visit_id", id).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("visit_notes").select("*").eq("visit_id", id).maybeSingle(),
        supabase.from("photos").select("*").eq("visit_id", id).order("created_at", { ascending: false }),
      ]);
    setVisit((v as unknown as VisitWithPatient) ?? null);
    setTasks((vt ?? []) as unknown as TaskRow[]);
    setVitals((vitalsRow ?? null) as Vitals | null);
    setNote((noteRow ?? null) as VisitNote | null);
    setPhotos((photoRows ?? []) as Photo[]);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!visit) return <LoadingScreen />;
  const readOnly = visit.status === "completed";

  async function handleToggle(task: TaskRow) {
    const next = !task.completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)));
    try {
      await toggleVisitTask(task.id, next);
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !next } : t)));
    }
  }

  async function handleCheckOut() {
    setCheckoutLoading(true);
    try {
      await checkOut(visit!.id);
      router.replace("/(nurse)");
    } catch (e) {
      Alert.alert("Check-out failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCheckoutLoading(false);
    }
  }

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.stone50 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: readOnly ? spacing.lg : 100 }}>
        <View style={styles.card}>
          <Text style={styles.patientName}>{visit.patients.full_name}</Text>
          <Text style={styles.muted}>{visit.patients.address}</Text>
          {visit.check_in_at && (
            <Text style={styles.mutedSmall}>
              Checked in {new Date(visit.check_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </Text>
          )}
          {visit.check_in_flagged && (
            <View style={styles.flagRow}>
              <MapPinOff size={13} color={colors.amber700} />
              <Text style={styles.flagText}>
                Checked in {Math.round(visit.check_in_distance_m ?? 0)}m from the patient&apos;s address — flagged
                for admin review.
              </Text>
            </View>
          )}
          {visit.patients.allergies && (
            <View style={styles.allergyBox}>
              <Text style={styles.allergyText}>Allergies: {visit.patients.allergies}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Care tasks</Text>
            <Text style={styles.muted}>
              {completedCount}/{tasks.length}
            </Text>
          </View>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {tasks.map((t) => (
              <Pressable
                key={t.id}
                disabled={readOnly}
                onPress={() => handleToggle(t)}
                style={[styles.taskRow, t.completed && styles.taskRowDone]}
              >
                <View style={[styles.checkbox, t.completed && styles.checkboxDone]}>
                  {t.completed && <Check size={13} color={colors.white} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskLabel}>{t.care_tasks.label}</Text>
                  {t.care_tasks.instructions && (
                    <Text style={styles.mutedSmall}>{t.care_tasks.instructions}</Text>
                  )}
                </View>
              </Pressable>
            ))}
            {tasks.length === 0 && <EmptyState text="No care tasks on file." />}
          </View>
        </View>

        <VitalsSection visitId={visit.id} patientId={visit.patient_id} vitals={vitals} readOnly={readOnly} onSaved={load} />
        <NoteSection visitId={visit.id} note={note} readOnly={readOnly} onSaved={load} />
        <PhotosSection visitId={visit.id} patientId={visit.patient_id} photos={photos} readOnly={readOnly} onUploaded={load} />
      </ScrollView>

      {!readOnly && (
        <View style={styles.checkoutBar}>
          <Button title="Check out" icon={<LogOut size={16} color={colors.white} />} variant="secondary" onPress={handleCheckOut} loading={checkoutLoading} />
        </View>
      )}
    </View>
  );
}

function VitalsSection({
  visitId,
  patientId,
  vitals,
  readOnly,
  onSaved,
}: {
  visitId: string;
  patientId: string;
  vitals: Vitals | null;
  readOnly: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    bp_systolic: vitals?.bp_systolic?.toString() ?? "",
    bp_diastolic: vitals?.bp_diastolic?.toString() ?? "",
    heart_rate: vitals?.heart_rate?.toString() ?? "",
    glucose: vitals?.glucose?.toString() ?? "",
    temperature: vitals?.temperature?.toString() ?? "",
    pain_level: vitals?.pain_level?.toString() ?? "",
    mood: vitals?.mood ?? "",
  });
  const [saving, setSaving] = useState(false);

  if (readOnly) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Vitals</Text>
        {vitals ? (
          <View style={{ marginTop: spacing.sm, gap: 4 }}>
            <Text style={styles.muted}>BP: {vitals.bp_systolic ?? "—"}/{vitals.bp_diastolic ?? "—"}</Text>
            <Text style={styles.muted}>Heart rate: {vitals.heart_rate ?? "—"} bpm</Text>
            <Text style={styles.muted}>Glucose: {vitals.glucose ?? "—"} mg/dL</Text>
            <Text style={styles.muted}>Temp: {vitals.temperature ?? "—"}°F</Text>
            <Text style={styles.muted}>Pain: {vitals.pain_level ?? "—"}/10</Text>
            <Text style={styles.muted}>Mood: {vitals.mood || "—"}</Text>
          </View>
        ) : (
          <EmptyState text="No vitals recorded." />
        )}
      </View>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const num = (v: string) => (v.trim() === "" ? null : Number(v));
      await saveVitals(visitId, patientId, {
        bp_systolic: num(form.bp_systolic),
        bp_diastolic: num(form.bp_diastolic),
        heart_rate: num(form.heart_rate),
        glucose: num(form.glucose),
        temperature: num(form.temperature),
        pain_level: num(form.pain_level),
        mood: form.mood || null,
      });
      onSaved();
    } catch (e) {
      Alert.alert("Couldn't save vitals", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Vitals</Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={styles.grid2}>
          <TextField label="BP systolic" keyboardType="number-pad" value={form.bp_systolic} onChangeText={(v) => setForm((f) => ({ ...f, bp_systolic: v }))} />
          <TextField label="BP diastolic" keyboardType="number-pad" value={form.bp_diastolic} onChangeText={(v) => setForm((f) => ({ ...f, bp_diastolic: v }))} />
        </View>
        <View style={styles.grid2}>
          <TextField label="Heart rate" keyboardType="number-pad" value={form.heart_rate} onChangeText={(v) => setForm((f) => ({ ...f, heart_rate: v }))} />
          <TextField label="Glucose" keyboardType="number-pad" value={form.glucose} onChangeText={(v) => setForm((f) => ({ ...f, glucose: v }))} />
        </View>
        <View style={styles.grid2}>
          <TextField label="Temp (°F)" keyboardType="decimal-pad" value={form.temperature} onChangeText={(v) => setForm((f) => ({ ...f, temperature: v }))} />
          <TextField label="Pain (0-10)" keyboardType="number-pad" value={form.pain_level} onChangeText={(v) => setForm((f) => ({ ...f, pain_level: v }))} />
        </View>
        <TextField label="Mood" value={form.mood} onChangeText={(v) => setForm((f) => ({ ...f, mood: v }))} placeholder="content, tired, anxious..." />
        <Button title="Save vitals" onPress={handleSave} loading={saving} />
      </View>
    </View>
  );
}

function NoteSection({
  visitId,
  note,
  readOnly,
  onSaved,
}: {
  visitId: string;
  note: VisitNote | null;
  readOnly: boolean;
  onSaved: () => void;
}) {
  const [summary, setSummary] = useState(note?.summary ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [saving, setSaving] = useState(false);

  if (readOnly) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Visit note</Text>
        <Text style={[styles.taskLabel, { marginTop: spacing.sm }]}>{note?.summary || "—"}</Text>
        {note?.body && <Text style={[styles.muted, { marginTop: 4 }]}>{note.body}</Text>}
      </View>
    );
  }

  async function handleSave() {
    if (!summary.trim()) {
      Alert.alert("Summary required", "Add a short summary before saving.");
      return;
    }
    setSaving(true);
    try {
      await saveVisitNote(visitId, summary, body || null);
      onSaved();
    } catch (e) {
      Alert.alert("Couldn't save note", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Visit note</Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <TextField label="Summary" value={summary} onChangeText={setSummary} placeholder="e.g. Stable visit, meds given" />
        <TextField
          label="Details (optional)"
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
          style={{ minHeight: 80, textAlignVertical: "top" }}
        />
        <Button title="Save note" onPress={handleSave} loading={saving} />
      </View>
    </View>
  );
}

function PhotosSection({
  visitId,
  patientId,
  photos,
  readOnly,
  onUploaded,
}: {
  visitId: string;
  patientId: string;
  photos: Photo[];
  readOnly: boolean;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handlePick() {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      await uploadVisitPhoto({ visitId, patientId, localUri: result.assets[0].uri });
      onUploaded();
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Photos</Text>
      {!readOnly && (
        <View style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
          <Button title={uploading ? "Uploading..." : "Add photo"} icon={<Camera size={16} color={colors.stone700} />} variant="ghost" onPress={handlePick} loading={uploading} />
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
        {photos.map((p) => (
          <PhotoThumb key={p.id} storagePath={p.storage_path} />
        ))}
      </View>
      {photos.length === 0 && <EmptyState text="No photos yet." />}
    </View>
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
  patientName: { fontSize: 18, fontWeight: "600", color: colors.stone900 },
  muted: { fontSize: 13, color: colors.stone500 },
  mutedSmall: { fontSize: 11, color: colors.stone400, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: colors.stone900 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  flagRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: spacing.sm },
  flagText: { fontSize: 11, color: colors.amber700, flex: 1 },
  allergyBox: { backgroundColor: colors.red50, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
  allergyText: { fontSize: 12, color: colors.red700, fontWeight: "600" },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  taskRowDone: { backgroundColor: colors.tealBg, borderColor: colors.tealLight },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.stone300,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: { backgroundColor: colors.teal600, borderColor: colors.teal600 },
  taskLabel: { fontSize: 14, fontWeight: "500", color: colors.stone700 },
  grid2: { flexDirection: "row", gap: spacing.sm },
  checkoutBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.stone200,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
});
