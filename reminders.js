
function requestNotifications(){
  if(Notification.permission!=="granted"){
    Notification.requestPermission();
  }
}

function scheduleHabitReminder(name,time){
  if(Notification.permission!=="granted") return;
  const [h,m]=time.split(":");
  const now=new Date();
  const t=new Date();
  t.setHours(h,m,0,0);
  if(t<now) t.setDate(t.getDate()+1);
  setTimeout(()=>{
    new Notification("Habit Reminder",{body:`Time to do: ${name}`});
  }, t-now);
}
