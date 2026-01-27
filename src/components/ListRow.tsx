import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

export default function ListRow({
  icon,
  title,
  subtitle,
  right,
  iconBg = "rgba(46,107,255,0.12)",
  iconColor = theme.colors.accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  right?: string;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: theme.colors.text }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={{ fontSize: 14, fontWeight: "800", color: theme.colors.text }}>{right}</Text> : null}
    </View>
  );
}
