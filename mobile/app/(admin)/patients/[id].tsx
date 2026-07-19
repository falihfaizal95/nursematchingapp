import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { inviteUser } from "@/lib/invite";
import { Button, TextField, Label, LoadingScreen, EmptyState } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import type { Patient, CarePlan, CareTask, FamilyLink, AppUser } from "@/lib/types";

type PlanRow = CarePlan & { care_tasks: CareTask[] };
type LinkRow = FamilyLink & { users: AppUser };

const CATEGORIES = ["medication", "wound_care", "bathing", "meals", "mobility", "vitals", "other"];

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: p }, { data: cp }, { data: fl }] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).eq("agency_id", profile.agency_id).single(),
      supabase.from("care_plans").select("*, care_tasks(*)").eq("patient_id", id).order("created_at"),
      supabase.from("family_links").select("*, users(*)").eq("patient_id", id),
    ]);
    setPatient((p as Patient) ?? null);
    setPlans((cp ?? []) as unknown as PlanRow[]);
    setLinks((fl ?? []) as unknown as LinkRow[]);
  }, [id, profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!patient) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View>
        <Text style={styles.name}>{patient.full_name}</Text>
        <Text style={styles.muted}>{patient.address}</Text>
      </View>

      <View style={styles.card}>
        <InfoRow label="Date of birth" value={patient.date_of_birth} />
        <InfoRow label="Primary condition" value={patient.primary_condition} />
        <InfoRow label="Allergies" value={patient.allergies} />
        <InfoRow
          label="Emergency contact"
          value={patient.emergency_contact_name ? `${patient.emergency_contact_name} — ${patient.emergency_contact_phone ?? ""}` : null}
        />
        {patient.notes && <InfoRow label="Notes" value={patient.notes} />}
      </View>

      <View>
        <Text style={styles.sectionTitle}>Care plans</Text>
        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          {plans.map((plan) => (
            <CarePlanCard key={plan.id} plan={plan} patientId={id} onChanged={load} />
          ))}
          <NewCarePlan patientId={id} onCreated={load} />
        </View>
      </View>

      <View>
        <Text style={styles.sectionTitle}>Family access</Text>
        <View style={styles.card}>
          {links.map((link) => (
            <View key={link.id} style={styles.familyRow}>
              <Text style={styles.familyName}>{link.users?.full_name}</Text>
              <Text style={styles.muted}>
                {link.users?.email} {link.relationship ? `· ${link.relationship}` : ""}
              </Text>
            </View>
          ))}
          {links.length === 0 && <EmptyState text="No family invited yet." />}
          <InviteFamilyForm patientId={id} onInvited={load} />
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );
}

function CarePlanCard({ plan, patientId, onChanged }: { plan: PlanRow; patientId: string; onChanged: () => void }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("medication");
  const [adding, setAdding] = useState(false);

  async function addTask() {
    if (!label.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("care_tasks").insert({
      care_plan_id: plan.id,
      label: label.trim(),
      category,
      sort_order: plan.care_tasks.length,
    });
    setAdding(false);
    if (!error) {
      setLabel("");
      onChanged();
    }
  }

  async function deleteTask(taskId: string) {
    await supabase.from("care_tasks").delete().eq("id", taskId);
    onChanged();
  }

  return (
    <View style={styles.card}>
      <Text style={styles.planTitle}>{plan.title}</Text>
      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
        {plan.care_tasks
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((t) => (
            <View key={t.id} style={styles.taskRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskLabel}>
                  {t.label} <Text style={styles.taskCategory}>{t.category}</Text>
                </Text>
              </View>
              <Pressable onPress={() => deleteTask(t.id)} hitSlop={8}>
                <Trash2 size={15} color={colors.stone300} />
              </Pressable>
            </View>
          ))}
        {plan.care_tasks.length === 0 && <Text style={styles.muted}>No tasks yet.</Text>}
      </View>

      <View style={styles.addTaskRow}>
        <View style={{ flex: 1 }}>
          <TextField placeholder="Task label" value={label} onChangeText={setLabel} />
        </View>
        <Button title={adding ? "..." : "Add"} onPress={addTask} loading={adding} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.xs }}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.categoryChip, category === c && styles.categoryChipActive]}
          >
            <Text style={[styles.categoryChipText, category === c && styles.categoryChipTextActive]}>
              {c.replace("_", " ")}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NewCarePlan({ patientId, onCreated }: { patientId: string; onCreated: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!title.trim() || !profile) return;
    setCreating(true);
    const { error } = await supabase.from("care_plans").insert({
      agency_id: profile.agency_id,
      patient_id: patientId,
      title: title.trim(),
    });
    setCreating(false);
    if (!error) {
      setTitle("");
      onCreated();
    }
  }

  return (
    <View style={[styles.card, { borderStyle: "dashed" }]}>
      <Label>New care plan title</Label>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
        <View style={{ flex: 1 }}>
          <TextField placeholder="e.g. Daily Care Plan" value={title} onChangeText={setTitle} />
        </View>
        <Button title="Add" onPress={create} loading={creating} />
      </View>
    </View>
  );
}

function InviteFamilyForm({ patientId, onInvited }: { patientId: string; onInvited: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!fullName.trim() || !email.trim()) {
      Alert.alert("Missing info", "Name and email are required.");
      return;
    }
    setSending(true);
    try {
      const result = await inviteUser({ role: "family", full_name: fullName, email, relationship, patient_id: patientId });
      Alert.alert(
        "Family member invited",
        `Share these sign-in details:\n\nEmail: ${result.email}\nTemporary password: ${result.tempPassword}\n\nThey should change it after signing in.`,
      );
      setFullName("");
      setEmail("");
      setRelationship("");
      onInvited();
    } catch (e) {
      Alert.alert("Couldn't invite", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      <TextField placeholder="Full name" value={fullName} onChangeText={setFullName} />
      <TextField placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextField placeholder="Relationship (e.g. Daughter)" value={relationship} onChangeText={setRelationship} />
      <Button title="Send invite" onPress={send} loading={sending} />
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: "700", color: colors.stone900 },
  muted: { fontSize: 13, color: colors.stone500 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: colors.stone900 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.md,
  },
  infoLabel: { fontSize: 11, color: colors.stone400, textTransform: "uppercase" },
  infoValue: { fontSize: 14, color: colors.stone700 },
  familyRow: { paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.stone100 },
  familyName: { fontSize: 14, fontWeight: "600", color: colors.stone900 },
  planTitle: { fontSize: 15, fontWeight: "600", color: colors.stone900 },
  taskRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  taskLabel: { fontSize: 13, color: colors.stone700 },
  taskCategory: { fontSize: 10, color: colors.stone400, textTransform: "uppercase" },
  addTaskRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" },
  categoryChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.stone100 },
  categoryChipActive: { backgroundColor: colors.stone900 },
  categoryChipText: { fontSize: 11, color: colors.stone600, textTransform: "capitalize" },
  categoryChipTextActive: { color: colors.white },
});
