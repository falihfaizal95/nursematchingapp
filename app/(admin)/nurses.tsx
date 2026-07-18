import { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { inviteUser } from "@/lib/invite";
import { TextField, Button, LoadingScreen, EmptyState } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import type { AppUser } from "@/lib/types";

export default function NursesScreen() {
  const { profile } = useAuth();
  const [nurses, setNurses] = useState<AppUser[] | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("agency_id", profile.agency_id)
      .eq("role", "nurse")
      .order("full_name");
    setNurses((data ?? []) as AppUser[]);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleInvite() {
    if (!fullName.trim() || !email.trim()) {
      Alert.alert("Missing info", "Name and email are required.");
      return;
    }
    setSending(true);
    try {
      const result = await inviteUser({ role: "nurse", full_name: fullName, email, phone });
      Alert.alert(
        "Nurse invited",
        `Share these sign-in details:\n\nEmail: ${result.email}\nTemporary password: ${result.tempPassword}\n\nThey should change it after signing in.`,
      );
      setFullName("");
      setEmail("");
      setPhone("");
      load();
    } catch (e) {
      Alert.alert("Couldn't invite", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }

  if (!nurses) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={styles.card}>
        {nurses.map((n) => (
          <View key={n.id} style={styles.row}>
            <Text style={styles.name}>{n.full_name}</Text>
            <Text style={styles.muted}>{n.email}</Text>
            {n.phone && <Text style={styles.muted}>{n.phone}</Text>}
          </View>
        ))}
        {nurses.length === 0 && <EmptyState text="No nurses yet." />}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Invite a nurse</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <TextField placeholder="Full name" value={fullName} onChangeText={setFullName} />
          <TextField placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextField placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Button title="Send invite" onPress={handleInvite} loading={sending} />
        </View>
      </View>
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
  row: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.stone100 },
  name: { fontSize: 14, fontWeight: "600", color: colors.stone900 },
  muted: { fontSize: 12, color: colors.stone500 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: colors.stone900 },
});
