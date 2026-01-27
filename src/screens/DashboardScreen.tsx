import React from "react";
import { View, Text, ScrollView } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { ProgressRing } from "../components/ProgressRing";
import { theme } from "../theme";
import Pill from "../components/Pill";
import PrimaryButton from "../components/PrimaryButton";
import { sample } from "../data/sample";

export default function DashboardScreen() {
  const d = sample.dashboard;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: theme.space.lg, paddingTop: theme.space.xl, paddingBottom: theme.space.md }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: theme.colors.text }}>
            Good Morning, {sample.user.name}
          </Text>
          <Text style={{ marginTop: 6, fontSize: 13, color: theme.colors.muted }}>{sample.user.dateLabel}</Text>
        </View>

        <View style={{ paddingHorizontal: theme.space.lg }}>
          <Card style={{ alignItems: "center", paddingVertical: 18 }}>
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <ProgressRing size={164} stroke={14} progress={d.score / 100} progressColor={theme.colors.accent} />
              <View style={{ position: "absolute", alignItems: "center" }}>
                <Text style={{ fontSize: 44, fontWeight: "900", color: theme.colors.text }}>{d.score}</Text>
                <Text style={{ marginTop: 2, fontSize: 12, fontWeight: "800", color: theme.colors.muted }}>
                  Daily Balance
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pill label="Finance" tint="rgba(34,197,94,0.12)" textColor={theme.colors.green} />
              <Pill label="Habits" tint="rgba(124,92,255,0.12)" textColor={theme.colors.purple} />
              <Pill label="Train" tint="rgba(255,122,61,0.12)" textColor={theme.colors.orange} />
              <Pill label="Nutrition" tint="rgba(30,202,211,0.12)" textColor={theme.colors.teal} />
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: theme.space.lg, marginTop: theme.space.md, gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Card style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: theme.colors.muted }}>Today's Spend</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: theme.colors.text, marginTop: 8 }}>
                ${d.spendToday}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>${d.budgetLeft} left</Text>
            </Card>

            <Card style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: theme.colors.muted }}>Habits</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: theme.colors.text, marginTop: 8 }}>
                {d.habitsDone} / {d.habitsTotal}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>Completed</Text>
            </Card>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Card style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: theme.colors.muted }}>Next Workout</Text>
              <Text style={{ fontSize: 16, fontWeight: "900", color: theme.colors.text, marginTop: 8 }}>
                {d.nextWorkout}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>Session</Text>
            </Card>

            <Card style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: theme.colors.muted }}>Nutrition</Text>
              <Text style={{ fontSize: 16, fontWeight: "900", color: theme.colors.text, marginTop: 8 }}>
                {d.caloriesLeft} Cal
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>Left today</Text>
            </Card>
          </View>
        </View>

        <View style={{ paddingHorizontal: theme.space.lg, marginTop: theme.space.md }}>
          <Card>
            <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.text }}>Upcoming</Text>
            <View style={{ marginTop: 10, gap: 12 }}>
              {d.upcoming.map((u, idx) => (
                <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: theme.colors.muted }}>{u.time}</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.text }}>{u.title}</Text>
                </View>
              ))}
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: theme.space.lg, marginTop: theme.space.md }}>
          <Card>
            <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.text }}>Insight</Text>
            <Text style={{ marginTop: 8, fontSize: 13, color: theme.colors.muted }}>{d.insight.title}</Text>
            <PrimaryButton label={d.insight.cta} style={{ marginTop: 14 }} icon="add" />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
