/**
 * Calendar4Christmas - Cloudflare Worker serving photo albums from private R2.
 *
 * Cloudflare Access must protect all Worker routes and media endpoints.
 * The existing client-side M2CSGA invitation gate stays in the Christmas UI.
 * Media management is performed using the Cloudflare R2 dashboard; no admin token or upload API.
 *
 * Do not commit or deploy private media as Workers static assets.
 */
const YEAR = 2026;
const MANIFEST = "calendar.json";
const ID = /^m[0-9]{3}$/;
const DEMO_COOKIE = "c4c_demo";
const DEMO_CODE = "triche";
const DEMO_SESSION_SECONDS = 2 * 60 * 60;
function demoEnabled(request) {
  // Demo access is for testing, not a second security boundary.
  // Cloudflare Access must remain enabled for every Worker route.
  return (request.headers.get("Cookie") || "").split(";")
    .some(part => part.trim() === DEMO_COOKIE + "=1");
}
function demoCookie(enabled) {
  return DEMO_COOKIE + "=" + (enabled ? "1" : "")
    + "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age="
    + (enabled ? DEMO_SESSION_SECONDS : 0);
}
const PUBLIC_FILES = new Set([
  "/", "/index.html", "/styles.css", "/access.js", "/app.js", "/i18n.js",
  "/surprises.js", "/surprises.en.js", "/secure-client.js", "/sw.js",
  "/manifest.webmanifest", "/assets/favicon.svg", 
]);
const BASE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY"
};
const send = (value, status=200, headers={}) => new Response(JSON.stringify(value), {
  status, headers:{...BASE_HEADERS,"Content-Type":"application/json; charset=utf-8",...headers}
});
const error = (status,message) => send({ok:false,error:message},status);
const originOk = request => {
  const origin=request.headers.get("Origin");
  const sec=request.headers.get("Sec-Fetch-Site");
  return sec!=="cross-site" && (!origin || origin===new URL(request.url).origin);
};
function released(day) {
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Europe/Paris",year:"numeric",month:"numeric",day:"numeric"
  }).formatToParts(new Date());
  const values=Object.fromEntries(parts.filter(x=>["year","month","day"].includes(x.type)).map(x=>[x.type,Number(x.value)]));
  return values.year>YEAR || (values.year===YEAR && values.month===12 && values.day>=day);
}
async function loadManifest(env) {
  if(!env.MEDIA)return null;
  const object=await env.MEDIA.get(MANIFEST);
  if(!object)return null;
  try {
    const data=await object.json();
    if(data.year!==YEAR || !Array.isArray(data.days) || data.days.length!==24)return null;
    return data;
  }catch{return null;}
}
function publicAlbum(entry){
  return {day:entry.day,title:entry.title,description:entry.description,
    media:entry.media.map(x=>({id:x.id,type:x.type,caption:x.caption||"",alt:x.alt||""}))};
}
async function streamMedia(request,env,id) {
  if(!ID.test(id))return error(404,"Fichier introuvable.");
  const data=await loadManifest(env);
  const matched=data?.days.flatMap(d=>d.type==="album" && (released(d.day) || demoEnabled(request))?d.media:[]).find(m=>m.id===id);
  if(!matched)return error(404,"Fichier indisponible.");
  const extension=matched.filename.split(".").pop().toLowerCase();
  const mime={"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","webp":"image/webp","mp4":"video/mp4"}[extension];
  if(!mime)return error(415,"Format non reconnu.");
  const range=request.headers.get("Range");
  if(range && !/^bytes=(\d*)-(\d*)$/.test(range))return error(416,"Plage invalide.");
  const file=await env.MEDIA.get("media/"+id+"."+extension,range?{range:request.headers}:undefined);
  if(!file?.body)return error(404,"Fichier non importé.");
  const h=new Headers(BASE_HEADERS);
  file.writeHttpMetadata(h);
  h.set("Content-Type",mime);
  h.set("Content-Security-Policy","default-src 'none'; sandbox");
  h.set("Accept-Ranges","bytes");
  h.set("ETag",file.httpEtag);
  if(range&&file.range){
    const r=file.range;
    const offset="offset" in r?r.offset:Math.max(0,file.size-r.suffix);
    const length="length" in r?r.length:file.size-offset;
    h.set("Content-Range",`bytes ${offset}-${offset+length-1}/${file.size}`);
    h.set("Content-Length",String(length));
    return new Response(file.body,{status:206,headers:h});
  }
  h.set("Content-Length",String(file.size));
  return new Response(file.body,{headers:h});
}
async function api(request,env){
  const path=new URL(request.url).pathname,method=request.method;
  if(path==="/api/demo"){
    if(method==="GET")return send({ok:true,demo:demoEnabled(request)});
    if(method==="DELETE"){
      if(!originOk(request))return error(403,"Origine non autorisée.");
      return send({ok:true,demo:false},200,{"Set-Cookie":demoCookie(false)});
    }
    if(method==="POST"){
      if(!originOk(request))return error(403,"Origine non autorisée.");
      const length=Number(request.headers.get("Content-Length")||0);
      if(length>256)return error(413,"Requête trop volumineuse.");
      const bodyText=await request.text();
      if(bodyText.length>256)return error(413,"Requête trop volumineuse.");
      let value;
      try{value=JSON.parse(bodyText);}catch{return error(400,"Code de démonstration requis.");}
      if(typeof value?.code!=="string" || value.code.trim().toLowerCase()!==DEMO_CODE){
        return error(401,"Code de démonstration incorrect.");
      }
      return send({ok:true,demo:true},200,{"Set-Cookie":demoCookie(true)});
    }
    return error(405,"Méthode non autorisée.");
  }
  if(path==="/api/health"&&method==="GET"){
    return send({ok:true,worker:true,r2Bound:Boolean(env.MEDIA),storageReady:Boolean(await loadManifest(env))});
  }
  const calendar=await loadManifest(env);
  if(path==="/api/calendar"&&method==="GET"){
    return send({ok:true,ready:Boolean(calendar),year:YEAR,
      days:calendar?calendar.days.map(d=>({
        day:d.day,type:d.type,available:released(d.day)||demoEnabled(request),
        count:(released(d.day)||demoEnabled(request))&&d.type==="album"?d.media.length:0,
        ...((released(d.day)||demoEnabled(request))&&d.type==="album"?{title:d.title}:{})
      })):[]});
  }
  const matchDay=/^\/api\/day\/(\d{1,2})$/.exec(path);
  if(matchDay&&method==="GET"){
    const day=Number(matchDay[1]);
    if(day<1||day>24||!(released(day)||demoEnabled(request)))return error(403,"Cette case est encore fermée.");
    const entry=calendar?.days.find(d=>d.day===day);
    return entry?.type==="album"?send({ok:true,...publicAlbum(entry)}):error(404,"Pas d'album à cette date.");
  }
  const matchMedia=/^\/api\/media\/(m\d{3})$/.exec(path);
  if(matchMedia&&method==="GET")return streamMedia(request,env,matchMedia[1]);

  return error(404,"Route inconnue.");
}
export default {
  async fetch(request,env) {
    try {
      const url=new URL(request.url);
      if(url.pathname.startsWith("/api/"))return await api(request,env);
      if(!["GET","HEAD"].includes(request.method))return error(405,"Méthode non autorisée.");
      if(!PUBLIC_FILES.has(url.pathname)||!env.ASSETS)return error(404,"Fichier absent.");
      const resource=url.pathname==="/"?new Request(new URL("/index.html",url),request):request;
      const response=await env.ASSETS.fetch(resource);
      const h=new Headers(response.headers);
      h.set("X-Content-Type-Options","nosniff");
      h.set("Referrer-Policy","same-origin");
      h.set("X-Frame-Options","DENY");
      h.set("Content-Security-Policy","default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
      return new Response(response.body,{status:response.status,headers:h});
    }catch(e){
      console.error("Calendar4Christmas request failed",String(e?.message||e));
      return error(500,"Service temporairement indisponible.");
    }
  }
};
