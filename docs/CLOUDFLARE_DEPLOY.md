# Calendar4Christmas - Migration Cloudflare Workers + R2

## État du projet

La branche `feature/cloudflare-private-albums` contient le système de sécurité **en développement**. Tant que la branche n'est pas fusionnée et que les ressources Cloudflare ne sont pas configurées, le site public ne dispose pas encore de l'authentification serveur.

**Aucune photo ou vidéo personnelle n'est publiée dans GitHub**. Le manifeste privé, le code d'accès, les jetons et les fichiers médias doivent rester hors de ce dépôt public.

## Architecture

- `src/worker.js` : validation du code d'invitation côté serveur, cookie `HttpOnly; Secure; SameSite=Strict` signé HMAC-SHA-256 (12 h), sessions, agenda des dates Europe/Paris, API des albums et lecture privée de médias R2
- `public/` : fichiers statiques de l'interface, avec sélection FR/EN mémorisée localement
- `public/admin.html` : interface privée d'import (manifest JSON puis ZIP ou fichiers multimédias), accessible après connexion + jeton administrateur
- `wrangler.jsonc` : Workers Static Assets + liaison `MEDIA` au bucket privé
- R2 : `config/calendar.json` et `media/m001` … `media/m053`

Aucune URL publique R2 n'est nécessaire. L'accès aux fichiers est conditionné à une session valide et à la date d'ouverture. Le mode démo ne contourne pas cette vérification.

## Configuration Cloudflare depuis un téléphone

1. Ouvrir [Cloudflare Dashboard](https://dash.cloudflare.com/) depuis Chrome (au besoin, activer **Version ordinateur**).
2. Dans **R2 Object Storage**, créer un bucket nommé **`calendar4christmas-private`**.
3. **Ne pas activer Public Development URL ou Custom Domain** pour ce bucket.
4. Dans **Workers & Pages → calendar4christmas → Settings → Variables and Secrets**, définir ces trois secrets :
   - `ACCESS_CODE` : **le code d'invitation choisi** (ne pas le coller dans le dépôt).
   - `SESSION_SECRET` : une chaîne aléatoire d'au moins 32 caractères, idéalement 64.
   - `ADMIN_TOKEN` : une **autre** chaîne aléatoire indépendante, d'au moins 32 caractères.
5. Vérifier que le Worker est configuré pour déployer depuis GitHub (branche `main`). Une fois ces ressources créées, fusionner la PR et configurer la commande de déploiement **`npm run deploy`** si Cloudflare ne la détecte pas automatiquement. La liaison R2 est décrite dans `wrangler.jsonc`, avec le nom exact **`MEDIA`**.
6. Vérifier `https://calendar4christmas.lperroquin.workers.dev/api/health` : `configured:true`, `r2Bound:true`.
7. Sur le site, entrer le code d'invitation ; le navigateur reçoit un cookie de session sécurisé sans exposer le code attendu dans le JavaScript.
8. Ouvrir l'interface administrateur : `https://calendar4christmas.lperroquin.workers.dev/admin.html`. Saisir le jeton administrateur, puis importer le **manifeste JSON privé** et le **ZIP original** (ou les fichiers extraits). Ne jamais envoyer ces éléments sur GitHub public.

Le manifeste préparé pour cette archive contient **21 albums photos/vidéos**, **53 médias** et **3 cases scientifiques** de complément. Les titres et descriptions sont provisoires, dans les deux langues, et peuvent être modifiés après relecture.

### Bascule FR / EN

Un bouton **FR / EN** est disponible sur la page d'accueil et dans le calendrier. Il est également présent sur l'interface d'administration. La préférence est enregistrée en `localStorage` et les 47 surprises scientifiques sont disponibles en anglais.

Pour les photos, le manifeste utilise le schéma suivant :

```json
{
  "day": 1,
  "type": "album",
  "title": { "fr": "Titre", "en": "Title" },
  "description": { "fr": "Description", "en": "Description" },
  "media": [
    {
      "id": "m001",
      "type": "image",
      "filename": "nom-original.jpg",
      "caption": { "fr": "", "en": "" },
      "alt": { "fr": "Description visuelle", "en": "Image description" }
    }
  ]
}
```

Le nom du fichier n'est transmis qu'à l'interface d'administration, pas aux visiteurs.

## Vérifications nécessaires

- Le Worker contrôle la disponibilité des médias avec le temps serveur en **Europe/Paris**, et pas seulement l'horloge locale.
- Les réponses des API privées contiennent `Cache-Control: no-store`.
- Les pages et scripts restent publics, mais ils ne contiennent ni images personnelles ni secrets.
- Les cookies `HttpOnly` empêchent le JavaScript de lire directement le jeton de session.
- Les téléchargements R2 nécessitent un cookie valide et un média autorisé pour le jour.
- Le service worker ne met **jamais** en cache les réponses `/api/*`.
- Le jeton d'administration est demandé à chaque passage et **n'est pas enregistré par l'application**.
- L'API des téléversements impose un plafond de **24 Mio par fichier**, des extensions et types MIME autorisés, et un nom d'objet déterminé par le manifeste.

## Limites et mesures complémentaires

1. Le limiteur de tentatives `/api/session` est **en mémoire par instance Worker** et n'est pas suffisant contre une attaque distribuée : ajouter une règle **Cloudflare WAF Rate Limiting** sur la route `/api/session`.
2. Le code d'invitation est partagé : les personnes ayant ce code verront les mêmes albums publiés. Une fois vus, ces médias peuvent être copiés ou partagés.
3. Une personne peut toujours modifier l'heure locale et ouvrir une case de démonstration, mais **elle ne recevra pas les fichiers privés en avance**.
4. Le navigateur peut conserver en mémoire un média qu'il a déjà chargé jusqu'à fermeture de l'onglet. La confidentialité après téléchargement ne peut être garantie.
5. Le projet est configuré pour 2026 : revoir la clé de stockage, l'année, les titres et les règles d'ouverture pour les éditions suivantes.
6. La sécurisation n'est opérationnelle en production **qu'après** configuration des secrets, du bucket, de la fusion de la PR et des tests de déploiement.

## Test local

```bash
npm install
cp .dev.vars.example .dev.vars
# Modifier .dev.vars avec les vrais secrets, ne jamais committer ce fichier.
npm run dev
```

Tests de syntaxe : `npm run check`.

## API résumée

- `GET /api/health` : présence des liaisons et des secrets (sans leurs valeurs)
- `POST /api/session` : valide le code, crée un cookie signé
- `GET /api/session` : état de connexion
- `DELETE /api/session` : fermeture de la session
- `GET /api/calendar` : type des 24 cases et disponibilités, sans nom de fichier
- `GET /api/day/:day` : titre, description et IDs des médias **uniquement si la date est ouverte**
- `GET /api/media/:id` : stream photo/vidéo R2 avec contrôle d'accès et support des plages vidéo
- `GET/PUT /api/admin/manifest` : lecture/import du manifeste, avec jeton admin
- `GET /api/admin/status` : liste des IDs médias déjà importés
- `PUT /api/admin/media/:id` : import d'un média autorisé par le manifeste

## Déploiement sûr

**Ne pas fusionner la PR tant que le bucket R2 et les secrets Cloudflare ne sont pas prêts.** Sans eux, l'accès au calendrier sera volontairement refusé (échec sécurisé). L'ancien calendrier GitHub Pages restera sur sa branche principale jusque-là.
