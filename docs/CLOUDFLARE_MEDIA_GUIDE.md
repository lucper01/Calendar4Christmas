# Calendar4Christmas - Photos privées sur Cloudflare, code sur GitHub

## Pourquoi ne pas committer les photos temporairement ?

**Supprimer un fichier du dépôt après déploiement ne le supprime pas de l'historique Git.** Une image ajoutée dans un dépôt public peut rester récupérable via l'historique, les clones et les caches. En outre, un déploiement Cloudflare ultérieur avec les photos supprimées du dépôt peut les supprimer des fichiers statiques déployés.

Cette version emploie donc une méthode plus fiable :

- **GitHub** contient le code du calendrier, sans aucune photo privée.
- **Cloudflare Workers** déploie automatiquement le code depuis GitHub.
- **Cloudflare R2** garde les photos/vidéos indépendamment des déploiements GitHub, sans URL publique directe.
- **Cloudflare Access** protège l'accès au domaine `calendar4christmas.lperroquin.workers.dev`.
- L'écran de code **M2CSGA** reste présent, sans authentification serveur supplémentaire pour les visiteurs.
- Le **jeton admin** protège uniquement les opérations d'import. Il doit être différent du code partagé aux visiteurs.

## État

La branche `feature/cloudflare-photo-albums` est une évolution qui doit être fusionnée après création du bucket et du jeton admin. Ne pas mettre à jour le site public tant que ces dépendances ne sont pas prêtes.

Le manifeste privé de l'archive du 27 novembre 2026 contient :
- 24 cases ;
- 21 albums photographiques/vidéo ;
- 3 cases scientifiques ;
- 50 photographies et 3 vidéos, sans duplicata ;
- titres, descriptions et légendes en français et anglais, provisoires et éditables.

Le manifeste est **remis en téléchargement privé dans la conversation**, jamais ajouté au dépôt GitHub public. Le ZIP d'origine reste également privé.

## Configuration depuis le téléphone

### 1. Créer R2

Ouvrir `https://dash.cloudflare.com/`, puis **R2 Object Storage** et créer un bucket nommé exactement :

`calendar4christmas-private`

Ne pas activer une **Public Development URL** ni lui associer de **Custom Domain**.

### 2. Configurer le seul jeton nécessaire à l'import

Dans **Workers & Pages → calendar4christmas → Settings → Variables and Secrets**, ajouter un secret :

- Nom : `ADMIN_TOKEN`
- Valeur : une chaîne aléatoire de **64 caractères** générée dans un gestionnaire de mots de passe.
- **Ne pas réutiliser le code M2CSGA**, qui est partagé avec les visiteurs.

Le jeton n'est pas dans le code GitHub et n'est pas sauvegardé par l'interface. La règle Cloudflare Access doit couvrir tout le domaine, en particulier `/api/*` et `/admin.html`.

### 3. Déployer depuis GitHub

Dans le projet Cloudflare **calendar4christmas** :
- Vérifier que GitHub est connecté au dépôt `lucper01/Calendar4Christmas`.
- Vérifier la branche de production `main`.
- À la fusion de la PR, le fichier `wrangler.jsonc` configure le code Worker, le dossier `public/` et la liaison R2 `MEDIA`.
- Dans les paramètres de build, utiliser la commande de déploiement `npx wrangler deploy` (ou `npm run deploy`) et l'installation `npm install` si demandée. Le nom du Worker doit rester `calendar4christmas`.

Lorsque le déploiement est terminé, vérifier :

`https://calendar4christmas.lperroquin.workers.dev/api/health`

Résultat attendu : `"ok": true`, `"worker": true`, `"r2Bound": true`, et `"storageReady": false` avant import du manifeste.

### 4. Importer l'archive directement sur Cloudflare

Depuis le navigateur du téléphone, ouvrir :

`https://calendar4christmas.lperroquin.workers.dev/admin.html`

Cette page propose trois étapes :

1. Entrer le `ADMIN_TOKEN` puis cliquer sur **Vérifier les accès** ;
2. Sélectionner le JSON `calendar4christmas-manifeste-prive-FR-EN-2026.json`, puis cliquer sur **Importer le calendrier** ;
3. Sélectionner le ZIP original **CSGA - Calendrier de l'avant -1-001.zip**, puis cliquer sur **Importer les médias**.

La page lit le ZIP dans le navigateur et transfère uniquement les 53 médias correspondants au manifeste, un par un. Les photos ne transitent pas par GitHub, et elles ne sont pas conservées dans le projet public.

Le ZIP est volumineux (environ 100 Mo) : sur Android, conserver l'onglet ouvert pendant l'import. Les 53 fichiers étant de moins de 24 Mio chacun, ils respectent le plafond appliqué par l'API. Si l'extraction ZIP n'est pas prise en charge par un navigateur, extraire l'archive sur l'appareil et sélectionner les médias directement.

Après import, cliquer sur **Vérifier les médias présents** : le bilan doit indiquer **53/53**.

### 5. Tester le calendrier

- Se connecter à Cloudflare Access.
- Saisir le code d'invitation sur l'écran de Noël.
- Basculer **FR / EN** et vérifier que la langue est conservée.
- En mode démo, les cases photographiques futures présentent seulement un aperçu, **pas le média**.
- Le jour prévu (heure Europe/Paris), les photos deviennent consultables via une galerie, avec navigation et légendes.
- Les cases 22 à 24 restent des surprises scientifiques.

## Description modifiable

Dans le manifeste JSON, chaque album propose `title.fr`, `title.en`, `description.fr`, `description.en` et pour chaque média `caption.fr` et `caption.en`.

Ces textes sont provisoires. Pour les modifier, éditer le JSON sur l'appareil puis le réimporter par l'interface admin. Il n'est pas nécessaire de republier GitHub.

## API du Worker

`GET /api/calendar` : inventaire public des cases, sans noms de médias non encore dévoilés.

`GET /api/day/:day` : titre, description et identifiants de médias d'un album uniquement après sa date d'ouverture.

`GET /api/media/:id` : lit le fichier privé dans R2, après vérification de la date. Vidéos MP4 servies avec prise en charge des requêtes `Range`.

`GET/PUT /api/admin/manifest`, `GET /api/admin/status` et `PUT /api/admin/media/:id` : nécessitent le jeton secret administrateur.

**Cloudflare Access doit rester activé** pour le domaine entier. Le Worker ne valide pas lui-même l'identité des visiteurs : il s'appuie sur la politique Access. Le code d'invitation côté navigateur est uniquement une seconde barrière de présentation. Une personne autorisée peut enregistrer et partager les images qu'elle a déjà reçues.

## Outils de développement

```sh
npm install
npm run check
npm test
npm run dev
```

Ne pas ajouter d'images, ZIP ou secrets dans Git. Les règles `.gitignore` évitent les ajouts accidentels dans les workflows locaux, mais elles ne remplacent pas une vérification des commits.

## Références de configuration

- GitHub integration Cloudflare Workers : https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
- Configuration Worker Static Assets : https://developers.cloudflare.com/workers/static-assets/binding/
- Liaison R2 : https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
