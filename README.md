# Calendar4Christmas — Le labo de Noël

Un calendrier de l'Avent scientifique, immersif, interactif et responsive. **24 cases** du 1er au 24 décembre **2026**, **47 surprises** sélectionnées aléatoirement (quiz, faits, défis et idées reçues) et une direction artistique Noël rouge, sapin et doré.

## Fonctionnalités

- 24 fenêtres qui se débloquent à minuit dans le fuseau **Europe/Paris**.
- Un contenu surprise aléatoire propre à chaque fenêtre et à chaque navigateur, conservé après rechargement.
- Bouton **Autre surprise** : nouveau tirage, sans répéter les contenus tant qu'il en reste.
- Quiz interactifs avec réponses et explications ; références DOI lorsque des études précises sont mentionnées.
- Progrès enregistrés localement dans le navigateur (localStorage).
- **Mode démo** permettant de tester les 24 cases avant décembre sans ajouter de journées à la progression officielle.
- Animation de neige et de confettis, petit carillon optionnel (désactivé initialement).
- Responsive, utilisation au clavier, prise en charge de la réduction des animations.
- **PWA** installable dans les navigateurs compatibles et cache hors ligne pour les fichiers essentiels.
- **Aucun compte**, aucun service tiers pour les surprises et aucune donnée personnelle transmise à un serveur. Les polices Google sont optionnelles et chargées depuis Google lorsque la connexion l'autorise.

## Lancer en local

Pas de compilation ni de dépendance npm.

```bash
python -m http.server 8080
```

Ouvrir [http://localhost:8080](http://localhost:8080). On peut également ouvrir `index.html` directement, mais un serveur local est recommandé pour le service worker.

## Publication GitHub Pages

Le workflow [pages.yml](.github/workflows/pages.yml) est déclenché à chaque push sur `main`.

1. Dans GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
2. Vérifier l'onglet **Actions**, workflow « Deploy Calendar4Christmas to GitHub Pages ».
3. Consulter **https://lucper01.github.io/Calendar4Christmas/** après la publication.

Si Pages n'était pas encore activé lors du premier push, relancer le workflow avec **Run workflow** une fois la source configurée.

## Modifier le calendrier

- `surprises.js` : les 47 surprises, catégories, options de quiz, bonnes réponses et liens DOI.
- `app.js` : calendrier, logique de déblocage, tirages, sauvegarde et interactions.
- `styles.css` : palette, design, animations et responsive.
- `index.html` : structure de la page.
- `assets/favicon.svg` : icône et logo simplifié.
- `sw.js` : cache PWA ; **augmenter la version** de `CACHE` lors de changements majeurs.

Les contenus sont des vulgarisations ou des jeux : ils ne remplacent pas une lecture critique des sources primaires.

## Notes techniques

- L'ouverture par date dépend de l'horloge du navigateur : **ce n'est pas une sécurité côté serveur**. Les visiteurs peuvent manipuler leur horloge ou les données locales.
- La progression est propre à chaque navigateur/appareil et peut disparaître si les données du site sont effacées ; elle n'est pas synchronisée.
- Le mode démo sert aux tests. Le choix des surprises peut être conservé localement, mais l'ouverture anticipée n'incrémente pas les journées officiellement découvertes.
- Édition actuellement figée sur **2026** ; pour réutiliser le projet en 2027, adapter l'année, les cibles UTC de décembre et les clés de stockage.
- Code statique en HTML, CSS et JavaScript natifs, sans backend et sans dépendances npm.

## Licence

Projet personnel ; aucune licence de redistribution n'est accordée par défaut.
