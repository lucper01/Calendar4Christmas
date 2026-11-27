(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const lang=()=>window.C4C_I18N?.lang==="en"?"en":"fr";
  const translations={
    fr:{
      home:"← Calendrier",eyebrow:"ACCÈS ORGANISATEUR · R2 PRIVÉ",title:"Les archives du Père Noël",
      intro:"Cet espace importe des albums bilingues dans le stockage Cloudflare R2 privé. Les fichiers restent hors de GitHub et ne sont révélés qu'aux dates autorisées.",
      step1:"Autorisation",step1d:"Connecte-toi d'abord au calendrier avec ton code d'invitation, puis saisis le jeton administrateur créé dans Cloudflare.",
      token:"Jeton administrateur (jamais conservé)",check:"Vérifier les accès",
      step2:"Calendrier bilingue",step2d:"Sélectionne le fichier JSON privé des 24 cases (titres, descriptions et légendes FR/EN). Il n'est pas envoyé dans GitHub.",uploadManifest:"Importer le calendrier",
      step3:"Photos et vidéos",step3d:"Sélectionne le ZIP initial ou plusieurs fichiers médias. Les noms sont associés automatiquement aux entrées du calendrier. Les fichiers sont transmis directement à R2, un par un, sans passer par GitHub.",
      uploadMedia:"Importer les médias",refresh:"Vérifier les médias présents",
      note:"N'utilise pas une URL publique R2. Conserve le bucket privé et règle un jeton administrateur long et aléatoire.",
      ready:"Prêt.",login:"Ouvre d'abord le calendrier et saisis le code d'invitation.",tokenMissing:"Saisis d'abord le jeton administrateur.",
      accessOk:"Accès administrateur validé.",manifestReady:"Manifeste privé prêt : {n} albums.",
      manifestSent:"Calendrier importé : {n} albums photo.",selectManifest:"Sélectionne le JSON privé.",
      selectFiles:"Sélectionne les médias ou l'archive ZIP.",uploading:"Envoi de {name} ({i}/{n})…",
      done:"Importation terminée : {n} média(s) envoyé(s).",empty:"Aucun fichier du ZIP ne correspond au manifeste.",
      status:"Médias présents : {n}/{total}.",error:"Erreur : {msg}",zipUnsupported:"Ce navigateur ne peut pas extraire automatiquement le ZIP. Décompresse-le et sélectionne les médias.",
      noManifest:"Importe d'abord le manifeste JSON ou utilise Vérifier les médias présents.",
      tooLarge:"Le fichier {name} dépasse la limite de 24 Mio.",
      zipCorrupt:"Archive ZIP invalide ou chiffrée.",noFile:"Aucun fichier sélectionné."
    },
    en:{
      home:"← Calendar",eyebrow:"ORGANISER ACCESS · PRIVATE R2",title:"Santa's archives",
      intro:"Import bilingual albums into private Cloudflare R2 storage. Files stay out of GitHub and can only be revealed on their scheduled dates.",
      step1:"Authorisation",step1d:"First sign in to the calendar with the invitation code, then enter the administrator token configured in Cloudflare.",
      token:"Administrator token (never stored)",check:"Check access",
      step2:"Bilingual calendar",step2d:"Select the private JSON file describing all 24 days (FR/EN titles, descriptions and captions). It will not be uploaded to GitHub.",uploadManifest:"Import calendar",
      step3:"Photos and videos",step3d:"Select the original ZIP or multiple media files. Filenames are matched automatically to the calendar. Files are uploaded straight to R2, one at a time, without passing through GitHub.",
      uploadMedia:"Upload media",refresh:"Check uploaded media",
      note:"Do not enable a public R2 URL. Keep the bucket private and use a long, random administrator token.",
      ready:"Ready.",login:"First open the calendar and enter your invitation code.",tokenMissing:"Enter the administrator token first.",
      accessOk:"Administrator access confirmed.",manifestReady:"Private manifest ready: {n} albums.",
      manifestSent:"Calendar uploaded: {n} photo albums.",selectManifest:"Select the private JSON file.",
      selectFiles:"Select media files or the ZIP archive.",uploading:"Uploading {name} ({i}/{n})…",
      done:"Upload complete: {n} media file(s) sent.",empty:"No file from the ZIP matches the manifest.",
      status:"Media uploaded: {n}/{total}.",error:"Error: {msg}",zipUnsupported:"This browser cannot unpack ZIP files automatically. Extract the archive and select the media files.",
      noManifest:"Import the JSON manifest first, or use Check uploaded media.",
      tooLarge:"File {name} exceeds the 24 MiB limit.",
      zipCorrupt:"Invalid or encrypted ZIP archive.",noFile:"No file selected."
    }
  };
  const t=(key,vars={})=>(translations[lang()][key]||key).replace(/\{(\w+)\}/g,(_,n)=>String(vars[n]??""));
  const ui={
    "home-link":"home","admin-eyebrow":"eyebrow","admin-title":"title","admin-intro":"intro",
    "step1-title":"step1","step1-desc":"step1d","status-button":"check",
    "step2-title":"step2","step2-desc":"step2d","manifest-button":"uploadManifest",
    "step3-title":"step3","step3-desc":"step3d","upload-button":"uploadMedia",
    "refresh-button":"refresh","admin-note":"note"
  };
  let manifest=null,busy=false;
  function localize(){
    for(const [id,key]of Object.entries(ui)) $(id).textContent=t(key);
    $("admin-token").placeholder=t("token");
  }
  function report(message){$("admin-status").textContent=message;}
  const token=()=> $("admin-token").value.trim();
  async function api(path,method="GET",body=null,headers={}){
    if(!token())throw Error(t("tokenMissing"));
    const response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",
      headers:{"X-Admin-Token":token(),...headers},body
    });
    let result={};
    try{result=await response.json();}catch{}
    if(!response.ok)throw Error(result.error || ("HTTP "+response.status));
    return result;
  }
  async function check(){
    // Cloudflare Access must cover both /admin.html and /api/admin/*.
    // The admin token is an additional write-only capability, separate from M2CSGA.
    const result=await api("/api/admin/manifest");
    manifest=result.manifest;
    report(manifest?t("manifestReady",{n:manifest.days.filter(x=>x.type==="album").length}):t("accessOk"));
    return true;
  }
  async function run(fn){
    if(busy)return;
    busy=true;
    ["manifest-button","upload-button","refresh-button","status-button"].forEach(id=>$(id).disabled=true);
    try{await fn();}catch(e){report(t("error",{msg:e.message||String(e)}));}
    finally{busy=false;["manifest-button","upload-button","refresh-button","status-button"].forEach(id=>$(id).disabled=false);}
  }
  $("status-button").addEventListener("click",()=>run(check));
  $("manifest-button").addEventListener("click",()=>run(async()=>{
    const file=$("manifest-file").files?.[0];
    if(!file)throw Error(t("selectManifest"));
    const obj=JSON.parse(await file.text());
    const result=await api("/api/admin/manifest","PUT",JSON.stringify(obj),{"Content-Type":"application/json"});
    manifest=obj;
    report(t("manifestSent",{n:result.albums}));
  }));
  $("refresh-button").addEventListener("click",()=>run(async()=>{
    if(!manifest)await check();
    const result=await api("/api/admin/status");
    const available=result.media.filter(x=>x.uploaded).length;
    report(t("status",{n:available,total:result.media.length}));
  }));
  const decoder=new TextDecoder();
  const view=(data)=>new DataView(data);
  function zipEntries(buffer){
    const d=view(buffer),size=d.byteLength;
    let end=-1;
    for(let p=size-22;p>=Math.max(0,size-65557);p--){
      if(d.getUint32(p,true)===0x06054b50){end=p;break}
    }
    if(end<0)throw Error(t("zipCorrupt"));
    const total=d.getUint16(end+10,true),off=d.getUint32(end+16,true);
    const entries=[];let p=off;
    for(let i=0;i<total;i++){
      if(p+46>size || d.getUint32(p,true)!==0x02014b50)throw Error(t("zipCorrupt"));
      const method=d.getUint16(p+10,true),compressed=d.getUint32(p+20,true),uncompressed=d.getUint32(p+24,true);
      const nlen=d.getUint16(p+28,true),extra=d.getUint16(p+30,true),comment=d.getUint16(p+32,true);
      const local=d.getUint32(p+42,true);
      const name=decoder.decode(new Uint8Array(buffer,p+46,nlen)).split("/").pop();
      if(local+30>size || d.getUint32(local,true)!==0x04034b50)throw Error(t("zipCorrupt"));
      const start=local+30+d.getUint16(local+26,true)+d.getUint16(local+28,true);
      if(start+compressed>size)throw Error(t("zipCorrupt"));
      if(name && !name.startsWith("__") && !name.startsWith("."))entries.push({name,method,compressed,uncompressed,start});
      p+=46+nlen+extra+comment;
    }
    return entries;
  }
  async function decompress(buffer,item){
    if(item.uncompressed>24*1024*1024)throw Error(t("tooLarge",{name:item.name}));
    const input=new Uint8Array(buffer,item.start,item.compressed);
    if(item.method===0)return input.slice().buffer;
    if(item.method!==8)throw Error(t("zipCorrupt"));
    if(typeof DecompressionStream==="undefined")throw Error(t("zipUnsupported"));
    let stream;
    try{stream=new Blob([input]).stream().pipeThrough(new DecompressionStream("deflate-raw"));}
    catch{throw Error(t("zipUnsupported"))}
    const decoded=await new Response(stream).arrayBuffer();
    if(decoded.byteLength!==item.uncompressed)throw Error(t("zipCorrupt"));
    return decoded;
  }
  const mime=(filename)=>/\.mp4$/i.test(filename)?"video/mp4":/\.png$/i.test(filename)?"image/png":/\.webp$/i.test(filename)?"image/webp":"image/jpeg";
  $("upload-button").addEventListener("click",()=>run(async()=>{
    if(!manifest)await check();
    if(!manifest)throw Error(t("noManifest"));
    const files=Array.from($("media-file").files||[]);
    if(!files.length)throw Error(t("selectFiles"));
    const entries=manifest.days.flatMap(day=>day.media||[]);
    const byName=new Map(entries.map(item=>[item.filename,item]));
    const pending=[];
    for(const file of files){
      if(/\.zip$/i.test(file.name)){
        const buffer=await file.arrayBuffer();
        for(const entry of zipEntries(buffer)){
          const item=byName.get(entry.name);
          if(item)pending.push({item,filename:entry.name,extract:()=>decompress(buffer,entry)});
        }
      }else{
        const item=byName.get(file.name);
        if(item)pending.push({item,filename:file.name,extract:()=>file.arrayBuffer()});
      }
    }
    const unique=Array.from(new Map(pending.map(x=>[x.item.id,x])).values());
    if(!unique.length)throw Error(t("empty"));
    let uploaded=0;
    $("upload-progress").max=unique.length;
    $("upload-progress").value=0;
    for(const task of unique){
      report(t("uploading",{name:task.filename,i:uploaded+1,n:unique.length}));
      const data=await task.extract();
      if(data.byteLength>24*1024*1024)throw Error(t("tooLarge",{name:task.filename}));
      await api("/api/admin/media/"+encodeURIComponent(task.item.id),"PUT",data,{"Content-Type":mime(task.filename)});
      uploaded++;
      $("upload-progress").value=uploaded;
    }
    report(t("done",{n:uploaded}));
  }));
  window.addEventListener("c4c:language",localize);
  localize();report(t("ready"));
})();
