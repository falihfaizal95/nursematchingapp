import { useCallback, useState } from "react";
import { View, Text, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { useFamilyPatient } from "@/context/family-patient";
import { PatientSwitcher } from "@/components/patient-switcher";
import { TextField, Button, LoadingScreen, EmptyState } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";
import type { AppUser, Message } from "@/lib/types";

type Row = Message & { users: AppUser };

export default function MessagesScreen() {
  const { profile } = useAuth();
  const { selected, loading: patientLoading } = useFamilyPatient();
  const [messages, setMessages] = useState<Row[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!selected) return;
    const { data } = await supabase
      .from("messages")
      .select("*, users(*)")
      .eq("patient_id", selected.id)
      .order("created_at");
    setMessages((data ?? []) as unknown as Row[]);
  }, [selected]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSend() {
    if (!body.trim() || !selected || !profile) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      agency_id: profile.agency_id,
      patient_id: selected.id,
      sender_id: profile.id,
      body: body.trim(),
    });
    setSending(false);
    if (!error) {
      setBody("");
      load();
    }
  }

  if (patientLoading || !selected) return <LoadingScreen />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <PatientSwitcher />
      <FlatList
        data={messages ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        ListEmptyComponent={messages ? <EmptyState text="Say hello to the care team." /> : <LoadingScreen />}
        renderItem={({ item }) => {
          const isMe = item.sender_id === profile?.id;
          return (
            <View style={{ alignItems: isMe ? "flex-end" : "flex-start" }}>
              <View style={[styles.bubble, isMe ? styles.bubbleMine : styles.bubbleTheirs]}>
                {!isMe && <Text style={styles.sender}>{item.users?.full_name}</Text>}
                <Text style={isMe ? styles.textMine : styles.textTheirs}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <View style={{ flex: 1 }}>
          <TextField value={body} onChangeText={setBody} placeholder="Type a message..." />
        </View>
        <Button title="Send" onPress={handleSend} loading={sending} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "78%", borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: colors.teal600 },
  bubbleTheirs: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.stone200 },
  sender: { fontSize: 11, fontWeight: "600", color: colors.stone500, marginBottom: 2 },
  textMine: { color: colors.white, fontSize: 14 },
  textTheirs: { color: colors.stone700, fontSize: 14 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.stone200,
    backgroundColor: colors.white,
  },
});
