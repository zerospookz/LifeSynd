import React from "react";
import { View, Text, ScrollView } from "react-native";
import Screen from "../components/Screen";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import { theme } from "../theme";
import { MacroRing } from "../components/MacroRing";
import PrimaryButton from "../components/PrimaryButton";
import { sample } from "../data/sample";
import { Ionicons } from "@expo/vector-icons";

export default function NutritionScreen() {
  const n = sample.nutrition;
  const calProgress = n.cal.current / n.cal.target;

  return (
    <Screen>
      <TopBar title="Today's Meals" rightIcon="menu" />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: theme.space.lg }}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.text }}>Today</Text>
                <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 4 }}>
                  {n.cal.current}/{n.cal.target} Cal
                </Text>
              </View>

              <MacroRing
                size={112}
                stroke={11}
                rings={[
                  { progress: calProgress, color: theme.colors.teal },
                  { progress: n.macros[0].current / n.macros[0].target, color: theme.colors.accent },
                  { progress: n.macros[1].current / n.macros[1].target, color: theme.colors.purple },
                ]}
              />
            </View>

            <View style={{ marginTop: 12, gap: 8 }}>
              {n.macros.map((m, idx) => (
                <View key={idx} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
                    <Text style={{ fontSize: 13, fontWeight: "800", color: theme.colors.text }}>
                      {m.current}g / {m.target}g {m.label}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "900", color: theme.colors.muted }}>
                    {Math.round((m.current / m.target) * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </Card>

          <View style={{ marginTop: 12, gap: 12 }}>
            {n.meals.map((m, idx) => (
              <Card key={idx}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.text }}>{m.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <Text style={{ fontSize: 13, color: theme.colors.muted, fontWeight: "700" }}>{m.desc}</Text>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: theme.colors.text }}>{m.cal} Cal</Text>
                </View>
              </Card>
            ))}
          </View>

          <View style={{ marginTop: 12 }}>
            <Card>
              <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.text }}>Water</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {Array.from({ length: n.water.target }).map((_, i) => {
                    const filled = i < n.water.current;
                    return (
                      <View
                        key={i}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 6,
                          backgroundColor: filled ? "rgba(46,107,255,0.18)" : "rgba(10,18,35,0.06)",
                          borderWidth: 1,
                          borderColor: filled ? "rgba(46,107,255,0.25)" : theme.colors.border,
                        }}
                      />
                    );
                  })}
                </View>
                <Text style={{ fontSize: 12, fontWeight: "900", color: theme.colors.muted }}>
                  {n.water.current} / {n.water.target} Cups
                </Text>
              </View>
            </Card>
          </View>

          <PrimaryButton label="Add Meal" icon="add" style={{ marginTop: 12 }} />
        </View>
      </ScrollView>
    </Screen>
  );
}
