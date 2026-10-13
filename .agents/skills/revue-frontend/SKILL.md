---
name: revue-frontend
description: >-
  Relit un changement du frontend CCD Digital (diff en cours, branche, commit, PR) contre les
  règles propres à ce dépôt : couches du domaine, simulation, clients d'API, états d'écran, charte.
  À utiliser quand on demande une revue ou une relecture de code Next.js / React de ce dépôt,
  avant un merge dans develop, ou à la question « est-ce que cet écran est bon ? ».
---

# Revue d'un changement frontend

`npm run lint` et `npm run typecheck` attrapent déjà les textes en dur, les imports interdits et
les erreurs de type. Cette revue cherche ce qu'ils ne voient pas.

## 1. Délimiter

```bash
git diff develop...HEAD --stat     # une branche
git diff                           # le travail en cours
```

Lire le diff, puis l'adaptateur et le `regles.ts` du domaine touché : un écran se juge avec la
couche qui le nourrit.

## 2. Chercher, du plus coûteux au moins coûteux

**Données réelles ou simulées — bloquant**
- L'écran affiche-t-il ce que le serveur renvoie ? Un groupe resté à `routesSimulees(false)` est
  simulé en production.
- Le bandeau de simulation dit-il la vérité, dans les deux sens ?
- Un fichier `simulation*.ts` survit-il à un domaine entièrement branché ?

**Frontière avec le serveur — bloquant**
- Le bon client : `api`, `apiAdministration` ou `apiPlateforme`. Le mauvais donne un 404 muet.
- Les deux espaces ne se mélangent pas : ni les jetons, ni les rôles de la plateforme et de
  l'entreprise.
- Un type `Charge*` exporté, ou une forme serveur qui atteint un composant.
- Un traitement d'erreur qui lit le message au lieu du `code`.
- Rien de `dev/` n'est atteignable depuis un écran client.

**Couches du domaine**
- Un calcul métier dans un composant plutôt que dans `regles.ts` — surtout un seuil ou un statut.
- Une clé React Query écrite dans l'écran au lieu de `cles.ts`.
- Une écriture sans invalidation du cache qu'elle périme.
- Une mutation qui se relance seule.

**États d'écran**
- Chargement, liste vide, erreur, droit insuffisant : chacun a un rendu.
- Le formulaire garde la saisie après une erreur du serveur.

**Charte**
- Une couleur, un espacement ou un rayon en dur ; une couleur dans `style={{}}`.
- Un tableau de liste hors de `TableauListe`, ou sans export ; le bouton d'export n'est pas à
  gauche du bouton d'ajout.
- Un `<button>` ou `<input>` nu sans `bg-transparent border-0` (le *preflight* est désactivé).
- L'écran tient-il à 390 px ?

**Langue**
- Une exemption ajoutée à `eslint.config.mjs` pour un dossier entier, ou sans justification.
- Un libellé fabriqué à partir d'un code (`"TERMINE".toLowerCase()` perd l'accent).

## 3. Vérifier plutôt que supposer

```bash
npm run lint
npm run typecheck
```

Puis ouvrir l'écran contre le backend local. Un soupçon sur l'affichage se confirme en regardant
l'écran, pas en lisant le JSX.

## 4. Restituer

Par ordre de gravité — **bloquant**, **à corriger**, **suggestion** — et pour chaque constat :

- `fichier:ligne` ;
- le scénario concret : quel geste de l'utilisateur produit quel mauvais résultat ;
- la correction proposée.

Ne pas signaler ce qu'ESLint attrape déjà. Terminer par ce qui **n'a pas** été vérifié (écran non
ouvert, largeur non testée, backend non lancé) : une revue qui ne dit pas ses limites passe pour
complète.
