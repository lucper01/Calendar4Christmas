(() => {
  "use strict";
  const t=(key,values)=>window.C4C_I18N?.t(key,values) || key;
  const gate=document.getElementById("access-gate");
  const form=document.getElementById("access-form");
  const field=document.getElementById("access-code");
  const feedback=document.getElementById("access-error");
  const submit=document.getElementById("access-submit");
  const lock=document.getElementById("lock-again");
  const visibility=document.getElementById("access-visibility");
  let authorized=false;
  let checking=false;

  function resetSubmit() {
    submit.disabled=false;
    submit.replaceChildren();
    const caption=document.createElement("span");
    caption.dataset.i18n="enter";
    caption.textContent=t("enter");
    const arrow=document.createElement("span");
    arrow.setAttribute("aria-hidden","true");
    arrow.textContent="↗";
    submit.append(caption,arrow);
  }
  function showFeedback(key) {feedback.textContent=key?t(key):"";}
  function unlock() {
    authorized=true;
    document.body.classList.remove("access-locked");
    document.body.classList.add("access-granted");
    gate.hidden=true;
    field.value="";
    showFeedback("");
    window.dispatchEvent(new CustomEvent("c4c:authenticated"));
  }
  function relock() {
    authorized=false;
    document.body.classList.remove("access-granted");
    document.body.classList.add("access-locked");
    gate.hidden=false;
    field.value="";
    field.type="password";
    visibility.setAttribute("aria-pressed","false");
    visibility.textContent=t("reveal");
    showFeedback("");
    window.dispatchEvent(new CustomEvent("c4c:logout"));
    field.focus();
  }
  async function api(url,options) {
    const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...options});
    let body={};
    try{body=await response.json();}catch{}
    return {response,body};
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(checking)return;
    const code=field.value.trim();
    if(!code){showFeedback("awaiting_code");field.focus();return;}
    checking=true;
    submit.disabled=true;
    submit.textContent=t("verifying");
    showFeedback("");
    try{
      const {response,body}=await api("/api/session",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})
      });
      if(response.ok && body.authenticated){unlock();}
      else if(response.status===429){showFeedback("too_many");}
      else if(response.status===503){showFeedback("unavailable");}
      else{showFeedback("incorrect_code");}
    }catch{showFeedback("network_error");}
    finally{
      field.value="";
      checking=false;
      resetSubmit();
    }
  });
  lock.addEventListener("click",async()=>{
    try{await api("/api/session",{method:"DELETE"});}catch{}
    relock();
    window.scrollTo({top:0,behavior:"instant"});
  });
  field.addEventListener("input",()=>showFeedback(""));
  visibility.addEventListener("click",()=>{
    const visible=field.type==="password";
    field.type=visible?"text":"password";
    visibility.setAttribute("aria-pressed",String(visible));
    visibility.textContent=t(visible?"conceal":"reveal");
    field.focus();
  });
  window.addEventListener("c4c:language",()=>{
    visibility.textContent=t(field.type==="password"?"reveal":"conceal");
    if(!checking)resetSubmit();
  });
  window.C4C_AUTH={get authenticated(){return authorized;}};
  // Do not trust a localStorage flag: the server validates the signed HttpOnly cookie.
  api("/api/session").then(({response,body})=>{
    if(response.ok && body.authenticated)unlock();
    else relock();
  }).catch(()=>relock());
})();