import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { X } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { recordAudit } from "@/lib/audit";
import { Button, TextField, Label, LoadingScreen, EmptyState } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Option = { id: string; full_name: string };
type ShiftRow = {
  id: string;
  start_time: string;
  patients: { full_name: string };
  users: { full_name: string };
};

export default function ScheduleScreen() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Option[]>([]);
  const [nurses, setNurses] = useState<Option[]>([]);
  const [upcoming, setUpcoming] = useState<ShiftRow[] | null>(null);

  const [patientId, setPatientId] = useState<string | null>(null);
  const [nurseId, setNurseId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [weeks, setWeeks] = useState("1");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: p }, { data: n }, { data: s }] = await Promise.all([
      supabase.from("patients").select("id, full_name").eq("agency_id", profile.agency_id).eq("active", true).order("full_name"),
      supabase.from("users").select("id, full_name").eq("agency_id", profile.agency_id).eq("role", "nurse").order("full_name"),
      supabase
        .from("shifts")
        .select("id, start_time, patients(full_name), users!shifts_nurse_id_fkey(full_name)")
        .eq("agency_id", profile.agency_id)
        .neq("status", "cancelled")
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(30),
    ]);
    setPatients(p ?? []);
    setNurses(n ?? []);
    setUpcoming((s ?? []) as unknown as ShiftRow[]);
    if (!patientId && p?.length) setPatientId(p[0].id);
    if (!nurseId && n?.length) setNurseId(n[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function toggleWeekday(i: number) {
    setWeekdays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]));
  }

  async function handleCreate() {
    if (!profile || !patientId || !nurseId || !startDate) {
      Alert.alert("Missing info", "Choose a patient, nurse, and start date.");
      return;
    }
    setSaving(true);
    try {
      const rows: { agency_id: string; patient_id: string; nurse_id: string; start_time: string; end_time: string }[] = [];
      const base = new Date(`${startDate}T00:00:00`);
      const daySet = new Set(weekdays.length ? weekdays : [base.getDay()]);
      const weekCount = Math.max(1, Number(weeks) || 1);

      for (let w = 0; w < weekCount; w++) {
        for (let d = 0; d < 7; d++) {
          const day = new Date(base);
          day.setDate(day.getDate() + w * 7 + d);
          if (!daySet.has(day.getDay()) || day < base) continue;

          const [sh, sm] = startTime.split(":").map(Number);
          const [eh, em] = endTime.split(":").map(Number);
          const start = new Date(day);
          start.setHours(sh, sm, 0, 0);
          const end = new Date(day);
          end.setHours(eh, em, 0, 0);

          rows.push({
            agency_id: profile.agency_id,
            patient_id: patientId,
            nurse_id: nurseId,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
          });
        }
      }

      const { error } = await supabase.from("shifts").insert(rows);
      if (error) throw new Error(error.message);

      await recordAudit(supabase, {
        agencyId: profile.agency_id,
        userId: profile.id,
        action: "create",
        entityType: "shift_series",
        metadata: { patient_id: patientId, nurse_id: nurseId, count: rows.length },
      });

      setStartDate("");
      setWeekdays([]);
      setWeeks("1");
      load();
    } catch (e) {
      Alert.alert("Couldn't create shift", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function cancelShift(id: string) {
    await supabase.from("shifts").update({ status: "cancelled" }).eq("id", id);
    load();
  }

  if (!upcoming) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>New recurring shift</Text>

        <Label>Patient</Label>
        <ChipRow options={patients} selected={patientId} onSelect={setPatientId} />

        <Label>Nurse</Label>
        <ChipRow options={nurses} selected={nurseId} onSelect={setNurseId} />

        <TextField label="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField label="Start time (HH:mm)" value={startTime} onChangeText={setStartTime} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="End time (HH:mm)" value={endTime} onChangeText={setEndTime} />
          </View>
        </View>

        <Label>Repeat on</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {WEEKDAYS.map((day, i) => (
            <Pressable key={day} onPress={() => toggleWeekday(i)} style={[styles.dayChip, weekdays.includes(i) && styles.dayChipActive]}>
              <Text style={[styles.dayChipText, weekdays.includes(i) && styles.dayChipTextActive]}>{day}</Text>
            </Pressable>
          ))}
        </View>

        <TextField label="For how many weeks" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" />

        <Button title="Create shift(s)" onPress={handleCreate} loading={saving} />
      </View>

      <View>
        <Text style={styles.sectionTitle}>Upcoming</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {upcoming.map((s) => (
            <View key={s.id} style={styles.shiftRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shiftPatient}>{s.patients?.full_name}</Text>
                <Text style={styles.muted}>
                  {new Date(s.start_time).toLocaleString()} · {s.users?.full_name}
                </Text>
              </View>
              <Pressable onPress={() => cancelShift(s.id)} hitSlop={8}>
                <X size={16} color={colors.stone300} />
              </Pressable>
            </View>
          ))}
          {upcoming.length === 0 && <EmptyState text="No upcoming shifts." />}
        </View>
      </View>
    </ScrollView>
  );
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: Option[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm }}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onSelect(o.id)} style={[styles.dayChip, selected === o.id && styles.dayChipActive]}>
          <Text style={[styles.dayChipText, selected === o.id && styles.dayChipTextActive]}>{o.full_name}</Text>
        </Pressable>
      ))}
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
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.stone900, marginBottom: spacing.xs },
  muted: { fontSize: 12, color: colors.stone500 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.stone100 },
  dayChipActive: { backgroundColor: colors.teal600 },
  dayChipText: { fontSize: 12, color: colors.stone600 },
  dayChipTextActive: { color: colors.white },
  shiftRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.md,
  },
  shiftPatient: { fontSize: 14, fontWeight: "600", color: colors.stone900 },
});
