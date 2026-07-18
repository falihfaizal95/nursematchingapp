import { Stack, useNavigation } from "expo-router";
import { Pressable } from "react-native";
import { Menu } from "lucide-react-native";
import { colors } from "@/lib/theme";

function MenuButton() {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => (navigation.getParent() ?? navigation).dispatch({ type: "OPEN_DRAWER" })}
      hitSlop={10}
      style={{ marginLeft: 4 }}
    >
      <Menu size={22} color={colors.stone700} />
    </Pressable>
  );
}

export default function PatientsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { color: colors.stone900 },
        contentStyle: { backgroundColor: colors.stone50 },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Patients", headerLeft: () => <MenuButton /> }} />
      <Stack.Screen name="new" options={{ title: "Add patient", presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: "Patient" }} />
    </Stack>
  );
}
