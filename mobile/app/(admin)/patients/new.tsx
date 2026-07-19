import { useState } from "react";
import { ScrollView, View, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { recordAudit } from "@/lib/audit";
import { TextField, Button } from "@/components/ui";
import { spacing } from "@/lib/theme";

export default function NewPatientScreen() {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    date_of_birth: "",
    address: "",
    lat: "",
    lng: "",
    primary_condition: "",
    allergies: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  async function handleSave() {
    if (!profile) return;
    if (!form.full_name || !form.address || !form.lat || !form.lng) {
      Alert.alert("Missing info", "Name, address, and coordinates are required.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("patients")
      .insert({
        agency_id: profile.agency_id,
        full_name: form.full_name,
        date_of_birth: form.date_of_birth || null,
        address: form.address,
        lat: Number(form.lat),
        lng: Number(form.lng),
        primary_condition: form.primary_condition || null,
        allergies: form.allergies || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        notes: form.notes || null,
      })
      .select("id")
      .single();
    setSaving(false);

    if (error || !data) {
      Alert.alert("Couldn't save patient", error?.message);
      return;
    }

    await recordAudit(supabase, {
      agencyId: profile.agency_id,
      userId: profile.id,
      action: "create",
      entityType: "patient",
      entityId: data.id,
    });

    router.replace(`/(admin)/patients/${data.id}`);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <TextField label="Full name" value={form.full_name} onChangeText={set("full_name")} />
      <TextField label="Date of birth (YYYY-MM-DD)" value={form.date_of_birth} onChangeText={set("date_of_birth")} />
      <TextField label="Address" value={form.address} onChangeText={set("address")} />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField label="Latitude" value={form.lat} onChangeText={set("lat")} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Longitude" value={form.lng} onChangeText={set("lng")} keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      <TextField label="Primary condition" value={form.primary_condition} onChangeText={set("primary_condition")} />
      <TextField label="Allergies" value={form.allergies} onChangeText={set("allergies")} />
      <TextField label="Emergency contact name" value={form.emergency_contact_name} onChangeText={set("emergency_contact_name")} />
      <TextField label="Emergency contact phone" value={form.emergency_contact_phone} onChangeText={set("emergency_contact_phone")} />
      <TextField label="Notes" value={form.notes} onChangeText={set("notes")} multiline numberOfLines={3} style={{ minHeight: 70, textAlignVertical: "top" }} />
      <Button title="Create patient" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}
