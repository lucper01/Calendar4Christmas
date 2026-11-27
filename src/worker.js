/**
 * Calendar4Christmas - private R2 media gateway.
 * No private image is included in the GitHub repository or static asset bundle.
 * Configure ACCESS_CODE, SESSION_SECRET and ADMIN_TOKEN as Cloudflare Secrets.
 */
const COOKIE = "c4c_auth";
const SESSION_MS = 12 * 60 * 60 * 1000;
const YEAR = 2026;
const MANIFEST_KEY = "config/calendar.json";
const textEncoder = new TextEncoder();
const secureHeaders = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY"
};
const publicFiles = new Set([
  "/", "/index.html", "/styles.css", "/app.js", "/surprises.js", "/secure-client.js",
  "/admin.html", "/admin.js", "/assets/favicon.svg", "/manifest.webmanifest", "/sw.js"
]);
const attempts = new Map();
const validId = s => /^m[0-9]{3}$/.test(s || "");
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { ...secureHeaders, "Content-Type":"application/json; charset=utf-8", ...extra }
});
const fail = (status, message) => json({ ok:false, error:message }, status);
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  if (site === "cross-site") return false;
  return !origin || origin === new URL(request.url).origin;
}
function parisParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/Paris", year:"numeric", month:"numeric", day:"numeric"})
    .formatToParts(date);
  return Object.fromEntries(parts.filter(p => ["year","month","day"].includes(p.type)).map(p => [p.type,Number(p.value)]));
}
function released(day) {
  const current = parisParts();
  return current.year > YEAR || (current.year === YEAR && current.month === 12 && current.day >= day);
}
function base64url(array) {
  let str = "";
  for (const b of array) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sign(secret, payload) {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const result = await crypto.subtle.sign("HMAC",key,textEncoder.encode(payload));
  return base64url(new Uint8Array(result));
}
function constantEqual(a,b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for(let i=0;i<a.length;i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function checkCode(input, secret) {
  const [a,b] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(String(input).trim().toUpperCase())),
    crypto.subtle.digest("SHA-256", textEncoder.encode(String(secret).trim().toUpperCase()))
  ]);
  return constantEqual(base64url(new Uint8Array(a)), base64url(new Uint8Array(b)));
}
function readCookie(request) {
  const entries = (request.headers.get("Cookie") || "").split(";").map(x=>x.trim());
  return entries.find(x => x.startsWith(COOKIE + "="))?.slice(COOKIE.length+1) || "";
}
async function isLoggedIn(request, env) {
  if (!env.SESSION_SECRET) return false;
  const token = readCookie(request);
  const m = /^(\d{13})\.([A-Za-z0-9_-]{16,60})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) return false;
  const deadline = Number(m[1]);
  if (deadline < Date.now() || deadline > Date.now() + SESSION_MS) return false;
  return constantEqual(m[3], await sign(env.SESSION_SECRET, m[1]+"."+m[2]));
}
function cookieFor(value, maxAge) {
  return COOKIE + "=" + value + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + maxAge;
}
function clientKey(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}
function canTry(request) {
  // Per-isolate throttle only; add a Cloudflare WAF rate-limit rule for distributed protection.
  const key = clientKey(request), now = Date.now(), item = attempts.get(key);
  if (attempts.size > 2500) attempts.clear();
  if (!item || item.until < now) return true;
  return item.count < 5;
}
function registerFailure(request) {
  const key=clientKey(request), now=Date.now();
  const item=attempts.get(key);
  if(!item || item.until < now) attempts.set(key,{count:1,until:now+60000});
  else attempts.set(key,{count:item.count+1,until:item.until});
}
function clearFailure(request) { attempts.delete(clientKey(request)); }
async function parseJson(request, maxBytes) {
  const length=Number(request.headers.get("Content-Length") || 0);
  if(length > maxBytes) return null;
  const text=await request.text();
  if(textEncoder.encode(text).byteLength > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}
async function manifest(env) {
  if (!env.MEDIA) return null;
  const object = await env.MEDIA.get(MANIFEST_KEY);
  if (!object) return null;
  try { const parsed = await object.json(); return parsed?.year === YEAR && Array.isArray(parsed.days) ? parsed : null; }
  catch { return null; }
}
function localizedValid(value,max,required=false) {
  if(typeof value==="string")return value.length<=max && (!required || value.trim().length>0);
  if(!value || Array.isArray(value) || typeof value!=="object" || Object.keys(value).some(k=>k!=="fr" && k!=="en"))return false;
  return ["fr","en"].every(k=>typeof value[k]==="string" && value[k].length<=max && (!required || value[k].trim().length>0));
}
function manifestErrors(data) {
  if (!data || data.year !== YEAR || !Array.isArray(data.days) || data.days.length !== 24) return "Le calendrier doit contenir exactement 24 jours pour 2026.";
  const days=new Set(), ids=new Set();
  for(const entry of data.days) {
    if (!Number.isInteger(entry.day) || entry.day < 1 || entry.day > 24 || days.has(entry.day)) return "Jours invalides ou dupliqués.";
    days.add(entry.day);
    if (!["album","science"].includes(entry.type)) return "Type de case invalide.";
    if (entry.type === "album") {
      if (!localizedValid(entry.title,160,true)) return "Titre bilingue manquant ou invalide.";
      if (!localizedValid(entry.description,2000)) return "Description bilingue invalide.";
      if (!Array.isArray(entry.media) || !entry.media.length || entry.media.length > 30) return "Album sans médias ou trop volumineux.";
      for(const item of entry.media) {
        if(!validId(item.id) || ids.has(item.id)) return "ID média invalide ou dupliqué.";
        if(!["image","video"].includes(item.type)) return "Type média invalide.";
        if(typeof item.filename !== "string" || !/\.(jpg|jpeg|png|webp|mp4)$/i.test(item.filename) || item.filename.length > 180) return "Nom de fichier invalide.";
        if(item.caption != null && !localizedValid(item.caption,500)) return "Légende invalide.";
        if(item.alt != null && !localizedValid(item.alt,250)) return "Texte alternatif invalide.";
        ids.add(item.id);
      }
    }
  }
  return days.size === 24 ? null : "Jours manquants.";
}
async function admin(request,env) {
  if (!await isLoggedIn(request,env)) return false;
  const provided=request.headers.get("X-Admin-Token") || "";
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) return false;
  return constantEqual(provided,env.ADMIN_TOKEN);
}
function publicAlbum(entry) {
  return {
    day:entry.day, title:entry.title, description:entry.description,
    media:entry.media.map(item=>({id:item.id,type:item.type,caption:item.caption||"",alt:item.alt||"Photographie du calendrier"}))
  };
}
function isMediaReleased(data,id) {
  for(const entry of data.days) {
    if(entry.type==="album" && released(entry.day) && entry.media.some(item=>item.id===id)) return true;
  }
  return false;
}
async function mediaResponse(request,env,id) {
  if(!validId(id)) return fail(404,"Média introuvable.");
  const data=await manifest(env);
  if(!data || !isMediaReleased(data,id)) return fail(404,"Média non disponible.");
  const rangeHeader = request.headers.get("Range");
  if(rangeHeader && !/^bytes=(\d*)-(\d*)$/.test(rangeHeader)) return fail(416,"Plage de lecture invalide.");
  const object=await env.MEDIA.get("media/"+id, rangeHeader ? {range:request.headers} : undefined);
  if(!object || !object.body) return fail(404,"Fichier non chargé.");
  const headers=new Headers(secureHeaders);
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", headers.get("Content-Type") || "application/octet-stream");
  headers.set("Accept-Ranges","bytes");
  headers.set("ETag",object.httpEtag);
  headers.set("Content-Security-Policy","default-src 'none'; sandbox");
  const r=object.range;
  if (rangeHeader && r) {
    const offset = "offset" in r ? r.offset : Math.max(0,object.size-r.suffix);
    const length = "length" in r ? r.length : object.size-offset;
    headers.set("Content-Range", "bytes "+offset+"-"+(offset+length-1)+"/"+object.size);
    headers.set("Content-Length",String(length));
    return new Response(object.body,{status:206,headers});
  }
  headers.set("Content-Length",String(object.size));
  return new Response(object.body,{status:200,headers});
}
async function handleApi(request,env) {
  const url=new URL(request.url), path=url.pathname;
  if(path==="/api/health" && request.method==="GET") {
    return json({ok:true,worker:true,configured:Boolean(env.ACCESS_CODE && env.SESSION_SECRET),r2Bound:Boolean(env.MEDIA)});
  }
  if(path==="/api/session" && request.method==="GET") return json({authenticated:await isLoggedIn(request,env)});
  if(path==="/api/session" && request.method==="DELETE") {
    if(!sameOrigin(request)) return fail(403,"Origine non autorisée.");
    return json({ok:true},200,{"Set-Cookie":cookieFor("",0)});
  }
  if(path==="/api/session" && request.method==="POST") {
    if(!sameOrigin(request)) return fail(403,"Origine non autorisée.");
    if(!env.ACCESS_CODE || !env.SESSION_SECRET || env.SESSION_SECRET.length<32) return fail(503,"L'accès sécurisé est en cours de configuration.");
    if(!canTry(request)) return fail(429,"Trop de tentatives. Réessaie dans une minute.");
    const body=await parseJson(request,2048);
    if(!body || typeof body.code!=="string" || body.code.length>80) return fail(400,"Code non valide.");
    const ok=await checkCode(body.code,env.ACCESS_CODE);
    if(!ok){registerFailure(request);return fail(401,"Code d'invitation incorrect.");}
    clearFailure(request);
    const expires=Date.now()+SESSION_MS;
    const nonce=base64url(crypto.getRandomValues(new Uint8Array(18)));
    const payload=expires+"."+nonce;
    const session=payload+"."+await sign(env.SESSION_SECRET,payload);
    return json({ok:true,authenticated:true},200,{"Set-Cookie":cookieFor(session,Math.floor(SESSION_MS/1000))});
  }

  if(!await isLoggedIn(request,env)) return fail(401,"Authentification requise.");
  if(path==="/api/calendar" && request.method==="GET") {
    const data=await manifest(env);
    return json({ok:true,ready:Boolean(data),year:YEAR,days:data?data.days.map(d=>({
      day:d.day,type:d.type,available:released(d.day),count:released(d.day)&&d.type==="album"?d.media.length:0,
      ...(released(d.day)&&d.type==="album"?{title:d.title}:{})
    })):[]});
  }
  const dayMatch=/^\/api\/day\/(\d{1,2})$/.exec(path);
  if(dayMatch && request.method==="GET") {
    const day=Number(dayMatch[1]);
    if(day<1 || day>24 || !released(day)) return fail(403,"Cette case n'est pas encore ouverte.");
    const data=await manifest(env);
    const entry=data?.days.find(d=>d.day===day);
    if(!entry || entry.type!=="album") return fail(404,"Pas d'album photographique ce jour.");
    return json({ok:true,...publicAlbum(entry)});
  }
  const mediaMatch=/^\/api\/media\/(m\d{3})$/.exec(path);
  if(mediaMatch && request.method==="GET") return mediaResponse(request,env,mediaMatch[1]);

  if(path.startsWith("/api/admin/")) {
    if(!await admin(request,env)) return fail(403,"Accès administrateur requis.");
    if(!env.MEDIA) return fail(503,"Stockage R2 non configuré.");
    if(path==="/api/admin/manifest" && request.method==="GET") {
      return json({ok:true,manifest:await manifest(env)});
    }
    if(path==="/api/admin/manifest" && request.method==="PUT") {
      if(!sameOrigin(request)) return fail(403,"Origine non autorisée.");
      const body=await parseJson(request,100000);
      const error=manifestErrors(body);
      if(error) return fail(400,error);
      await env.MEDIA.put(MANIFEST_KEY,JSON.stringify(body),{httpMetadata:{contentType:"application/json"}});
      return json({ok:true,albums:body.days.filter(d=>d.type==="album").length});
    }
    if(path==="/api/admin/status" && request.method==="GET") {
      const data=await manifest(env);
      if(!data) return fail(404,"Importer d'abord le manifeste.");
      const media=data.days.flatMap(d=>d.media||[]);
      const listed=await Promise.all(media.map(async m=>({id:m.id,filename:m.filename,uploaded:Boolean(await env.MEDIA.head("media/"+m.id))})));
      return json({ok:true,media:listed});
    }
    const uploadMatch=/^\/api\/admin\/media\/(m\d{3})$/.exec(path);
    if(uploadMatch && request.method==="PUT") {
      if(!sameOrigin(request)) return fail(403,"Origine non autorisée.");
      const id=uploadMatch[1], data=await manifest(env);
      const entry=data?.days.flatMap(d=>d.media||[]).find(m=>m.id===id);
      if(!entry) return fail(404,"Média absent du manifeste.");
      const max=24*1024*1024;
      const size=Number(request.headers.get("Content-Length")||0);
      if(!Number.isFinite(size) || size<=0 || size>max) return fail(413,"Fichier trop volumineux (max. 24 Mio).");
      const mime=request.headers.get("Content-Type")?.split(";")[0]?.toLowerCase();
      const allowed=entry.type==="video"?["video/mp4"]:["image/jpeg","image/png","image/webp"];
      if(!allowed.includes(mime)) return fail(415,"Type de fichier refusé.");
      const bytes=await request.arrayBuffer();
      if(bytes.byteLength !== size) return fail(400,"Longueur de fichier incohérente.");
      await env.MEDIA.put("media/"+id,bytes,{httpMetadata:{contentType:mime}});
      return json({ok:true,id,bytes:bytes.byteLength});
    }
  }
  return fail(404,"Route introuvable.");
}
export default {
  async fetch(request,env) {
    try {
      const url = new URL(request.url);
      if(url.pathname.startsWith("/api/")) return await handleApi(request,env);
      if(request.method!=="GET" && request.method!=="HEAD") return fail(405,"Méthode non autorisée.");
      if(!publicFiles.has(url.pathname) || !env.ASSETS) return fail(404,"Page introuvable.");
      const result=await env.ASSETS.fetch(request);
      const headers=new Headers(result.headers);
      headers.set("X-Content-Type-Options","nosniff");
      headers.set("Referrer-Policy","same-origin");
      headers.set("X-Frame-Options","DENY");
      headers.set("Content-Security-Policy","default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
      return new Response(result.body,{status:result.status,headers});
    } catch(e) {
      console.error("Calendar4Christmas Worker error",String(e?.message||e));
      return fail(500,"Erreur du service, merci de réessayer.");
    }
  }
};
