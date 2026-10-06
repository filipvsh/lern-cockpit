/* Lern-Cockpit · Service Worker: App-Shell offline, Daten immer live (Supabase wird nie gecacht) */
const CACHE="lc-v5-3";
const SHELL=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./js/engine.js","./js/api.js","./js/store.js","./js/ai.js","./js/trainer.js","./js/views-learn.js","./js/views-test.js","./js/views-mission.js","./js/app.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);
 if(u.origin!==location.origin||e.request.method!=="GET")return; // Supabase, KI, Fonts: nie cachen
 if(e.request.mode==="navigate"||SHELL.some(s=>u.pathname.endsWith(s.replace("./","/")))){
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{});return r;}).catch(()=>caches.match(e.request).then(m=>m||caches.match("./index.html"))));}});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{const c=cs.find(x=>"focus" in x);if(c)return c.focus();return clients.openWindow("./#/dashboard");}));});
