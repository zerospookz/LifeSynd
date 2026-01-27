export const sample = {
  user: { name: "Alex", dateLabel: "Today, May 5" },
  dashboard: {
    score: 82,
    spendToday: 45,
    budgetLeft: 100,
    habitsDone: 4,
    habitsTotal: 5,
    nextWorkout: "Upper Body",
    caloriesLeft: 800,
    upcoming: [
      { time: "12:00 PM", title: "Lunch: Chicken Salad" },
      { time: "5:00 PM", title: "Reading: 20 Minutes" }
    ],
    insight: { title: "Low Protein Yesterday.", cta: "Add Snack" }
  },
  finances: {
    totalBalance: 3250,
    categories: [
      { label: "Food", value: 0.45, color: "#7C5CFF" },
      { label: "Bills", value: 0.18, color: "#2E6BFF" },
      { label: "Transport", value: 0.14, color: "#1ECAD3" },
      { label: "Shopping", value: 0.13, color: "#FF7A3D" },
      { label: "Other", value: 0.10, color: "#22C55E" }
    ],
    transactions: [
      { merchant: "Starbucks", amount: 6.50, icon: "cafe" },
      { merchant: "Uber", amount: 18.00, icon: "car" },
      { merchant: "Amazon", amount: 50.00, icon: "cart" }
    ]
  },
  habits: {
    completed: 4,
    total: 5,
    streak: 7,
    items: [
      { title: "Morning Walk", right: "Done", state: "done" },
      { title: "Read 20 Pages", right: "Due 5:00 PM", state: "pending" },
      { title: "Drink Water", right: "6 / 8 Cups", state: "progress" },
      { title: "Meditation", right: "Missed", state: "missed" }
    ],
    weekly: [1,1,1,1,1,1,0] // Sun..Sat
  },
  workout: {
    plan: "Strength Building",
    session: "Upper Body Workout • Week 4 • Day 2",
    exercise: { name: "Bench Press", weight: 105, unit: "lbs", sets: [
      { w: 100, r: 8, done: true },
      { w: 105, r: 8, done: true },
      { w: 105, r: 8, done: false }
    ]}
  },
  nutrition: {
    cal: { current: 1200, target: 1800 },
    macros: [
      { label: "P", current: 105, target: 150, color: "#2E6BFF" },
      { label: "C", current: 140, target: 200, color: "#7C5CFF" },
      { label: "F", current: 40, target: 60, color: "#FF7A3D" }
    ],
    meals: [
      { name: "Breakfast", desc: "Oatmeal & Berries", cal: 320 },
      { name: "Lunch", desc: "Grilled Chicken & Quinoa", cal: 450 },
      { name: "Dinner", desc: "Planned: Salmon & Veggies", cal: 550 }
    ],
    water: { current: 4, target: 8 }
  }
};
