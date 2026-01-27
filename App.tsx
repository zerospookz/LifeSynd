import React from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "./src/theme";

import LandingScreen from "./src/screens/LandingScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import FinancesScreen from "./src/screens/FinancesScreen";
import HabitsScreen from "./src/screens/HabitsScreen";
import WorkoutsScreen from "./src/screens/WorkoutsScreen";
import NutritionScreen from "./src/screens/NutritionScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          height: 74,
          paddingTop: 10,
          paddingBottom: 14,
          borderTopWidth: 0,
          backgroundColor: "rgba(255,255,255,0.92)",
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -6 },
          elevation: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarIcon: ({ color, size, focused }) => {
          const iconSize = focused ? size + 2 : size;
          let name: keyof typeof Ionicons.glyphMap = "grid-outline";
          switch (route.name) {
            case "Dashboard":
              name = focused ? "grid" : "grid-outline";
              break;
            case "Finances":
              name = focused ? "wallet" : "wallet-outline";
              break;
            case "Habits":
              name = focused ? "checkmark-circle" : "checkmark-circle-outline";
              break;
            case "Workouts":
              name = focused ? "barbell" : "barbell-outline";
              break;
            case "Nutrition":
              name = focused ? "restaurant" : "restaurant-outline";
              break;
          }
          return <Ionicons name={name} size={iconSize} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Finances" component={FinancesScreen} />
      <Tab.Screen name="Habits" component={HabitsScreen} />
      <Tab.Screen name="Workouts" component={WorkoutsScreen} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const prefix = Linking.createURL("/");

  const linking = {
    prefixes: [prefix],
    config: {
      screens: {
        Landing: "",
        Main: {
          screens: {
            Dashboard: "app/dashboard",
            Finances: "app/finances",
            Habits: "app/habits",
            Workouts: "app/workouts",
            Nutrition: "app/nutrition",
          },
        },
      },
    },
  };

  return (
    <NavigationContainer linking={Platform.OS === "web" ? linking : undefined}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
