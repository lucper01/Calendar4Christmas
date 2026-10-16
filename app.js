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
    if (!reroll && Number.isInteger(existing) && existing >= 0 && existing < surprises.length) return surprises[existing];
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
    return surprises[index];
  }

  function setStatus() {
    const today = parisDate();
    const count = state.opened.length;
    $("opened-count").textContent = String(count);
    $("progress-fill").style.width = (count / 24 * 100) + "%";
    $("progress-fill").parentElement.setAttribute("aria-label", count + " cases découvertes sur 24");

    let message = "Les lutins peaufinent les protocoles.";
    if (demo) message = "Mode démo : les 24 cases sont accessibles !";
    else if (today.year > YEAR || (today.year === YEAR && today.month === 12 && today.day >= 24)) message = "Toutes les surprises sont au rendez-vous !";
    else if (today.year === YEAR && today.month === 12 && today.day >= 1) {
      message = state.opened.includes(today.day) ? "C'est noté ! À demain pour la suite." : "Une nouvelle fenêtre t'attend aujourd'hui !";
    }
    $("status-message").textContent = message;
    updateCountdown(today);
  }

  function updateCountdown(today = parisDate()) {
    let target, label;
    if (today.year < YEAR || (today.year === YEAR && today.month < 12)) {
      target = new Date("2026-11-30T23:00:00Z");
      label = "AVANT LE PREMIER CADEAU";
    } else if (today.year === YEAR && today.month === 12 && today.day < 24) {
      target = new Date(Date.UTC(YEAR, 11, today.day, 23, 0, 0));
      label = "PROCHAINE SURPRISE DANS";
    } else {
      $("countdown").textContent = "24 / 24";
      $("countdown-caption").textContent = "LA MAGIE EST COMPLÈTE";
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
    el.setAttribute("aria-label", "Jour " + day + " décembre : " + (opened ? "découvert" : !unlocked ? "verrouillé" : preview ? "aperçu disponible" : "à découvrir"));
    el.title = opened ? "Redécouvrir la case " + day : unlocked ? "Ouvrir la case " + day : "Disponible le " + day + " décembre 2026";
    const icon = opened ? surprises[Number(state.picks[day])]?.emoji || "✦" : ICONS[(day * 7 + 3) % ICONS.length];
    const status = opened ? "DÉCOUVERT" : !unlocked ? "FERMÉ" : preview ? "APERÇU" : "OUVRIR";
    el.innerHTML = '<span class="door-number"></span><span class="door-date">DÉC.</span><span class="door-icon" aria-hidden="true"></span><span class="door-status"></span>' + (day === 24 ? '<span class="door-feature" aria-hidden="true">✦</span>' : "");
    el.querySelector(".door-number").textContent = String(day).padStart(2,"0");
    el.querySelector(".door-icon").textContent = icon;
    el.querySelector(".door-status").textContent = status;
    el.addEventListener("click", () => {
      if (!eligible(day)) {
        play("locked");
        showToast("La case " + day + " s'ouvrira le " + day + " décembre 2026. Le Père Noël veille !");
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
      explanation.textContent = (index === item.correct ? "Bravo ! " : "Pas tout à fait. ") + item.explanation;
      if (!demo || officiallyUnlocked(day)) { state.answers[day] = index; persist(); }
      play(index === item.correct ? "correct" : "wrong");
    }
    if (Number.isInteger(saved) && saved >= 0 && saved < item.options.length) grade(saved);
  }

  function showSurprise(day, item) {
    if (!item) { showToast("Les surprises sont momentanément indisponibles."); return; }
    $("dialog-day").textContent = "CASE " + String(day).padStart(2,"0") + " / 24";
    $("dialog-illustration").textContent = item.emoji;
    $("dialog-category").textContent = TYPE_NAMES[item.type] || "SURPRISE SCIENTIFIQUE";
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
      source.textContent = "Voir l'étude · " + (item.sourceLabel || "DOI") + " ↗";
      source.hidden = false;
    } else {
      source.removeAttribute("href");
      source.hidden = true;
    }
  }

  function openDoor(day) {
    activeDay = day;
    const wasOpened = state.opened.includes(day);
    const item = draw(day);
    if (officiallyUnlocked(day) && !wasOpened) {
      state.opened.push(day);
      state.opened.sort((a,b) => a-b);
      persist();
    }
    showSurprise(day, item);
    renderGrid();
    $("surprise-dialog").showModal();
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
    const title = state.sound ? "Couper les sons" : "Activer les sons";
    button.setAttribute("aria-label", title);
    button.title = title;
  }

  function updateDemoButton() {
    $("preview-toggle").setAttribute("aria-pressed", String(demo));
    $("preview-label").textContent = demo ? "Quitter la démo" : "Mode démo";
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

  $("preview-toggle").addEventListener("click", () => {
    demo = !demo;
    updateDemoButton();
    renderGrid();
    showToast(demo ? "Mode démo activé ! Les découvertes anticipées ne comptent pas dans la progression officielle." : "Mode démo désactivé : retour au calendrier réel.");
  });
  $("sound-toggle").addEventListener("click", () => {
    state.sound = !state.sound;
    persist();
    updateSoundButton();
    play("correct");
    showToast(state.sound ? "Petit carillon activé !" : "Ambiance silencieuse activée.");
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