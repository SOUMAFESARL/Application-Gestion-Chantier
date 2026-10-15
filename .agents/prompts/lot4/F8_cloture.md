# F8 — Clôture du lot 4 : plan d'alignement à jour

Branche : `feature/lot4-cloture`
Prérequis : **toutes** les tâches B1–B6 et F1–F7 fusionnées.

## 1. Le plan — `docs/plan_alignement_api.md` (ignoré par Git : `git add -f`)

Section « Lot 4 » (l. ~163) :

1. Un paragraphe **« Cadrage et décisions des 14 et 15/10/2026 »** qui reprend le tableau de
   `../API-Gestion-Chantier/.agents/prompts/lot4/README.md` §3, et précise :
   - « La durée (US 3.1) et le début dans le passé (US 3.5) étaient déjà en place : vérifiés. »
   - « Les dates ne pouvaient plus être modifiées une fois fixées (RG-11, `PATCH` refusé) : la
     reprogrammation est branchée pour le projet, les lots et les activités. »
   - « Les équipes étaient simulées en production : elles sont réelles. »
   - « Le retrait d'un collaborateur efface physiquement l'affectation, par décision du développeur
     (environnement de tests), contre le Socle Commun : à revoir avant la mise en service. »
   - « **Non branchés, par décision** : activation / désactivation d'un lot ou d'une activité ;
     détail et modification d'un tiers (le module Tiers est à construire) ; référentiel des villes
     (liste embarquée générée depuis le serveur) ; statistiques d'équipes (calculées par l'écran). »
2. Un tableau des quatorze tâches (Tâche / Contenu / État), sur le modèle des lots 2 et 3, avec
   « **Fait le <date>.** » et ce qui a été vérifié à l'écran.
3. Une dernière ligne : « Lot 4 fusionné dans `develop` des deux dépôts le <date>, **non poussé**. »

## 2. Les README

- `features/projets/README.md` : retirer ce qui parle des équipes simulées et des routes
  d'encadrement « proposées » ; décrire en deux phrases la reprogrammation et la règle des budgets.
- `lib/api/README.md` : s'il cite `simulationEquipes` ou `routesSimulees(false)`, mettre à jour.

## 3. Vérifications finales

1. `npm run lint`, `npm run typecheck`, `npm run build` : verts.
2. `grep -rn "SIMULATION_ACTIVE\|routesSimulees" features/projets` → plus aucune branche simulée
   dans le domaine projets (s'il en reste une, la lister dans le compte rendu avec sa raison).
3. Parcours rapide (CP de `CHANT-2026-001`) : fiche (durée, santé, budget, historique des dates),
   lots et activités (budgets, dates), encadrement, équipes, affectations d'équipes, import. Aucune
   erreur dans la console du navigateur.

## 4. Définition de terminé

- [ ] Plan et README à jour ; `lint`, `typecheck`, `build` verts ; vérifications faites.
- [ ] Commit : `docs(projets): plan du lot 4 a jour`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
- [ ] Compte rendu final du lot, puis **s'arrêter**.
