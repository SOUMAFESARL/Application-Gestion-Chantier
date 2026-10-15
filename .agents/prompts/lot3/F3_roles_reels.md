# F3 — Rôles : retrait de la simulation et du composant mort des droits par projet (3.3, 3.4)

Branche : `feature/lot3-roles-reels`
Prérequis : backend `B1_erreurs_et_journal.md` fusionné ; F1 et F2 fusionnées.

## 1. Contexte

`features/roles/api.ts` (149 lignes) :

| Fonction | État | Décision |
|---|---|---|
| `listerRoles`, `creerRole`, `modifierRole` | réelles (`/parametres/roles/`) | rien |
| `obtenirRole` (l. 97) | simulée sinon `/roles/{id}/` | **aucun écran ne l'appelle** (`grep -rn obtenirRole app features components`) → la **supprimer** |
| `supprimerRole` (l. 124) | simulée sinon `POST /roles/{id}/supprimer/` | garder **le seul appel réel** ; route servie, réponse `{message, role_supprime, utilisateurs_reassignes, affectations_reassignees}` |
| `obtenirMatriceProjet`, `sauvegarderMatriceProjet` (l. 132-149) | simulées sinon `/projets/{id}/permissions-roles/` | **la route n'existe pas** et ne sera pas faite (décision 3.4, MLD v1.7 §5.2.5) → **supprimer** |

`features/roles/components/ProjetPermissionsSection.tsx` (le seul consommateur de la matrice) n'est
**monté par aucune page** : c'est du code mort, exporté par `features/roles/index.ts`.

`features/roles/simulationRoles.ts` (365 lignes) ne sert plus qu'à ces fonctions.

Enfin, l'écran `app/(entreprise)/parametres/roles/page.tsx` affiche ses erreurs par `alert(…)`
(l. 82, 105, 120, 149) : une boîte du navigateur, hors charte, qui bloque la page. Depuis B1, le
serveur envoie des messages précis : il faut les montrer proprement.

## 2. Ce qu'il faut faire

1. `features/roles/api.ts` :
   - supprimer `obtenirRole`, `obtenirMatriceProjet`, `sauvegarderMatriceProjet`, l'interface
     `SurchargeAccesProjet`, `ChargeProjetRoleMatrice`, `versMatriceProjet`, et tout ce qui ne sert
     plus ;
   - `supprimerRole` : seulement `return api.creer<ResultatSuppressionRole>(\`/roles/${roleId}/supprimer/\`, payload);` ;
   - retirer les imports devenus inutiles (`appeler`, `SIMULATION_ACTIVE`, `simulationRoles`, et
     les types).
2. `features/roles/types.ts` : supprimer `ProjetRoleMatrice` (l. 70-76) s'il n'a plus d'usage.
3. `git rm features/roles/components/ProjetPermissionsSection.tsx features/roles/simulationRoles.ts`.
4. `features/roles/index.ts` : retirer l'export de `ProjetPermissionsSection`.
5. `eslint.config.mjs` : retirer `"features/roles/simulationRoles.ts",` (l. ~335) et son
   commentaire s'il ne sert qu'à elle.
6. `messages/fr.json` : chercher les clés que **seul** `ProjetPermissionsSection` utilisait
   (lire le fichier supprimé avant de le supprimer, noter ses `t("…")`), et les retirer si aucune
   autre partie du code ne les lit (`grep -rn '"<clé>"\|\.<clé>' app features components`).
7. `app/(entreprise)/parametres/roles/page.tsx` : remplacer les quatre `alert(...)` par
   `toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurAction"))`
   (`toast` de `sonner`, `ErreurApi` de `@/lib/api`) ; ajouter `"erreurAction": "L’action n’a pas
   abouti. Réessayez."` sous l'espace de noms des rôles dans `messages/fr.json` s'il n'existe pas
   de clé équivalente (en chercher une d'abord).
8. `grep -rn "simulationRoles\|ProjetPermissionsSection\|permissions-roles\|obtenirMatriceProjet" app features components lib`
   → zéro résultat.

## 3. Vérification à l'écran (DG du schéma `demo`)

1. Paramètres > Rôles : la matrice se charge.
2. Créer un rôle personnalisé de test, lui donner des droits, **recharger** : gardés.
3. Le supprimer en réaffectant ses porteurs → toast avec les compteurs ; recharger : disparu.
4. Provoquer un refus (en AD : modifier la portée du rôle DG si l'écran le permet, ou supprimer un
   rôle système) → toast avec le message précis du serveur, pas de boîte `alert`.
5. 390 px.

## 4. Définition de terminé

- [ ] Plus de simulation ni de matrice par projet dans `features/roles/` ; exemption retirée.
- [ ] Plus aucun `alert(` dans `app/(entreprise)/parametres/roles/`.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 5 vérifications faites.
- [ ] Commit : `refactor(roles): plus de simulation ni de droits par projet, erreurs lisibles`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
