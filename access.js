/* Temporary invitation gate for a public static website.
 * This is a client-side deterrent only, NOT private asset protection.
 * The verification secret is a PBKDF2-derived key; the raw entry code is not in the repo.
 */
(() => {
  "use strict";

  const SESSION_KEY = "calendar4christmas-access-session-v2";
  const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
  const ITERATIONS = 175000;
  const SALT_HEX = "20cbfdd6496a1dc192f93009b26be565";
  const EXPECTED_HEX = "6fbf533cb1f1af4ba04b4286c40b869e6f2a5581272b9f9221b8f5e2416108b2";

  const gate = document.getElementById("access-gate");
  const form = document.getElementById("access-form");
  const field = document.getElementById("access-code");
  const feedback = document.getElementById("access-error");
  const submit = document.getElementById("access-submit");
  const lockAgain = document.getElementById("lock-again");
  const showCode = document.getElementById("access-visibility");
  let failedAttempts = 0;
  let cooldownUntil = 0;

  function hexToBytes(hex) {
    return Uint8Array.from(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
  }

  async function verify(code) {
    if (!crypto || !crypto.subtle) {
      throw new Error("Secure context required");
    }
    const input = new TextEncoder().encode(code.trim().toUpperCase());
    const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]);
    const result = await crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt: hexToBytes(SALT_HEX),
      iterations: ITERATIONS,
      hash: "SHA-256"
    }, key, 256);
    const digest = Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, "0")).join("");
    return digest === EXPECTED_HEX;
  }

  function saveSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_LIFETIME_MS));
    } catch { /* A locked-down browser may prevent session persistence. */ }
  }

  function isSessionValid() {
    try {
      const expiry = Number(sessionStorage.getItem(SESSION_KEY));
      return Number.isFinite(expiry) && expiry > Date.now() && expiry <= Date.now() + SESSION_LIFETIME_MS;
    } catch { return false; }
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }

  function unlock() {
    document.body.classList.remove("access-locked");
    document.body.classList.add("access-granted");
    gate.hidden = true;
    feedback.textContent = "";
    field.value = "";
    document.getElementById("calendar-grid")?.setAttribute("aria-live", "off");
  }

  function relock() {
    clearSession();
    document.body.classList.remove("access-granted");
    document.body.classList.add("access-locked");
    gate.hidden = false;
    field.value = "";
    field.type = "password";
    showCode.textContent = "Afficher";
    showCode.setAttribute("aria-pressed", "false");
    feedback.textContent = "";
    field.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  if (isSessionValid()) unlock();

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (Date.now() < cooldownUntil) {
      feedback.textContent = "Quelques secondes de patience avant une nouvelle tentative.";
      return;
    }

    const candidate = field.value.trim();
    if (!candidate) {
      feedback.textContent = "Saisis ton code pour entrer dans le labo.";
      field.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Vérification…";
    feedback.textContent = "";
    try {
      if (await verify(candidate)) {
        failedAttempts = 0;
        saveSession();
        unlock();
        document.querySelector(".brand")?.focus();
      } else {
        failedAttempts++;
        field.value = "";
        if (failedAttempts >= 5) {
          cooldownUntil = Date.now() + 30000;
          failedAttempts = 0;
          feedback.textContent = "Trop de tentatives : réessaie dans 30 secondes.";
        } else {
          feedback.textContent = "Ce code n'ouvre pas la porte. Réessaie !";
        }
        field.focus();
      }
    } catch {
      feedback.textContent = "Impossible de vérifier le code ici. Ouvre le site via HTTPS.";
    } finally {
      submit.disabled = false;
      submit.innerHTML = "Ouvrir le laboratoire <span aria-hidden=\"true\">↗</span>";
    }
  });

  field.addEventListener("input", () => { feedback.textContent = ""; });

  showCode.addEventListener("click", () => {
    const visible = field.type === "password";
    field.type = visible ? "text" : "password";
    showCode.textContent = visible ? "Masquer" : "Afficher";
    showCode.setAttribute("aria-pressed", String(visible));
    field.focus();
  });

  lockAgain.addEventListener("click", relock);
})();
