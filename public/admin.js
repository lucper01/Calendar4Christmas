(() => {
"use strict";
const $=id=>document.getElementById(id);
const t=(fr,en)=>window.C4C_I18N?.lang==="en"?en:fr;
const lang=()=>window.C4C_I18N?.lang||"fr";
const loc=(value)=>value?.[lang()]||value?.fr||value?.en||"";
let manifest=null, selectedDay=1, loading=false, dirty=false, busy=false;
const control={
 titleFr:$("admin-title-fr"),titleEn:$("admin-title-en"),
 descFr:$("admin-desc-fr"),descEn:$("admin-desc-en"),
 bonus:$("admin-bonus-type"),
 infoTitleFr:$("admin-info-title-fr"),infoTitleEn:$("admin-info-title-en"),
 infoBodyFr:$("admin-info-body-fr"),infoBodyEn:$("admin-info-body-en"),
 questionFr:$("admin-question-fr"),questionEn:$("admin-question-en"),
 optionsFr:$("admin-options-fr"),optionsEn:$("admin-options-en"),
 correct:$("admin-correct"),explainFr:$("admin-explain-fr"),explainEn:$("admin-explain-en")
};
const message=(text,error=false)=>{
 const el=$("admin-message");el.textContent=text;el.classList.toggle("is-error",error);
};
function current(){return manifest.days.find(d=>d.day===selectedDay);}
const mediaById=id=>manifest.mediaLibrary.find(m=>m.id===id);
function markDirty(){dirty=true;$("admin-save").classList.add("has-changes");}
async function api(path,options={}){
 const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...options});
 let result=null;
 try{result=await response.json();}catch{}
 if(!response.ok){
   const err=new Error(result?.error || t("Une erreur est survenue.","An error occurred."));
   err.status=response.status;
   throw err;
 }
 return result;
}
function guard(demoMissing=true){
 $("admin-locked").hidden=!demoMissing;
 $("admin-workspace").hidden=demoMissing;
 $("admin-save").disabled=demoMissing;
 $("admin-status").disabled=demoMissing;
 if(demoMissing)message(t("Ouvrez le calendrier et activez la démo avec triche avant d'entrer dans l'administration.","Enable demo mode with triche in the calendar before opening administration."),true);
}
function setWords(){
 $("admin-back").textContent=t("← Calendrier","← Calendar");
 $("admin-heading-title").textContent=t("Le calendrier, à votre façon.","Your calendar, your way.");
 $("admin-description").textContent=t(
   "24 journées, une photo ou galerie et une surprise scientifique chaque jour. Toutes les modifications sont enregistrées sur Cloudflare R2.",
   "24 days, each with a photo gallery and a daily science surprise. All changes are saved to Cloudflare R2.");
 $("admin-save").textContent=t("Enregistrer les changements","Save changes");
 $("admin-status").textContent=t("Vérifier les fichiers","Check files");
 $("admin-days-heading").textContent=t("Les 24 journées","All 24 days");
 $("admin-days-hint").textContent=t("Chaque journée doit contenir au moins une photo ou vidéo et un bonus scientifique.","Each day must contain at least one photo or video and a science bonus.");
 $("admin-selected-heading").textContent=t("Photos de cette journée","Photos for this day");
 $("admin-media-help").textContent=t("Utilisez les flèches pour modifier l'ordre.","Use arrows to reorder photos.");
 $("admin-bonus-heading").textContent=t("Surprise du jour","Daily science bonus");
 $("admin-bonus-kind-label").textContent=t("Type de surprise","Bonus type");
 $("admin-bonus-type").options[0].textContent=t("Surprise scientifique automatique","Automatic science surprise");
 $("admin-bonus-type").options[1].textContent=t("Petite information personnalisée","Custom science fact");
 $("admin-bonus-type").options[2].textContent=t("Quiz personnalisé","Custom quiz");
 $("admin-library-heading").textContent=t("Médiathèque","Media library");
 $("admin-library-hint").textContent=t("Appuyez sur une photo pour l'affecter au jour sélectionné. Un média peut figurer dans plusieurs jours.","Tap a photo to assign it to the selected day. A media item may appear on multiple days.");
 $("admin-upload-label").textContent=t("Ajouter des photos ou vidéos","Add photos or videos");
 $("admin-upload-hint").textContent=t("JPEG, PNG, WebP, MP4 · 24 Mio maximum par fichier","JPEG, PNG, WebP, MP4 · 24 MiB maximum per file");
 $("admin-library-search").placeholder=t("Rechercher un média…","Search media…");
 $("admin-quiz-note").textContent=t("Saisissez 2 à 4 réponses dans chaque langue (une par ligne) et sélectionnez la bonne réponse.","Enter 2 to 4 answers in each language (one per line) and select the correct answer.");
 $("admin-correct-label").textContent=t("Numéro de la bonne réponse","Correct answer number");
 $("admin-locked-title").textContent=t("Accès réservé au mode démo","Demo mode required");
 $("admin-locked-message").textContent=t("Activez le mode démo avec triche depuis le calendrier, puis revenez ici.","Enable demo mode with triche in the calendar, then return here.");
 $("admin-locked-action").textContent=t("Revenir au calendrier","Return to calendar");
 $("admin-days-hint").title=t("Le contenu bonus automatique utilise la bibliothèque des 47 surprises scientifiques.","Automatic bonuses use the 47-science-surprise library.");
 if(manifest)renderAll();
}
function el(tag,className,text){
 const node=document.createElement(tag);if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}
function renderDays(){
 const grid=$("admin-days");grid.replaceChildren();
 for(const day of manifest.days){
   const button=el("button","admin-day"+(day.day===selectedDay?" is-active":""),
     String(day.day).padStart(2,"0"));
   button.type="button";button.title=loc(day.title);
   button.setAttribute("aria-pressed",String(day.day===selectedDay));
   button.append(el("small","",day.media.length+" 📷"));
   button.onclick=()=>{writeForm();selectedDay=day.day;renderAll()};
   button.ondragover=e=>e.preventDefault();
   button.ondrop=e=>{
     e.preventDefault();
     const id=e.dataTransfer?.getData("text/plain");
     if(!mediaById(id))return;
     writeForm();
     if(!day.media.includes(id)){day.media.push(id);markDirty()}
     selectedDay=day.day;renderAll();
   };
   grid.append(button);
 }
 $("admin-day-total").textContent=manifest.days.length+"/24";
}
function mediaThumb(item){
 const media=item.type==="video"?el("video","admin-thumb"):el("img","admin-thumb");
 media.src="/api/media/"+encodeURIComponent(item.id);
 if(item.type==="video"){media.muted=true;media.preload="metadata";media.playsInline=true;}
 else {media.loading="lazy";media.alt=item.original||item.id;}
 return media;
}
function renderSelected(){
 const day=current(),grid=$("admin-selected-media");grid.replaceChildren();
 $("admin-day-heading").textContent=t("Jour ","Day ")+String(day.day).padStart(2,"0");
 $("admin-current-count").textContent=day.media.length+t(" média"," media");
 if(!day.media.length)grid.append(el("p","admin-empty",t("Aucune photo pour ce jour. Ajoutez-en une depuis la médiathèque.","No photos assigned. Add one from the media library.")));
 day.media.forEach((id,index)=>{
   const item=mediaById(id);if(!item)return;
   const card=el("div","admin-assigned");
   card.append(mediaThumb(item),el("span","admin-media-name",item.original||item.filename));
   const controls=el("div","admin-mini-actions");
   for(const [symbol,label,dir] of [["↑","Up",-1],["↓","Down",1]]){
     const button=el("button","",symbol);button.type="button";
     button.title=t(dir<0?"Monter":"Descendre",label);
     button.disabled=index+dir<0||index+dir>=day.media.length;
     button.onclick=()=>{
       writeForm();const a=day.media[index];day.media[index]=day.media[index+dir];day.media[index+dir]=a;markDirty();renderAll();
     };controls.append(button);
   }
   const remove=el("button","is-remove","×");
   remove.type="button";remove.title=t("Retirer de ce jour","Remove from day");
   remove.onclick=()=>{writeForm();day.media.splice(index,1);markDirty();renderAll()};
   controls.append(remove);card.append(controls);grid.append(card);
 });
}
function renderLibrary(){
 const grid=$("admin-library-grid"),term=$("admin-library-search").value.trim().toLowerCase();
 grid.replaceChildren();
 const entries=manifest.mediaLibrary.filter(m=>
   (m.original||"").toLowerCase().includes(term)||m.id.toLowerCase().includes(term)||
   m.filename.toLowerCase().includes(term));
 $("admin-library-total").textContent=manifest.mediaLibrary.length+t(" médias"," media");
 for(const item of entries){
   const assigned=current().media.includes(item.id);
   const card=el("button","admin-library-item"+(assigned?" is-assigned":""));
   card.type="button";card.title=(item.original||item.filename)+t(" · Appuyer pour affecter"," · Tap to assign");
   card.draggable=true;
   card.ondragstart=e=>e.dataTransfer?.setData("text/plain",item.id);
   card.append(mediaThumb(item),el("small","",item.id+(assigned?" ✓":"")));
   card.onclick=()=>{
     writeForm();
     const list=current().media;
     if(list.includes(item.id))list.splice(list.indexOf(item.id),1);
     else list.push(item.id);
     markDirty();renderAll();
   };
   grid.append(card);
 }
}
function renderForm(){
 const day=current(),bonus=day.bonus||{type:"surprise"};
 control.titleFr.value=day.title.fr;control.titleEn.value=day.title.en;
 control.descFr.value=day.description.fr;control.descEn.value=day.description.en;
 control.bonus.value=bonus.type;
 control.infoTitleFr.value=bonus.title?.fr||"";
 control.infoTitleEn.value=bonus.title?.en||"";
 control.infoBodyFr.value=bonus.body?.fr||"";
 control.infoBodyEn.value=bonus.body?.en||"";
 control.questionFr.value=bonus.question?.fr||"";
 control.questionEn.value=bonus.question?.en||"";
 control.optionsFr.value=(bonus.options?.fr||[]).join("\n");
 control.optionsEn.value=(bonus.options?.en||[]).join("\n");
 control.correct.value=String(bonus.correctIndex||0);
 control.explainFr.value=bonus.explanation?.fr||"";
 control.explainEn.value=bonus.explanation?.en||"";
 showBonusForm();
}
function showBonusForm(){
 const value=control.bonus.value;
 $("admin-info-fields").hidden=value!=="info";
 $("admin-quiz-fields").hidden=value!=="quiz";
}
function lines(value){return value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);}
function writeForm(){
 if(!manifest)return;
 const day=current();
 day.title={fr:control.titleFr.value,en:control.titleEn.value};
 day.description={fr:control.descFr.value,en:control.descEn.value};
 const type=control.bonus.value;
 if(type==="surprise")day.bonus={type};
 if(type==="info")day.bonus={type,title:{fr:control.infoTitleFr.value,en:control.infoTitleEn.value},
    body:{fr:control.infoBodyFr.value,en:control.infoBodyEn.value}};
 if(type==="quiz")day.bonus={type,question:{fr:control.questionFr.value,en:control.questionEn.value},
   options:{fr:lines(control.optionsFr.value),en:lines(control.optionsEn.value)},
   correctIndex:Number(control.correct.value),
   explanation:{fr:control.explainFr.value,en:control.explainEn.value}};
}
function renderAll(){
 if(!manifest)return;
 renderDays();renderSelected();renderForm();renderLibrary();
}
async function load(){
 try{
   const session=await api("/api/demo");
   if(session.demo!==true){guard(true);return;}
   const result=await api("/api/admin/calendar");
   manifest=result.manifest;
   guard(false);renderAll();
   message(t("Le calendrier est prêt à être personnalisé.","Calendar ready to edit."));
 }catch(error){guard(true);message(error.message,true)}
}
async function save(){
 if(!manifest||busy)return;
 writeForm();
 busy=true;$("admin-save").disabled=true;
 try{
   const result=await api("/api/admin/calendar",{
     method:"PUT",headers:{"Content-Type":"application/json"},
     body:JSON.stringify(manifest)
   });
   dirty=false;$("admin-save").classList.remove("has-changes");
   message(t("Les 24 journées ont été enregistrées sur Cloudflare R2.","All 24 days have been saved to Cloudflare R2."));
 }catch(error){message(error.message,true)}
 finally{busy=false;$("admin-save").disabled=false}
}
async function upload(files){
 if(!manifest||busy)return;
 writeForm();
 busy=true;$("admin-upload-input").disabled=true;
 const errors=[];
 let done=0;
 for(const file of files){
   if(file.size>24*1024*1024||file.size===0){errors.push(file.name+" : "+t("fichier trop volumineux","file too large"));continue;}
   try{
     message(t("Importation","Uploading")+" "+file.name+" ("+(done+1)+"/"+files.length+")");
     const result=await api("/api/admin/media",{
       method:"POST",headers:{"Content-Type":file.type||"application/octet-stream",
         "X-Filename":encodeURIComponent(file.name)},
       body:file
     });
     manifest.mediaLibrary.push(result.media);
     done++;
   }catch(err){errors.push(file.name+": "+err.message)}
 }
 busy=false;$("admin-upload-input").disabled=false;
 $("admin-upload-input").value="";
 renderAll();
 message(done+t(" fichier(s) importé(s). "," file(s) uploaded. ")+(errors.length?errors.join(" ; "):t("Sélectionnez un jour pour les affecter.","Assign them to a day.")),Boolean(errors.length));
}
async function status(){
 try{
   const result=await api("/api/admin/status");
   message(result.present+"/"+result.total+t(" fichiers présents dans R2."," files available in R2.")+
     (result.missing.length?t(" Manquants : "," Missing: ")+result.missing.join(", "):""));
 }catch(e){message(e.message,true)}
}
$("admin-save").onclick=save;
$("admin-status").onclick=status;
$("admin-library-search").addEventListener("input",()=>manifest&&renderLibrary());
$("admin-upload-input").addEventListener("change",event=>upload([...event.target.files]));
control.bonus.addEventListener("change",()=>{showBonusForm();markDirty()});
Object.values(control).forEach(field=>{
 if(field!==control.bonus)field.addEventListener("input",markDirty);
});
window.addEventListener("beforeunload",event=>{
 if(dirty){event.preventDefault();event.returnValue="";}
});
window.addEventListener("c4c:language",setWords);
setWords();void load();
})();