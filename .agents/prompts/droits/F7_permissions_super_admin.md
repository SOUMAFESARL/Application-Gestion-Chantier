# F7 — Back-office, permissions : alignées sur B2

Branche : `feature/droits-permissions-admin`
Prérequis : F6 fusionné ; B2 fusionné.

## 1. Le constat

`app/(admin)/admin/parametres/permissions/ListePermissions.tsx` (857 lignes) propose :

- à la **création**, de choisir **plusieurs modules** pour une permission (`modulesCreation`,
  l. 96) ;
- l'action **« changer les modules »** (`action.type === "modules"`, l. 76, 392 ; `rattacherPermission`,
  l. 249-251), avec un choix libre parmi tous les modules.

B2 a posé la règle D2 : **une permission `x.action` ne se rattache qu'au module `x`**. Tout autre
choix revient en 400 :
« La permission « chantier.lire » appartient au module « chantier » : elle ne peut pas être rattachée au module « projets ». »
L'écran propose donc des gestes que le serveur refuse. Le reste (lister, activer, désactiver,
modifier libellé et description, supprimer) fonctionne depuis B2.

## 2. Ce que la tâche livre

| Geste | Avant | Après |
|---|---|---|
| Créer | code + libellé + description + **plusieurs modules** | code + libellé + description ; le module **se lit dans le code** (préfixe), affiché en lecture sous le champ ; la charge utile envoie `modules: [prefixe]` |
| Changer les modules | choix libre, multiple | **une** action selon l'état : « Rattacher à « {module} » » si la permission n'est rattachée à aucun module, « Détacher de « {module} » » si elle l'est — chacune avec sa confirmation |
| Supprimer | confirmation existante | la confirmation dit aussi que la permission **quitte tous les rôles** |
| Lister, filtrer, activer, désactiver, modifier | inchangés | inchangés |

Rappel B2 : la création n'accepte qu'un code **du REGISTRE du serveur** (on **rétablit** une
permission supprimée, on n'en invente pas — test d'acceptation `lot1/test_catalogue.py`, A-01). Le
commentaire de `listerPermissions` (`features/administration/adaptateur.ts:1131-1137`) le dit déjà.

## 3. Couche par couche

### 3.1 `features/administration/regles.ts`

```ts
/** Le module d'un code de permission : son préfixe (`projets.lire` → `projets`), ou `null`. */
export function moduleDuCode(code: string): string | null

/** Le module du catalogue qui porte ce préfixe, s'il existe. */
export function moduleDeLaPermission(code: string, modules: ModulePlateforme[]): ModulePlateforme | null
```

### 3.2 `features/administration/validations.ts`

`schemaPermission` : retirer `modules` du schéma (le module ne se saisit plus). La règle de forme
du code (l. 366-369) reste. `DemandePermission.modules` reste dans le type : l'écran le remplit avec
`[moduleDuCode(code)]`.

### 3.3 `ListePermissions.tsx`

**Création** :

- retirer le choix des modules (`modulesCreation` et son champ) ;
- sous le champ code, une ligne `text-xs` qui suit la saisie :
  - préfixe connu : `administration.permissions.moduleDeduit` « Module : {libelle} ({code}) » ;
  - préfixe inconnu (code bien formé) : `administration.permissions.moduleInconnu` « Aucun module
    « {code} » au catalogue. » en `text-erreur`, et le bouton « Créer » désactivé ;
- charge utile : `{ code, libelle, description, modules: [prefixe] }` ;
- une erreur du serveur sous le champ code si elle le désigne (`erreursParChamp.code`), sinon dans
  la modale.

**Rattacher / détacher** (remplace « changer les modules ») :

- l'état `modulesChoisis` (l. 94) et la modale de choix multiple disparaissent ;
- pour chaque ligne : si `permission.modules` est vide **et** que `moduleDeLaPermission` existe →
  bouton « Rattacher à « {libelle} » » (`administration.permissions.rattacher`) ; si elle est
  rattachée à son module → « Détacher » (`administration.permissions.detacher`) ; une permission
  rattachée à un **autre** module (donnée ancienne) → « Détacher », qui la ramène à `[]` ;
- confirmation (une `Modale`) :
  - rattacher, `Alerte type="info"` : « « {code} » sera rattachée à « {module} ». Elle ne sera
    accordée à aucun rôle : le Directeur Général de chaque entreprise l'a d'office, les autres rôles
    la reçoivent depuis l'écran des rôles. »
  - détacher, `Alerte type="avertissement"` : « « {code} » sera détachée de « {module} » et retirée
    de tous les rôles qui la détiennent, dans toutes les entreprises. La rattacher de nouveau ne la
    rendra à personne. »
- l'appel reste `rattacherPermission(id, [prefixe])` ou `rattacherPermission(id, [])` ; au succès,
  invalider `CLES_ADMINISTRATION.permissions()` **et** `CLES_ADMINISTRATION.modules()` (déjà fait
  l. 164 pour d'autres gestes : garder la même forme).

**Suppression** : dans la modale existante, ajouter la phrase
`administration.permissions.suppressionRoles` « Elle sera retirée de tous les rôles de toutes les
entreprises. » avant la confirmation.

Les clés devenues orphelines (choix multiple des modules, son titre, ses aides) se retirent de
`messages/fr.json`.

## 4. Vérification à l'écran (back-office local, compte superviseur)

1. Créer `projets.lire` (déjà actif) → l'erreur du serveur s'affiche (« existe déjà ») ; taper
   `inconnu.test` → « Aucun module « inconnu » au catalogue. », « Créer » désactivé.
2. Supprimer `pilotage.voir_montants` → la confirmation dit « retirée de tous les rôles » ; après,
   le module Pilotage (écran des modules) a une permission de moins.
3. La recréer (code `pilotage.voir_montants`, libellé « Voir les montants du pilotage ») → créée,
   rattachée à Pilotage, **même identifiant** qu'avant (B2).
4. Détacher `tiers.ecrire` → confirmation « retirée de tous les rôles » ; la ligne propose ensuite
   « Rattacher à « Parties Prenantes / Tiers » » ; rattacher → info « accordée à aucun rôle ». Rendre
   `tiers.ecrire` aux rôles de `demo` qui l'avaient (AD, DO) depuis l'écran des rôles, pour remettre
   `demo` en état.
5. Aucune action ne revient en 400 « appartient au module ».
6. 390 px : la liste et les modales.

## 5. Définition de terminé

- [ ] Plus de choix de modules à la création ni de choix multiple ensuite ; rattacher / détacher
      selon D2, chacun confirmé ; la suppression annonce la révocation.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 6 vérifications faites.
- [ ] Commit : `feat(back-office): permissions rattachees a leur seul module`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
