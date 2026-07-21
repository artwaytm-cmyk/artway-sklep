/* Artway-TM PWA — statyczna powłoka aplikacji. Dane administratora i API
   zawsze pochodzą z sieci i nigdy nie są zapisywane w Service Workerze. */
const CACHE_NAME="artway-admin-2026.07.22.17";
const APP_SHELL=[
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/artway-icon.svg",
  "/icons/artway-icon-192.png",
  "/icons/artway-icon-512.png",
  "/assets/styles.css?v=2026.07.22.17",
  "/assets/app.js?v=2026.07.22.17"
];

self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("artway-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});

function isPrivateRequest(url){return url.pathname==="/api/store"||url.pathname.startsWith("/.netlify/functions/")||url.pathname.startsWith("/api/");}
async function networkFirst(request){
  try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}return response;}
  catch(error){return (await caches.match(request))||(await caches.match("/index.html"))||Response.error();}
}
async function cacheFirst(request){
  const cached=await caches.match(request);if(cached)return cached;
  const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}return response;
}
self.addEventListener("fetch",event=>{
  const request=event.request;if(request.method!=="GET")return;
  const url=new URL(request.url);if(url.origin!==self.location.origin||isPrivateRequest(url))return;
  if(request.mode==="navigate"){event.respondWith(networkFirst(request));return;}
  if(url.pathname==="/manifest.webmanifest"||url.pathname==="/sw.js"){event.respondWith(networkFirst(request));return;}
  if(url.pathname.startsWith("/assets/")||url.pathname.startsWith("/icons/")){event.respondWith(cacheFirst(request));}
});
