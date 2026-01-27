import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import Screen from "../components/Screen";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import { theme } from "../theme";
import PrimaryButton from "../components/PrimaryButton";
import { sample } from "../data/sample";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function WorkoutsScreen() {
  const w = sample.workout;

  return (
    <Screen>
      <View style={{ backgroundColor: "#1E4ED8" }}>
        <TopBar title="Workouts" rightIcon="person-circle-outline" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: theme.space.lg, marginTop: 4 }}>
          <View
            style={{
              backgroundColor: "rgba(30,78,216,0.16)",
              borderRadius: theme.radius.card,
              padding: 14,
              borderWidth: 1,
              borderColor: "rgba(30,78,216,0.18)",
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "800", color: "rgba(10,18,35,0.65)" }}>
              Training Plan: {w.plan}
            </Text>
          </View>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <LinearGradient colors={["#2563EB", "#1ECAD3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "rgba(255,255,255,0.85)" }}>
                  Today's Session
                </Text>
                <Text style={{ marginTop: 8, fontSize: 16, fontWeight: "900", color: "#fff" }}>
                  {w.session}
                </Text>
              </View>
            </LinearGradient>

            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: theme.colors.muted }}>Active Workout</Text>

              <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: "rgba(255,122,61,0.16)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="barbell" size={20} color={theme.colors.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: theme.colors.text }}>
                    {w.exercise.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
                    {w.exercise.weight} {w.exercise.unit} • {w.exercise.sets.length} sets planned
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: theme.radius.pill,
                    backgroundColor: "rgba(34,197,94,0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(34,197,94,0.18)",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "900", color: theme.colors.green }}>Start</Text>
                </View>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                {w.exercise.sets.map((s, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: theme.radius.soft,
                      backgroundColor: theme.colors.surface2,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: theme.colors.text }}>
                      {s.w} {w.exercise.unit}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: theme.colors.muted }}>{s.r} reps</Text>
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 7,
                        backgroundColor: s.done ? "rgba(34,197,94,0.15)" : "rgba(10,18,35,0.08)",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: s.done ? "rgba(34,197,94,0.22)" : theme.colors.border,
                      }}
                    >
                      {s.done ? <Ionicons name="checkmark" size={12} color={theme.colors.green} /> : null}
                    </View>
                  </View>
                ))}
              </View>

              <PrimaryButton label="Start Workout" style={{ marginTop: 14 }} icon="play" />
            </View>
          </Card>

          <View style={{ marginTop: 12 }}>
            <Card>
              <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.text }}>Personal Bests</Text>
              <View style={{ marginTop: 10, gap: 10 }}>
                <Row icon="fitness" title="Bench Press" right="180 lbs" />
                <Row icon="barbell" title="Squat" right="220 lbs" />
              </View>
            </Card>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, title, right }: { icon: any; title: string; right: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Ionicons name={icon} size={18} color={theme.colors.text} />
        <Text style={{ fontSize: 13, fontWeight: "800", color: theme.colors.text }}>{title}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: "900", color: theme.colors.muted }}>{right}</Text>
    </View>
  );
}
