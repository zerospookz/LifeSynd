import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

export default function TopBar({
  title,
  rightIcon = "ellipsis-horizontal",
  onRightPress,
  leftBack = false,
  onLeftPress,
}: {
  title: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  leftBack?: boolean;
  onLeftPress?: () => void;
}) {
  return (
    <View
      style={{
        paddingHorizontal: theme.space.lg,
        paddingTop: theme.space.xl,
        paddingBottom: theme.space.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Pressable
        onPress={onLeftPress}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: leftBack ? 1 : 0 }}
        disabled={!leftBack}
      >
        <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
      </Pressable>

      <Text style={{ fontSize: 18, fontWeight: "800", color: theme.colors.text }}>{title}</Text>

      <Pressable
        onPress={onRightPress}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name={rightIcon} size={20} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}
