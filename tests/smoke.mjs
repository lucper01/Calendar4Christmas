import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import worker from "../src/worker.js";

const BASE="https://calendar4christmas.example";
const calendar={year:2026,days:Array.from({length:24},(_,i)=>i===0?{
  day:1,type:"album",title:{fr:"Photos test",en:"Test photos"},
  description:{fr:"Exemple",en:"Example"},media:[{
    id:"m001",type:"image",filename:"holiday.jpg",
    caption:{fr:"Une image",en:"An image"},alt:{fr:"Photo test",en:"Test photograph"}
  }]
}:{day:i+1,type:"science"})};
const sample=Uint8Array.from([0xff,0xd8,0xff,0xd9]);
const objects=new Map([["calendar.json",calendar],["media/m001.jpg",sample]]);
const MEDIA={
  get:async key=>{
    if(!objects.has(key))return null;
    const obj=objects.get(key);
    if(key==="calendar.json")return {json:async()=>obj};
    return {body:new Blob([obj]).stream(),size:obj.byteLength,httpEtag:'"test"',
      writeHttpMetadata:h=>h.set("Content-Type","image/jpeg")};
  },
  put:async()=>{throw Error("R2 modifications disabled: dashboard-only uploads");},
  head:async()=>{throw Error("R2 read-only API");}
};
const ASSETS={fetch:async()=>new Response("<html>Advent</html>",{headers:{"content-type":"text/html"}})};
const env={MEDIA,ASSETS};
async function call(path,init={}) {
  const request=new Request(BASE+path,{...init,
    headers:{"Origin":BASE,...(init.headers||{})}});
  return worker.fetch(request,env);
}
assert.equal((await call("/")).status,200);
const health=await (await call("/api/health")).json();
assert.equal(health.r2Bound,true);
assert.equal(health.storageReady,true);
const listing=await (await call("/api/calendar")).json();
assert.equal(listing.days.length,24);
assert.equal(listing.days[0].type,"album");
assert.equal("filename" in listing.days[0],false);
const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
  timeZone:"Europe/Paris",year:"numeric",month:"numeric",day:"numeric"
}).formatToParts(new Date()).map(x=>[x.type,Number(x.value)]));
const released=parts.year>2026||(parts.year===2026&&parts.month===12&&parts.day>=1);
assert.equal((await call("/api/day/1")).status,released?200:403);
const media=await call("/api/media/m001");
assert.equal(media.status,released?200:404);
if(released){
 assert.equal(media.headers.get("content-type"),"image/jpeg");
 const album=await (await call("/api/day/1")).json();
 assert.equal("filename" in album.media[0],false);
 assert.equal(album.media[0].id,"m001");
}
assert.equal((await call("/api/admin/manifest")).status,404);
assert.equal((await call("/api/admin/media/m001",{method:"PUT",body:sample})).status,404);
assert.equal((await call("/api/media/m001",{method:"PUT",body:sample})).status,405);
assert.equal((await call("/api/media/m001",{headers:{Range:"bytes=malformed"}})).status,released?416:404);
const web=await call("/");
assert.match(web.headers.get("content-security-policy"),/script-src 'self'/);
const scope={window:{}};
vm.runInNewContext(readFileSync("public/surprises.js","utf8"),scope);
vm.runInNewContext(readFileSync("public/surprises.en.js","utf8"),scope);
assert.equal(scope.window.SURPRISES.length,47);
assert.equal(scope.window.C4C_SURPRISES_EN.length,47);
scope.window.C4C_SURPRISES_EN.forEach((entry,i)=>{
  assert.ok(entry.title && entry.body,"English translation missing: "+i);
  if(scope.window.SURPRISES[i].type==="quiz")assert.equal(entry.options.length,3);
});
const fakeDoc={readyState:"loading",addEventListener(){},querySelectorAll(){return []},documentElement:{lang:"fr"}};
const locale={window:{dispatchEvent(){}},document:fakeDoc,
  navigator:{language:"fr"},localStorage:{getItem(){return null},setItem(){}},CustomEvent:class{}};
vm.runInNewContext(readFileSync("public/i18n.js","utf8"),locale);
const keys=[...readFileSync("public/index.html","utf8").matchAll(/data-i18n(?:-placeholder|-aria)?="([^"]+)"/g)].map(m=>m[1]);
for(const key of keys){
  assert.notEqual(locale.window.C4C_I18N.t(key),key,"FR label missing: "+key);
  locale.window.C4C_I18N.change("en");
  assert.notEqual(locale.window.C4C_I18N.t(key),key,"EN label missing: "+key);
  locale.window.C4C_I18N.change("fr");
}
assert.ok(readFileSync("public/index.html","utf8").includes("secure-client.js"),"Gallery script missing");
assert.ok(readFileSync("public/access.js","utf8").includes("EXPECTED_HEX"),"Existing invitation code gate missing");
assert.equal(readFileSync("src/worker.js","utf8").includes("ADMIN_TOKEN"),false);
assert.equal(readFileSync("src/worker.js","utf8").includes("/api/admin"),false);
console.log("PASS: Cloudflare R2 read-only gallery, dates, no admin endpoints, FR/EN");
