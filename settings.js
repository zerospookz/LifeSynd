
function exportData(){
 const payload={
  habitsV2: JSON.parse(localStorage.getItem("habitsV2")||"[]"),
  workoutData: JSON.parse(localStorage.getItem("workoutData")||"[]"),
  meals: JSON.parse(localStorage.getItem("meals")||"[]"),
  workoutTemplates: JSON.parse(localStorage.getItem("workoutTemplates")||"{}"),
  plannedWorkouts: JSON.parse(localStorage.getItem("plannedWorkouts")||"{}"),
  financeTx: JSON.parse(localStorage.getItem("financeTx")||"[]"),
  habitsReminder: JSON.parse(localStorage.getItem("habitsReminder")||"null"),
 };

 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
 const a=document.createElement("a");
 a.href=URL.createObjectURL(blob);
 a.download="lifesync-export.json";
 a.click();
 showToast("Exported");
}

// -----------------------------
// Habits-only backup & restore
// -----------------------------
function getHabitsOnlyPayload(){
  // Keep this intentionally scoped to the Habits module + its preferences.
  const payload = {
    _meta: {
      type: "lifesync-habits-backup",
      version: 1,
      exportedAt: new Date().toISOString()
    },
    habitsV2: JSON.parse(localStorage.getItem("habitsV2")||"[]"),
    habitsReminder: JSON.parse(localStorage.getItem("habitsReminder")||"null"),
    habitsReminderLastNotified: localStorage.getItem("habitsReminderLastNotified") || "",
    habitsCarouselIndex: localStorage.getItem("habitsCarouselIndex") || "0",
    habitsAnalyticsView: localStorage.getItem("habitsAnalyticsView") || "month",
    habitsAnalyticsOffsetDays: localStorage.getItem("habitsAnalyticsOffsetDays") || "0",
    habitsAnalyticsPaintMode: localStorage.getItem("habitsAnalyticsPaintMode") || "mark",
  };

  // Optional: preserve animated wheel previous % values (keys are date-specific)
  // This is purely cosmetic; safe to omit, but useful if you want the UI to feel identical.
  try{
    const wheelKeys = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('heroWheelPrevPct:')) wheelKeys.push(k);
    }
    if(wheelKeys.length){
      payload.heroWheelPrevPct = {};
      wheelKeys.forEach(k => payload.heroWheelPrevPct[k] = localStorage.getItem(k));
    }
  }catch(_){ /* ignore */ }

  return payload;
}

function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function exportHabits(){
  const payload = getHabitsOnlyPayload();
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  downloadJSON(payload, `lifesync-habits-${y}${m}${day}.json`);
  showToast && showToast("Habits exported");
}

function importHabits(){
  const input = document.getElementById('habitsImportFile');
  const f = input && input.files ? input.files[0] : null;
  if(!f) return;

  const r = new FileReader();
  r.onload = ()=>{
    try{
      const obj = JSON.parse(r.result);

      // Accept either the habits-only file or a full export that contains habitsV2.
      const habitsArr = obj.habitsV2;
      if(!Array.isArray(habitsArr)){
        alert("That file doesn't look like a Habits backup (missing habitsV2).");
        return;
      }

      localStorage.setItem("habitsV2", JSON.stringify(habitsArr));

      if("habitsReminder" in obj) localStorage.setItem("habitsReminder", JSON.stringify(obj.habitsReminder));
      if("habitsReminderLastNotified" in obj) localStorage.setItem("habitsReminderLastNotified", String(obj.habitsReminderLastNotified||""));
      if("habitsCarouselIndex" in obj) localStorage.setItem("habitsCarouselIndex", String(obj.habitsCarouselIndex||"0"));
      if("habitsAnalyticsView" in obj) localStorage.setItem("habitsAnalyticsView", String(obj.habitsAnalyticsView||"month"));
      if("habitsAnalyticsOffsetDays" in obj) localStorage.setItem("habitsAnalyticsOffsetDays", String(obj.habitsAnalyticsOffsetDays||"0"));
      if("habitsAnalyticsPaintMode" in obj) localStorage.setItem("habitsAnalyticsPaintMode", String(obj.habitsAnalyticsPaintMode||"mark"));

      if(obj.heroWheelPrevPct && typeof obj.heroWheelPrevPct === 'object'){
        Object.keys(obj.heroWheelPrevPct).forEach(k=>{
          if(k && k.startsWith('heroWheelPrevPct:')){
            localStorage.setItem(k, String(obj.heroWheelPrevPct[k]||"0"));
          }
        });
      }

      showToast && showToast("Habits imported — open Habits to verify");
    }catch(e){
      alert("Invalid JSON");
    }
  };
  r.readAsText(f);
}
function importData(){
 const f=importFile.files[0];
 if(!f) return;
 const r=new FileReader();
 r.onload=()=>{
  try{
   const obj=JSON.parse(r.result);
   if(obj.habitsV2) localStorage.setItem("habitsV2", JSON.stringify(obj.habitsV2));
   if(obj.workoutData) localStorage.setItem("workoutData", JSON.stringify(obj.workoutData));
   if(obj.meals) localStorage.setItem("meals", JSON.stringify(obj.meals));
   if(obj.workoutTemplates) localStorage.setItem("workoutTemplates", JSON.stringify(obj.workoutTemplates));
   if(obj.plannedWorkouts) localStorage.setItem("plannedWorkouts", JSON.stringify(obj.plannedWorkouts));
   if(obj.financeTx) localStorage.setItem("financeTx", JSON.stringify(obj.financeTx));
   if(obj.habitsReminder) localStorage.setItem("habitsReminder", JSON.stringify(obj.habitsReminder));
   if(obj.financeBudgets) localStorage.setItem("financeBudgets", JSON.stringify(obj.financeBudgets));
   showToast("Imported — refresh pages");
  }catch(e){ alert("Invalid JSON"); }
 };
 r.readAsText(f);
}



function getHabitsReminderSettings(){
  try{
    const raw = JSON.parse(localStorage.getItem("habitsReminder")||"null") || {};
    return {
      enabled: raw.enabled !== false,
      time: typeof raw.time==="string" ? raw.time : "20:00",
      threshold: Number.isFinite(raw.threshold) ? Math.max(0, Math.min(100, raw.threshold)) : 50
    };
  }catch(_){
    return { enabled:true, time:"20:00", threshold:50 };
  }
}

function setHabitsReminderSettings(s){
  localStorage.setItem("habitsReminder", JSON.stringify(s));
}

function updateNotifStatus(){
  const el = document.getElementById("hr_status");
  if(!el) return;
  if(!("Notification" in window)){
    el.textContent = "Notifications not supported in this browser.";
    return;
  }
  const perm = Notification.permission;
  const hasSub = !!localStorage.getItem("pushSubscription");
  el.textContent = "Permission: " + perm + (hasSub ? " · Push: subscribed" : " · Push: not subscribed");
}

// --- Push Notifications (Variant A) ---
// TODO (later): set these when you add your Cloudflare Worker.
// Public VAPID key from your push service.
const PUSH_PUBLIC_VAPID_KEY = "REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY";
// Endpoint that stores/updates subscriptions on your backend.
const PUSH_SUBSCRIBE_ENDPOINT = ""; // e.g. https://<your-worker-domain>/api/push/subscribe

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function ensureServiceWorkerReady(){
  if(!('serviceWorker' in navigator)) return null;
  // app.js sets window.__swReady
  if(window.__swReady) return await window.__swReady;
  try{
    await navigator.serviceWorker.register('sw.js', { scope: './' });
    return await navigator.serviceWorker.ready;
  }catch(e){
    console.warn('SW not ready', e);
    return null;
  }
}

async function postJSON(url, body){
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if(!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json().catch(()=>({ ok:true }));
}

async function enablePushNotifications(){
  if(!("Notification" in window)){
    alert("Notifications are not supported in this browser.");
    return;
  }
  const perm = await Notification.requestPermission();
  if(perm !== 'granted'){
    updateNotifStatus();
    return;
  }

  const reg = await ensureServiceWorkerReady();
  if(!reg){
    alert("Service Worker isn't available. Push works only on HTTPS (or localhost).");
    updateNotifStatus();
    return;
  }

  if(PUSH_PUBLIC_VAPID_KEY === "REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY"){
    // Still allow permission + local test notification.
    reg.active && reg.active.postMessage({ type:'TEST_NOTIFICATION' });
    localStorage.removeItem('pushSubscription');
    updateNotifStatus();
    alert("Push subscription needs a VAPID public key. Add it in settings.js (PUSH_PUBLIC_VAPID_KEY).\n\nPermission is granted — you can already test notifications, but real background pushes will work after you connect the server.");
    return;
  }

  const existing = await reg.pushManager.getSubscription();
  const sub = existing || await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_VAPID_KEY)
  });

  localStorage.setItem('pushSubscription', JSON.stringify(sub));

  // Send subscription + reminder prefs to backend (optional until you wire Cloudflare).
  if(PUSH_SUBSCRIBE_ENDPOINT){
    const prefs = getHabitsReminderSettings();
    await postJSON(PUSH_SUBSCRIBE_ENDPOINT, { subscription: sub, reminder: prefs });
  }

  // Local test notification
  reg.active && reg.active.postMessage({ type:'TEST_NOTIFICATION' });
  updateNotifStatus();
  showToast && showToast('Push subscribed');
}

function initHabitsReminderSettingsUI(){
  const enabledEl = document.getElementById("hr_enabled");
  const timeEl = document.getElementById("hr_time");
  const pctEl = document.getElementById("hr_pct");
  const permBtn = document.getElementById("hr_perm");
  if(!enabledEl || !timeEl || !pctEl) return;

  const s = getHabitsReminderSettings();
  enabledEl.checked = !!s.enabled;
  timeEl.value = s.time || "20:00";
  pctEl.value = String(s.threshold ?? 50);

  const saveFromUI = ()=>{
    const next = {
      enabled: enabledEl.checked,
      time: timeEl.value || "20:00",
      threshold: Math.max(0, Math.min(100, parseInt(pctEl.value||"50", 10)))
    };
    setHabitsReminderSettings(next);
    showToast && showToast("Saved");

    // If you already subscribed, optionally sync prefs to your backend.
    if(PUSH_SUBSCRIBE_ENDPOINT && localStorage.getItem('pushSubscription')){
      try{
        const sub = JSON.parse(localStorage.getItem('pushSubscription'));
        postJSON(PUSH_SUBSCRIBE_ENDPOINT, { subscription: sub, reminder: next }).catch(()=>{});
      }catch(_){ /* ignore */ }
    }
  };

  enabledEl.addEventListener("change", saveFromUI);
  timeEl.addEventListener("change", saveFromUI);
  pctEl.addEventListener("change", saveFromUI);

  if(permBtn){
    permBtn.addEventListener("click", async ()=>{
      try{
        await enablePushNotifications();
      }catch(e){
        console.warn(e);
        alert("Couldn't enable notifications.");
      }
    });
  }

  updateNotifStatus();
}

initHabitsReminderSettingsUI();
