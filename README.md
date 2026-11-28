# Calendar4Christmas - Le labo de Noël

Un calendrier de l'Avent scientifique et photographique pour décembre **2026**, hébergé par Cloudflare Workers. Il comprend 24 cases : **21 albums photo/vidéo** stockés dans **Cloudflare R2**, et **3 cases de surprises scientifiques**. L'interface et les 47 contenus scientifiques disponibles pour les cases non photographiques sont bilingues **FR / EN**.

## Accès et mode de vérification

- **Cloudflare Access** protège le domaine Workers. Les API et médias doivent rester couverts par cette politique, y compris `/api/*`.
- Un écran d'invitation supplémentaire utilise le code transmis aux invités, contrôlé côté navigateur par une empreinte PBKDF2. Il n'est **pas** un mécanisme de sécurité suffisant à lui seul.
- Le bouton **Mode démo** ouvre une fenêtre demandant le code **triche**. Une fois validé par le Worker, il donne accès **aux 24 cases immédiatement, y compris tous les albums et vidéos R2**, sans attendre leurs dates.
- Le Worker active une session démo limitée à **2 heures** via un cookie `HttpOnly; Secure; SameSite=Strict`. Le bouton **Quitter la démo** supprime ce cookie. La session expire également à la fermeture du navigateur si le cookie de session est supprimé.
- Hors démo, les images et vidéos de chaque jour ne sont accessibles qu'après la date correspondante selon le fuseau **Europe/Paris**, contrôlé par le Worker. La progression officielle n'est pas augmentée par les ouvertures anticipées en démo.

**Important :** `triche` est un code de vérification partagé, **pas une protection confidentielle** ; une personne qui le connaît et dispose de l'accès Cloudflare pourra consulter les albums futurs. Il ne remplace pas Cloudflare Access. L'application ne comporte aucun jeton administrateur.

## Architecture

- `src/worker.js` : Worker Cloudflare, API des albums, lecture des médias R2, calendrier et session démo.
- `public/index.html`, `public/styles.css`, `public/app.js`, `public/access.js`, `public/secure-client.js`, `public/i18n.js` : interface festive, code d'invitation, galerie, changement de langue et contrôles de démo.
- `public/surprises.js`, `public/surprises.en.js` : contenu des 47 surprises scientifiques en deux langues.
- `public/sw.js` : cache PWA limité aux fichiers statiques, **jamais** aux routes `/api/`.
- `wrangler.jsonc` : configuration du Worker et liaison R2 `MEDIA` avec le bucket `calendar4christmas-private`.
- Bucket R2 (privé) : `calendar.json` à la racine et `media/m001.jpg` etc. Les clés réelles dépendent des extensions conservées dans le manifeste.

**Aucune photo, vidéo, archive ni description privée n'est enregistrée dans GitHub**. L'objectif est de déplacer définitivement la gestion du code et des déploiements dans Cloudflare Artifacts, puis de retirer le dépôt GitHub après un déploiement indépendant vérifié.

## Installation et validation

```bash
npm install
npm run check
npm test
npm run deploy
```

Les tests couvrent notamment l'accès aux albums, le verrouillage normal avant décembre, l'activation démo avec `triche`, le rejet d'un mauvais code, la sortie du mode démo et les traductions de l'interface.

## Publication

Le projet Cloudflare Workers s'appelle **calendar4christmas** et conserve l'adresse :

`https://calendar4christmas.lperroquin.workers.dev/`

L'accès à `/api/health` doit indiquer `worker:true`, `r2Bound:true` et `storageReady:true` après la mise en place de R2.

Voir aussi le [guide Cloudflare](docs/CLOUDFLARE_MEDIA_GUIDE.md).

## Licence

Projet personnel. Aucune licence de redistribution n'est accordée par défaut.
