
const hour = new Date().getHours();
const mode = hour < 12 ? "morning" : "evening";

document.addEventListener("DOMContentLoaded", () => {
  const title = document.getElementById("dashMode");
  const hint = document.getElementById("dashHint");

  if (mode === "morning") {
    title.textContent = "Good Morning ☀️";
    hint.textContent = "Focus on habits and your planned workout.";
  } else {
    title.textContent = "Good Evening 🌙";
    hint.textContent = "Wrap up habits and review today's progress.";
  }
});
