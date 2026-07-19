import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type ViewProps,
  type TextInputProps,
} from "react-native";
import { colors, radius, spacing } from "@/lib/theme";

export function Screen({
  children,
  style,
  background = colors.stone50,
}: ViewProps & { background?: string }) {
  return <View style={[{ flex: 1, backgroundColor: background }, style]}>{children}</View>;
}

export function Card({ children, style }: ViewProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function TextField(props: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {props.label && <Label>{props.label}</Label>}
      <TextInput
        placeholderTextColor={colors.stone400}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  icon,
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: React.ReactNode;
}) {
  const variantStyle = {
    primary: { bg: colors.teal600, fg: colors.white },
    secondary: { bg: colors.stone900, fg: colors.white },
    danger: { bg: colors.red600, fg: colors.white },
    ghost: { bg: colors.stone100, fg: colors.stone700 },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: variantStyle.bg, opacity: pressed || disabled ? 0.7 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {icon}
          <Text style={[styles.buttonText, { color: variantStyle.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.stone50 }}>
      <ActivityIndicator color={colors.teal600} size="large" />
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.stone900,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.stone600,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.stone300,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.stone900,
    backgroundColor: colors.white,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
  },
  emptyText: {
    color: colors.stone400,
    fontSize: 14,
  },
});
