import React from "react";
import { View, ViewStyle } from "react-native";
import { theme } from "../theme";

export default function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: theme.space.md,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
