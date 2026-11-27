import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import worker from "../src/worker.js";

const BASE="https://calendar4christmas.example";
const adminToken="a".repeat(64);
const manifest={
  year:2026,days:Array.from({length:24},(_,i)=>i===0?{
    day:1,type:"album",title:{fr:"Photos test",en:"Test photos"},
    description:{fr:"Légende",en:"Caption"},
    media:[{id:"m001",type:"image",filename:"holiday.jpg",
      caption:{fr:"Une photo",en:"A photo"},alt:{fr:"Photo test",en:"Test photo"}}]
  }:{day:i+1,type:"science"})
};
const objects=new Map();
const MEDIA={
  get:async key=>{
    if(!objects.has(key))return null;
    if(key==="config/calendar.json")return {json:async()=>objects.get(key)};
    const bytes=objects.get(key);
    return {body:new Blob([bytes]).stream(),size:bytes.byteLength,
      httpEtag:'"test"',writeHttpMetadata:h=>h.set("Content-Type","image/jpeg")};
  },
  put:async(key,val)=>{objects.set(key,typeof val==="string"?JSON.parse(val):val);},
  head:async key=>objects.has(key)?{key}:null
};
const env={
  ADMIN_TOKEN:adminToken,MEDIA,
  ASSETS:{fetch:async()=>new Response("<html>Advent</html>",{status:200,headers:{"content-type":"text/html"}})}
};
function request(path,init={}){
  return new Request(BASE+path,{...init,
    headers:{"Origin":BASE,"CF-Connecting-IP":"198.51.100.5",...(init.headers||{})}});
}
const call=(path,init)=>worker.fetch(request(path,init),env);
const apiJson=(path,method,body,headers={})=>call(path,{method,headers:{
  "Content-Type":"application/json",...headers},body:JSON.stringify(body)});
const admin={"X-Admin-Token":adminToken};
assert.equal((await call("/")).status,200);
assert.equal((await call("/api/health")).status,200);
assert.equal((await call("/api/admin/manifest")).status,403);
assert.equal((await call("/api/calendar")).status,200);
const badManifest={...manifest,days:[]};
assert.equal((await apiJson("/api/admin/manifest","PUT",badManifest,admin)).status,400);
assert.equal((await apiJson("/api/admin/manifest","PUT",manifest,admin)).status,200);
const cal=(await (await call("/api/calendar")).json());
assert.equal(cal.days.length,24);
assert.equal(cal.days[0].type,"album");
assert.equal("filename" in cal.days[0],false);
const p=(await new Intl.DateTimeFormat("en-GB",{
 timeZone:"Europe/Paris",year:"numeric",month:"numeric",day:"numeric"
}).formatToParts(new Date()).reduce((o,item)=>{o[item.type]=Number(item.value);return o;},{}));
const released=p.year>2026||(p.year===2026&&p.month===12&&p.day>=1);
const day=await call("/api/day/1");
assert.equal(day.status,released?200:403);
const beforeMedia=await call("/api/media/m001");
assert.equal(beforeMedia.status,404);
const jpeg=Uint8Array.from([255,216,255,217]);
assert.equal((await call("/api/admin/media/m001",{
  method:"PUT",headers:{"Content-Type":"image/jpeg",...admin},body:jpeg
})).status,200);
assert.equal((await call("/api/admin/status",{headers:admin})).status,200);
const media=await call("/api/media/m001");
assert.equal(media.status,released?200:404);
assert.equal((await call("/api/admin/media/m001",{
 method:"PUT",headers:{"Content-Type":"application/octet-stream",...admin},body:jpeg
})).status,415);
assert.equal((await call("/api/admin/manifest",{headers:admin})).status,200);
assert.match((await call("/")).headers.get("content-security-policy"),/script-src 'self'/);
const scope={window:{}};
vm.runInNewContext(readFileSync("public/surprises.js","utf8"),scope);
vm.runInNewContext(readFileSync("public/surprises.en.js","utf8"),scope);
assert.equal(scope.window.SURPRISES.length,47);
assert.equal(scope.window.C4C_SURPRISES_EN.length,47);
scope.window.C4C_SURPRISES_EN.forEach((entry,i)=>{
  assert.ok(entry.title&&entry.body,"Missing EN translation at "+i);
  if(scope.window.SURPRISES[i].type==="quiz")assert.equal(entry.options.length,3);
});
const fakeDoc={readyState:"loading",addEventListener(){},querySelectorAll(){return[]},documentElement:{lang:"fr"}};
const locale={window:{dispatchEvent(){}},document:fakeDoc,
  navigator:{language:"fr"},localStorage:{getItem(){return null},setItem(){}},CustomEvent:class{}};
vm.runInNewContext(readFileSync("public/i18n.js","utf8"),locale);
const keys=[...readFileSync("public/index.html","utf8").matchAll(/data-i18n(?:-placeholder|-aria)?="([^"]+)"/g)].map(x=>x[1]);
for(const key of keys){
  assert.notEqual(locale.window.C4C_I18N.t(key),key,"Missing FR label "+key);
  locale.window.C4C_I18N.change("en");
  assert.notEqual(locale.window.C4C_I18N.t(key),key,"Missing EN label "+key);
  locale.window.C4C_I18N.change("fr");
}
const html=readFileSync("public/index.html","utf8");
assert.ok(html.includes("./secure-client.js"),"gallery script missing");
assert.ok(html.includes("access-gate"),"invitation gate missing");
assert.ok(readFileSync("public/access.js","utf8").includes("EXPECTED_HEX"),"existing client code gate missing");
console.log("PASS: Cloudflare Worker + R2 release, admin upload, bilingual assets and 47 translations");
