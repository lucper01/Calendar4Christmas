/**
 * Calendar4Christmas - Cloudflare Worker serving photo albums from private R2.
 *
 * Cloudflare Access protects this Worker (configure it in the Cloudflare dashboard).
 * The existing client-side M2CSGA invitation gate stays in the Christmas UI.
 * Admin uploads additionally require a separate ADMIN_TOKEN secret.
 *
 * Do not commit or deploy private media as Workers static assets.
 */
const YEAR = 2026;
const MANIFEST = "config/calendar.json";
const ID = /^m[0-9]{3}$/;
const PUBLIC_FILES = new Set([
  "/", "/index.html", "/styles.css", "/access.js", "/app.js", "/i18n.js",
  "/surprises.js", "/surprises.en.js", "/secure-client.js", "/sw.js",
  "/manifest.webmanifest", "/assets/favicon.svg", "/admin.html", "/admin.js"
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
function equal(a,b) {
  if(typeof a!=="string" || typeof b!=="string" || a.length!==b.length || !a.length)return false;
  let mismatch=0;
  for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch===0;
}
function admin(request,env) {
  const secret=env.ADMIN_TOKEN;
  return typeof secret==="string" && secret.length>=32 && equal(request.headers.get("X-Admin-Token")||"",secret);
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
function locValid(value,limit,required=false){
  const validate=x=>typeof x==="string"&&x.length<=limit&&(!required||Boolean(x.trim()));
  if(validate(value))return true;
  if(!value||Array.isArray(value)||typeof value!=="object")return false;
  const keys=Object.keys(value);
  return keys.length===2 && keys.every(k=>["fr","en"].includes(k)) && validate(value.fr) && validate(value.en);
}
function checkManifest(data){
  if(!data||data.year!==YEAR||!Array.isArray(data.days)||data.days.length!==24)return "24 jours requis pour l'année 2026.";
  const days=new Set(),ids=new Set(),files=new Set();
  for(const entry of data.days){
    if(!Number.isInteger(entry.day)||entry.day<1||entry.day>24||days.has(entry.day))return "Jour invalide ou dupliqué.";
    days.add(entry.day);
    if(entry.type!=="album" && entry.type!=="science")return "Type de case non autorisé.";
    if(entry.type==="album"){
      if(!locValid(entry.title,160,true)||!locValid(entry.description,2000))return "Titre ou description bilingue invalide.";
      if(!Array.isArray(entry.media)||entry.media.length<1||entry.media.length>30)return "Nombre de médias invalide.";
      for(const media of entry.media){
        if(!ID.test(media.id)||ids.has(media.id))return "Identifiant média invalide ou dupliqué.";
        if(!["image","video"].includes(media.type))return "Type de média non autorisé.";
        if(typeof media.filename!=="string"||media.filename.length>180||!/^[-_a-zA-Z0-9. ()]+\.(jpg|jpeg|png|webp|mp4)$/i.test(media.filename)||files.has(media.filename))return "Nom de fichier invalide ou dupliqué.";
        if(media.type==="video" && !/\.mp4$/i.test(media.filename))return "Format vidéo invalide.";
        if(media.type==="image" && /\.mp4$/i.test(media.filename))return "Format image invalide.";
        if(media.caption!=null&&!locValid(media.caption,500))return "Légende invalide.";
        if(media.alt!=null&&!locValid(media.alt,250))return "Texte alternatif invalide.";
        ids.add(media.id);files.add(media.filename);
      }
    }
  }
  return days.size===24?null:"Il manque des journées.";
}
function publicAlbum(entry){
  return {day:entry.day,title:entry.title,description:entry.description,
    media:entry.media.map(x=>({id:x.id,type:x.type,caption:x.caption||"",alt:x.alt||""}))};
}
async function streamMedia(request,env,id) {
  if(!ID.test(id))return error(404,"Fichier introuvable.");
  const data=await loadManifest(env);
  const allowed=data?.days.some(d=>d.type==="album" && released(d.day) && d.media.some(m=>m.id===id));
  if(!allowed)return error(404,"Fichier indisponible.");
  const range=request.headers.get("Range");
  if(range && !/^bytes=(\d*)-(\d*)$/.test(range))return error(416,"Plage invalide.");
  const file=await env.MEDIA.get("media/"+id,range?{range:request.headers}:undefined);
  if(!file?.body)return error(404,"Fichier non importé.");
  const h=new Headers(BASE_HEADERS);
  file.writeHttpMetadata(h);
  h.set("Content-Type",h.get("Content-Type")||"application/octet-stream");
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
async function readSmallJson(request,max=100000){
  const n=Number(request.headers.get("Content-Length")||0);
  if(n>max)return null;
  const content=await request.text();
  if(new TextEncoder().encode(content).length>max)return null;
  try{return JSON.parse(content);}catch{return null;}
}
async function api(request,env){
  const path=new URL(request.url).pathname,method=request.method;
  if(path==="/api/health"&&method==="GET"){
    return send({ok:true,worker:true,r2Bound:Boolean(env.MEDIA),storageReady:Boolean(await loadManifest(env))});
  }
  const calendar=await loadManifest(env);
  if(path==="/api/calendar"&&method==="GET"){
    return send({ok:true,ready:Boolean(calendar),year:YEAR,
      days:calendar?calendar.days.map(d=>({
        day:d.day,type:d.type,available:released(d.day),
        count:released(d.day)&&d.type==="album"?d.media.length:0,
        ...(released(d.day)&&d.type==="album"?{title:d.title}:{})
      })):[]});
  }
  const matchDay=/^\/api\/day\/(\d{1,2})$/.exec(path);
  if(matchDay&&method==="GET"){
    const day=Number(matchDay[1]);
    if(day<1||day>24||!released(day))return error(403,"Cette case est encore fermée.");
    const entry=calendar?.days.find(d=>d.day===day);
    return entry?.type==="album"?send({ok:true,...publicAlbum(entry)}):error(404,"Pas d'album à cette date.");
  }
  const matchMedia=/^\/api\/media\/(m\d{3})$/.exec(path);
  if(matchMedia&&method==="GET")return streamMedia(request,env,matchMedia[1]);

  if(path.startsWith("/api/admin/")){
    // Cloudflare Access protects the application as a whole; uploads also need this
    // high-entropy organiser-only secret. The visitor code must not be used here.
    if(!admin(request,env))return error(403,"Jeton administrateur requis.");
    if(!env.MEDIA)return error(503,"Bucket R2 manquant.");
    if(path==="/api/admin/manifest"&&method==="GET")return send({ok:true,manifest:calendar});
    if(path==="/api/admin/manifest"&&method==="PUT"){
      if(!originOk(request))return error(403,"Origine non autorisée.");
      const body=await readSmallJson(request);
      const invalid=checkManifest(body);
      if(invalid)return error(400,invalid);
      await env.MEDIA.put(MANIFEST,JSON.stringify(body),{httpMetadata:{contentType:"application/json"}});
      return send({ok:true,albums:body.days.filter(d=>d.type==="album").length});
    }
    if(path==="/api/admin/status"&&method==="GET"){
      if(!calendar)return error(404,"Importer le manifeste au préalable.");
      const all=calendar.days.flatMap(d=>d.media||[]);
      const found=await Promise.all(all.map(async file=>({
        id:file.id,filename:file.filename,uploaded:Boolean(await env.MEDIA.head("media/"+file.id))
      })));
      return send({ok:true,media:found});
    }
    const upload=/^\/api\/admin\/media\/(m\d{3})$/.exec(path);
    if(upload&&method==="PUT"){
      if(!originOk(request))return error(403,"Origine non autorisée.");
      if(!calendar)return error(404,"Importer le manifeste en premier.");
      const file=calendar.days.flatMap(d=>d.media||[]).find(m=>m.id===upload[1]);
      if(!file)return error(404,"ID de média inconnu.");
      const max=24*1024*1024;
      const provided=request.headers.get("Content-Length");
      const declared=provided===null?null:Number(provided);
      if(declared!==null && (!Number.isInteger(declared)||declared<1||declared>max))return error(413,"Fichier trop volumineux (24 Mio max).");
      const mime=request.headers.get("Content-Type")?.split(";")[0]?.toLowerCase();
      const good=file.type==="video"?["video/mp4"]:["image/jpeg","image/png","image/webp"];
      if(!good.includes(mime))return error(415,"Type de média invalide.");
      const buffer=await request.arrayBuffer();
      const length=buffer.byteLength;
      if(length<1 || length>max)return error(413,"Fichier trop volumineux (24 Mio max).");
      if(declared!==null && length!==declared)return error(400,"Longueur invalide.");
      await env.MEDIA.put("media/"+file.id,buffer,{httpMetadata:{contentType:mime}});
      return send({ok:true,id:file.id,bytes:length});
    }
  }
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
