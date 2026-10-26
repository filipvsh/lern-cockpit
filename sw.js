/* Lern-Cockpit · Service Worker: App-Shell offline, Daten immer live (Supabase wird nie gecacht) */
const CACHE="lc-v18";
const SHELL=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./js/engine.js","./js/fr-grammar.js","./js/lesson.js","./js/drill.js","./js/mathe.js","./js/fr-check.js","./js/api.js","./js/store.js","./js/ai.js","./js/trainer.js","./js/views-learn.js","./js/views-test.js","./js/views-mission.js","./js/views-material.js","./js/views-games.js","./js/deutsch-extrem-data.js","./js/views-deutsch.js","./js/videos.js","./js/grammar-notes.js","./js/views-klausur.js","./js/views-writing.js","./js/views-lesson.js","./js/views-drill.js","./js/motivation.js","./js/push.js","./js/content-packs.js","./js/app.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);
 if(u.origin!==location.origin||e.request.method!=="GET")return; // Supabase, KI, Fonts: nie cachen
 if(e.request.mode==="navigate"||SHELL.some(s=>u.pathname.endsWith(s.replace("./","/")))){
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{});return r;}).catch(()=>caches.match(e.request).then(m=>m||caches.match("./index.html"))));}});
// Push (Edge Function „push-reminder“): Nachricht anzeigen
self.addEventListener("push",e=>{let d={};try{d=e.data?e.data.json():{};}catch(x){d={title:"Lern-Cockpit",body:e.data?e.data.text():""};}
 e.waitUntil(self.registration.showNotification(d.title||"Lern-Cockpit",{body:d.body||"",tag:d.tag||"lc-push",icon:"icon-192.png",badge:"icon-192.png",data:{url:d.url||"#/dashboard"}}));});
// Antippen: offenes Fenster nach vorn holen und zur passenden Seite springen, sonst neu öffnen
self.addEventListener("notificationclick",e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||"#/dashboard";
 e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{const c=cs.find(x=>"focus" in x);if(c){if("navigate" in c)c.navigate("./"+url).catch(()=>{});return c.focus();}return clients.openWindow("./"+url);}));});
