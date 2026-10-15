# F6 — Équipes de chantier réelles ; fin de la simulation (phase B)

Branche : `feature/lot4-equipes`
Prérequis : backend `B5_equipes.md` fusionné ; F5 fusionnée.

## 1. Le constat

`const EQUIPES_SIMULEES = routesSimulees(false);` (`features/projets/adaptateur.ts:72`) : les équipes
sont **simulées même en production**, dans `sessionStorage` (`features/projets/simulationEquipes.ts`).
Les écrans : `app/(entreprise)/projets/[id]/equipes/` (liste et `FicheEquipe.tsx`),
`app/(entreprise)/projets/equipe-affectations/AffectationsProjet.tsx`, les modales
`ModaleAjoutMembre`, `ModaleRoleMembre`, `ModaleRetraitMembre`, `TiroirEquipe`, `TiroirAffectation`.

## 2. Le contrat servi (B5)

| Geste | Route | Corps |
|---|---|---|
| Lister | `GET /projets/{id}/equipes/` | — |
| Créer | `POST /projets/{id}/equipes/` | `{nom, nature: "INTERNE" \| "SOUS_TRAITANT", specialite, chef: {collaborateur_id?, prenom?, nom?}, membres: [{collaborateur_id?, prenom?, nom?, role}]}` |
| Lire | `GET /projets/{id}/equipes/{equipe_id}/` | — |
| Supprimer | `DELETE /projets/{id}/equipes/{equipe_id}/` | — |
| Ajouter un membre | `POST /projets/{id}/equipes/{equipe_id}/membres/` | `{collaborateur_id?, prenom?, nom?, role}` → l'équipe |
| Changer de rôle | `PATCH …/membres/{membre_id}/` | `{role}` → l'équipe |
| Retirer un membre | `DELETE …/membres/{membre_id}/` | → 204 |
| Affecter à une activité | `POST /projets/{id}/equipes/affectations/` | `{equipe_id, activite_id}` (remplace l'équipe précédente) |
| Désaffecter | `DELETE /projets/{id}/equipes/affectations/{affectation_id}/` | — |

Réponse d'équipe : `{id, projet_id, nom, nature, specialite, chef: {id, collaborateur_id, prenom, nom, role} | null, membres: [...], effectif, est_actif}`.
Activité (`GET /lots/{id}/activites/`) : `equipe_chantier: {id, nom, effectif, affectation_id} | null`.

**Piège à corriger** : `affecterEquipe` (`adaptateur.ts:1106-1125`) envoyait `equipe_ids` dans un
`PATCH /activites/{id}/` — or `equipe_ids` désigne côté serveur **les collaborateurs** de l'activité,
pas une équipe de chantier. Ne plus jamais l'utiliser pour une équipe.

Un compte ajouté à une équipe doit être **affecté au projet** (400 sinon) : la liste de candidats est
donc celle des affectés (encadrement du projet, F5), plus la saisie libre d'un nom (personne sans
compte : ouvrier journalier, compagnon d'un sous-traitant).

## 3. Ce qu'il faut faire

1. `features/projets/adaptateur.ts` :
   - supprimer `EQUIPES_SIMULEES`, l'import de `simulationEquipes` et **toutes** les branches
     simulées (`grep -n "EQUIPES_SIMULEES\|simulationEquipes" features/projets/adaptateur.ts`) ;
   - `ChargeEquipeDetail` / `ChargeMembre` au format §2 (champ `projet_id`, `specialite`, `chef`,
     `membres[].{collaborateur_id, prenom, nom, role}`) ; `versChargeMembre` envoie
     `collaborateur_id` **ou** `prenom` + `nom` (jamais les deux) ;
   - `retirerMembreEquipe` relit l'équipe après le 204 (comportement actuel, l. 1094-1100) ;
   - `affecterEquipe(projetId, activite, equipeId | null)` : `equipeId` → `POST …/equipes/affectations/` ;
     `null` → `DELETE …/equipes/affectations/{activite.equipe.affectationId}/` ; puis relire
     l'activité (ou la reconstruire depuis la réponse) ;
   - `versActivite` lit `equipe_chantier` (avec `affectationId`) ; `EquipeChantier` (`types.ts`) gagne
     `affectationId?: string`.
   - La ligne 751 (`simulationEquipes.affectations(projetId)`) disparaît : l'équipe d'une activité
     vient du serveur.
2. `git rm features/projets/simulationEquipes.ts` ; retirer son exemption de `eslint.config.mjs`
   (`"features/projets/simulationEquipes.ts",`, l. ~327, et son commentaire) ;
   `grep -rn "simulationEquipes\|routesSimulees(false)" app features lib` → zéro résultat
   (garder `routesSimulees` dans `lib/api/simulation.ts` s'il a d'autres appelants).
3. Les écrans gardent leur comportement ; vérifier que `changerRoleMembre` (`regles.ts:1201`) et la
   réponse du serveur s'accordent (un nouveau chef rétrograde l'ancien) — l'écran **repart de la
   réponse du serveur**, il ne recalcule pas.
4. `NatureEquipe` reste `"INTERNE" | "SOUS_TRAITANT"` (le serveur s'est aligné).

## 4. Vérification à l'écran (CP de `CHANT-2026-001`)

1. Créer une équipe interne avec un chef (collaborateur affecté) et deux membres (un compte, un nom
   libre) → **recharger** : elle est là (avant, elle disparaissait en changeant d'onglet ou en
   production).
2. Ajouter un membre, le nommer chef → l'ancien chef devient ouvrier qualifié ; recharger.
3. Retirer un membre → effectif décrémenté.
4. Équipe sous-traitante : nature conservée.
5. Affecter l'équipe à une activité, puis une autre équipe à la même activité → la seconde remplace la
   première ; désaffecter → plus d'équipe ; recharger à chaque fois.
6. Ajouter un compte non affecté au projet (si l'écran le permet) → message du serveur.
7. 390 px.

## 5. Définition de terminé

- [ ] Plus de simulation des équipes ; fichier et exemption retirés.
- [ ] Membres, chef, nature, affectation à une activité par les routes réelles ; `equipe_ids` plus
      jamais utilisé pour une équipe.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 7 vérifications faites.
- [ ] Commit : `feat(projets): equipes de chantier reelles, fin de la simulation`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
