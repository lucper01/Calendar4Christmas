(() => {
  "use strict";
  const t=(key,vars)=>window.C4C_I18N?.t(key,vars)||key;
  let days=new Map(), currentAlbum=null, currentSlide=0, initialized=false;
  const $=id=>document.getElementById(id);
  function localized(value) {
    if(typeof value==="string")return value;
    if(!value || typeof value!=="object")return "";
    const lang=window.C4C_I18N?.lang || "fr";
    return value[lang] || value.fr || value.en || "";
  }
  async function api(url) {
    const response=await fetch(url,{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw Error("HTTP "+response.status);
    return response.json();
  }
  async function init(){
    // The existing invitation gate remains client-side; Cloudflare Access protects the whole domain.
    try {
      const data=await api("/api/calendar");
      days=new Map((data.days || []).map(item=>[item.day,item]));
      initialized=true;
      window.dispatchEvent(new CustomEvent("c4c:calendar"));
    } catch { initialized=false;days.clear(); }
  }
  function reset() {
    initialized=false; days.clear();currentAlbum=null;
    if($("album-gallery")) $("album-gallery").replaceChildren();
  }
  function getDay(day){return days.get(Number(day))||null;}
  function make(tag,className,content) {
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(content!=null)el.textContent=content;
    return el;
  }
  function isDayAvailable(day) {
    return days.get(day)?.available === true;
  }
  function prepareDialog(day) {
    $("dialog-day").textContent=t("day")+" "+String(day).padStart(2,"0")+" / 24";
    $("dialog-category").textContent=t("secure_album");
    $("dialog-illustration").textContent="📷";
    $("quiz-area").hidden=true;
    $("dialog-explanation").hidden=true;
    $("source-link").hidden=true;
    $("reroll-button").hidden=true;
    $("album-gallery").hidden=false;
  }
  function mediaNode(item) {
    const src="/api/media/"+encodeURIComponent(item.id);
    if(item.type==="video") {
      const player=make("video","album-media");
      player.controls=true;player.playsInline=true;player.preload="metadata";
      player.src=src;
      player.setAttribute("aria-label",localized(item.alt)||t("video_label"));
      return player;
    }
    const image=make("img","album-media");
    image.src=src;image.loading="eager";image.decoding="async";
    image.alt=localized(item.alt)||t("image_alt");
    return image;
  }
  function showSlide() {
    if(!currentAlbum)return;
    const gallery=$("album-gallery");
    gallery.replaceChildren();
    const items=currentAlbum.media||[];
    if(!items.length) {gallery.append(make("p","album-empty",t("no_photos")));return;}
    const item=items[currentSlide]||items[0];
    const stage=make("div","album-stage");
    stage.append(mediaNode(item));
    gallery.append(stage);
    const caption=localized(item.caption);
    if(caption)gallery.append(make("p","album-caption",caption));
    if(items.length>1){
      const controls=make("div","album-nav");
      const prev=make("button","album-arrow","‹");
      prev.type="button";prev.setAttribute("aria-label",t("prev_media"));
      prev.addEventListener("click",()=>{currentSlide=(currentSlide+items.length-1)%items.length;showSlide()});
      const count=make("span","album-count",t("album_progress",{current:currentSlide+1,total:items.length}));
      const next=make("button","album-arrow","›");
      next.type="button";next.setAttribute("aria-label",t("next_media"));
      next.addEventListener("click",()=>{currentSlide=(currentSlide+1)%items.length;showSlide()});
      controls.append(prev,count,next);
      gallery.append(controls);
    }
    gallery.append(make("p","album-media-type",item.type==="video"?t("video_label"):t("photo_label")));
  }
  function render() {
    if(!currentAlbum)return;
    $("dialog-title").textContent=localized(currentAlbum.title)||t("gallery");
    $("dialog-body").textContent=localized(currentAlbum.description)||t("no_description");
    showSlide();
  }
  async function openAlbum(day) {
    day=Number(day);
    prepareDialog(day);
    $("dialog-title").textContent=t("loading");
    $("dialog-body").textContent="";
    $("album-gallery").replaceChildren();
    if(!isDayAvailable(day)){
      $("dialog-title").textContent=t("preview_only");
      $("dialog-body").textContent=t("photo_coming");
      return;
    }
    try {
      const album=await api("/api/day/"+day);
      // Cloudflare Access enforces the access policy before serving this API response.
      currentAlbum=album;currentSlide=0;
      if($("surprise-dialog").open)render();
    }catch{
      $("dialog-title").textContent=t("secure_album");
      $("dialog-body").textContent=t("album_error");
    }
  }
  // Calendar metadata contains no unreleased filenames or private media.
  void init();
  window.addEventListener("c4c:logout",reset);
  window.addEventListener("c4c:language",()=>{if(currentAlbum)render();});
  $("surprise-dialog").addEventListener("close",()=>{
    currentAlbum=null;
    $("album-gallery").replaceChildren();
    $("album-gallery").hidden=true;
    $("reroll-button").hidden=false;
  });
  window.C4C_SECURE={getDay,openAlbum,reset,get initialized(){return initialized;}};
})();