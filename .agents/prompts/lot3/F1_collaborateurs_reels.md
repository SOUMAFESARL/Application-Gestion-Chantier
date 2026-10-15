# F1 — Collaborateurs : retrait de la simulation (3.1)

Branche : `feature/lot3-collaborateurs-reels`
Prérequis : backend `B1_erreurs_et_journal.md` fusionné.

## 1. Contexte

`features/invitations/adaptateur.ts` appelle déjà les vraies routes, mais garde une branche
`SIMULATION_ACTIVE` sur cinq fonctions (l. 134-173) qui rejoue par-dessus la liste du serveur les
suspensions et suppressions de `features/invitations/simulationCollaborateurs.ts` (121 lignes).
Son en-tête dit pourquoi : « ni la fiche, ni la suspension, la réactivation ou la suppression
n'existent encore côté Django ». **C'est faux depuis** : toutes ces routes sont servies.

| Fonction | Route servie |
|---|---|
| `listerCollaborateurs` | `GET /parametres/collaborateurs/` |
| `lireCollaborateur` | `GET /parametres/collaborateurs/{id}/` |
| `suspendreCollaborateur` | `POST /parametres/collaborateurs/{id}/suspendre/` → le collaborateur |
| `reactiverCollaborateur` | `POST /parametres/collaborateurs/{id}/reactiver/` → le collaborateur |
| `supprimerCollaborateur` | `DELETE /parametres/collaborateurs/{id}/` → 200 `{…}` (corps non lu) |

Depuis B1, les refus de ces routes arrivent au format `{"erreur": {"code", "message"}}` : le hook
`useGestionCollaborateur` (`features/invitations/components/GestionCollaborateur.tsx:55-80`)
affiche déjà `cause.message` dans sa modale — **il n'y a rien à changer côté écran** pour que
« Le compte du Directeur Général / Propriétaire ne peut pas être suspendu. » apparaisse.

## 2. Ce qu'il faut faire

1. `features/invitations/adaptateur.ts` :
   - supprimer l'import de `SIMULATION_ACTIVE` et de `simulationCollaborateurs` (l. 10-12) ;
   - dans les cinq fonctions, ne garder que l'appel réel ;
   - réécrire le commentaire de `listerCollaborateurs` (l. 128-133) : supprimer la phrase sur
     `NEXT_PUBLIC_API_SIMULE` ;
   - **vérifier champ par champ** que `ChargeCollaborateur` (l. 25-40) correspond à ce que renvoie
     `CollaborateurResponseSerializer` (`../API-Gestion-Chantier/apps/accounts/serializers/`, chercher
     `class CollaborateurResponseSerializer`) : `role_personnalise` et `projets` existent côté
     serveur ; s'ils sont absents de `ChargeCollaborateur` et qu'un écran en a besoin, les ajouter ;
     sinon ne rien ajouter.
2. `git rm features/invitations/simulationCollaborateurs.ts`.
3. `eslint.config.mjs` : retirer la ligne `"features/invitations/simulationCollaborateurs.ts",`
   (l. ~338) **et son commentaire** s'il ne sert qu'à elle.
4. `grep -rn "simulationCollaborateurs" app features components lib` → zéro résultat.

## 3. Vérification à l'écran (DG puis AD du schéma `demo`)

1. Paramètres > Collaborateurs : la liste se charge.
2. Suspendre un collaborateur actif → toast ; **recharger** : toujours suspendu (le serveur l'a
   gardé). Le réactiver.
3. En AD, essayer de suspendre le DG (s'il est proposé ; sinon depuis sa fiche) : le message
   précis du serveur s'affiche dans la modale, **pas** « Une erreur est survenue ».
4. Supprimer un invité de test → il disparaît ; recharger : toujours absent.
5. Ouvrir la fiche d'un collaborateur directement par son URL : elle se charge.
6. 390 px : la liste et la fiche restent utilisables.

## 4. Définition de terminé

- [ ] Plus aucune branche simulée dans `features/invitations/` ; fichier et exemption retirés.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 6 vérifications faites.
- [ ] Commit : `refactor(invitations): les gestes sur un collaborateur ne sont plus simules`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
