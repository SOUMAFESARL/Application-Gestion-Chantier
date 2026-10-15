# F1 — Budgets : activité dans le tableau, somme des budgets, budget du projet (US 3.3, 3.4, 3.9)

Branche : `feature/lot4-budgets`
Prérequis : backend `B1_budgets.md` fusionné.

## 1. Ce qui existe

- Le budget d'activité se saisit déjà (`features/projets/validations.ts:335-341`, champ facultatif)
  et s'envoie (`versChargeActivite`, `budget_initial_montant`).
- Les bornes de l'écran sont **par élément** : `plafondBudgetDepasse` (`features/projets/regles.ts:334`)
  compare un lot au budget du projet, une activité au budget du lot ; `budgetMaxActivites` (l. 348)
  empêche un lot de descendre sous **la plus grosse** activité. `schemaLotBorne`
  (`validations.ts:234`) les applique au formulaire de lot.
- Le budget du projet se fixe et se modifie par la modale de cadrage
  (`features/projets/components/ModaleCadrageProjet.tsx`, `definirBudgetProjet`, `adaptateur.ts:513`).

## 2. La règle validée (4.4) — la **somme**

- somme des budgets des lots ≤ budget du projet ; somme des budgets des activités d'un lot ≤ budget
  du lot ;
- un parent ne descend pas sous la somme de ses enfants ;
- un parent sans budget ne borne rien ; un enfant sans budget compte zéro ;
- le message donne le **disponible** : « Il reste 12 000 000 FCFA sur le budget du projet
  (100 000 000 FCFA). »

Le serveur applique la même règle (B1) : l'écran la montre **avant** l'envoi, et affiche le message
du serveur sous le champ `budget` s'il refuse quand même (données changées par un autre).

## 3. Couche par couche

### 3.1 `features/projets/regles.ts`

Remplacer la logique par élément par la logique de somme, en gardant les noms quand c'est possible
pour limiter les changements d'appel :

```ts
/** La somme des budgets (centimes) ; un budget absent compte zéro. */
export function sommeBudgets(elements: { budget: number | null }[]): number

/**
 * Ce qui reste sous le plafond d'un parent pour un enfant, **les autres enfants déduits**.
 * `null` : le parent n'a pas de budget, il ne borne rien. Jamais négatif.
 */
export function budgetDisponible(plafond: number | null, autres: { budget: number | null }[]): number | null

/** Le plancher d'un parent : la somme de ses enfants ; `null` s'il n'en a aucun de budgété. */
export function plancherBudget(enfants: { budget: number | null }[]): number | null
```

- `budgetMaxActivites` devient `plancherBudget(lot.activites)` (garder l'ancien nom en alias
  seulement s'il est exporté ailleurs ; sinon le remplacer partout).
- `plafondBudgetDepasse` : le refaire en termes de `budgetDisponible` (le lot comparé au disponible
  du projet, l'activité au disponible du lot **et** du projet — une activité ne peut pas non plus
  faire déborder le projet par son lot, mais c'est le lot qui la borne : vérifier qu'aucun cas ne
  demande davantage).

### 3.2 `features/projets/validations.ts`

- `schemaLotBorne(budgetProjet, lot, autresLots)` : reçoit les **autres** lots du projet ; message
  `projets.lotsActivites.formLot.erreurBudgetDisponible` (« Il reste {disponible} sur le budget du
  projet ({plafond}). ») et `erreurBudgetPlancher` (« Le budget du lot ne peut pas être inférieur à
  la somme de ses activités ({somme}). »).
- Même chose pour le formulaire d'activité (créer un `schemaActiviteBorne(budgetLot, autresActivites)`
  s'il n'existe pas).
- Le schéma du budget du projet dans la modale de cadrage (`validations.ts:~664`) reçoit
  `plancher = plancherBudget(lots)` : message `projets.cadrage.erreurBudgetPlancher` (« Le budget
  du projet ne peut pas être inférieur à la somme de ses lots ({somme}). »).
- Montants affichés par `formaterMontant` (`lib/format`), jamais à la main.

### 3.3 Les écrans

1. **Tableau des activités (US 3.3)** : trouver le tableau des activités d'un lot
   (`app/(entreprise)/projets/lots-activites/StructureLots.tsx` et/ou `PanneauActivite.tsx` —
   chercher où `activite.libelle` est rendu en ligne de tableau) et y ajouter une colonne
   **Budget** (`formaterMontant`, vide si `null`), **masquée** pour qui ne voit pas les montants
   (reprendre la condition déjà employée pour le budget des lots dans le même écran). L'**export**
   du tableau (`exporter`) reçoit la même colonne, en **francs entiers** (règle 10 du `CLAUDE.md`).
2. Le tiroir de lot (`features/projets/components/TiroirLot.tsx`) et celui d'activité
   (`TiroirActivite.tsx`) : passer les autres lots / autres activités aux schémas bornés ; afficher
   **sous le champ budget** une aide « Disponible : {disponible} » quand le parent a un budget.
3. La modale de cadrage du budget du projet : le plancher, et l'aide « Somme des lots : {somme} ».
4. Erreur serveur sur `budget_initial_montant` → posée sous le champ `budget`.

### 3.4 `messages/fr.json`

Les clés citées, plus `aideDisponible` (« Disponible : {montant} ») et `aideSommeLots` (« Somme des
lots : {montant} »), dans les espaces de noms existants des formulaires concernés (les trouver dans
les `useTranslations` des composants). Apostrophes typographiques `’`.

## 4. Vérification à l'écran (CP de `CHANT-2026-001`, puis un compte sans droit aux montants)

1. Projet à 100 M avec deux lots à 60 M et 30 M : créer un 3ᵉ lot à 20 M → erreur « Il reste
   10 000 000 FCFA » **avant** l'envoi ; à 10 M → créé.
2. Même chose pour les activités d'un lot.
3. Baisser le budget du projet sous la somme des lots → erreur ; au-dessus → enregistré ;
   recharger : gardé.
4. Tableau des activités : colonne Budget ; export CSV avec la colonne, en francs entiers.
5. Compte sans droit aux montants : aucune colonne Budget, aucun montant dans les aides.
6. 390 px.

## 5. Définition de terminé

- [ ] Règle de somme dans `regles.ts` ; schémas bornés ; aides « disponible ».
- [ ] Colonne et export du budget d'activité ; masquage respecté.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 6 vérifications faites.
- [ ] Commit : `feat(projets): budgets bornes par la somme, budget d'activite dans le tableau`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
