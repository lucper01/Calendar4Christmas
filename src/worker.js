/**
 * Calendar4Christmas - Cloudflare Worker serving photo albums from private R2.
 *
 * Cloudflare Access must protect all Worker routes and media endpoints.
 * The existing client-side M2CSGA invitation gate stays in the Christmas UI.
 * Administration uses the same triche demo session, behind Cloudflare Access. No admin token.
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
  "/manifest.webmanifest", "/assets/favicon.svg", "/admin.html", "/admin.js", 
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

const MEDIA_PREFIX = "media/";
const allowedTypes = {"image/jpeg":".jpg","image/png":".png","image/webp":".webp","video/mp4":".mp4"};
const localized = value => {
  if(typeof value === "string")return {fr:value,en:value};
  return {fr:String(value?.fr||""),en:String(value?.en||"")};
};
function normalizeManifest(data) {
  if(!data || data.year!==YEAR || !Array.isArray(data.days)||data.days.length!==24)throw Error("Manifest invalid");
  if(data.schemaVersion===2 && Array.isArray(data.mediaLibrary)){
    return data;
  }
  const library=[];
  const days=data.days.map((d,i)=>{
    const media=Array.isArray(d.media)?d.media:[];
    media.forEach(item=>library.push({
      id:item.id,type:item.type,filename:item.filename,
      caption:localized(item.caption),alt:localized(item.alt)
    }));
    return {day:i+1,type:"album",
      title:localized(d.title||{fr:"Jour "+(i+1),en:"Day "+(i+1)}),
      description:localized(d.description),
      media:media.map(x=>x.id),
      bonus:{type:"surprise"}};
  });
  // The original calendar had media only on days 1-21. Move exactly one
  // photograph from each of the three largest albums to days 22-24,
  // ensuring every day presents media as well as its scientific bonus.
  for(const day of days.filter(d=>d.media.length===0)){
    const donor=[...days].filter(d=>d.media.length>1)
      .sort((a,b)=>b.media.length-a.media.length||a.day-b.day)[0];
    if(donor)day.media.push(donor.media.pop());
  }
  return {year:YEAR,schemaVersion:2,mediaLibrary:library,days};
}
async function loadManifest(env) {
  if(!env.MEDIA)return null;
  const obj=await env.MEDIA.get(MANIFEST);
  if(!obj)return null;
  try{return normalizeManifest(await obj.json());}catch{return null;}
}
function entryFor(data,day){return data?.days.find(x=>x.day===Number(day));}
function mediaById(data,id){return data?.mediaLibrary.find(x=>x.id===id);}
function publicAlbum(data,entry) {
  return {day:entry.day,title:entry.title,description:entry.description,
    bonus:entry.bonus||{type:"surprise"},
    media:entry.media.map(id=>mediaById(data,id))
      .filter(Boolean).map(x=>({id:x.id,type:x.type,caption:x.caption||"",alt:x.alt||""}))};
}
function mediaInReleasedDay(data,id,request){
  return data?.days.some(d=>
    (released(d.day)||demoEnabled(request)) && d.media.includes(id)
  )===true;
}
async function streamMedia(request,env,id) {
  if(!ID.test(id))return error(404,"Fichier introuvable.");
  const data=await loadManifest(env);
  const item=mediaById(data,id);
  if(!item || !(demoEnabled(request)||mediaInReleasedDay(data,id,request)))return error(404,"Fichier indisponible.");
  const ext=Object.values(allowedTypes).find(x=>item.filename.toLowerCase().endsWith(x))
    || (/\.jpeg$/i.test(item.filename)?".jpeg":null);
  if(!ext)return error(415,"Extension inconnue.");
  const mime=Object.entries(allowedTypes).find(([,value])=>value===ext)?.[0] || "image/jpeg";
  const range=request.headers.get("Range");
  if(range && !/^bytes=(\d*)-(\d*)$/.test(range))return error(416,"Plage invalide.");
  const file=await env.MEDIA.get(MEDIA_PREFIX+id+ext,range?{range:request.headers}:undefined);
  if(!file?.body)return error(404,"Fichier non importé.");
  const h=new Headers(BASE_HEADERS);
  file.writeHttpMetadata(h);
  h.set("Content-Type",mime);
  h.set("Content-Security-Policy","default-src 'none'; sandbox");
  h.set("Accept-Ranges","bytes");
  h.set("ETag",file.httpEtag);
  if(range && file.range){
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
async function readJson(request,max=180000){
  const declared=Number(request.headers.get("Content-Length")||0);
  if(declared>max)return null;
  const text=await request.text();
  if(new TextEncoder().encode(text).length>max)return null;
  try{return JSON.parse(text);}catch{return null;}
}
function validLocale(value,max,required=false){
  return value && typeof value==="object" && ["fr","en"].every(k=>
    typeof value[k]==="string" && value[k].length<=max
    && (!required || value[k].trim().length>0));
}
function validateManifest(data){
  if(!data || data.year!==YEAR || data.schemaVersion!==2 ||
     !Array.isArray(data.mediaLibrary)||!Array.isArray(data.days) ||
     data.days.length!==24 || data.mediaLibrary.length>500)return "Structure du calendrier invalide.";
  const ids=new Set();
  for(const m of data.mediaLibrary){
    if(!ID.test(m.id)||ids.has(m.id)||!["image","video"].includes(m.type) ||
       typeof m.filename!=="string"||m.filename.length>180 ||
       !/\.(jpg|jpeg|png|webp|mp4)$/i.test(m.filename) ||
       !validLocale(m.caption,800)||!validLocale(m.alt,320))return "Médiathèque invalide.";
    ids.add(m.id);
  }
  const days=new Set();
  for(const d of data.days){
    if(!Number.isInteger(d.day)||d.day<1||d.day>24||days.has(d.day) ||
       d.type!=="album"||!validLocale(d.title,180,true)||
       !validLocale(d.description,3000)||!Array.isArray(d.media)||
       d.media.length<1||d.media.length>50||
       d.media.some(id=>!ids.has(id))||
       (new Set(d.media)).size!==d.media.length)return "Il faut au moins une photo ou vidéo valide par jour.";
    days.add(d.day);
    const b=d.bonus||{type:"surprise"};
    if(!["surprise","quiz","info"].includes(b.type))return "Bonus inconnu.";
    if(b.type==="info"&&(!validLocale(b.title,180,true)||!validLocale(b.body,3000,true)))return "Information quotidienne invalide.";
    if(b.type==="quiz" && (!validLocale(b.question,320,true) ||
       !b.options || !["fr","en"].every(lang=>Array.isArray(b.options[lang]) &&
           b.options[lang].length>=2 && b.options[lang].length<=4 &&
           b.options[lang].every(a=>typeof a==="string"&&a.trim()&&a.length<=250)) ||
       !Number.isInteger(b.correctIndex)||b.correctIndex<0 ||
       b.correctIndex>=b.options.fr.length||b.options.en.length!==b.options.fr.length ||
       !validLocale(b.explanation,1500)))return "Quiz quotidien invalide.";
  }
  return null;
}
async function adminApi(request,env,path,method,calendar){
  if(!demoEnabled(request))return error(403,"Active le mode démo avec le code requis.");
  if(!env.MEDIA)return error(503,"Stockage R2 indisponible.");
  if(path==="/api/admin/calendar" && method==="GET")
    return calendar?send({ok:true,manifest:calendar}):error(404,"Manifeste absent.");
  if(path==="/api/admin/calendar" && method==="PUT"){
    if(!originOk(request))return error(403,"Origine non autorisée.");
    const body=await readJson(request);
    const invalid=validateManifest(body);
    if(invalid)return error(400,invalid);
    // Never trust a browser-supplied filename or media ID for existing objects.
    // Descriptive changes remain editable, but IDs/files must belong to R2's catalog.
    const old=new Map((calendar?.mediaLibrary||[]).map(m=>[m.id,m]));
    if(body.mediaLibrary.length!==old.size)return error(409,"Recharger la médiathèque avant de sauvegarder.");
    for(const item of body.mediaLibrary){
      const prev=old.get(item.id);
      if(!prev||prev.filename!==item.filename||prev.type!==item.type)
        return error(409,"Les fichiers existants ne peuvent pas être renommés ici.");
    }
    await env.MEDIA.put(MANIFEST,JSON.stringify(body),{
      httpMetadata:{contentType:"application/json"}
    });
    return send({ok:true,saved:true,days:24,media:body.mediaLibrary.length});
  }
  if(path==="/api/admin/media" && method==="POST"){
    if(!originOk(request))return error(403,"Origine non autorisée.");
    if(!calendar)return error(404,"Manifeste manquant.");
    const mime=(request.headers.get("Content-Type")||"").split(";")[0].toLowerCase();
    if(!allowedTypes[mime])return error(415,"Photo JPEG/PNG/WebP ou vidéo MP4 attendue.");
    const max=24*1024*1024;
    const expected=Number(request.headers.get("Content-Length")||0);
    if(expected>max)return error(413,"Média trop volumineux (24 Mio maximum).");
    const bytes=await request.arrayBuffer();
    if(bytes.byteLength===0||bytes.byteLength>max)return error(413,"Taille du média invalide.");
    const view=new Uint8Array(bytes,0,Math.min(bytes.byteLength,16));
    const signature=(mime==="image/jpeg"&&view[0]===255&&view[1]===216) ||
      (mime==="image/png"&&view[0]===137&&view[1]===80&&view[2]===78&&view[3]===71) ||
      (mime==="image/webp"&&String.fromCharCode(...view.slice(0,4))==="RIFF"&&String.fromCharCode(...view.slice(8,12))==="WEBP") ||
      (mime==="video/mp4"&&String.fromCharCode(...view.slice(4,8))==="ftyp");
    if(!signature)return error(415,"Signature du fichier incompatible avec son format.");
    const next=Math.max(0,...calendar.mediaLibrary.map(x=>Number(x.id.slice(1))||0))+1;
    if(next>999)return error(409,"Nombre maximal de médias atteint.");
    const id="m"+String(next).padStart(3,"0");
    const ext=allowedTypes[mime];
    // Preserve original filename for reference only, not for R2 object paths.
    const original=(request.headers.get("X-Filename")||"").slice(0,150).replace(/[\\/\x00-\x1f]/g,"");
    const item={id,filename:id+ext,type:mime==="video/mp4"?"video":"image",
      original,caption:{fr:"",en:""},alt:{fr:original||"Photo du laboratoire",en:original||"Laboratory photo"}};
    await env.MEDIA.put(MEDIA_PREFIX+id+ext,bytes,{httpMetadata:{contentType:mime}});
    const updated={...calendar,mediaLibrary:[...calendar.mediaLibrary,item]};
    await env.MEDIA.put(MANIFEST,JSON.stringify(updated),{
      httpMetadata:{contentType:"application/json"}
    });
    return send({ok:true,media:item,count:updated.mediaLibrary.length});
  }
  if(path==="/api/admin/status" && method==="GET"){
    if(!calendar)return error(404,"Manifeste manquant.");
    const present=await Promise.all(calendar.mediaLibrary.map(async m=>{
      const ext=m.filename.slice(m.filename.lastIndexOf("."));
      return {id:m.id,exists:Boolean(await env.MEDIA.head(MEDIA_PREFIX+m.id+ext))};
    }));
    return send({ok:true,total:present.length,present:present.filter(x=>x.exists).length,
      missing:present.filter(x=>!x.exists).map(x=>x.id)});
  }
  return error(404,"Route administrateur inconnue.");
}
async function api(request,env) {
  const path=new URL(request.url).pathname,method=request.method;
  if(path==="/api/demo"){
    if(method==="GET")return send({ok:true,demo:demoEnabled(request)});
    if(method==="DELETE"){
      if(!originOk(request))return error(403,"Origine non autorisée.");
      return send({ok:true,demo:false},200,{"Set-Cookie":demoCookie(false)});
    }
    if(method==="POST"){
      if(!originOk(request))return error(403,"Origine non autorisée.");
      if(Number(request.headers.get("Content-Length")||0)>256)return error(413,"Requête trop volumineuse.");
      const content=await request.text();
      if(content.length>256)return error(413,"Requête trop volumineuse.");
      let value;try{value=JSON.parse(content);}catch{return error(400,"Code démo requis.");}
      if(typeof value?.code!=="string"||value.code.trim().toLowerCase()!==DEMO_CODE)
        return error(401,"Code démo incorrect.");
      return send({ok:true,demo:true},200,{"Set-Cookie":demoCookie(true)});
    }
    return error(405,"Méthode non autorisée.");
  }
  if(path==="/api/health"&&method==="GET"){
    return send({ok:true,worker:true,r2Bound:Boolean(env.MEDIA),storageReady:Boolean(await loadManifest(env))});
  }
  const calendar=await loadManifest(env);
  if(path.startsWith("/api/admin/"))return adminApi(request,env,path,method,calendar);
  if(path==="/api/calendar"&&method==="GET"){
    return send({ok:true,ready:Boolean(calendar),year:YEAR,demo:demoEnabled(request),
      days:calendar?calendar.days.map(d=>({
        day:d.day,type:"album",available:released(d.day)||demoEnabled(request),
        count:(released(d.day)||demoEnabled(request))?d.media.length:0,
        ...(released(d.day)||demoEnabled(request)?{title:d.title}:{})
      })):[]});
  }
  const dayMatch=/^\/api\/day\/(\d{1,2})$/.exec(path);
  if(dayMatch&&method==="GET"){
    const day=Number(dayMatch[1]);
    if(day<1||day>24||!(released(day)||demoEnabled(request)))return error(403,"Case verrouillée.");
    const entry=entryFor(calendar,day);
    return entry?send({ok:true,...publicAlbum(calendar,entry)}):error(404,"Case introuvable.");
  }
  const mediaMatch=/^\/api\/media\/(m\d{3})$/.exec(path);
  if(mediaMatch&&method==="GET")return streamMedia(request,env,mediaMatch[1]);
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
