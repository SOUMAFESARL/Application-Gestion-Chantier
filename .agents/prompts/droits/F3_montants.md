# F3 — Les montants n'apparaissent qu'à qui a `projets.voir_montants`

Branche : `feature/droits-montants`
Prérequis : F2 fusionné.

## 1. Le constat

Le serveur **retire** toute clé de montant (`montant`, `budget`, `cout`, `prix` dans le nom) des
réponses faites à qui n'a pas `projets.voir_montants`, et **refuse** d'en écrire une non nulle
(`API-Gestion-Chantier/apps/core/purger_montants.py` ; `apps/core/droits.py`, `peut_voir_montants` :
DG, et les rôles qui ont le code — dans `demo` : DG, DO, CP ; **pas** l'AD, le CT, le CC).

Le frontend, lui, ne le sait pas :

- l'adaptateur remplace une clé absente par 0 (`features/projets/adaptateur.ts:345`,
  `budgetConsomme: charge.budget_consomme_montant ?? 0`, et d'autres) : l'AD lit « 0 FCFA » de
  budget sur chaque projet — **une information fausse** ;
- les formulaires (lot, activité, cadrage) proposent un champ de budget qui, rempli, revient en 400
  « Champ non accepté sans la permission projets.voir_montants. ».

**Décision D5** : les types ne changent pas (pas de `number | null` à propager dans vingt
fichiers). Une règle décide ; les écrans masquent.

## 2. La règle

`features/habilitations/regles.ts` :

```ts
/**
 * Voir et saisir les montants (budgets, coûts) : le code `projets.voir_montants`.
 * Recopie `peut_voir_montants` (`apps/core/droits.py`, règle E-11) : le serveur retire les
 * montants des réponses faites aux autres — un 0 affiché serait faux.
 */
export function peutVoirMontants(droits: Droits | null): boolean {
  return peutCode(droits, "projets.voir_montants");
}
```

`useDroits()` expose `voitMontants: peutVoirMontants(droits)`.

## 3. Ce que « masquer » veut dire

| Élément | Si `!voitMontants` |
|---|---|
| Colonne d'un tableau consacrée à un montant | la colonne n'existe pas (pas une colonne vide) ; l'export (`components/ui/export-tableau.tsx`) ne l'inclut pas non plus |
| Montant dans une carte, un en-tête, une ligne de détail | l'élément n'est pas rendu ; si sa disparition laisse un bloc vide (un titre seul), le bloc entier disparaît |
| Graphique ou indicateur fait de montants (`GraphiqueBudgets`, indicateurs budgétaires) | le composant n'est pas rendu |
| Champ de saisie d'un montant (budget d'un lot, d'une activité, du projet) | le champ n'est pas rendu, et la charge utile **n'envoie pas** la clé (ni 0, ni chaîne vide ; `undefined`, ou `null` si le type de l'adaptateur l'impose) |
| Règle de cohérence qui compare des budgets (somme des lots ≤ budget du projet, `features/projets/regles.ts`) | elle ne s'affiche pas (pas d'alerte « dépassement » calculée sur des zéros) |
| Import de lots (`ImportLots.tsx`) | une colonne de budget du fichier est ignorée et l'aperçu ne l'affiche pas ; le dire en une ligne sous l'aperçu : `projets.import.budgetIgnore` « Les budgets du fichier ne sont pas importés : votre rôle ne donne pas accès aux montants. » |

Rien d'autre : un montant qui n'est pas celui d'un projet, d'un lot ou d'une activité (stocks,
abonnement, back-office, achats, finance) **n'est pas concerné**.

## 4. Les fichiers à passer en revue

Relevé du 16/10 (`grep -rlE "budget|montant" app features components --include=*.tsx`, hors stocks,
abonnement, admin, achats, finance) :

```
app/(entreprise)/projets/ListeProjets.tsx
app/(entreprise)/projets/lots-activites/LotsActivites.tsx
app/(entreprise)/projets/lots-activites/PanneauActivite.tsx
app/(entreprise)/projets/lots-activites/StructureLots.tsx
app/(entreprise)/projets/[id]/FicheProjet.tsx
app/(entreprise)/projets/[id]/page.tsx
app/(entreprise)/tableau-de-bord/AlertesPilotage.tsx
app/(entreprise)/tableau-de-bord/CellulesPortefeuille.tsx
app/(entreprise)/tableau-de-bord/ChantiersAttention.tsx
app/(entreprise)/tableau-de-bord/EnTeteDirection.tsx
app/(entreprise)/tableau-de-bord/GraphiqueBudgets.tsx
app/(entreprise)/tableau-de-bord/IndicateursDirection.tsx
app/(entreprise)/tableau-de-bord/PanneauPortefeuille.tsx
app/(entreprise)/tableau-de-bord/ValidationsEnAttente.tsx
features/projets/components/GestionProjet.tsx
features/projets/components/ImportLots.tsx
features/projets/components/ModaleCadrageProjet.tsx
features/projets/components/TiroirActivite.tsx
features/projets/components/TiroirCreationProjet.tsx
features/projets/components/TiroirLot.tsx
```

Pour **chacun** : ouvrir, repérer chaque montant affiché ou saisi, appliquer le §3. Un fichier où le
mot n'apparaît que dans un commentaire, un nom de type ou une clé de traduction sans affichage :
rien à faire, le noter dans le compte rendu de F8. `EquipeEncadrement.tsx` et
`RapportJournalierDocument.tsx` sont sortis du relevé : vérifier qu'ils n'affichent pas de montant
de projet ; sinon, même traitement.

Les composants d'un écran lisent `voitMontants` par `useDroits()` ; un composant de présentation
pur (sans contexte) le reçoit en propriété de son parent.

## 5. `messages/fr.json`

Seulement les clés que la tâche crée (`projets.import.budgetIgnore`, et toute phrase rendue
nécessaire par un bloc qui change). Pas de clé morte : une clé qui n'est plus lue se supprime.

## 6. Vérification à l'écran (schéma `demo`)

1. **AD** : liste des projets sans colonne de budget ; fiche d'un projet sans aucun montant ; lot et
   activité : pas de champ budget, et enregistrer un lot **réussit** ; tableau de bord sans montant ni
   graphique de budgets.
2. **CT** : mêmes constats sur son projet.
3. **CP** et **DO** : tout est là, comme avant ; saisir un budget de lot réussit.
4. **DG** : rien ne change.
5. 390 px : la fiche projet et le tableau de bord de l'AD.

## 7. Définition de terminé

- [ ] `peutVoirMontants` écrit ; `voitMontants` dans `useDroits`.
- [ ] Les vingt fichiers passés en revue, le §3 appliqué ; aucun « 0 FCFA » visible pour l'AD.
- [ ] Aucun formulaire n'envoie de montant pour qui ne les voit pas.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 5 vérifications faites.
- [ ] Commit : `feat(projets): montants masques sans projets.voir_montants`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
