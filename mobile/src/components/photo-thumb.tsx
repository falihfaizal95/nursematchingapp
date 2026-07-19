import { useEffect, useState } from "react";
import { Image, View, ActivityIndicator, StyleSheet } from "react-native";
import { getSignedPhotoUrl } from "@/lib/photos";
import { colors, radius } from "@/lib/theme";

export function PhotoThumb({ storagePath, size = 100 }: { storagePath: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getSignedPhotoUrl(storagePath).then((u) => {
      if (mounted) setUrl(u);
    });
    return () => {
      mounted = false;
    };
  }, [storagePath]);

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <ActivityIndicator color={colors.stone300} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.stone100,
    borderRadius: radius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
