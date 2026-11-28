(() => {
  "use strict";

  const YEAR = 2026;
  const TIME_ZONE = "Europe/Paris";
  const STORAGE_KEY = "calendar4christmas-2026-v1";
  const ORDER = [12, 3, 20, 7, 14, 1, 18, 9, 4, 23, 10, 16, 21, 5, 13, 2, 11, 24, 6, 19, 8, 17, 22, 15];
  const ICONS = ["🎄", "✧", "🦌", "🔔", "❄", "🎁", "☃", "✦", "🧪", "🌟", "🕯️", "🧠"];
  const TYPE_NAMES = {quiz:"QUIZ DU LUTIN", fact:"LE SAVIEZ-VOUS ?", challenge:"DÉFI DU LABORATOIRE", myth:"VRAI OU FAUX ?"};
  const surprises = Array.isArray(window.SURPRISES) ? window.SURPRISES : [];
  const $ = id => document.getElementById(id);
  const t = (key,vars) => window.C4C_I18N?.t(key,vars) || key;
  const localizedSurprise = index => {
    const original=surprises[index];
    const translated=window.C4C_I18N?.lang==="en" ? window.C4C_SURPRISES_EN?.[index] : null;
    return original ? {...original,...(translated||{})} : null;
  };
  const state = readState();
  let demo = false;
  let activeDay = null;
  let toastTimer = null;
  let audio = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function readState() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}; }
    catch { saved = {}; }
    return {
      opened: Array.isArray(saved.opened) ? [...new Set(saved.opened.filter(n => Number.isInteger(n) && n >= 1 && n <= 24))] : [],
      picks: saved.picks && typeof saved.picks === "object" && !Array.isArray(saved.picks) ? saved.picks : {},
      seen: Array.isArray(saved.seen) ? saved.seen.filter(n => Number.isInteger(n) && n >= 0 && n < surprises.length) : [],
      answers: saved.answers && typeof saved.answers === "object" ? saved.answers : {},
      sound: saved.sound === true
    };
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { /* The calendar remains usable in private or restricted storage contexts. */ }
  }

  function parisDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE, year:"numeric", month:"2-digit", day:"2-digit"
    }).formatToParts(now);
    const part = key => Number(parts.find(p => p.type === key).value);
    return {year:part("year"),month:part("month"),day:part("day")};
  }

  function officiallyUnlocked(day, now = parisDate()) {
    if (now.year > YEAR) return true;
    return now.year === YEAR && now.month === 12 && now.day >= day;
  }

  function eligible(day) { return demo || officiallyUnlocked(day); }

  function rand(max) {
    if (max < 2) return 0;
    if (window.crypto && crypto.getRandomValues) {
      const values = new Uint32Array(1);
      const limit = Math.floor(4294967296 / max) * max;
      do { crypto.getRandomValues(values); } while (values[0] >= limit);
      return values[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function draw(day, reroll = false) {
    if (!surprises.length) return null;
    const existing = Number(state.picks[day]);
    if (!reroll && Number.isInteger(existing) && existing >= 0 && existing < surprises.length) return localizedSurprise(existing);
    const occupied = new Set(Object.values(state.picks).map(Number).filter(Number.isInteger));
    const fresh = surprises.map((_, i) => i).filter(i => !occupied.has(i) && !state.seen.includes(i));
    const unoccupied = surprises.map((_, i) => i).filter(i => !occupied.has(i));
    const withoutCurrent = surprises.map((_, i) => i).filter(i => i !== existing);
    const pool = fresh.length ? fresh : (unoccupied.length ? unoccupied : withoutCurrent);
    const index = pool[rand(pool.length)] ?? 0;
    if (reroll) delete state.answers[day];
    state.picks[day] = index;
    if (!state.seen.includes(index)) state.seen.push(index);
    persist();
    return localizedSurprise(index);
  }

  function setStatus() {
    const today = parisDate();
    const count = state.opened.length;
    $("opened-count").textContent = String(count);
    $("progress-fill").style.width = (count / 24 * 100) + "%";
    $("progress-fill").parentElement.setAttribute("aria-label", count + " cases découvertes sur 24");

    let message = t("message_before");
    if (demo) message = t("message_demo");
    else if (today.year > YEAR || (today.year === YEAR && today.month === 12 && today.day >= 24)) message = t("message_complete");
    else if (today.year === YEAR && today.month === 12 && today.day >= 1) {
      message = state.opened.includes(today.day) ? t("message_opened_today") : t("message_today");
    }
    $("status-message").textContent = message;
    updateCountdown(today);
  }

  function updateCountdown(today = parisDate()) {
    let target, label;
    if (today.year < YEAR || (today.year === YEAR && today.month < 12)) {
      target = new Date("2026-11-30T23:00:00Z");
      label = t("countdown_first");
    } else if (today.year === YEAR && today.month === 12 && today.day < 24) {
      target = new Date(Date.UTC(YEAR, 11, today.day, 23, 0, 0));
      label = t("countdown_next");
    } else {
      $("countdown").textContent = "24 / 24";
      $("countdown-caption").textContent = t("countdown_complete");
      return;
    }
    const remaining = Math.max(0, target.getTime() - Date.now());
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const pad = n => String(n).padStart(2, "0");
    $("countdown").textContent = days > 0 ? days + "j " + pad(hours) + "h " + pad(minutes) + "m" : pad(hours) + " : " + pad(minutes) + " : " + pad(secs);
    $("countdown-caption").textContent = label;
  }

  function showToast(message) {
    const node = $("toast");
    node.textContent = message;
    node.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("is-visible"), 3900);
  }

  function makeDoor(day) {
    const today = parisDate();
    const unlocked = eligible(day);
    const opened = state.opened.includes(day);
    const preview = demo && !officiallyUnlocked(day, today);
    const current = officiallyUnlocked(day, today) && today.year === YEAR && today.month === 12 && today.day === day;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "door" + (opened ? " is-opened" : "") + (!unlocked ? " is-locked" : "") + (preview ? " is-preview" : "") + (current ? " is-current" : "");
    const labelState = opened?t("discovered"):!unlocked?t("closed"):preview?t("preview"):t("open");
    el.setAttribute("aria-label", (window.C4C_I18N?.lang==="en"?"Day ":"Jour ")+day+" "+(window.C4C_I18N?.lang==="en"?"December":"décembre")+" : "+labelState);
    el.title=(window.C4C_I18N?.lang==="en"?"Day ":"Jour ")+day+" · "+labelState;
    const icon = opened ? (window.C4C_SECURE?.getDay(day)?.type==="album"?"📷":surprises[Number(state.picks[day])]?.emoji || "✦") : ICONS[(day * 7 + 3) % ICONS.length];
    const status=opened?t("discovered"):!unlocked?t("closed"):preview?t("preview"):t("open");
    el.innerHTML = '<span class="door-number"></span><span class="door-date">DÉC.</span><span class="door-icon" aria-hidden="true"></span><span class="door-status"></span>' + (day === 24 ? '<span class="door-feature" aria-hidden="true">✦</span>' : "");
    el.querySelector(".door-number").textContent = String(day).padStart(2,"0");
    el.querySelector(".door-date").textContent=t("december");
    el.querySelector(".door-icon").textContent = icon;
    el.querySelector(".door-status").textContent = status;
    el.addEventListener("click", () => {
      if (!eligible(day)) {
        play("locked");
        showToast(t("locked_day",{day}));
        return;
      }
      openDoor(day);
    });
    return el;
  }

  function renderGrid() {
    const grid = $("calendar-grid");
    const fragment = document.createDocumentFragment();
    ORDER.forEach(day => fragment.appendChild(makeDoor(day)));
    grid.replaceChildren(fragment);
    setStatus();
  }

  function renderQuiz(item, day) {
    const area = $("quiz-area");
    area.hidden = false;
    area.replaceChildren();
    const saved = !demo || officiallyUnlocked(day) ? state.answers[day] : undefined;
    item.options.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-option";
      button.textContent = String.fromCharCode(65 + index) + ". " + choice;
      button.addEventListener("click", () => grade(index));
      area.appendChild(button);
    });
    function grade(index) {
      const choices = [...area.querySelectorAll(".quiz-option")];
      choices.forEach((choice, i) => {
        choice.disabled = true;
        if (i === item.correct) choice.classList.add("is-correct");
        else if (i === index) choice.classList.add("is-wrong");
      });
      const explanation = $("dialog-explanation");
      explanation.hidden = false;
      explanation.textContent = (index === item.correct ? t("quiz_correct") : t("quiz_incorrect")) + item.explanation;
      if (!demo || officiallyUnlocked(day)) { state.answers[day] = index; persist(); }
      play(index === item.correct ? "correct" : "wrong");
    }
    if (Number.isInteger(saved) && saved >= 0 && saved < item.options.length) grade(saved);
  }

  function showSurprise(day, item) {
    if (!item) { showToast("Les surprises sont momentanément indisponibles."); return; }
    $("dialog-day").textContent = t("day") + " " + String(day).padStart(2,"0") + " / 24";
    $("dialog-illustration").textContent = item.emoji;
    $("dialog-category").textContent = t(item.type) || TYPE_NAMES[item.type] || "SCIENCE";
    $("dialog-title").textContent = item.title;
    $("dialog-body").textContent = item.body;
    $("quiz-area").hidden = true;
    $("quiz-area").replaceChildren();
    $("dialog-explanation").hidden = true;
    $("dialog-explanation").textContent = "";
    if (item.type === "quiz" && Array.isArray(item.options)) renderQuiz(item, day);
    else if (item.explanation) {
      $("dialog-explanation").textContent = item.explanation;
      $("dialog-explanation").hidden = false;
    }
    const source = $("source-link");
    if (item.source && /^https:\/\/doi\.org\//.test(item.source)) {
      source.href = item.source;
      source.textContent = t("source_label") + " · " + (item.sourceLabel || "DOI") + " ↗";
      source.hidden = false;
    } else {
      source.removeAttribute("href");
      source.hidden = true;
    }
  }

  function openDoor(day) {
    activeDay = day;
    const wasOpened = state.opened.includes(day);
    const album = window.C4C_SECURE?.getDay(day);
    const isAlbum = album?.type==="album";
    const item = isAlbum ? null : draw(day);
    // Demo allows verifying all media without marking future doors officially opened.
    if (officiallyUnlocked(day) && !wasOpened) {
      state.opened.push(day);
      state.opened.sort((a,b) => a-b);
      persist();
    }
    if (isAlbum) {
      $("quiz-area").hidden=true;
      $("reroll-button").hidden=true;
      $("album-gallery").hidden=false;
      $("dialog-category").textContent=t("secure_album");
      $("dialog-title").textContent=t("loading");
      $("dialog-body").textContent="";
    } else {
      $("reroll-button").hidden=false;
      $("album-gallery").hidden=true;
      showSurprise(day, item);
    }
    renderGrid();
    $("surprise-dialog").showModal();
    if(isAlbum) void window.C4C_SECURE.openAlbum(day);
    play("open");
    if (!wasOpened && !demo) confetti();
  }

  function confetti() {
    if (reducedMotion) return;
    const layer = $("confetti-layer");
    const colors = ["#f4d394","#bc364a","#e0f4d2","#31775b","#ffffff"];
    for (let i=0; i<38; i++) {
      const piece = document.createElement("i");
      piece.className = "confetti";
      piece.style.left = rand(100) + "%";
      piece.style.background = colors[rand(colors.length)];
      piece.style.animationDelay = rand(60) * 12 + "ms";
      piece.style.animationDuration = (1100 + rand(1100)) + "ms";
      piece.style.setProperty("--sway", (rand(300)-150) + "px");
      piece.style.setProperty("--spin", (rand(1300)-650) + "deg");
      layer.append(piece);
      piece.addEventListener("animationend", () => piece.remove(), {once:true});
    }
  }

  function play(kind) {
    if (!state.sound) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      audio ||= new Context();
      if (audio.state === "suspended") void audio.resume();
      const notes = kind === "open" ? [523,659,784] : kind === "correct" ? [659,988] : kind === "wrong" ? [392,330] : [260];
      const start = audio.currentTime;
      notes.forEach((frequency, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, start + i*.09);
        gain.gain.setValueAtTime(.0001, start + i*.09);
        gain.gain.exponentialRampToValueAtTime(.065, start + i*.09 + .01);
        gain.gain.exponentialRampToValueAtTime(.0001, start + i*.09 + .25);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(start + i*.09);
        osc.stop(start + i*.09 + .28);
      });
    } catch { /* Audio is optional. */ }
  }

  function updateSoundButton() {
    const button = $("sound-toggle");
    button.setAttribute("aria-pressed", String(state.sound));
    const title = state.sound ? t("sound_disable") : t("sound_enable");
    button.setAttribute("aria-label", title);
    button.title = title;
  }

  function updateDemoButton() {
    $("preview-toggle").setAttribute("aria-pressed", String(demo));
    $("preview-label").textContent = demo ? t("quit_demo") : t("demo");
  }

  function createSnow() {
    if (reducedMotion) return;
    const layer = document.querySelector(".snowfall");
    const fragment = document.createDocumentFragment();
    for (let i=0; i<42; i++) {
      const flake = document.createElement("i");
      const width = 2 + rand(4);
      flake.style.left = rand(100) + "%";
      flake.style.width = width + "px";
      flake.style.height = width + "px";
      flake.style.animationDelay = "-" + rand(3000)/100 + "s";
      flake.style.animationDuration = (13 + rand(20)) + "s";
      flake.style.opacity = String(.16 + rand(50)/100);
      fragment.appendChild(flake);
    }
    layer.appendChild(fragment);
  }

  const demoDialog=$("demo-code-dialog");
  const demoForm=$("demo-code-form");
  const demoInput=$("demo-code-input");
  const demoError=$("demo-code-error");
  const demoSubmit=$("demo-code-submit");
  let demoBusy=false;
  $("preview-toggle").addEventListener("click", async () => {
    if(demoBusy)return;
    if(!demo){
      demoError.textContent="";
      demoInput.value="";
      demoDialog.showModal();
      demoInput.focus();
      return;
    }
    demoBusy=true;
    try{
      await window.C4C_SECURE.deactivateDemo();
      showToast(t("demo_off"));
    }catch{
      showToast(t("demo_connection_error"));
    }finally{demoBusy=false;}
  });
  $("demo-code-cancel").addEventListener("click",()=>demoDialog.close());
  demoDialog.addEventListener("close",()=>{
    demoInput.value="";
    demoError.textContent="";
  });
  demoForm.addEventListener("submit",async event=>{
    event.preventDefault();
    if(demoBusy)return;
    demoBusy=true;
    demoSubmit.disabled=true;
    demoSubmit.textContent=t("demo_activating");
    demoError.textContent="";
    try {
      await window.C4C_SECURE.activateDemo(demoInput.value);
      demoDialog.close();
      showToast(t("demo_on"));
    }catch(err){
      demoError.textContent=err?.status===401?t("demo_invalid"):t("demo_connection_error");
      demoInput.select();
    }finally{
      demoBusy=false;
      demoSubmit.disabled=false;
      demoSubmit.textContent=t("demo_activate");
    }
  });
  $("sound-toggle").addEventListener("click", () => {
    state.sound = !state.sound;
    persist();
    updateSoundButton();
    play("correct");
    showToast(state.sound ? t("sound_on") : t("sound_off"));
  });
  $("dialog-close").addEventListener("click", () => $("surprise-dialog").close());
  $("dialog-done").addEventListener("click", () => $("surprise-dialog").close());
  $("surprise-dialog").addEventListener("click", event => {
    if (event.target === $("surprise-dialog")) $("surprise-dialog").close();
  });
  $("reroll-button").addEventListener("click", () => {
    if (activeDay == null) return;
    const item = draw(activeDay, true);
    showSurprise(activeDay, item);
    renderGrid();
    play("open");
  });
  $("surprise-dialog").addEventListener("close", () => { activeDay = null; });
  window.addEventListener("c4c:calendar", ()=>{
    demo=window.C4C_SECURE?.demo===true;
    updateDemoButton();
    renderGrid();
  });
  window.addEventListener("c4c:language", () => {
    updateSoundButton();
    updateDemoButton();
    renderGrid();
    if(activeDay!=null && !window.C4C_SECURE?.getDay(activeDay)?.type) {
      const index=Number(state.picks[activeDay]);
      if(Number.isInteger(index) && surprises[index]) showSurprise(activeDay,localizedSurprise(index));
    }
  });
  createSnow();
  updateSoundButton();
  updateDemoButton();
  renderGrid();

  // Keep the countdown live without recreating focused calendar buttons every second.
  let lastParisDay = JSON.stringify(parisDate());
  setInterval(() => {
    const current = parisDate();
    const key = JSON.stringify(current);
    if (key !== lastParisDay) {
      lastParisDay = key;
      renderGrid();
    } else {
      updateCountdown(current);
    }
  }, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { lastParisDay = JSON.stringify(parisDate()); renderGrid(); }
  });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();