import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import worker from "../src/worker.js";
const BASE="https://calendar4christmas.example";
const original={year:2026,days:Array.from({length:24},(_,i)=>({
 day:i+1,type:i<21?"album":"science",
 title:{fr:"Jour "+(i+1),en:"Day "+(i+1)},
 description:{fr:"Journal du laboratoire",en:"Laboratory log"},
 ...(i<21?{media:i<3?[
  {id:"m"+String(i*2+1).padStart(3,"0"),type:"image",filename:"portrait"+i+".jpg",caption:{fr:"",en:""},alt:{fr:"Photo",en:"Photo"}},
  {id:"m"+String(i*2+2).padStart(3,"0"),type:"image",filename:"portrait"+i+".jpg",caption:{fr:"",en:""},alt:{fr:"Photo",en:"Photo"}}]:[
  {id:"m"+String(i+4).padStart(3,"0"),type:"image",filename:"image"+i+".jpg",caption:{fr:"",en:""},alt:{fr:"Photo",en:"Photo"}}]
 }:{})
}))};
const images=new Map();
for(const d of original.days)for(const item of d.media||[])images.set("media/"+item.id+".jpg",new Uint8Array([255,216,255,217]));
const entries=new Map([["calendar.json",original],...images]);
const MEDIA={
 get:async(key)=>{if(!entries.has(key))return null;
  const content=entries.get(key);
  if(key==="calendar.json")return {json:async()=>structuredClone(content)};
  return {body:new Blob([content]).stream(),size:content.byteLength,httpEtag:'"test"',
   writeHttpMetadata:headers=>headers.set("Content-Type","image/jpeg")};},
 put:async(key,value)=>{entries.set(key,typeof value==="string"?JSON.parse(value):new Uint8Array(value));},
 head:async(key)=>entries.has(key)?{key}:null
};
const ASSETS={fetch:async()=>new Response("Calendar",{headers:{"Content-Type":"text/html"}})};
async function call(path,options={}){
 const request=new Request(BASE+path,{...options,headers:{"Origin":BASE,...options.headers}});
 return worker.fetch(request,{MEDIA,ASSETS});
}
const json=async(path,method,body,headers={})=>call(path,{method,
 headers:{"Content-Type":"application/json",...headers},
 body:JSON.stringify(body)});
const health=await (await call("/api/health")).json();
assert.equal(health.storageReady,true);
const regular=await (await call("/api/calendar")).json();
assert.equal(regular.days.length,24);
assert.ok(regular.days.every(d=>d.type==="album"),"All 24 days have media");
const dateParts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
 timeZone:"Europe/Paris",year:"numeric",month:"numeric",day:"numeric"
}).formatToParts(new Date()).map(x=>[x.type,Number(x.value)]));
const released=dateParts.year>2026||(dateParts.year===2026&&dateParts.month===12&&dateParts.day>=1);
assert.equal((await call("/api/day/1")).status,released?200:403);
assert.equal((await call("/api/admin/calendar")).status,403);
assert.equal((await call("/api/admin/calendar",{headers:{"Cookie":"c4c_demo=1"}})).status,403);
assert.equal((await call("/api/admin/calendar",{headers:{"Cookie":"c4c_demo=9999999999."+("0".repeat(64))}})).status,403);
assert.equal((await json("/api/demo","POST",{code:"incorrect"})).status,401);
const enabled=await json("/api/demo","POST",{code:"triche"});
assert.equal(enabled.status,200);
const token={"Cookie":enabled.headers.get("Set-Cookie").split(";")[0]};
const admin=await (await call("/api/admin/calendar",{headers:token})).json();
assert.equal(admin.manifest.schemaVersion,2);
assert.equal(admin.manifest.days.length,24);
assert.ok(admin.manifest.days.every(x=>x.media.length>=1),"No empty daily galleries after upgrade");
assert.equal(admin.manifest.days.reduce((a,x)=>a+x.media.length,0),original.days.reduce((a,x)=>a+(x.media||[]).length,0));
const preview=await (await call("/api/calendar",{headers:token})).json();
assert.ok(preview.days.every(d=>d.available));
const album=await (await call("/api/day/24",{headers:token})).json();
assert.ok(album.media.length>=1);
assert.equal(album.bonus.type,"surprise");
assert.equal((await call("/api/media/"+album.media[0].id,{headers:token})).status,200);
assert.equal((await json("/api/admin/calendar","PUT",{},token)).status,400);
const updated=admin.manifest;
updated.days[0].bonus={type:"quiz",
 question:{fr:"La bonne réponse ?",en:"Correct answer?"},
 options:{fr:["Oui","Non"],en:["Yes","No"]},
 correctIndex:0,explanation:{fr:"Explication",en:"Explanation"}};
updated.days[1].bonus={type:"info",title:{fr:"La science",en:"Science"},
 body:{fr:"Une information du jour",en:"A daily fact"}};
assert.equal((await json("/api/admin/calendar","PUT",updated,token)).status,200);
const changed=await (await call("/api/day/1",{headers:token})).json();
assert.equal(changed.bonus.type,"quiz");
const first=await (await call("/api/admin/calendar",{headers:token})).json();
assert.equal(first.manifest.days[1].bonus.type,"info");
const image=Uint8Array.from([255,216,255,217]);
const uploaded=await call("/api/admin/media",{
 method:"POST",headers:{...token,"Content-Type":"image/jpeg","X-Filename":encodeURIComponent("cafetière.jpg")},
 body:image
});
assert.equal(uploaded.status,200);
const up=await uploaded.json();
assert.ok(/^m\d{3}$/.test(up.media.id));
assert.equal(up.media.type,"image");
assert.equal((await call("/api/media/"+up.media.id,{headers:token})).status,200);
const state=await (await call("/api/admin/calendar",{headers:token})).json();
assert.equal(state.manifest.mediaLibrary.length,updated.mediaLibrary.length+1);
state.manifest.days[23].media.push(up.media.id);
assert.equal((await json("/api/admin/calendar","PUT",state.manifest,token)).status,200);
assert.equal((await call("/api/admin/status",{headers:token})).status,200);
const exit=await call("/api/demo",{method:"DELETE",headers:token});
assert.equal(exit.status,200);
assert.match(exit.headers.get("Set-Cookie"),/Max-Age=0/);
const cleared={"Cookie":exit.headers.get("Set-Cookie").split(";")[0]};
assert.equal((await call("/api/admin/calendar",{headers:cleared})).status,403);
assert.equal((await call("/api/day/24",{headers:cleared})).status,dateParts.year>2026||(dateParts.year===2026&&dateParts.month===12&&dateParts.day>=24)?200:403);
assert.equal((await call("/api/admin/calendar",{method:"PUT",headers:{...token,"Origin":"https://evil.invalid"},body:"{}"})).status,403);
const scope={window:{}};
vm.runInNewContext(readFileSync("public/surprises.js","utf8"),scope);
vm.runInNewContext(readFileSync("public/surprises.en.js","utf8"),scope);
assert.equal(scope.window.SURPRISES.length,47);
assert.equal(scope.window.C4C_SURPRISES_EN.length,47);
for(const path of ["public/app.js","public/admin.js","public/secure-client.js","src/worker.js"]){
 assert.ok(readFileSync(path,"utf8").length>1000);
}
assert.ok(readFileSync("public/index.html","utf8").includes('id="admin-link"'));
assert.ok(readFileSync("public/admin.html","utf8").includes('id="admin-days"'));
console.log("PASS: 24 photos + daily science bonuses, admin editing and upload, demo session and translations");
