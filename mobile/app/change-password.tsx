import { useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Screen, TextField, Button } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

export default function ChangePasswordScreen() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.back(), 900);
  }

  return (
    <Screen background={colors.white} style={{ padding: spacing.lg }}>
      <Text style={{ fontSize: 14, color: colors.stone500, marginBottom: spacing.lg }}>
        Choose a new password for your account.
      </Text>
      {error && <Text style={{ color: colors.red600, marginBottom: spacing.md }}>{error}</Text>}
      {success && <Text style={{ color: colors.teal600, marginBottom: spacing.md }}>Password updated.</Text>}
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password-new"
      />
      <View style={{ height: spacing.lg }} />
      <Button title="Save password" onPress={handleSave} loading={loading} />
    </Screen>
  );
}
