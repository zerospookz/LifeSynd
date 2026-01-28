
// ===== Habits Analytics – Matrix (Clickable) =====

function habitHue(habitId) {
  let hash = 0;
  for (let i = 0; i < habitId.length; i++) {
    hash = habitId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function getLastNDates(n = 14) {
  const res = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const dt = new Date(d);
    dt.setDate(d.getDate() - i);
    res.push(dt.toISOString().slice(0, 10));
  }
  return res.reverse();
}

function toggleHabitAt(habitId, iso) {
  const h = habits.find(x => x.id === habitId);
  if (!h) return;
  h.log = h.log || {};
  h.log[iso] = !h.log[iso];
  save();
}

function renderHabitsAnalytics() {
  const container = document.getElementById("habits-analytics");
  if (!container) return;

  if (!habits || habits.length === 0) {
    container.innerHTML = "<p class='muted'>No habits yet</p>";
    return;
  }

  const dates = getLastNDates(14);

  container.innerHTML = "";
  const matrix = document.createElement("div");
  matrix.className = "habits-matrix";

  // header row
  const header = document.createElement("div");
  header.className = "matrix-row header";
  header.appendChild(document.createElement("div"));

  habits.forEach(h => {
    const col = document.createElement("div");
    col.className = "matrix-col-header";
    const hue = habitHue(h.id);
    col.style.setProperty("--habit-accent", `hsl(${hue} 70% 55%)`);
    col.textContent = h.name;
    header.appendChild(col);
  });

  matrix.appendChild(header);

  // rows
  dates.forEach(date => {
    const row = document.createElement("div");
    row.className = "matrix-row";

    const label = document.createElement("div");
    label.className = "matrix-date";
    label.textContent = date.slice(5);
    row.appendChild(label);

    habits.forEach(h => {
      const cell = document.createElement("div");
      cell.className = "matrix-cell";
      const hue = habitHue(h.id);
      cell.style.setProperty("--habit-accent", `hsl(${hue} 70% 55%)`);

      const done = h.log && h.log[date];
      if (done) cell.classList.add("done");

      cell.dataset.habitId = h.id;
      cell.dataset.date = date;

      row.appendChild(cell);
    });

    matrix.appendChild(row);
  });

  container.appendChild(matrix);

  // click delegation
  matrix.onclick = e => {
    const cell = e.target.closest(".matrix-cell");
    if (!cell) return;
    toggleHabitAt(cell.dataset.habitId, cell.dataset.date);
    renderHabitsAnalytics();
  };
}

// remove legacy buttons by not rendering them
const _origRender = render;
render = function () {
  _origRender();
  renderHabitsAnalytics();
};
