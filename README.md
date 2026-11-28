# Calendar4Christmas - Calendrier de l'Avent du laboratoire

Projet déployé sur Cloudflare Workers + Cloudflare R2, avec **24 journées** composées chacune d'une **photo ou galerie de photos/vidéos** et d'une **surprise scientifique**. Le site fonctionne en français et en anglais.

## Accès et administration

- Cloudflare Access : protection du domaine Workers et de l'intégralité des routes `/api/*`.
- Écran d'invitation du calendrier : code d'accès habituel, côté navigateur.
- **Mode démo** : saisie du code de démonstration convenu dans le Worker, donnant immédiatement accès aux 24 jours, photos, vidéos et quiz, avant leur date réelle.
- **Administration** : un lien apparaît dans le calendrier lorsque le mode démo est actif. La même session démo permet d'ouvrir `/admin.html`, sans code ni jeton administrateur distinct.
- Le Worker émet un cookie de prévisualisation HMAC signé, `HttpOnly`, `Secure`, `SameSite=Strict`, valable 2 heures. Il peut facultativement utiliser un secret `DEMO_SIGNING_KEY` stocké dans Cloudflare pour améliorer la gestion de la signature, sans être un code de connexion utilisateur.

**Limite importante :** toute personne autorisée par Cloudflare Access et connaissant le code démo peut aussi modifier le calendrier. C'est le fonctionnement demandé pour un usage privé ; le code démo ne constitue pas un dispositif d'autorisation administrateur robuste. Cloudflare Access doit rester actif. Aucun secret ni média personnel ne doit être ajouté au dépôt public.

## L'administration

La page `/admin.html` permet :

- de choisir un jour parmi les 24 ;
- de répartir librement les photos, vidéos et albums ; de les déplacer, réordonner, retirer de chaque jour ou réutiliser sur plusieurs jours ;
- d'ajouter des médias à la bibliothèque R2 depuis le navigateur, un par un (JPEG, PNG, WebP, MP4 ; maximum 24 Mio par fichier) ;
- de renseigner titres, descriptions et légendes dans les deux langues ;
- de proposer chaque jour **une surprise scientifique automatique**, **une information personnalisée** ou **un quiz personnalisé** (2 à 4 réponses, choix correct, explication) ;
- d'enregistrer directement le calendrier dans R2, sans déploiement supplémentaire ;
- de vérifier la présence des fichiers dans R2.

Le bouton **Enregistrer** persiste l'organisation des 24 journées. L'import d'une nouvelle photo la met dans la médiathèque ; elle est ensuite attribuable à un jour.

### Migration de l'ancien calendrier

La version précédente contenait 21 journées photographiques et 3 journées scientifiques. Le Worker convertit automatiquement l'ancien fichier `calendar.json` au format **24 journées photographiques + bonus quotidien** et répartit trois médias des albums les plus fournis sur les trois derniers jours. Aucun média n'est supprimé ou déplacé physiquement dans R2. La première sauvegarde depuis l'administration enregistre durablement cette nouvelle organisation.

Les nouvelles photos sélectionnées dans l'administration sont stockées directement dans R2 (pas dans le dépôt GitHub).

## Organisation Cloudflare

- `src/worker.js` : API des 24 journées, des photos, des bonus et de l'administration ;
- `public/index.html`, `public/app.js`, `public/secure-client.js` : calendrier et galerie ;
- `public/admin.html`, `public/admin.js`, `public/admin.css` : interface d'édition ;
- `public/surprises.js`, `public/surprises.en.js` : 47 surprises scientifiques possibles pour le bonus automatique ;
- `public/i18n.js` : sélection FR/EN ;
- `wrangler.jsonc` : déploiement Worker et liaison `MEDIA` au bucket privé `calendar4christmas-private`.

Les photos sont dans R2 aux clés `media/m001.jpg`, etc. Le fichier `calendar.json` est placé à la racine du bucket. Les routes `/api/media/*` contrôlent les dates de publication, sauf en mode démo.

## Développement et contrôle

```bash
npm install
npm run check
npm test
npm run deploy
```

Le projet conserve le déploiement intermédiaire via GitHub jusqu'au transfert définitif du code dans Cloudflare Artifacts. **Ne pas supprimer GitHub avant d'avoir vérifié un déploiement indépendant du dépôt.**

## Licence

Projet personnel. Aucune licence de redistribution n'est accordée par défaut.
