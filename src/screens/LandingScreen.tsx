import React from "react";
import { View, Text, StyleSheet, Image, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";

type Props = {
  navigation: any;
};

export default function LandingScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#1463FF", "#6720FF"]}
        start={{ x: 0.15, y: 0.2 }}
        end={{ x: 0.85, y: 0.9 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>LifeSync</Text>
          </View>
        </View>

        <View style={styles.logoWrap}>
          <Image source={require("../../assets/icon.png")} style={styles.logo} />
        </View>

        <Text style={styles.title}>Sync your health, habits & money.</Text>
        <Text style={styles.subtitle}>
          One modern dashboard for finances, habits, workouts, and nutrition — built to keep you consistent.
        </Text>

        <View style={styles.ctaRow}>
          <Pressable style={styles.primary} onPress={() => navigation.replace("Main")}>
            <Text style={styles.primaryText}>Enter App</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => navigation.navigate("Main")}>
            <Text style={styles.secondaryText}>Preview</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>What you get</Text>

        <View style={styles.grid}>
          <FeatureCard title="Dashboard" desc="All signals in one place: streaks, spend, workouts and macros." />
          <FeatureCard title="Finances" desc="Track budgets, income, and spend categories with clarity." />
          <FeatureCard title="Habits" desc="Daily habits with streaks, reminders, and completion history." />
          <FeatureCard title="Workouts" desc="Log sessions, volume, and PRs — stay progressive." />
          <FeatureCard title="Nutrition" desc="Simple nutrition plan + macro targets and meal guidance." />
        </View>

        <Pressable style={styles.fullCta} onPress={() => navigation.replace("Main")}>
          <Text style={styles.fullCtaText}>Get started</Text>
        </Pressable>

        <Text style={styles.footer}>© {new Date().getFullYear()} LifeSync</Text>
      </ScrollView>
    </View>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  hero: { paddingTop: 58, paddingHorizontal: 18, paddingBottom: 22 },
  heroTop: { flexDirection: "row", justifyContent: "flex-start" },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  badgeText: { color: "white", fontWeight: "800", letterSpacing: 0.4 },
  logoWrap: { alignItems: "center", marginTop: 12, marginBottom: 10 },
  logo: { width: 84, height: 84, borderRadius: 20 },
  title: { color: "white", fontSize: 26, fontWeight: "900", marginTop: 6, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.86)", fontSize: 14, lineHeight: 20, marginTop: 10, textAlign: "center" },
  ctaRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  primary: { flex: 1, backgroundColor: "white", borderRadius: 16, paddingVertical: 13, alignItems: "center" },
  primaryText: { color: "#171A22", fontWeight: "900" },
  secondary: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  secondaryText: { color: "white", fontWeight: "900" },

  content: { padding: 18, paddingBottom: 26 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: theme.colors.text, marginBottom: 10 },
  grid: { gap: 10 },
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(23,26,34,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardTitle: { fontWeight: "900", color: theme.colors.text, marginBottom: 6 },
  cardDesc: { color: theme.colors.muted, lineHeight: 19 },

  fullCta: { marginTop: 14, backgroundColor: "#171A22", borderRadius: 18, paddingVertical: 14, alignItems: "center" },
  fullCtaText: { color: "white", fontWeight: "900" },
  footer: { textAlign: "center", color: theme.colors.muted, marginTop: 14 },
});
