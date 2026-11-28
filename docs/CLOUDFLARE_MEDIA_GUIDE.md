# Calendar4Christmas - Hébergement 100 % Cloudflare

## Architecture définitive

- **Cloudflare Workers** : héberge l'interface HTML/CSS/JavaScript et les API du calendrier.
- **Cloudflare Access** : protège le Worker (toutes les routes, y compris `/api/*`).
- **Code M2CSGA** : conservé comme écran d'invitation, sans jeton administrateur.
- **Cloudflare R2** : conserve durablement les 53 photographies/vidéos et le manifeste calendrier; bucket non public.
- **Cloudflare Artifacts** (migration finale) : peut héberger le code source dans un dépôt Git compatible, connecté à Workers Builds, **sans GitHub**.
- **GitHub** : uniquement un relais de déploiement temporaire. Il peut être supprimé après migration et vérification de l'indépendance Cloudflare.

Les documents et médias personnels ne sont pas et ne doivent pas être ajoutés à GitHub. Aucun token d'administration de l'application n'est requis. Le tableau de bord Cloudflare, authentifié par le compte Cloudflare, permet d'importer les objets R2.

## Paquet d'importation privé

Le fichier **`Calendar4Christmas_R2_import_sans_token.zip`** est disponible en téléchargement dans la conversation. Il comprend :
- `calendar.json` : les 24 cases, 21 albums et 3 surprises scientifiques ;
- `media/m001.jpg` ... : les 50 photos et 3 vidéos renommées avec un nom simple ;
- `LISEZMOI_IMPORT_R2.txt` : les étapes d'importation.

**L'archive doit être extraite avant upload dans Cloudflare R2.** R2 ne décompresse pas les ZIP déposés.

La correspondance des **53 fichiers** avec les originaux a été contrôlée ; aucun média oublié.

## Mise en place sur Cloudflare (sans jeton d'admin)

1. Depuis `https://dash.cloudflare.com`, ouvrir **R2 Object Storage**.
2. Créer le bucket privé `calendar4christmas-private`.
3. **Ne pas activer** de lien public, de domaine R2 public ou de `r2.dev`.
4. Dans le bucket, ajouter `calendar.json` à sa racine.
5. Créer ou ouvrir le dossier virtuel `media/` et téléverser les 53 fichiers du sous-dossier `media/` du ZIP décompressé. Les clés finales doivent ressembler à `media/m001.jpg`, `media/m012.png`, `media/m053.mp4` selon les extensions réelles.
6. Dans Workers & Pages, vérifier que le Worker `calendar4christmas` possède une **règle Cloudflare Access** couvrant **toutes les routes**. La règle doit empêcher les personnes non autorisées d'atteindre le Worker avant le traitement des requêtes.
7. Vérifier que le Worker existant est lié au dépôt GitHub temporaire `lucper01/Calendar4Christmas` et qu'un `push` sur `main` lance le déploiement.
8. **Une fois R2 prêt**, fusionner la PR de migration. Le fichier `wrangler.jsonc` utilise `npx wrangler deploy`, le nom `calendar4christmas`, le dossier `public/` et la liaison R2 `MEDIA`.
9. Contrôler `https://calendar4christmas.lperroquin.workers.dev/api/health` derrière Access. La réponse doit contenir `"worker":true`, `"r2Bound":true` et `"storageReady":true`.
10. Tester le code M2CSGA, le sélecteur FR/EN, les 24 cases, une galerie ouverte et l'impossibilité d'obtenir des médias des cases futures directement.

**Ne pas fusionner avant la création du bucket R2** : un Worker déployé avec une liaison vers une ressource inexistante peut échouer au déploiement, ce qui compliquerait la migration.

## Organisation des objets R2

```text
calendar4christmas-private/
  calendar.json
  media/
    m001.jpg
    m002.jpg
    ...
    m053.mp4
```

Les extensions dépendent des fichiers originaux : elles sont utilisées par le Worker pour déterminer la clé R2 et le type MIME exact. Le manifeste JSON conserve les noms d'origine en interne, mais ne les transmet pas au navigateur.

## Abandon définitif de GitHub

Cloudflare propose **Artifacts**, un hébergement de dépôt Git compatible, connecté directement à **Workers Builds**. Cela permet d'héberger le code source, ses versions et ses déploiements au sein de Cloudflare.

Procédure recommandée :

1. Importer le dépôt GitHub actuel dans **Cloudflare Artifacts** depuis la console Cloudflare ou son API.
2. Connecter le Worker `calendar4christmas` à ce dépôt Artifacts dans **Workers Builds**.
3. Effectuer **au moins un déploiement depuis Artifacts** et vérifier l'adresse publique existante.
4. Contrôler que le bucket R2, le manifeste, les 53 médias, Access et les galeries restent accessibles.
5. Désactiver l'ancienne intégration GitHub ; vérifier que les nouvelles mises à jour proviennent bien d'Artifacts.
6. **Seulement alors**, supprimer le dépôt GitHub.

Cloudflare indique qu'un Worker déjà déployé continue d'être hébergé lorsque son accès à GitHub est retiré, mais cela **interrompt les futurs builds GitHub**. La migration préalable vers Artifacts évite cette dépendance.

Pour créer/modifier des descriptions, il suffit d'actualiser le fichier `calendar.json` dans R2 ; pas besoin de re-déployer le site.

## Tests

`npm run check` : validation syntaxique.

`npm test` : simulation des 24 cases, contrôle des dates, médias R2 en lecture seule, absence de routes administrateur, sélecteur FR/EN et 47 surprises traduites.

### Liens utiles

- Cloudflare Artifacts : https://developers.cloudflare.com/artifacts/
- Artifacts + Workers Builds : https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/artifacts-integration/
- Protection Workers Access : https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- GitHub integration : https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
