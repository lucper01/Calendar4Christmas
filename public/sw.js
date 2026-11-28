/* Never cache authenticated API responses or personal photographs. */
const CACHE = "calendar4christmas-2026-v6-triche-demo";
const CORE = ["./","./index.html","./styles.css","./i18n.js","./access.js","./app.js","./secure-client.js","./surprises.js","./surprises.en.js","./manifest.webmanifest","./assets/favicon.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith("/api/") || !CORE.some(p=>new URL(p,self.registration.scope).pathname===url.pathname))return;
  if(event.request.mode==="navigate") {
    event.respondWith(fetch(event.request).catch(()=>caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));
});
