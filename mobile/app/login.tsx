import { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Redirect } from "expo-router";
import { Heart } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { Screen, TextField, Button } from "@/components/ui";
import { colors, spacing, radius } from "@/lib/theme";

export default function LoginScreen() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Redirect href="/" />;

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError(signInError.message);
  }

  return (
    <Screen background={colors.stone50}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
          <View style={styles.logo}>
            <Heart size={26} color={colors.white} fill={colors.white} />
          </View>
          <Text style={styles.title}>Evoura Home Care</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.card}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <View style={{ height: spacing.md }} />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          <View style={{ height: spacing.lg }} />
          <Button title="Sign in" onPress={handleSignIn} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.teal600,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.stone900 },
  subtitle: { fontSize: 14, color: colors.stone500, marginTop: 2 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stone200,
    padding: spacing.lg,
  },
  errorBox: {
    backgroundColor: colors.red50,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.red700, fontSize: 13 },
});
