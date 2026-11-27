import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";
import worker from "../src/worker.js";

globalThis.crypto ||= webcrypto;
const BASE="https://calendar4christmas.example";
const accessCode="test-only-invite";
const adminToken="a".repeat(48);
const secret="b".repeat(64);
const data={
  year:2026,
  days:Array.from({length:24},(_,index)=>index===0?{
    day:1,type:"album",title:{fr:"Album test",en:"Test album"},
    description:{fr:"Description",en:"Description"},
    media:[{id:"m001",type:"image",filename:"test.jpg",
      caption:{fr:"Légende",en:"Caption"},alt:{fr:"Image test",en:"Test image"}}]
  }:{day:index+1,type:"science"})
};
const objects=new Map([["config/calendar.json",data]]);
const MEDIA={
  get:async key=>{
    if(key==="config/calendar.json" && objects.has(key))return {json:async()=>objects.get(key)};
    if(key==="media/m001" && objects.has(key)){
      const bytes=objects.get(key);
      return {
        body:new Blob([bytes]).stream(),
        size:bytes.byteLength,httpEtag:'"test-etag"',
        writeHttpMetadata:headers=>headers.set("Content-Type","image/jpeg")
      };
    }
    return null;
  },
  put:async(key,value)=>{objects.set(key,typeof value==="string"?JSON.parse(value):value);},
  head:async(key)=>objects.has(key)?{key}:null
};
const ASSETS={fetch:async request=>new Response("<!doctype html><title>Calendar</title>",{status:200,headers:{"content-type":"text/html"}})};
const env={ACCESS_CODE:accessCode,SESSION_SECRET:secret,ADMIN_TOKEN:adminToken,MEDIA,ASSETS};
function req(path,init={}){
  return new Request(BASE+path,{
    ...init,
    headers:{"Origin":BASE,"CF-Connecting-IP":"198.51.100.70",...(init.headers||{})}
  });
}
async function call(path,init={}){return worker.fetch(req(path,init),env);}
function postJson(path,data,headers={}){return call(path,{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(data)});}
const health=await call("/api/health");
assert.equal(health.status,200);
assert.deepEqual(await health.json(),{ok:true,worker:true,configured:true,r2Bound:true});
assert.equal((await call("/api/calendar")).status,401);
assert.equal((await postJson("/api/session",{code:"incorrect"})).status,401);
const login=await postJson("/api/session",{code:accessCode});
assert.equal(login.status,200);
const setCookie=login.headers.get("set-cookie");
assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Strict/);
const cookie=setCookie.split(";")[0];
const auth={"Cookie":cookie};
const token={"Cookie":cookie,"X-Admin-Token":adminToken};
assert.equal((await call("/api/session",{headers:auth})).status,200);
assert.equal((await call("/api/calendar",{headers:auth})).status,200);
const calendar=await (await call("/api/calendar",{headers:auth})).json();
assert.equal(calendar.days.length,24);
assert.equal("filename" in calendar.days[0],false);
assert.equal((await call("/api/admin/manifest",{headers:auth})).status,403);
assert.equal((await call("/api/admin/manifest",{headers:token})).status,200);
const manifest=(await (await call("/api/admin/manifest",{headers:token})).json()).manifest;
assert.equal(manifest.days[0].title.en,"Test album");
assert.equal((await call("/api/admin/manifest",{method:"PUT",headers:{...token,"Content-Type":"application/json"},body:JSON.stringify({...data,days:[]})})).status,400);
const bytes=new Uint8Array([255,216,255,217]);
const upload=await call("/api/admin/media/m001",{method:"PUT",headers:{...token,"Content-Length":String(bytes.length),"Content-Type":"image/jpeg"},body:bytes});
assert.equal(upload.status,200);
const status=await (await call("/api/admin/status",{headers:token})).json();
assert.equal(status.media[0].uploaded,true);
const unauth=await call("/api/media/m001");
assert.equal(unauth.status,401);
const day=await call("/api/day/1",{headers:auth});
const paris=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
const p=Object.fromEntries(paris.map(x=>[x.type,Number(x.value)]));
const firstReleased=p.year>2026 || (p.year===2026 && p.month===12 && p.day>=1);
assert.equal(day.status,firstReleased?200:403);
if(firstReleased){
  const album=await day.json();
  assert.equal(album.media[0].id,"m001");
  assert.equal("filename" in album.media[0],false);
  assert.equal((await call("/api/media/m001",{headers:auth})).status,200);
}
assert.equal((await call("/",{})).status,200);
const staticResponse=await call("/");
assert.match(staticResponse.headers.get("content-security-policy"),/script-src 'self'/);
const logout=await call("/api/session",{method:"DELETE",headers:auth});
assert.equal(logout.status,200);
assert.match(logout.headers.get("set-cookie"),/Max-Age=0/);
const scope={window:{}};
vm.runInNewContext(readFileSync("public/surprises.js","utf8"),scope);
vm.runInNewContext(readFileSync("public/surprises.en.js","utf8"),scope);
assert.equal(scope.window.SURPRISES.length,47);
assert.equal(scope.window.C4C_SURPRISES_EN.length,47);
scope.window.C4C_SURPRISES_EN.forEach((entry,i)=>{
  assert.ok(entry.title&&entry.body,"Missing English translation at "+i);
  if(scope.window.SURPRISES[i].type==="quiz")assert.equal(entry.options.length,3);
});
const doc={readyState:"loading",addEventListener(){},querySelectorAll(){return[]},documentElement:{lang:"fr"}};
const localeCtx={window:{dispatchEvent(){},addEventListener(){}},document:doc,navigator:{language:"fr"},localStorage:{getItem(){return null},setItem(){}},CustomEvent:class{}};
vm.runInNewContext(readFileSync("public/i18n.js","utf8"),localeCtx);
const keys=[...readFileSync("public/index.html","utf8").matchAll(/data-i18n(?:-placeholder|-aria)?="([^"]+)"/g)].map(x=>x[1]);
for(const key of keys){
  assert.notEqual(localeCtx.window.C4C_I18N.t(key),key,"Missing French localization for "+key);
  localeCtx.window.C4C_I18N.change("en");
  assert.notEqual(localeCtx.window.C4C_I18N.t(key),key,"Missing English localization for "+key);
  localeCtx.window.C4C_I18N.change("fr");
}
console.log("PASS: secure session, route gating, R2 upload, bilingual manifest, 47 translations and all UI labels");
