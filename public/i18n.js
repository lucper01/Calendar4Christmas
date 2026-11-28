(() => {
  "use strict";
  const KEY = "calendar4christmas-language-v1";
  const translations = {
    fr: {
      gate_edition:"ÉDITION 2026 · INVITATION PRIVILÉGIÉE", gate_title:"La magie est", gate_title_em:"sous clé.",
      gate_intro:"Un petit secret avant les grandes découvertes. Entre le code transmis par l'organisateur pour accéder au calendrier de l'Avent du laboratoire.",
      access_label:"TON CODE D'ACCÈS", access_placeholder:"Code d'invitation", reveal:"Afficher", conceal:"Masquer",
      enter:"Ouvrir le laboratoire", gate_foot:"24 jours. 24 fenêtres. Une infinité de curiosités.",
      awaiting_code:"Saisis ton code pour entrer dans le labo.", incorrect_code:"Ce code n'ouvre pas la porte. Réessaie !",
      too_many:"Trop de tentatives. Réessaie dans une minute.", verifying:"Vérification…",
      unavailable:"Le laboratoire n'est pas encore configuré sur Cloudflare.",
      network_error:"Connexion impossible. Vérifie ta connexion Internet et réessaie.",
      lock:"Verrouiller", lock_title:"Verrouiller le calendrier", demo:"Mode démo", quit_demo:"Quitter la démo",
      demo_heading:"Mode de vérification", demo_intro:"Entre le code démo pour vérifier les 24 cases dès maintenant, y compris les photos et les vidéos. Les dates d'ouverture normales restent inchangées.",
      demo_code_label:"Code de démonstration", demo_code_placeholder:"Code démo",
      demo_cancel:"Annuler", demo_activate:"Activer la démo", demo_activating:"Activation…",
      demo_invalid:"Code démo incorrect.", demo_connection_error:"Impossible de vérifier le mode démo sur Cloudflare. Réessaie.",
      brand_subtitle:"LE LABO DE NOËL", hero_kicker:"DÉCEMBRE 2026", hero_motto:"UN NOËL TRÈS CURIEUX",
      hero_line1:"Cette année,", hero_line2:"la science se met", hero_line3:"sur son 31.",
      hero_intro:"24 petites portes. Un concentré de découvertes, de quiz improbables et de défis de labo. Chaque jour, un peu de magie… et beaucoup de curiosité.",
      discover:"Découvrir le calendrier", hero_caption:"À consommer sans modération scientifique.",
      formula:"FORMULE SECRÈTE", science:"science",
      pole:"MESSAGE DU PÔLE NORD", opened_label:"CASES DÉCOUVERTES", countdown_first:"AVANT LE PREMIER CADEAU",
      countdown_next:"PROCHAINE SURPRISE DANS", countdown_complete:"LA MAGIE EST COMPLÈTE",
      message_before:"Les lutins peaufinent les protocoles.", message_demo:"Mode démo : les 24 cases sont accessibles !",
      message_complete:"Toutes les surprises sont au rendez-vous !",
      message_opened_today:"C'est noté ! À demain pour la suite.", message_today:"Une nouvelle fenêtre t'attend aujourd'hui !",
      calendar_kicker:"VOTRE RENDEZ-VOUS SCIENTIFIQUE", calendar_title:"Le calendrier", calendar_title_em:"des curiosités.",
      calendar_intro:"Choisis une case, laisse-toi surprendre.", calendar_intro2:"Les surprises s'ouvrent du 1er au 24 décembre.",
      december:"DÉC.", discovered:"DÉCOUVERT", closed:"FERMÉ", open:"OUVRIR", preview:"APERÇU",
      legend_ready:"À découvrir", legend_discovered:"Découverte", legend_locked:"Encore un peu de patience",
      recipe:"LA RECETTE DU BONHEUR", recipe_title:"Un peu de Noël.", recipe_title_em:"Beaucoup de neurones.",
      recipe_body:"Chaque fenêtre révèle une surprise puisée dans un assortiment de quiz, faits étonnants et petites expériences. Reviens chaque jour : ton aventure se conserve sur cet appareil.",
      impatient:"POUR LES CURIEUX IMPATIENTS", impatient_title:"Tu veux essayer", impatient_title2:"avant décembre ?",
      impatient_body:"Active le mode démo en haut de la page : les 24 fenêtres deviennent accessibles, sans altérer ta progression officielle.",
      footer:"Fait avec de la curiosité, de la rigueur et une pointe de cannelle.", copyright:"© 2026 · L'AVENT DE LA SCIENCE",
      read_source:"Lire la source scientifique", another:"Autre surprise", done:"C'est dans la boîte !",
      close_surprise:"Fermer la surprise", day:"CASE", preview_only:"Aperçu de l'album",
      photo_coming:"Cette case contient un album photo protégé. Les images seront révélées le jour prévu, à l'heure de Paris.",
      upload_pending:"Cet album n'a pas encore été importé dans le stockage privé.",
      no_photos:"Les images de cet album ne sont pas encore disponibles.", image_alt:"Photo de l'album",
      source_label:"Voir l'étude", photos:"photos", videos:"vidéos", media:"médias", gallery:"Galerie",
      login_required:"Connecte-toi pour accéder au calendrier.", lock_succeeded:"Le laboratoire est à nouveau verrouillé.",
      not_available:"Cette case n'est pas encore disponible.", locked_day:"La case {day} s'ouvrira le {day} décembre 2026. Le Père Noël veille !",
      demo_on:"Mode démo activé ! Les 24 cases, photos et vidéos sont accessibles.",
      demo_off:"Mode démo désactivé : retour au calendrier réel.",
      sound_on:"Petit carillon activé !", sound_off:"Ambiance silencieuse activée.",
      sound_enable:"Activer les sons", sound_disable:"Couper les sons",
      quiz:"QUIZ DU LUTIN", fact:"LE SAVIEZ-VOUS ?", challenge:"DÉFI DU LABORATOIRE", myth:"VRAI OU FAUX ?",
      quiz_correct:"Bravo ! ", quiz_incorrect:"Pas tout à fait. ",
      loading:"Chargement…", secure_album:"ALBUM SECRET", album_error:"Impossible d'ouvrir cet album pour le moment.",
      next_media:"Photo suivante", prev_media:"Photo précédente", album_progress:"{current} sur {total}",
      photo_label:"Photographie", video_label:"Vidéo", no_description:"Description à venir.",
      admin_link:"Espace administration", lang_label:"Langue / Language"
    },
    en: {
      gate_edition:"2026 EDITION · AN EXCLUSIVE INVITATION", gate_title:"The magic is", gate_title_em:"under lock and key.",
      gate_intro:"A little secret before the big discoveries. Enter the code shared by the organiser to explore the laboratory's Advent calendar.",
      access_label:"YOUR ACCESS CODE", access_placeholder:"Invitation code", reveal:"Show", conceal:"Hide",
      enter:"Enter the laboratory", gate_foot:"24 days. 24 doors. Endless curiosity.",
      awaiting_code:"Enter your code to visit the lab.", incorrect_code:"That code doesn't open the door. Try again!",
      too_many:"Too many attempts. Please try again in one minute.", verifying:"Checking…",
      unavailable:"The laboratory has not been configured on Cloudflare yet.",
      network_error:"Could not connect. Check your internet connection and try again.",
      lock:"Lock", lock_title:"Lock the calendar", demo:"Demo mode", quit_demo:"Exit demo",
      demo_heading:"Verification mode", demo_intro:"Enter the demo code to test all 24 doors now, including photos and videos. Normal release dates remain unchanged.",
      demo_code_label:"Demo access code", demo_code_placeholder:"Demo code",
      demo_cancel:"Cancel", demo_activate:"Enable demo", demo_activating:"Enabling…",
      demo_invalid:"Incorrect demo code.", demo_connection_error:"Could not activate demo mode on Cloudflare. Try again.",
      brand_subtitle:"THE CHRISTMAS LAB", hero_kicker:"DECEMBER 2026", hero_motto:"A VERY CURIOUS CHRISTMAS",
      hero_line1:"This year,", hero_line2:"science is", hero_line3:"dressed to impress.",
      hero_intro:"24 little doors. A collection of discoveries, quirky quizzes and lab challenges. A touch of magic every day… and plenty of curiosity.",
      discover:"Explore the calendar", hero_caption:"Best enjoyed with a generous dose of curiosity.",
      formula:"SECRET FORMULA", science:"science",
      pole:"MESSAGE FROM THE NORTH POLE", opened_label:"DOORS DISCOVERED", countdown_first:"UNTIL THE FIRST GIFT",
      countdown_next:"NEXT SURPRISE IN", countdown_complete:"ALL THE MAGIC UNLOCKED",
      message_before:"The elves are fine-tuning their protocols.", message_demo:"Demo mode: all 24 doors can be explored!",
      message_complete:"All the surprises are ready!",
      message_opened_today:"All noted! Come back tomorrow.", message_today:"A new door is waiting for you today!",
      calendar_kicker:"YOUR DAILY SCIENCE DATE", calendar_title:"The calendar", calendar_title_em:"of curiosities.",
      calendar_intro:"Pick a door and see what happens.", calendar_intro2:"New surprises unlock from December 1 to 24.",
      december:"DEC.", discovered:"DISCOVERED", closed:"LOCKED", open:"OPEN", preview:"PREVIEW",
      legend_ready:"Ready to discover", legend_discovered:"Discovered", legend_locked:"A little more patience",
      recipe:"THE RECIPE FOR JOY", recipe_title:"A little Christmas.", recipe_title_em:"A lot of brainpower.",
      recipe_body:"Every window reveals a surprise drawn from quizzes, surprising facts and small experiments. Come back every day: your progress is saved on this device.",
      impatient:"FOR THE IMPATIENTLY CURIOUS", impatient_title:"Want to try it", impatient_title2:"before December?",
      impatient_body:"Enable demo mode above: all 24 doors can be explored, without affecting your official progress.",
      footer:"Made with curiosity, rigour, and a pinch of cinnamon.", copyright:"© 2026 · A SCIENTIFIC ADVENT",
      read_source:"Read the scientific source", another:"Another surprise", done:"One for the books!",
      close_surprise:"Close surprise", day:"DAY", preview_only:"Album preview",
      photo_coming:"This door contains a protected photo album. The photos will be revealed on the scheduled day, Paris time.",
      upload_pending:"This album has not yet been uploaded to private storage.",
      no_photos:"The images in this album are not available yet.", image_alt:"Album photo",
      source_label:"Read the study", photos:"photos", videos:"videos", media:"media", gallery:"Gallery",
      login_required:"Sign in to access the calendar.", lock_succeeded:"The laboratory is locked again.",
      not_available:"This door is not available yet.", locked_day:"Door {day} will unlock on December {day}, 2026. Santa is watching!",
      demo_on:"Demo mode enabled! All 24 doors, photos and videos are now available.",
      demo_off:"Demo mode off: back to the actual calendar.",
      sound_on:"Holiday chimes enabled!", sound_off:"Silent mode enabled.",
      sound_enable:"Enable sounds", sound_disable:"Mute sounds",
      quiz:"ELF QUIZ", fact:"DID YOU KNOW?", challenge:"LAB CHALLENGE", myth:"FACT OR FICTION?",
      quiz_correct:"Well done! ", quiz_incorrect:"Not quite. ",
      loading:"Loading…", secure_album:"SECRET ALBUM", album_error:"This album could not be opened right now.",
      next_media:"Next photo", prev_media:"Previous photo", album_progress:"{current} of {total}",
      photo_label:"Photograph", video_label:"Video", no_description:"Description coming soon.",
      admin_link:"Administration", lang_label:"Language / Langue"
    }
  };
  const valid = value => value==="en" || value==="fr";
  let current = "fr";
  try {
    const stored = localStorage.getItem(KEY);
    const browser = (navigator.language || "fr").toLowerCase().startsWith("fr") ? "fr" : "en";
    current = valid(stored) ? stored : browser;
  } catch {}
  function t(key,vars={}) {
    const str=translations[current][key] || translations.fr[key] || key;
    return str.replace(/\{(\w+)\}/g,(_,name)=>String(vars[name]??""));
  }
  function apply() {
    document.documentElement.lang=current;
    document.querySelectorAll("[data-i18n]").forEach(el=>{el.textContent=t(el.dataset.i18n);});
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{el.placeholder=t(el.dataset.i18nPlaceholder);});
    document.querySelectorAll("[data-i18n-aria]").forEach(el=>{el.setAttribute("aria-label",t(el.dataset.i18nAria));});
    document.querySelectorAll("[data-lang]").forEach(el=>{
      el.setAttribute("aria-pressed", String(el.dataset.lang===current));
    });
    document.title = current==="fr" ? "Calendar4Christmas | Un Noël très curieux" : "Calendar4Christmas | A very curious Christmas";
  }
  function change(lang) {
    if(!valid(lang)) return;
    current=lang;
    try{localStorage.setItem(KEY,lang);}catch{}
    apply();
    window.dispatchEvent(new CustomEvent("c4c:language", {detail:{lang}}));
  }
  document.addEventListener("click",ev=>{
    const button=ev.target.closest("[data-lang]");
    if(button)change(button.dataset.lang);
  });
  window.C4C_I18N={t, change, apply, get lang(){return current;}};
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",apply,{once:true});
  else apply();
})();