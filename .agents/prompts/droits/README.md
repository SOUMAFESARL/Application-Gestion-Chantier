# Chantier « droits » — rôles, modules et permissions : prompts pour l'agent d'implémentation (frontend)

Rédigé le 16/10/2026 par l'agent de cadrage (Claude), après validation du développeur.

**Lire d'abord** `../API-Gestion-Chantier/.agents/prompts/droits/README.md` : l'ordre des neuf tâches
(B2 backend, puis F1 à F8, **une seule phase, sans arrêt**), le prérequis, les décisions R0 à R11 et
D1 à D5. Ce dossier ne les recopie pas.

## 1. Les tâches de ce dossier

| Tâche | Après | Contenu |
|---|---|---|
| `F1_droits_profil.md` | B2 | `Droits` porte les codes du profil et sa portée ; routes par code |
| `F2_gestes_par_codes.md` | F1 | Créer, modifier, suspendre, archiver, affecter, équipes : un code chacun |
| `F3_montants.md` | F2 | `peutVoirMontants` ; les montants masqués à qui ne les voit pas |
| `F4_ecran_roles.md` | F3 | Écran des rôles : catalogue du serveur, cases par permission, règles DG / AD |
| `F5_portee.md` | F4 | Portée : badge, choix à la création, changement confirmé (DG) |
| `F6_modules_super_admin.md` | F5 | Back-office, modules : ordre, icône, permissions rattachées |
| `F7_permissions_super_admin.md` | F6 | Back-office, permissions : alignées sur B2 |
| `F8_cloture.md` | F7 | Plan d'alignement, compte rendu |

## 2. Règles communes

**Identiques aux lots précédents** : `../lot2/README.md` §2 (lectures obligatoires, Git, `npm run
lint` et `npm run typecheck` à zéro erreur, vérification à l'écran contre le backend local à 1440 et
390 px). En plus :

- **Lire `CLAUDE.md` en entier** avant la première ligne : aucune chaîne en dur dans le JSX
  (`messages/fr.json`), Tailwind seul, logique dans `features/<domaine>/`.
- **`features/projets/adaptateur.ts` reste la référence de style** des branchements : types
  `Charge*` privés, fonctions `vers*`, noms à l'infinitif en français.
- **Les règles de droits ne protègent rien** : elles évitent de proposer un geste que le serveur
  refuserait. Elles doivent donc dire **exactement** ce que dit le serveur — chaque tâche donne la
  règle serveur qu'elle recopie, avec son fichier. Ne jamais en élargir une.
- **Les messages d'erreur du serveur s'affichent tels quels** (`ErreurApi.message`) ; une erreur
  dont le serveur désigne le champ s'affiche sous le champ (`erreursParChamp`).
- Les règles se testent par l'écran, avec les comptes du schéma `demo` (DG, AD, DO, CP, CT, CC).
  **Demander les identifiants au développeur** ; ne jamais les écrire dans un fichier versionné.
- `NODE_OPTIONS=--max-old-space-size=4096` si `npm run lint` manque de mémoire. Une seule commande
  lourde à la fois.

## 3. Ce que le serveur sert (relevé du 16/10/2026, schéma `demo`, compte AD)

### `GET /auth/profil/` (extrait)

```json
{
  "id": "3e0cc69c-…", "role_global": "AD", "is_dg": false, "is_owner": false,
  "portee": "ENTREPRISE",
  "permissions": ["administration.abonnement_voir", "administration.collaborateurs_gerer",
    "administration.collaborateurs_voir", "administration.factures_voir",
    "administration.onboarding_suivre", "administration.roles_gerer",
    "chantier.lire", "chantier.rediger", "chantier.valider", "pilotage.lire",
    "projets.affecter_membres", "projets.changer_statut", "projets.creer", "projets.ecrire",
    "projets.gerer_equipes", "projets.lire", "projets.resilier_archiver",
    "tiers.ecrire", "tiers.lire"],
  "habilitations": {"PROJETS": {"libelle": "Validation", "niveau": 3},
    "CHANTIER": {"libelle": "Validation", "niveau": 3}, "GED": {"libelle": "Aucun", "niveau": 0},
    "PILOTAGE": {"libelle": "Lecture", "niveau": 1}, "TIERS": {"libelle": "Écriture", "niveau": 2}}
}
```

`portee` vaut `"ENTREPRISE"` ou `"PROJET"` (DG → `ENTREPRISE`). `permissions` est la liste
**exacte** des droits effectifs (`apps/core/droits.py`, `permissions_effectives`).

### `GET /parametres/roles/` (un élément, rôle CP)

```json
{
  "id": "1ecb364a-…", "code": "CP", "libelle": "Chef de Projet", "description": "…",
  "est_systeme": true, "est_actif": true, "portee": "PROJET", "nb_utilisateurs": 4,
  "modules": [
    {"module_id": "d13a…", "module_code": "projets", "module_libelle": "Gestion des Projets",
     "module_description": "…", "module_icone": "folder-kanban", "module_ordre": 1, "niveau": 2,
     "permissions": [{"id": "5fa7…", "code": "projets.lire", "libelle": "Consulter les projets",
                      "description": "…", "ordre": 1}, "… les permissions ACCORDÉES au rôle …"]},
    {"module_code": "chantier", "niveau": 2, "permissions": ["chantier.lire", "chantier.rediger"]},
    {"module_code": "ged", "niveau": 2, "permissions": []},
    "…"
  ],
  "permissions_modules": {"projets": ["projets.lire", "lecture", "LECTURE", "…"]},
  "avertissements": ["permission_globale_sur_role_projet"]
}
```

- `modules[].permissions` = les permissions **accordées** au rôle sur ce module ; `niveau` (0 à 3)
  est calculé par le serveur.
- `permissions_modules` mélange codes et alias (`lecture`, `LECTURE`…) : **ne plus le lire** après F4.
- Le module `administration` n'est jamais dans `modules`.

### `GET /modules/` — le catalogue **de celui qui demande**

Une liste triée par `ordre` : `{id, code, libelle, description, ordre, icone, statut,
permissions: [{id, code, libelle, description, ordre}], permissions_codes, niveaux_supportes,
acces_par_defaut}`. **Le serveur n'y met que les permissions que le demandeur détient** (tout pour
le DG ; son périmètre pour l'AD — `projets.voir_montants` n'y est pas) et **omet un module dont il
ne détient aucune** (`ged` aujourd'hui : aucune permission au catalogue). Source :
`API-Gestion-Chantier/apps/referentiels/views/module.py`.

### Écrire un rôle

| Geste | Appel |
|---|---|
| Créer | `POST /parametres/roles/ {code, libelle, description, portee, permissions: string[]}` → 201 |
| Modifier | `PATCH /parametres/roles/{id}/ {libelle?, description?, permissions?: string[], portee?, confirmer?}` → 200 |
| Supprimer | `POST /roles/{id}/supprimer/ {role_substitution_id, reassigner_vers_role_id}` (inchangé) |

- `permissions` est la **liste complète** des codes du rôle : elle **remplace** toute la matrice.
  Une liste vide retire tout.
- Changer `portee` sans `confirmer: true` → **409** `{"erreur": {"code": "confirmation_requise",
  "message": "Confirmation requise pour le changement de portée.", "details":
  {"personnes_touchees": 3}}}`. `personnes_touchees` est un **nombre** (le type `ErreurApi.details`
  le dit chaîne : le lire par `Number(...)`).
- Refus possibles, à afficher tels quels : 403 `modification_dg_interdite` (rôle DG),
  403 `modification_role_systeme_interdite` (rôle système, non-DG), 403 « Vous ne pouvez attribuer
  que des permissions que vous possédez. » (B-08), 403 « Seul le Directeur Général peut modifier la
  portée d'un rôle. ».

## 4. Fin du chantier

F8 écrit le compte rendu. Puis **s'arrêter** : pas de push.
