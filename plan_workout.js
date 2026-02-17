<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Plan workout</title>
<link rel="icon" href="./favicon.ico"/>
<link rel="stylesheet" href="style.css"/>
<link rel="stylesheet" href="workouts_v3.css"/>
</head>
<body class="pwPage">
<div class="layout">
  <aside class="sidebar">
    <div class="brand">
      <img class="logoMark" src="icons/brand-mark-128.png" alt="LifeSync">
      <div>
        <div class="brandName">LifeSync</div>
        <div class="brandSub">Personal OS</div>
      </div>
    </div>

    <nav class="nav">
      <a class="navItem" href="dashboard.html">Dashboard</a>
      <a class="navItem" href="habits.html">Habits</a>
      <a class="navItem" href="finances.html">Finances</a>
      <a class="navItem active" href="workouts.html">Workouts</a>
      <a class="navItem" href="analytics.html">Analytics</a>
      <a class="navItem" href="settings.html">Settings</a>
    </nav>
  </aside>

  <main class="content">
    <div class="topbar">
      <div>
        <div class="pageTitleRow">
          <img class="topbarLogo" src="icons/brand-mark-128.png" alt="LifeSync">
          <h1 class="pageTitle">Plan workout</h1>
        </div>
        <p class="subtitle" id="pwSubline">—</p>
      </div>
      <div class="actionsRow">
        <button class="btn secondary" id="pwBack">Back</button>
      </div>
    </div>

    <section class="pwWrap">
      <!-- What/When header -->
      <div class="pwHeader">
        <div class="pwHeaderTop">
          <button class="btn secondary pwBackInline" id="pwBackInline" type="button">Back</button>
          <div class="pwSaved" id="pwSavedState">Saved</div>
        </div>

        <div class="pwDate" id="pwBigDate">—</div>

        <div class="pwNameRow">
          <input id="pwName" class="pwNameInput" type="text" placeholder="Workout name" autocomplete="off" />
        </div>

        <div class="pwSubRow" id="pwSubRow">
          <div class="pwSubItem">
            <span class="pwMetaLabel">From</span>
            <select id="pwTemplate" class="pwSelect" aria-label="Template">
              <option value="">Loading…</option>
            </select>
            <button class="btn secondary small" id="pwApplyTemplate" type="button">Apply</button>
          </div>
          <div class="pwSubItem">
            <span class="pwMetaLabel">Session</span>
            <select id="pwWorkoutSelect" class="pwSelect" aria-label="Select workout"></select>
            <button class="pwIconBtn" id="pwNewWorkout" type="button" aria-label="New workout">+</button>
            <button class="pwIconBtn" id="pwDeleteWorkout" type="button" aria-label="Delete workout" title="Delete workout">🗑</button>
          </div>
        </div>
      </div>

      <!-- Add Exercises: 1-tap primary CTA -->
      <button class="pwPrimaryAdd" id="pwAddExercise" type="button" aria-label="Add exercise">
        <span class="pwPlus" aria-hidden="true">+</span>
        <span class="pwAddLabel">Add exercise</span>
      </button>

      <!-- Exercises -->
      <div id="pwExercises" class="pwExercises"></div>

      <div class="pwFooter">
        <button class="btn secondary" id="pwCancel" type="button">Cancel</button>
        <button class="btn" id="pwDone" type="button">Done</button>
      </div>
    </section>
  </main>
</div>

<!-- Exercise picker (bottom sheet / modal) -->
<div class="sheetOverlay" id="exOverlay" hidden></div>
<div class="sheet" id="exSheet" hidden role="dialog" aria-modal="true" aria-label="Add exercise">
  <div class="sheetTop">
    <div class="sheetTitle">Add exercise</div>
    <button class="sheetClose" id="exClose" aria-label="Close">×</button>
  </div>

  <div class="sheetSearch">
    <input id="exSearch" type="search" placeholder="Search exercises…" autocomplete="off" />
  </div>

  <div class="sheetHint">Type to search — or create your own exercise (press Enter)</div>

  <div class="sheetChips" id="exChips">
    <!-- JS fills chips -->
  </div>

  <div class="sheetList" id="exList" role="list"></div>
</div>

<!-- Floating rest timer (matches dark/glass vibe) -->
<div id="pwRestClock" class="pwRestClock" hidden>
  <button class="pwRestClockClose" id="pwRestClockStop" type="button" aria-label="Stop rest"><svg class="pwRestIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  <div class="pwRestRing" aria-hidden="true">
    <svg viewBox="0 0 44 44" class="pwRestSvg">
      <circle class="pwRestTrack" cx="22" cy="22" r="18"></circle>
      <circle class="pwRestProg" cx="22" cy="22" r="18"></circle>
    </svg>
  </div>
  <div class="pwRestText">
    <div class="pwRestLabel">Rest</div>
    <div class="pwRestTime" id="pwRestTime">00:00</div>
  </div>
  <button class="pwRestClockGear" id="pwRestClockSettings" type="button" aria-label="Rest settings"><svg class="pwRestIcon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</div>

<!-- Rest duration picker -->
<div class="pwModal" id="pwRestModal" hidden>
  <div class="pwModalBackdrop" data-close="1"></div>
  <div class="pwModalCard" role="dialog" aria-modal="true" aria-labelledby="pwRestModalTitle">
    <div class="pwModalHead">
      <div class="pwModalTitle" id="pwRestModalTitle">Rest duration</div>
      <button class="pwIconBtn" type="button" data-close="1" aria-label="Close">✕</button>
    </div>
    <div class="pwModalBody">
      <div class="pwRestQuick">
        <button type="button" class="chipBtn" data-rest="30">30s</button>
        <button type="button" class="chipBtn" data-rest="60">60s</button>
        <button type="button" class="chipBtn" data-rest="90">90s</button>
        <button type="button" class="chipBtn" data-rest="120">120s</button>
        <button type="button" class="chipBtn" data-rest="180">180s</button>
      </div>
      <div class="pwRestCustomRow">
        <label class="pwMetaLabel" for="pwRestCustom">Custom (sec)</label>
        <input id="pwRestCustom" class="pwRestInput" type="number" min="5" max="3600" step="5" inputmode="numeric" />
        <button type="button" class="btn secondary" id="pwRestSave">Save</button>
      </div>
      <div class="pwHint">Tip: press <strong>Rest</strong> and it will start with this duration.</div>
    </div>
  </div>
</div>

<nav class="bottomNav" aria-label="Primary">
  <a href="dashboard.html">🏠<span>Dashboard</span></a>
  <a href="habits.html"><span class="iconWrap"><img class="navIcon" src="icons/habits.png?v=6" alt="Habits"></span><span>Habits</span></a>
  <a class="active" href="workouts.html">🏋️<span>Workouts</span></a>
  <a href="nutrition.html">🍎<span>Nutrition</span></a>
  <a href="finances.html">💰<span>Finances</span></a>
</nav>

<script src="app.js"></script>
<script src="ui.js"></script>
<script src="workouts.js"></script>
<script src="plan_workout.js"></script>
</body>
</html>
