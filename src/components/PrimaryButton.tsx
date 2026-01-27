import React from "react";
import { Pressable, Text, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";

export default function PrimaryButton({
  label,
  onPress,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} style={[{ borderRadius: theme.radius.card, overflow: "hidden" }, style]}>
      <LinearGradient colors={["#2E6BFF", "#1ECAD3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Pressable
          onPress={onPress}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
          }}
        >
          {icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{label}</Text>
        </Pressable>
      </LinearGradient>
    </Pressable>
  );
}
