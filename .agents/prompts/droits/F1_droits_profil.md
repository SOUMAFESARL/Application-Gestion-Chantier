# F1 — Les droits lus dans les codes du profil ; la portée « entreprise » ; les routes par code

Branche : `feature/droits-profil`
Prérequis : B2 fusionné dans `develop` du backend ; backend local relancé.

## 1. Le constat

`features/habilitations/adaptateur.ts`, `versDroits` :

- ne lit que `habilitations` (un niveau 0-3 par module) et **ignore** `permissions` (les codes) ;
- donne à tout non-DG `portee: { type: "PERSONNE", … }` : l'AD et le DO, dont le rôle a la portée
  `ENTREPRISE`, ne voient que les chantiers où ils sont affectés — le serveur, lui, leur sert tous
  les chantiers (`apps/core/permissions.py`, `GardePermissionProjet`, règle D-08) ;
- `CONDITIONS_ROUTES` (`features/habilitations/regles.ts:58`) ferme tout `/parametres` à qui n'est
  pas DG, alors que l'AD détient `administration.roles_gerer` et `administration.collaborateurs_voir`.

## 2. Ce que la tâche livre

1. `ProfilUtilisateur` porte `permissions` et `portee`.
2. `Droits` porte les **codes** exacts et une portée `TOUS` pour la portée `ENTREPRISE`.
3. Trois règles : `peutCode`, `peutSurProjet` (D-08) et l'accès par module **dérivé des codes**.
4. Deux routes s'ouvrent par code (décision D4).
5. L'outil de développement « Voir en tant que… » suit (sans changer son comportement).

Aucun écran n'est modifié ici, sauf le menu qui suit les routes de lui-même.

## 3. Couche par couche

### 3.1 `features/auth/api.ts` — `ProfilUtilisateur`

Ajouter, sous `habilitations` (l. 63), avec un commentaire d'une ligne chacun dans le ton du fichier :

```ts
  /** Les droits effectifs, code par code (`projets.creer`…) : la liste exacte que le serveur applique. */
  permissions?: string[];
  /** `ENTREPRISE` : tous les chantiers de l'entreprise ; `PROJET` : ceux où la personne est affectée. */
  portee?: "ENTREPRISE" | "PROJET";
```

Optionnels : le profil tiré de la connexion (`seConnecter`) ne les porte pas.

### 3.2 `features/habilitations/types.ts`

- `Droits` gagne :
  ```ts
  /**
   * Les codes de permission accordés (`projets.creer`, `projets.voir_montants`…), tels que le
   * serveur les applique. Vide pour la direction, qui a tout (voir `peutCode`).
   */
  codes: readonly string[];
  ```
- `ConditionAcces` gagne `| { type: "PERMISSION"; code: string }`.
- Le commentaire de `PorteeProjets` est complété : `TOUS` = la direction **et** tout rôle de portée
  `ENTREPRISE`.
- Le commentaire de `estDirection` reste vrai (le DG seul) : ne pas le changer.

### 3.3 `features/habilitations/regles.ts`

Ajouter, après `peut` :

```ts
/**
 * Le compte détient-il ce code ? La direction a tout. Recopie `a_permission`
 * (`apps/core/droits.py`) : la liste du profil est déjà celle que le serveur applique.
 */
export function peutCode(droits: Droits | null, code: string): boolean

/**
 * Ce geste sur ce chantier : le code, **et** une portée « entreprise » ou une fonction tenue sur
 * le chantier. Recopie `GardePermissionProjet` (`apps/core/permissions.py`, règle D-08).
 */
export function peutSurProjet(droits: Droits | null, code: string, projet: Projet): boolean
//   direction → true ; !peutCode → false ; portee TOUS → true ;
//   sinon fonctionsSurProjet(projet, droits).length > 0
```

Et la dérivation des accès, **pure**, exportée (F4 s'en sert aussi) :

```ts
/**
 * Les accès d'un module, lus dans les codes — la même correspondance que le serveur
 * (`_normaliser_permissions_modules`, `apps/accounts/services/roles.py`) :
 * - lecture    ← `{module}.lire`
 * - saisie     ← `{module}.ecrire` ou `{module}.rediger`
 * - validation ← `{module}.valider`, et `projets.changer_statut` pour le module projets
 * Renvoie `null` si aucun code ne commence par `{module}.` : l'appelant se replie alors sur le niveau.
 */
export function accesDepuisCodes(module: string, codes: readonly string[]): AccesModule[] | null
```

`droitsDirection()` renvoie `codes: []`.

`satisfait` traite `PERMISSION` par `peutCode(droits, condition.code)`.

`CONDITIONS_ROUTES` — ajouter deux lignes (le préfixe le plus long l'emporte déjà) :

```ts
  ["/parametres/collaborateurs", permission("administration.collaborateurs_voir")],
  ["/parametres/roles", permission("administration.roles_gerer")],
```

avec une fonction locale `permission(code)` sur le modèle de `lecture(module)`. `/parametres`,
`/parametres/configuration` et `/abonnement` **restent** `DIRECTION` (D4). Mettre à jour le
commentaire de `Droits.estDirection` dans `types.ts` seulement s'il devient faux (« Seul à voir les
Paramètres » : il le devient — écrire « Seul à voir l'Abonnement et la configuration de
l'entreprise ; les rôles et les collaborateurs s'ouvrent aussi par leur code »).

### 3.4 `features/habilitations/adaptateur.ts`

`versDroits(profil)` :

```ts
if (profil.is_dg || profil.role_global === "DG") return droitsDirection();
const codes = (profil.permissions ?? []).map((c) => c.toLowerCase());
// accès par module : accesDepuisCodes(module, codes) ?? accès du niveau d'habilitation (code actuel)
// portée : profil.portee === "ENTREPRISE" ? { type: "TOUS" } : { type: "PERSONNE", collaborateurId: profil.id }
return { estDirection: false, codes, permissions, portee };
```

- **Repli** : si `profil.permissions` est absent (profil de connexion, serveur ancien), le
  comportement d'aujourd'hui reste entier (niveaux, portée `PERSONNE`).
- Le repli par module est nécessaire : `ged` n'a **aucune** permission au catalogue, son niveau ne
  vient que de `habilitations`. Sans repli, l'écran `/documents` se fermerait à tout le monde.
- Garder le passage en minuscules des clés de `habilitations` (commentaire l. 41-44).

`droitsDuRole(role, collaborateurId)` (outil de développement) :

- `codes` = l'union des codes de `role.modules[].permissions[].code` (voir §3.5) ;
- accès par module : `accesDepuisCodes(module, codes)` ?? les accès de `role.permissions_modules`
  (comportement actuel) ;
- portée : `role.portee === "ENTREPRISE"` → `{ type: "TOUS" }`, sinon le `PERSONNE` actuel.

### 3.5 `features/roles/types.ts` et `api.ts` — ajouts **additifs** seulement

F4 refait ce domaine ; ici, on **ajoute** ce que `droitsDuRole` lit, sans rien retirer :

```ts
export type PorteeRole = "ENTREPRISE" | "PROJET";

/** Une permission du catalogue, telle que le serveur la décrit. */
export interface PermissionCatalogue {
  id: string;
  code: string;
  libelle: string;
  description: string;
  ordre: number;
}

/** Un module de la matrice d'un rôle : son niveau (calculé par le serveur) et ses permissions accordées. */
export interface ModuleRole {
  moduleId: string;
  code: string;
  libelle: string;
  description: string;
  icone: string;
  ordre: number;
  niveau: NiveauAcces;
  permissions: PermissionCatalogue[];
}
```

`RoleItem` gagne `portee: PorteeRole`, `avertissements: string[]`, `modules: ModuleRole[]`.

Dans `api.ts`, `ChargeRole` gagne les champs bruts (`portee`, `avertissements`, `modules` au
format du README §3 : `module_id`, `module_code`, `module_libelle`, `module_description`,
`module_icone`, `module_ordre`, `niveau`, `permissions`) et `versRole` les traduit
(`portee ?? "PROJET"`, `avertissements ?? []`, `modules` triés par `ordre` puis `code`, un `niveau`
hors de 0-3 vaut 0). Un module `administration` reçu par erreur est **écarté**.

`dev/rolesTest.ts`, `roleTest(...)` : ajouter `portee: "PROJET"`, `avertissements: []`,
`modules: []` — le comportement de l'outil ne change pas (repli sur `permissions_modules`).

### 3.6 `features/habilitations/components/ContexteDroits.tsx` — `useDroits`

Exposer, à côté de `peut` :

```ts
    peutCode: (code: string) => peutCode(droits, code),
    peutSurProjet: (code: string, projet: Projet) => peutSurProjet(droits, code, projet),
```

(chacun dans un `useCallback`, comme `peut`).

## 4. Pièges

- **`projetsVisibles` change de résultat pour l'AD et le DO** : ils voient désormais tous les
  chantiers. C'est voulu (D-08) ; le vérifier à l'écran (§5).
- `fonctionsSurProjet` renvoie `[]` pour une portée `TOUS` : un AD n'est « chef » d'aucun projet.
  `estChefDuProjet`, `peutCadrerProjet`, `etapeASigner` restent donc fermés à l'AD — c'est la règle
  du serveur (le CP **affecté** cadre et signe). Ne pas « corriger ».
- `personneQuiSigne` : avec une portée `TOUS`, il retombe sur `profil.id` ; vérifier que la
  signature d'un rapport reste refusée à l'AD (il n'est CT ni CP d'aucun chantier).
- Les codes du profil sont en minuscules ; comparer en minuscules partout.

## 5. Vérification à l'écran (backend local, schéma `demo`)

1. **AD** : le menu montre « Rôles » et « Collaborateurs » sous Paramètres ; « Configuration » et
   « Abonnement » restent absents ; `/parametres/configuration` tapé à la main → « Accès non
   autorisé ». La liste des projets montre **tous** les projets de `demo`.
2. **DO** : tous les projets ; pas de « Rôles » ni « Collaborateurs » (il n'a pas ces codes).
3. **CP** : seulement ses projets, comme avant ; pas de Paramètres.
4. **CC** : `/documents` s'ouvre toujours s'il s'ouvrait avant (repli sur le niveau `ged`).
5. **DG** : rien ne change.
6. 390 px : le menu.

## 6. Définition de terminé

- [ ] `Droits.codes`, `peutCode`, `peutSurProjet`, `accesDepuisCodes` écrits et exportés.
- [ ] Portée `ENTREPRISE` → tous les chantiers ; repli intégral si le profil n'a pas `permissions`.
- [ ] `/parametres/roles` et `/parametres/collaborateurs` ouverts par code ; le reste inchangé.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 6 vérifications faites.
- [ ] Commit : `feat(habilitations): droits lus dans les codes du profil, portee entreprise`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
