/* LifeSync Workouts (Workouts page)
 * - Structured sessions (workouts/exercises/sets)
 * - Weekly planner integration (uses planner.js keys)
 * - Rest timer
 * - PRs + history
 * - Backwards compatible with legacy flat set log (localStorage: workoutData)
 */

(function () {
  // -------------------- Storage keys --------------------
  const LEGACY_KEY = "workoutData";          // array<{ex,sets,reps,weight,date}>
  const W_KEY = "workoutsV2";               // array<Workout>
  const EX_KEY = "workoutExercisesV2";      // array<Exercise>
  const SET_KEY = "workoutSetsV2";          // array<ExerciseSet>
  const TIMER_KEY = "workoutRestTimerV2";   // Rest timer state
  const TPL_KEY = "workoutTemplates";       // planner.js uses this key (object)
  const PLAN_KEY = "plannedWorkouts";       // planner.js uses this key (object)

  // -------------------- Helpers --------------------
  function jget(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || ""); }
    catch { return fallback; }
  }
  function jset(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function nowIso() { return new Date().toISOString(); }
  function isoDate(d = new Date()) { return d.toISOString().slice(0, 10); }
  function uuid() {
    try {
      if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    } catch {}
    return "id-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
  }
  function clamp(n, min, max) {
    n = Number(n);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  // -------------------- State --------------------
  let legacyLog = jget(LEGACY_KEY, []);
  let workouts = jget(W_KEY, []);
  let exercises = jget(EX_KEY, []);
  let sets = jget(SET_KEY, []);
  let restTimer = jget(TIMER_KEY, { running: false, remainingSec: 0 });

  function saveAll() {
    jset(LEGACY_KEY, legacyLog);
    jset(W_KEY, workouts);
    jset(EX_KEY, exercises);
    jset(SET_KEY, sets);
    jset(TIMER_KEY, restTimer);
  }

  // -------------------- Core CRUD API --------------------
  function createWorkout(input = {}) {
    const w = {
      id: uuid(),
      name: String(input.name || "Workout").trim(),
      date: input.date || isoDate(),
      status: "planned",
      notes: input.notes || "",
      templateId: input.templateId,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    workouts.unshift(w);
    saveAll();
    return w;
  }

  function updateWorkout(id, patch = {}) {
    const w = workouts.find(x => x.id === id);
    if (!w) throw new Error("Workout not found");
    Object.assign(w, patch);
    w.updatedAt = nowIso();
    saveAll();
    return w;
  }

  function deleteWorkout(id) {
    workouts = workouts.filter(w => w.id !== id);
    const exIds = exercises.filter(e => e.workoutId === id).map(e => e.id);
    exercises = exercises.filter(e => e.workoutId !== id);
    sets = sets.filter(s => !exIds.includes(s.exerciseId));
    saveAll();
  }

  function getWorkout(id) { return workouts.find(w => w.id === id) || null; }

  function listWorkouts(range) {
    if (!range) return workouts.slice();
    const { from, to } = range;
    return workouts.filter(w => w.date >= from && w.date <= to);
  }

  function listExercises(workoutId) {
    return exercises
      .filter(e => e.workoutId === workoutId)
      .slice()
      .sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function listSets(exerciseId) {
    return sets
      .filter(s => s.exerciseId === exerciseId)
      .slice()
      .sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  }


  function addExercise(workoutId, input = {}) {
    if (!getWorkout(workoutId)) throw new Error("Workout not found");
    const order = (typeof input.order === "number")
      ? input.order
      : exercises.filter(e => e.workoutId === workoutId).length;

    const ex = {
      id: uuid(),
      workoutId,
      name: String(input.name || "Exercise").trim(),
      order,
      notes: input.notes || ""
    };
    exercises.push(ex);
    saveAll();
    return ex;
  }

  function updateExercise(id, patch = {}) {
    const e = exercises.find(x => x.id === id);
    if (!e) throw new Error("Exercise not found");
    Object.assign(e, patch);
    saveAll();
    return e;
  }

  function removeExercise(id) {
    exercises = exercises.filter(e => e.id !== id);
    sets = sets.filter(s => s.exerciseId !== id);
    saveAll();
  }

  function reorderExercises(workoutId, orderedIds) {
    const map = new Map(orderedIds.map((id, idx) => [id, idx]));
    exercises.forEach(e => {
      if (e.workoutId === workoutId && map.has(e.id)) e.order = map.get(e.id);
    });
    saveAll();
  }

  function addSet(exerciseId, input = {}) {
    if (!exercises.find(x => x.id === exerciseId)) throw new Error("Exercise not found");
    const order = sets.filter(s => s.exerciseId === exerciseId).length;
    const s = {
      id: uuid(),
      exerciseId,
      order,
      kind: input.kind || "work",
      targetReps: input.targetReps,
      targetWeightKg: input.targetWeightKg,
      reps: input.reps,
      weightKg: input.weightKg,
      rpe: input.rpe,
      restSec: (input.restSec ?? 90),
      completed: !!input.completed
    };
    sets.push(s);
    saveAll();
    return s;
  }

  function updateSet(id, patch = {}) {
    const s = sets.find(x => x.id === id);
    if (!s) throw new Error("Set not found");
    Object.assign(s, patch);
    saveAll();
    return s;
  }

  function removeSet(id) {
    sets = sets.filter(s => s.id !== id);
    saveAll();
  }

  function reorderSets(exerciseId, orderedIds) {
    const map = new Map(orderedIds.map((id, idx) => [id, idx]));
    sets.forEach(s => {
      if (s.exerciseId === exerciseId && map.has(s.id)) s.order = map.get(s.id);
    });
    saveAll();
  }

  // -------------------- Workflow --------------------
  function startWorkout(workoutId) {
    return updateWorkout(workoutId, { status: "in_progress", startedAt: nowIso() });
  }
  function finishWorkout(workoutId) {
    return updateWorkout(workoutId, { status: "completed", finishedAt: nowIso() });
  }
  function skipWorkout(workoutId, reason) {
    const w = getWorkout(workoutId);
    if (!w) throw new Error("Workout not found");
    const notes = (w.notes || "").trim();
    const extra = reason ? `Skipped: ${reason}` : "Skipped";
    return updateWorkout(workoutId, { status: "skipped", notes: (notes ? notes + "\n" : "") + extra });
  }
  function duplicateWorkout(workoutId, opts = {}) {
    const src = getWorkout(workoutId);
    if (!src) throw new Error("Workout not found");
    const newW = createWorkout({
      name: src.name,
      date: opts.date || isoDate(),
      templateId: src.templateId,
      notes: src.notes || ""
    });

    const srcExercises = exercises
      .filter(e => e.workoutId === src.id)
      .sort((a, b) => a.order - b.order);

    const exMap = new Map();
    srcExercises.forEach(e => {
      const ne = addExercise(newW.id, { name: e.name, order: e.order, notes: e.notes || "" });
      exMap.set(e.id, ne.id);
    });

    srcExercises.forEach(e => {
      const srcSets = sets.filter(s => s.exerciseId === e.id).sort((a, b) => a.order - b.order);
      srcSets.forEach(s => {
        addSet(exMap.get(e.id), {
          kind: s.kind,
          targetReps: s.targetReps,
          targetWeightKg: s.targetWeightKg,
          restSec: (s.restSec ?? 90),
          completed: false
        });
      });
    });

    return newW;
  }

  // -------------------- Quick actions --------------------
  function toggleSetCompleted(setId, completed) {
    const s = sets.find(x => x.id === setId);
    if (!s) throw new Error("Set not found");
    s.completed = (typeof completed === "boolean") ? completed : !s.completed;
    saveAll();
    if (s.completed && (s.restSec || 0) > 0) startRestTimer(s.restSec);
    return s;
  }

  function addSets(exerciseId, count, defaults = {}) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(addSet(exerciseId, defaults));
    return out;
  }

  function clonePreviousSet(exerciseId) {
    const prev = sets.filter(s => s.exerciseId === exerciseId).sort((a, b) => b.order - a.order)[0];
    if (!prev) return addSet(exerciseId, {});
    return addSet(exerciseId, {
      kind: prev.kind,
      targetReps: (prev.reps ?? prev.targetReps),
      targetWeightKg: (prev.weightKg ?? prev.targetWeightKg),
      restSec: (prev.restSec ?? 90)
    });
  }

  function nudgeSet(setId, delta = {}) {
    const s = sets.find(x => x.id === setId);
    if (!s) throw new Error("Set not found");
    if (delta.weightKg) s.weightKg = (Number(s.weightKg || 0) + Number(delta.weightKg));
    if (delta.reps) s.reps = (Number(s.reps || 0) + Number(delta.reps));
    saveAll();
    return s;
  }

  function computeWorkoutSummary(workoutId) {
    const exs = exercises.filter(e => e.workoutId === workoutId);
    const setList = exs.flatMap(e => sets.filter(s => s.exerciseId === e.id));
    const totalSets = setList.length;
    const completedSets = setList.filter(s => s.completed).length;

    let totalReps = 0;
    let totalVolumeKg = 0;
    setList.forEach(s => {
      const reps = Number(s.reps || 0);
      const weight = Number(s.weightKg || 0);
      totalReps += reps;
      totalVolumeKg += reps * weight;
    });

    const w = getWorkout(workoutId);
    let durationSec;
    if (w?.startedAt && w?.finishedAt) {
      durationSec = Math.max(0, Math.floor((new Date(w.finishedAt) - new Date(w.startedAt)) / 1000));
    }

    const prs = [];
    exs.forEach(e => {
      const maxW = Math.max(0, ...sets.filter(s => s.exerciseId === e.id).map(s => Number(s.weightKg || 0)));
      if (maxW > 0) prs.push({ exerciseName: e.name, type: "weight", value: maxW });
    });

    return { totalSets, completedSets, totalReps, totalVolumeKg, durationSec, prs };
  }

  function getExerciseHistory(exerciseName, limit = 30) {
    const name = String(exerciseName || "").trim().toLowerCase();
    const points = [];

    workouts
      .filter(w => w.status === "completed")
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach(w => {
        const exs = exercises.filter(e => e.workoutId === w.id && e.name.trim().toLowerCase() === name);
        if (!exs.length) return;

        const setList = exs.flatMap(e => sets.filter(s => s.exerciseId === e.id));
        const topSetWeightKg = Math.max(0, ...setList.map(s => Number(s.weightKg || 0)));
        const topSetReps = Math.max(0, ...setList.map(s => Number(s.reps || 0)));
        const totalVolumeKg = setList.reduce((acc, s) => acc + Number(s.weightKg || 0) * Number(s.reps || 0), 0);

        points.push({ date: w.date, topSetWeightKg, topSetReps, totalVolumeKg });
      });

    return points.slice(0, limit);
  }

  function getExercisePRs(exerciseName) {
    const hist = getExerciseHistory(exerciseName, 5000);
    const maxWeightKg = hist.reduce((m, p) => Math.max(m, Number(p.topSetWeightKg || 0)), 0) || undefined;
    const maxVolumeKg = hist.reduce((m, p) => Math.max(m, Number(p.totalVolumeKg || 0)), 0) || undefined;
    return { maxWeightKg, maxVolumeKg };
  }

  function validateWorkout(workoutId) {
    const w = getWorkout(workoutId);
    if (!w) return { ok: false, errors: ["Workout not found"] };
    const exs = exercises.filter(e => e.workoutId === workoutId);
    const errs = [];
    if (!w.name) errs.push("Missing workout name");
    if (!w.date) errs.push("Missing date");
    if (exs.some(e => !e.name)) errs.push("One or more exercises missing name");
    return errs.length ? { ok: false, errors: errs } : { ok: true };
  }

  function canFinishWorkout(workoutId) {
    const exs = exercises.filter(e => e.workoutId === workoutId);
    const setList = exs.flatMap(e => sets.filter(s => s.exerciseId === e.id));
    const missing = [];
    if (setList.some(s => s.completed && (s.reps == null || s.weightKg == null))) {
      missing.push("Some completed sets are missing reps/weight");
    }
    return { canFinish: missing.length === 0, missing };
  }

  // -------------------- Templates (planner.js compatible) --------------------
  function listTemplates() {
    const t = jget(TPL_KEY, {});
    return Object.keys(t).sort().map(k => ({
      id: k,
      name: t[k].name || k,
      exercises: (t[k].exercises || []).slice()
    }));
  }

  function createWorkoutFromTemplate(templateId, date) {
    const all = jget(TPL_KEY, {});
    const tpl = all[templateId];
    if (!tpl) throw new Error("Template not found");

    const w = createWorkout({ name: tpl.name || templateId, date: date || isoDate(), templateId });
    (tpl.exercises || []).forEach((exName, idx) => {
      const ex = addExercise(w.id, { name: exName, order: idx });
      addSets(ex.id, 3, { kind: "work", restSec: 90, completed: false });
    });
    return w;
  }

  function createTemplateFromWorkout(workoutId, name) {
    const w = getWorkout(workoutId);
    if (!w) throw new Error("Workout not found");

    const exs = exercises.filter(e => e.workoutId === workoutId).sort((a, b) => a.order - b.order);
    const tplName = String(name || w.name || "Template").trim();

    const all = jget(TPL_KEY, {});
    all[tplName] = { name: tplName, exercises: exs.map(e => e.name) };
    jset(TPL_KEY, all);

    return { id: tplName, name: tplName, exercises: exs.map(e => ({ name: e.name, sets: [] })) };
  }

  function deleteTemplate(templateId) {
    const all = jget(TPL_KEY, {});
    delete all[templateId];
    jset(TPL_KEY, all);
  }

  // -------------------- Rest timer --------------------
  function startRestTimer(seconds) {
    const sec = clamp(seconds, 0, 60 * 60);
    const end = new Date(Date.now() + sec * 1000).toISOString();
    restTimer = { running: true, endAt: end, remainingSec: sec };
    saveAll();
    renderRestTimer();
    return restTimer;
  }

  function stopRestTimer() {
    restTimer = { running: false, remainingSec: 0 };
    saveAll();
    renderRestTimer();
    return restTimer;
  }

  function tickRestTimer(nowIsoStr) {
    if (!restTimer.running || !restTimer.endAt) return restTimer;
    const now = nowIsoStr ? new Date(nowIsoStr) : new Date();
    const end = new Date(restTimer.endAt);
    const remaining = Math.max(0, Math.round((end - now) / 1000));
    restTimer.remainingSec = remaining;
    if (remaining <= 0) {
      restTimer.running = false;
      restTimer.endAt = undefined;
      if (typeof showToast === "function") showToast("Rest done");
    }
    saveAll();
    renderRestTimer();
    return restTimer;
  }

  // -------------------- Import/Export --------------------
  function exportWorkoutsToJSON(range) {
    const ws = listWorkouts(range);
    const wIds = new Set(ws.map(w => w.id));
    const ex = exercises.filter(e => wIds.has(e.workoutId));
    const exIds = new Set(ex.map(e => e.id));
    const ss = sets.filter(s => exIds.has(s.exerciseId));
    return JSON.stringify({ version: 2, workouts: ws, exercises: ex, sets: ss, legacyLog }, null, 2);
  }

  function importWorkoutsFromJSON(json, opts = {}) {
    const merge = (opts.merge !== false);
    const parsed = JSON.parse(json);
    if (!parsed || (parsed.version !== 2 && !parsed.workouts)) throw new Error("Unsupported format");

    const inW = parsed.workouts || [];
    const inE = parsed.exercises || [];
    const inS = parsed.sets || [];
    const inLegacy = parsed.legacyLog || [];

    let imported = 0, skipped = 0;

    if (!merge) {
      workouts = inW.slice();
      exercises = inE.slice();
      sets = inS.slice();
      legacyLog = inLegacy.slice();
      saveAll();
      return { imported: inW.length, skipped: 0 };
    }

    const haveW = new Set(workouts.map(w => w.id));
    inW.forEach(w => { if (haveW.has(w.id)) skipped++; else { workouts.push(w); imported++; } });

    const haveE = new Set(exercises.map(e => e.id));
    inE.forEach(e => { if (haveE.has(e.id)) skipped++; else { exercises.push(e); imported++; } });

    const haveS = new Set(sets.map(s => s.id));
    inS.forEach(s => { if (haveS.has(s.id)) skipped++; else { sets.push(s); imported++; } });

    const sig = x => `${x.date}|${x.ex}|${x.sets}|${x.reps}|${x.weight}`;
    const haveL = new Set(legacyLog.map(sig));
    inLegacy.forEach(l => { if (haveL.has(sig(l))) skipped++; else { legacyLog.push(l); imported++; } });

    saveAll();
    return { imported, skipped };
  }

  // -------------------- Legacy log + PR box --------------------
  function legacyLogSet() {
    const exEl = document.getElementById("ex");
    const setsEl = document.getElementById("sets");
    const repsEl = document.getElementById("reps");
    const weightEl = document.getElementById("weight");
    if (!exEl || !setsEl || !repsEl || !weightEl) return;

    if (!exEl.value || !setsEl.value || !repsEl.value) return;

    const entry = {
      ex: exEl.value.trim(),
      sets: +setsEl.value,
      reps: +repsEl.value,
      weight: +weightEl.value || 0,
      date: isoDate()
    };

    legacyLog.unshift(entry);

    // Attach to today's active workout if any
    const today = isoDate();
    const w = workouts.find(x => x.date === today && x.status === "in_progress");
    if (w) {
      let e = exercises.find(x =>
        x.workoutId === w.id && x.name.trim().toLowerCase() === entry.ex.toLowerCase()
      );
      if (!e) e = addExercise(w.id, { name: entry.ex });
      addSet(e.id, { kind: "work", reps: entry.reps, weightKg: entry.weight, completed: true });
    }

    saveAll();
    render();
    if (typeof showToast === "function") showToast("Set logged");

    exEl.value = "";
    setsEl.value = "";
    repsEl.value = "";
    weightEl.value = "";
  }

  // -------------------- Minimal UI enhancements --------------------
  function ensureEnhancements() {
    const main = document.querySelector("main.content");
    if (!main) return;
    if (document.getElementById("todayWorkoutCard")) return;

    const topbar = main.querySelector(".topbar");
    const anchor = topbar ? topbar.nextElementSibling : null;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div id="todayWorkoutCard" class="card soft" style="margin-top:18px">
        <div class="cardHeader">
          <h3 class="cardTitle">Today's workout</h3>
          <span class="badge" id="todayWorkoutBadge">Plan</span>
        </div>
        <div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div id="todayWorkoutLine" class="small">Loading…</div>
            <div id="todayWorkoutMeta" class="small" style="opacity:.8;margin-top:6px"></div>
          </div>
          <div class="actionsRow" style="margin:0">
            <button id="btnCreateFromPlan">Create</button>
            <button id="btnStartWorkout" class="secondary">Start</button>
            <button id="btnFinishWorkout" class="secondary">Finish</button>
          </div>
        </div>
        <div class="hr"></div>
        <div id="restTimerBar" class="row" style="justify-content:space-between;align-items:center">
          <div><strong>Rest timer</strong> <span id="restTimerText" class="small" style="margin-left:8px">Off</span></div>
          <div class="actionsRow" style="margin:0">
            <button id="btnRest60" class="secondary">60s</button>
            <button id="btnRest90" class="secondary">90s</button>
            <button id="btnRestStop" class="secondary">Stop</button>
          </div>
        </div>
      </div>
    `;

    const card = wrap.firstElementChild;
    if (anchor) main.insertBefore(card, anchor);
    else main.insertBefore(card, main.firstChild);

    document.getElementById("btnCreateFromPlan").onclick = () => {
      const plan = jget(PLAN_KEY, {});
      const today = isoDate();
      const tpl = plan[today]?.template;
      if (!tpl) { showToast?.("No template planned today"); return; }
      createWorkoutFromTemplate(tpl, today);
      showToast?.("Workout created");
      render();
    };

    document.getElementById("btnStartWorkout").onclick = () => {
      const today = isoDate();
      let w = workouts.find(x => x.date === today && (x.status === "planned" || x.status === "in_progress"));
      if (!w) {
        const plan = jget(PLAN_KEY, {});
        const tpl = plan[today]?.template;
        w = tpl ? createWorkoutFromTemplate(tpl, today) : createWorkout({ name: "Workout", date: today });
      }
      startWorkout(w.id);
      showToast?.("Workout started");
      render();
    };

    document.getElementById("btnFinishWorkout").onclick = () => {
      const today = isoDate();
      const w = workouts.find(x => x.date === today && x.status === "in_progress");
      if (!w) { showToast?.("No workout in progress"); return; }
      const gate = canFinishWorkout(w.id);
      if (!gate.canFinish) {
        alert("Can't finish yet:\n" + gate.missing.join("\n"));
        return;
      }
      finishWorkout(w.id);
      showToast?.("Workout completed");
      render();
    };

    document.getElementById("btnRest60").onclick = () => startRestTimer(60);
    document.getElementById("btnRest90").onclick = () => startRestTimer(90);
    document.getElementById("btnRestStop").onclick = () => stopRestTimer();
  }

  function renderRestTimer() {
    const el = document.getElementById("restTimerText");
    if (!el) return;
    if (!restTimer.running) { el.textContent = "Off"; return; }
    const s = Math.max(0, restTimer.remainingSec | 0);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    el.textContent = `${mm}:${ss}`;
  }

  function renderActiveWorkout() {
    const box = document.getElementById("workoutList");
    if (!box) return;

    const today = isoDate();
    const active = workouts.find(w => w.date === today && w.status === "in_progress");
    const planned = workouts.find(w => w.date === today && w.status === "planned");

    const badge = document.getElementById("todayWorkoutBadge");
    const line = document.getElementById("todayWorkoutLine");
    const meta = document.getElementById("todayWorkoutMeta");

    const plan = jget(PLAN_KEY, {});
    const tplName = plan[today]?.template;
    const done = plan[today]?.done;

    if (line) {
      if (tplName) line.innerHTML = `Planned: <strong>${tplName}</strong> ${done ? '<span class="badge ok" style="margin-left:8px">Done</span>' : ""}`;
      else line.textContent = "No template planned today (use Weekly Planner below).";
    }
    if (meta) {
      if (active) meta.innerHTML = `Status: <strong>In progress</strong> • Started: ${active.startedAt ? new Date(active.startedAt).toLocaleTimeString() : "—"}`;
      else if (planned) meta.innerHTML = `Status: <strong>Planned</strong>`;
      else meta.innerHTML = `Status: <strong>—</strong>`;
    }
    if (badge) {
      badge.textContent = active ? "In progress" : (tplName ? "Planned" : "Free");
      badge.className = "badge" + (active ? " warn" : "");
    }

    if (!active) return;

    const exs = exercises
      .filter(e => e.workoutId === active.id)
      .sort((a, b) => a.order - b.order);

    const summary = computeWorkoutSummary(active.id);
    const summaryHtml = `
      <div class="card soft" style="margin-top:12px">
        <div class="row" style="justify-content:space-between;align-items:center">
          <strong>${active.name}</strong>
          <span class="badge">${summary.completedSets}/${summary.totalSets} sets</span>
        </div>
        <div class="small" style="margin-top:8px">Volume: <strong>${Math.round(summary.totalVolumeKg)}</strong> kg • Reps: <strong>${summary.totalReps}</strong></div>
      </div>
    `;

    const exHtml = exs.map(e => {
      const ss = sets.filter(s => s.exerciseId === e.id).sort((a, b) => a.order - b.order);
      const rows = ss.map(s => {
        const checked = s.completed ? "checked" : "";
        const repsVal = (s.reps ?? "");
        const wVal = (s.weightKg ?? "");
        return `
          <div class="row" style="justify-content:space-between;gap:10px;align-items:center;margin-top:10px">
            <label class="row" style="gap:10px;align-items:center">
              <input type="checkbox" ${checked} onchange="Workouts.toggleSetCompleted('${s.id}', this.checked); Workouts.render()">
              <span class="small">Set ${s.order + 1}</span>
            </label>
            <div class="row" style="gap:10px;align-items:center">
              <input style="width:90px" type="number" placeholder="reps" value="${repsVal}"
                     onchange="Workouts.updateSet('${s.id}', { reps: +this.value || 0 }); Workouts.render()">
              <input style="width:110px" type="number" placeholder="kg" value="${wVal}"
                     onchange="Workouts.updateSet('${s.id}', { weightKg: +this.value || 0 }); Workouts.render()">
              <button class="secondary" onclick="Workouts.clonePreviousSet('${e.id}'); Workouts.render()">+Set</button>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="card soft" style="margin-top:12px">
          <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
            <strong>${e.name}</strong>
            <span class="badge">${ss.filter(x => x.completed).length}/${ss.length} done</span>
          </div>
          ${rows}
        </div>
      `;
    }).join("");

    // Prepend active workout section above legacy list
    box.innerHTML = summaryHtml + exHtml + box.innerHTML;
  }

  function renderLegacyPRs() {
    const prBox = document.getElementById("prBox");
    if (!prBox) return;

    const prs = {};
    legacyLog.forEach(d => { prs[d.ex] = Math.max(prs[d.ex] || 0, Number(d.weight || 0)); });

    workouts.filter(w => w.status === "completed").forEach(w => {
      exercises.filter(e => e.workoutId === w.id).forEach(e => {
        const maxW = Math.max(0, ...sets.filter(s => s.exerciseId === e.id).map(s => Number(s.weightKg || 0)));
        if (maxW > 0) prs[e.name] = Math.max(prs[e.name] || 0, maxW);
      });
    });

    const prLines = Object.entries(prs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => `<div class="row" style="justify-content:space-between"><span>${k}</span><strong>${v} kg</strong></div>`)
      .join("");

    prBox.innerHTML = `<h3>Personal Records</h3>${prLines || '<p class="empty">No PRs yet.</p>'}`;
  }

  function renderLegacyList() {
    const box = document.getElementById("workoutList");
    if (!box) return;

    if (!legacyLog.length) {
      box.innerHTML = '<p class="empty">No sets logged yet.</p>';
      return;
    }

    const items = legacyLog.slice(0, 30).map(d => `
      <div class="card">
        <strong>${d.ex}</strong><br>
        ${d.sets}×${d.reps} @ ${d.weight}kg<br>
        <span class="small">${d.date}</span>
      </div>
    `).join("");

    box.innerHTML = items;
  }

  function render() {
    legacyLog = jget(LEGACY_KEY, []);
    workouts = jget(W_KEY, []);
    exercises = jget(EX_KEY, []);
    sets = jget(SET_KEY, []);
    restTimer = jget(TIMER_KEY, { running: false, remainingSec: 0 });

    const workoutList = document.getElementById("workoutList");
    if (workoutList) workoutList.innerHTML = "";

    renderLegacyPRs();
    renderLegacyList();
    renderActiveWorkout();
    renderRestTimer();
  }

  // -------------------- Expose API to window --------------------
  window.Workouts = {
    // CRUD
    createWorkout, updateWorkout, deleteWorkout, getWorkout, listWorkouts, listExercises, listSets,
    addExercise, updateExercise, removeExercise, reorderExercises,
    addSet, updateSet, removeSet, reorderSets,

    // Flow
    startWorkout, finishWorkout, skipWorkout, duplicateWorkout,

    // Quick actions
    toggleSetCompleted, addSets, clonePreviousSet, nudgeSet,

    // Analytics
    computeWorkoutSummary, getExerciseHistory, getExercisePRs,

    // Templates
    listTemplates, createTemplateFromWorkout, createWorkoutFromTemplate, deleteTemplate,

    // Validation
    validateWorkout, canFinishWorkout,

    // Rest timer
    startRestTimer, stopRestTimer, tickRestTimer,

    // Import/Export
    exportWorkoutsToJSON, importWorkoutsFromJSON,

    // UI
    render
  };

  // matches workouts.html onclick
  window.logSet = legacyLogSet;

  // -------------------- Boot --------------------
  ensureEnhancements();
  render();

  setInterval(() => {
    if (restTimer.running) tickRestTimer();
  }, 1000);
})();
