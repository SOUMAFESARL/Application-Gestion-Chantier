---
name: brancher-api
description: >-
  Méthode pour brancher un écran du frontend CCD Digital sur une API réelle du backend : lire le
  contrat, écrire ou corriger l'adaptateur du domaine, sortir de la simulation, vérifier à l'écran.
  À utiliser pour tout appel d'API nouveau ou modifié, pour passer un domaine de la simulation au
  réel, ou quand un écran affiche des données simulées alors que le backend sert la route.
---

# Brancher une API

**Un nouveau branchement reprend la méthode et le style des branchements existants.** La référence
est `features/projets/adaptateur.ts` (projets, lots, activités) avec `features/projets/cles.ts`.
Ne pas introduire une autre façon de faire, même jugée meilleure : deux styles dans le même dépôt
coûtent plus cher que le moins bon des deux.

## 1. Lire le contrat réel

Dans l'ordre de confiance :

1. **La réponse du serveur local** — `http://<entreprise>.localhost:8000/api/v1/…`. C'est la
   seule source qui ne peut pas être en retard.
2. **La vue et le serializer**, dans `../API-Gestion-Chantier/apps/<module>/`.
3. **Le schéma OpenAPI**, `/api/v1/schema/`. Il est incomplet : des vues sans serializer déclaré
   n'y figurent pas. Une route absente du schéma n'est pas une route absente du serveur.

Relever pour chaque route : le verbe, les champs et leur nullabilité, l'unité des montants, le
format des dates, les valeurs des énumérations, la forme de la liste (tableau nu ou `results`),
et les codes d'erreur métier.

## 2. Comparer avec ce que l'adaptateur attend

Mettre côte à côte les `Charge*` de `features/<domaine>/adaptateur.ts` et la réponse réelle. Les
routes de beaucoup d'adaptateurs ont été **proposées avant que le serveur existe** : le chemin
peut être juste et la forme fausse.

Pour chaque écart, dire qui s'aligne. **Par défaut le frontend s'aligne sur le backend.** Une
route n'est ajoutée au backend que si l'écran perdrait une fonction.

## 3. Écrire dans l'adaptateur

`adaptateur.ts` est le seul fichier du domaine qui sait que le serveur existe.

| Élément | Convention |
|---|---|
| Types de transport | `interface Charge*`, **privés au fichier**, en `snake_case` comme le serveur |
| Serveur → domaine | fonctions `vers*` (`versProjet`, `versLot`) |
| Domaine → serveur | fonctions `versCharge*` |
| Fonctions exportées | en français, verbe à l'infinitif : `listerX`, `lireX`, `creerX`, `modifierX`, `supprimerX` ; elles renvoient des types de `types.ts` |
| Client | `api` (entreprise), `apiAdministration` (back-office), `apiPlateforme` (anonyme) — verbes `lire`, `creer`, `modifier`, `supprimer` |
| Liste | accepter tableau nu ou paginé : `Array.isArray(charge) ? charge : (charge?.results ?? [])` |
| Annulation | passer le `signal` reçu de React Query aux lectures |

Autour de l'adaptateur :

- **Clés React Query dans `cles.ts`**, jamais recopiées dans un écran ; invalider après chaque
  écriture.
- **Calculs dans `regles.ts`**, schémas zod dans `validations.ts`.
- **Erreurs** : brancher sur `ErreurApi.code`, jamais sur le message. Un code métier nouveau
  s'ajoute à `lib/api/erreurs.ts` et son texte à `messages/fr.json`.
- **Aucun texte en dur** : `t("…")` dans un composant, `texte()` ailleurs.

## 4. Sortir de la simulation

1. Passer le groupe de `routesSimulees(false)` à `routesSimulees(true)`. À `false`, le groupe est
   simulé **même en production** : le drapeau `NEXT_PUBLIC_API_SIMULE` n'y change rien.
2. Quand toutes les fonctions du groupe répondent en réel, **supprimer** le fichier
   `simulation*.ts`, ses imports et la constante. Une simulation désactivée qui reste dans le dépôt
   finit par être rebranchée par erreur.
3. Retirer `BandeauSimulation` de l'écran — et seulement quand plus rien n'y est simulé. Un bandeau
   absent sur des données simulées est aussi faux qu'un bandeau présent sur des données réelles.
4. Mettre à jour le `README.md` du domaine.

## 5. Vérifier

```bash
npm run lint
npm run typecheck
```

Puis à l'écran, contre le backend local :

- la lecture affiche les données de la base, pas celles de la démonstration ;
- après une écriture, **recharger la page** : la donnée est toujours là ;
- l'onglet réseau montre l'appel réel, avec le bon verbe ;
- un cas d'erreur (droit insuffisant, validation refusée) affiche un message, pas un écran blanc.

## Pièges

- **Le mauvais client échoue sans bruit.** `apiPlateforme` à la place d'`api` donne un 404, pas
  une erreur d'authentification.
- **`.env` versionné met la simulation à `1`, `.env.local` peut la remettre à `0`.** Vérifier la
  valeur effective avant de conclure qu'un écran est branché.
- **ESLint interdit d'importer `api` dans `app/` et `components/`**, et d'y importer un
  identifiant `snake_case` : une charge serveur qui remonte jusqu'à l'écran est une erreur.
- **Un libellé ne se dérive pas d'un code.** Il vient de `/referentiels/enumerations/`.
