import React from "react";
import { View, Text, ScrollView } from "react-native";
import Screen from "../components/Screen";
import TopBar from "../components/TopBar";
import Card from "../components/Card";
import { theme } from "../theme";
import { DonutChart } from "../components/DonutChart";
import ListRow from "../components/ListRow";
import { sample } from "../data/sample";

export default function FinancesScreen() {
  const f = sample.finances;

  return (
    <Screen>
      <TopBar title="Finances" />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: theme.space.lg }}>
          <Card style={{ padding: 18 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: theme.colors.muted }}>May Overview</Text>
            <Text style={{ fontSize: 34, fontWeight: "900", color: theme.colors.text, marginTop: 10 }}>
              ${f.totalBalance.toLocaleString()}
            </Text>
            <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 4 }}>Total Balance</Text>

            <View style={{ marginTop: 14, height: 10, borderRadius: 999, backgroundColor: "rgba(46,107,255,0.12)" }}>
              <View style={{ width: "68%", height: "100%", borderRadius: 999, backgroundColor: theme.colors.accent }} />
            </View>
          </Card>

          <View style={{ marginTop: 12 }}>
            <Card>
              <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.text }}>Spending Categories</Text>
              <View style={{ alignItems: "center", marginTop: 12 }}>
                <DonutChart size={175} stroke={22} segments={f.categories.map(c => ({ value: c.value, color: c.color }))} />
                <View style={{ position: "absolute", alignItems: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: theme.colors.text }}>Food</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 3 }}>45%</Text>
                </View>
              </View>

              <View style={{ marginTop: 14, gap: 8 }}>
                {f.categories.slice(0, 4).map((c, idx) => (
                  <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
                      <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.text }}>{c.label}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: theme.colors.muted }}>
                      {Math.round(c.value * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>

          <View style={{ marginTop: 12 }}>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontWeight: "900", color: theme.colors.text }}>Recent Transactions</Text>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    backgroundColor: "rgba(46,107,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "900", color: theme.colors.accent }}>+</Text>
                </View>
              </View>

              <View style={{ marginTop: 8 }}>
                {f.transactions.map((t, idx) => (
                  <View key={idx} style={{ borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: theme.colors.border }}>
                    <ListRow
                      icon={t.icon as any}
                      title={t.merchant}
                      right={`$${t.amount.toFixed(2)}`}
                      iconBg="rgba(30,202,211,0.12)"
                      iconColor={theme.colors.teal}
                    />
                  </View>
                ))}
              </View>
            </Card>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
