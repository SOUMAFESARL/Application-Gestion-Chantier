# F2 — Chaque geste des projets suit son code

Branche : `feature/droits-gestes`
Prérequis : F1 fusionné (`peutCode`, `peutSurProjet` existent).

## 1. Le constat

Les écrans des projets décident de leurs boutons par **niveau** (`peut("projets", "saisie")`,
`peut("projets", "validation")`) ou par « est-ce le DG » (`estDirection`). Le serveur, lui, décide
par **code** (`apps/projets/views/__init__.py:100-118`, `views/affectation.py`, `views/equipe.py`).
Les deux ne coïncident pas :

| Rôle (`demo`) | Niveau projets | Ce que l'écran propose | Ce que le serveur accepte |
|---|---|---|---|
| DO | « saisie » + « validation » | créer, modifier, suspendre, supprimer | créer, modifier, suspendre, archiver — **pas** affecter, **pas** les équipes |
| CP | « saisie » (niveau 2) | **créer** un projet ; **pas** suspendre | **pas** `projets.creer` → 403 ; **suspendre**, oui (`projets.changer_statut`) |
| CT | « saisie » | **créer** un projet | **pas** `projets.creer` → 403 |
| AD | « validation » | encadrement fermé (réservé à la direction) | `projets.affecter_membres` sur tous les chantiers |

## 2. La table des gestes (la recopier exactement)

| Geste | Règle frontend | Règle serveur recopiée |
|---|---|---|
| Créer un projet | `peutCode(droits, "projets.creer")` | `APermission.pour("projets.creer")` (`views/__init__.py:103`) |
| Modifier un projet (fiche, lots, activités) | `peutSurProjet(droits, "projets.ecrire", projet)` | `projets.ecrire` + D-08 |
| Suspendre / reprendre | `peutSurProjet(droits, "projets.changer_statut", projet)` | `projets.changer_statut` (`views/__init__.py:113`) |
| Supprimer / résilier / archiver | `peutSurProjet(droits, "projets.resilier_archiver", projet)` | `views/__init__.py:318-321` |
| Désigner le chef de projet | `projetModifiable(projet) && (droits.estDirection \|\| (peutCode(droits, "projets.affecter_membres") && droits.portee.type === "TOUS"))` | `projets.affecter_membres` ; la désignation reste un acte d'entreprise (décision du 14/10 : le CP ne se désigne pas un successeur) |
| Compléter l'encadrement (CT, CC, autres membres) | `projetModifiable(projet) && peutSurProjet(droits, "projets.affecter_membres", projet)` | `GardePermissionProjet.pour("projets.affecter_membres")` (`views/affectation.py:49, 133`) |
| Créer, modifier, supprimer une équipe ; ses membres | `peutSurProjet(droits, "projets.gerer_equipes", projet)` | `GardePermissionProjet.pour("projets.gerer_equipes")` (`views/equipe.py`, six vues) |
| Retirer quelqu'un du projet | **inchangé** : `peutRetirerDuProjet` (`features/projets/regles.ts:1687`, lot 4) | `PeutRetirerDuProjet` (`apps/projets/permissions.py`) |

Les gestes du **journal** (`chantier` : lire, rédiger, valider, signer) ne changent pas : leurs
accès sont désormais dérivés des codes `chantier.*` par F1, ce qui suffit.

## 3. Les fichiers

Pour chaque fichier, remplacer la règle par celle de la table §2, et rien d'autre.

| Fichier | Lignes (au 16/10) | Aujourd'hui | Devient |
|---|---|---|---|
| `features/habilitations/regles.ts` | 222-233 | `peutDesignerChefProjet`, `peutGererEncadrement` | les deux lignes de la table ; mettre à jour leur commentaire (citer le code et D-08) |
| `app/(entreprise)/tableau-de-bord/TableauDeBordDirection.tsx` | 71 | `peut("projets", "saisie")` | `peutCode("projets.creer")` |
| `app/(entreprise)/projets/ListeProjets.tsx` | 101-102, 294-341, 363, 402 | `peutSaisir` / `peutValider` | « Nouveau » (363, 402) : `peutCode("projets.creer")` ; crayon (294) : `peutSurProjet("projets.ecrire", row.original)` ; pause / lecture (306, 318) : `peutSurProjet("projets.changer_statut", …)` ; corbeille (330) : `peutSurProjet("projets.resilier_archiver", …)` |
| `app/(entreprise)/projets/[id]/FicheProjet.tsx` | 197-198, 321-352 | `peutSaisir` / `peutValider` | mêmes correspondances, avec `projet` |
| `app/(entreprise)/projets/lots-activites/StructureLots.tsx` | 93 | `peut("projets", "saisie")` | `peutSurProjet("projets.ecrire", projet)` (le projet affiché ; s'il n'y en a pas, `false`) |
| `app/(entreprise)/projets/lots-activites/PanneauActivite.tsx` | 35 | idem | idem |
| `app/(entreprise)/projets/equipe-affectations/EquipesProjet.tsx` | 50, 143 | `peut("chantier", "saisie")` | voir ci-dessous |
| `app/(entreprise)/projets/equipe-affectations/AffectationsProjet.tsx` | 52 | idem | voir ci-dessous |
| `app/(entreprise)/projets/[id]/equipes/[equipeId]/FicheEquipe.tsx` | 71 | idem | voir ci-dessous |

**Les trois écrans d'équipes et d'affectations** : pour chaque bouton gardé par `peutSaisir`,
regarder **la fonction d'adaptateur qu'il appelle** (`features/projets/adaptateur.ts`) :

- si elle appelle une route `/equipes/…` → `peutSurProjet("projets.gerer_equipes", projet)` ;
- si elle appelle une route `/affectations/…` → `peutSurProjet("projets.affecter_membres", projet)` ;
- si elle appelle autre chose (pointage, rapport) → laisser `peut("chantier", "saisie")`.

Noter dans le message de commit la décision prise pour chaque bouton.

Après les remplacements, une variable devenue inutile (`peutSaisir`, `peutValider`) se supprime ;
un `useMemo` qui en dépendait voit sa liste de dépendances mise à jour (le lint le signale).

## 4. Pièges

- **Ne pas élargir** `peutRetirerDuProjet` ni `peutCadrerProjet` : ils suivent des décisions du
  lot 4 (le CP affecté cadre ; DG, AD, CP et CT retirent).
- Un `projet` absent (écran en chargement) → le geste est refusé, jamais accordé.
- La direction passe partout (`peutCode` et `peutSurProjet` renvoient `true`) : rien à ajouter pour
  le DG.

## 5. Vérification à l'écran (schéma `demo`)

1. **CP** : la liste des projets **n'a plus** « Nouveau projet » ; sur son projet, il modifie, il
   suspend (il a `projets.changer_statut`), il **ne voit pas** la corbeille (pas
   `resilier_archiver`) ; il complète l'encadrement de son projet.
2. **CT** : pas de « Nouveau projet » ; sur son projet, il modifie (`projets.ecrire`) ; il gère les
   équipes (`gerer_equipes`) ; il **ne complète pas** l'encadrement (pas `affecter_membres`).
3. **DO** : « Nouveau projet » ; corbeille et suspension sur tous les projets ; **ni** encadrement
   **ni** équipes.
4. **AD** : « Nouveau projet » ; complète l'encadrement et désigne le CP de **n'importe quel** projet ;
   gère les équipes partout.
5. Pour chaque geste proposé ci-dessus, le faire une fois : **aucun 403**.
6. 390 px : la liste et la fiche.

## 6. Définition de terminé

- [ ] Plus aucun `peut("projets", "saisie" | "validation")` dans `app/` ni `features/` (`grep -rn
      'peut("projets"' app features` : seules restent les lectures `peut("projets")`).
- [ ] La table §2 appliquée, fichier par fichier ; les choix des écrans d'équipes notés au commit.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 6 vérifications faites.
- [ ] Commit : `feat(projets): chaque geste suit son code de permission`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
