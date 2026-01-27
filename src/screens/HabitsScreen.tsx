import React from "react";
import { View, Text, ScrollView } from "react-native";
import Screen from "../components/Screen";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import { theme } from "../theme";
import PrimaryButton from "../components/PrimaryButton";
import { sample } from "../data/sample";
import { Ionicons } from "@expo/vector-icons";

function statusDot(state: string) {
  if (state === "done") return { bg: "rgba(34,197,94,0.12)", icon: "checkmark" as const, color: theme.colors.green };
  if (state === "missed") return { bg: "rgba(239,68,68,0.12)", icon: "close" as const, color: theme.colors.red };
  if (state === "progress") return { bg: "rgba(46,107,255,0.12)", icon: "water" as const, color: theme.colors.accent };
  return { bg: "rgba(124,92,255,0.12)", icon: "time" as const, color: theme.colors.purple };
}

export default function HabitsScreen() {
  const h = sample.habits;
  return (
    <Screen>
      <TopBar title="Habits" rightIcon="notifications-outline" />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: theme.space.lg }}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.text }}>Today</Text>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.muted} />
            </View>

            <View
              style={{
                marginTop: 12,
                backgroundColor: "rgba(30,202,211,0.12)",
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: theme.radius.pill,
                borderWidth: 1,
                borderColor: "rgba(30,202,211,0.15)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.accent }}>
                {h.completed} / {h.total}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: theme.colors.muted }}>
                Completed • {h.streak} Day Streak
              </Text>
            </View>

            <View style={{ marginTop: 14, gap: 10 }}>
              {h.items.map((it, idx) => {
                const st = statusDot(it.state);
                return (
                  <View
                    key={idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: theme.colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        backgroundColor: st.bg,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Ionicons name={st.icon} size={16} color={st.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: theme.colors.text }}>{it.title}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>{it.right}</Text>
                    </View>
                    {it.state === "done" ? (
                      <Text style={{ fontSize: 12, fontWeight: "900", color: theme.colors.green }}>Done</Text>
                    ) : it.state === "missed" ? (
                      <Text style={{ fontSize: 12, fontWeight: "900", color: theme.colors.red }}>Missed</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Card>

          <View style={{ marginTop: 12 }}>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.text }}>Weekly Progress</Text>
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.muted} />
              </View>

              <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between" }}>
                {["S","M","T","W","T","F","S"].map((d, i) => {
                  const done = h.weekly[i] === 1;
                  return (
                    <View key={i} style={{ alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 12, color: theme.colors.muted, fontWeight: "700" }}>{d}</Text>
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 8,
                          backgroundColor: done ? "rgba(46,107,255,0.18)" : "rgba(10,18,35,0.06)",
                          borderWidth: 1,
                          borderColor: done ? "rgba(46,107,255,0.25)" : theme.colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {done ? <Ionicons name="checkmark" size={14} color={theme.colors.accent} /> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>

          <PrimaryButton label="Add Habit" icon="add" style={{ marginTop: 12 }} />
        </View>
      </ScrollView>
    </Screen>
  );
}
