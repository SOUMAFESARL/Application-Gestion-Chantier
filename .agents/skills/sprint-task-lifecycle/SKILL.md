---
name: sprint-task-lifecycle
description: >-
  Déroulé d'une tâche de sprint sur le frontend CCD Digital : cadrage, plan dans le chat, branche
  feature, implémentation et vérification à l'écran, merge dans develop. À utiliser dès que
  l'utilisateur confie une tâche du backlog, une user story (« US x.y »), un lot du plan
  d'alignement ou demande de créer ou modifier un écran.
---

# Cycle de vie d'une tâche de sprint — frontend

Cinq étapes, dans l'ordre. Les deux premières ne modifient aucun fichier. C'est le même cycle que
celui du backend (`../API-Gestion-Chantier/.agents/skills/sprint-task-lifecycle`) ; seules la
lecture de départ et la façon de vérifier changent.

**Qui écrit le code.** Pour le chantier d'alignement (`docs/plan_alignement_api.md`), l'agent
implémente tout — décision du 13/10/2026. Pour toute autre tâche, poser la question à la fin de
l'étape 2.

## Étape 1 — Cadrage (lecture seule)

1. **Lire les trois côtés de la tâche** :
   - l'écran, dans `app/` ;
   - le domaine, dans `features/<domaine>/` — son `README.md` d'abord, puis `types.ts`,
     `regles.ts`, `adaptateur.ts` ;
   - le serveur, dans `../API-Gestion-Chantier/apps/<module>/` (vue et serializer), et la
     spécification dans `../../04_Conception/specifications_fonctionnelles/` quand ces dossiers
     sont présents sur la machine.
2. **Dire ce qui existe déjà** : ce qui est en place, ce qui manque, ce qui s'écarte. Un écran
   « fait » peut tourner sur des données simulées — le vérifier dans l'adaptateur, pas à l'œil.
3. **Relever les règles en jeu** : celles du `CLAUDE.md` de ce dépôt, et les règles métier
   (circuit de validation, droits par module, montants, dates).
4. **Restituer le cadrage** en quatre temps — situation, complication, question, orientation —
   puis le résultat du point de vue de l'utilisateur final (le « film mental » : ce qu'il voit et
   peut faire quand la tâche est finie, sur ordinateur et sur téléphone).
5. **Poser les questions d'arbitrage** qui changent l'implémentation. Seulement celles-là.

## Étape 2 — Plan, dans le chat

Un message, sans document à côté :

- les fichiers à créer ou modifier, **dans l'ordre des couches** : `types.ts` → `regles.ts` →
  `validations.ts` → `adaptateur.ts` → `cles.ts` → composants → écran → `messages/fr.json` ;
- le contrat d'API à tenir, champ par champ quand il y a un branchement ;
- **les pièges de cette tâche précise** (deux ou trois), chacun avec ce qui le révèle : une règle
  ESLint, le typage, un geste à l'écran ;
- ce qui sera vérifié à l'écran, et sur quelles largeurs.

## Étape 3 — Branche feature

```bash
git checkout develop
git pull
git checkout -b feature/<nom-court-de-la-tache>
```

Si la tâche touche aussi le backend, il a sa propre branche et son propre commit.

## Étape 4 — Implémentation et vérification

1. Implémenter selon le plan. Un branchement d'API suit le skill `brancher-api`.
2. Valider — les deux commandes tournent aussi en CI, avant le build :
   ```bash
   npm run lint
   npm run typecheck
   ```
3. **Vérifier à l'écran, contre le backend local.** Ce dépôt n'a pas de lanceur de tests : un
   écran que personne n'a ouvert n'est pas vérifié. Faire le geste, **recharger la page** pour
   s'assurer que la donnée vient du serveur, puis provoquer un cas d'erreur.
4. Pour une modification qui ne doit rien changer à l'affichage :
   `npm run recette:capture`, et comparer avec `docs/recette/`.
5. Quand une commande échoue : lire l'erreur, dire quelle hypothèse elle infirme, corriger la
   cause. Ne pas ajouter d'exemption à `eslint.config.mjs` pour faire passer.

## Étape 5 — Intégration dans `develop`

1. Commiter sur la branche feature. **Uniquement ses propres fichiers** : ce dépôt porte souvent
   le travail en cours de quelqu'un d'autre.
   ```bash
   git add <fichiers-concernes>
   git commit -m "feat(<scope>): <description claire et concise>"
   ```
2. Fusionner en conservant l'historique, puis supprimer la branche :
   ```bash
   git checkout develop
   git merge --no-ff feature/<nom-court-de-la-tache> -m "merge: feature/<nom-court-de-la-tache> into develop"
   git branch -d feature/<nom-court-de-la-tache>
   ```
3. **Push : quand le développeur le demande.** Pousser `develop` ne déploie rien ; pousser `main`
   **déploie en production**.
4. **Clôture.** Résumer ce qui a été livré, ce qui a été vérifié à l'écran et ce qui ne l'a pas
   été. Puis poser au développeur une question qui l'oblige à expliquer le mécanisme central de la
   tâche comme s'il l'enseignait à un pair (le défi « Homo Docens ») — une seule, précise, sans
   réponse dans le code.
