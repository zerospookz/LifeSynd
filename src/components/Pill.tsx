import React from "react";
import { View, Text } from "react-native";
import { theme } from "../theme";

export default function Pill({
  label,
  tint = "rgba(46,107,255,0.12)",
  textColor = theme.colors.accent,
}: {
  label: string;
  tint?: string;
  textColor?: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: theme.radius.pill,
        backgroundColor: tint,
        borderWidth: 1,
        borderColor: "rgba(46,107,255,0.10)",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: textColor }}>{label}</Text>
    </View>
  );
}
