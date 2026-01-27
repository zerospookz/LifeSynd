import React from "react";
import { View, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";

export default function Screen({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={["#F7FAFF", "#F5F7FB"]}
        style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
      />
      {children}
    </View>
  );
}
