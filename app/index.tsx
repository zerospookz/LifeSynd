import { Link } from "expo-router";
import { View, Text, Pressable } from "react-native";

export default function Landing() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
      <Text style={{ fontSize: 36, fontWeight: "700", marginBottom: 8 }}>LifeSync</Text>
      <Text style={{ fontSize: 16, opacity: 0.7, textAlign: "center", marginBottom: 24 }}>
        Your all-in-one system for finances, habits, workouts, and nutrition.
      </Text>
      <Link href="/app/dashboard" asChild>
        <Pressable style={{ paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, backgroundColor: "#111827" }}>
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>Enter App</Text>
        </Pressable>
      </Link>
    </View>
  );
}
