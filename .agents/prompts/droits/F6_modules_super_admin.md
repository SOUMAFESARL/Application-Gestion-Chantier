# F6 — Back-office, modules : ordre, icône, permissions rattachées

Branche : `feature/droits-modules-admin`
Prérequis : F5 fusionné ; **B2 fusionné** (sans B2, rattacher des permissions vide le module).

## 1. Le constat

`app/(admin)/admin/parametres/modules/ListeModules.tsx` et `features/administration/` :

- le formulaire édite un **« accès par défaut »** (`accesParDefaut`, l. 214-217, 453-470) que le
  serveur traduisait en `LECTURE` / `ECRITURE` / `VALIDATION` **en remplaçant les permissions fines
  du module** — en production, modifier la description d'un module effaçait son catalogue. Depuis
  `bf3ae8d` le serveur l'ignore : le champ ne sert plus à rien ;
- l'écran ne montre ni l'**ordre**, ni l'**icône**, ni les **permissions rattachées** au module, que
  le serveur sert (`GET /admins/modules/` : `ordre`, `icone`, `permissions[]`, `permissions_codes`) ;
- rien ne permet de rattacher ou de retirer une permission d'un module.

## 2. Le contrat servi (B2)

| Geste | Appel | Réponse |
|---|---|---|
| Lister | `GET /admins/modules/` | `[{id, code, libelle, description, ordre, icone, est_actif, statut, permissions: [{id, code, libelle, description, ordre}], permissions_codes, cree_le, modifie_le}]` |
| Créer | `POST /admins/modules/ {libelle, description, ordre, icone}` | le module (code dérivé du libellé) |
| Modifier | `PATCH /admins/modules/{id}/ {libelle, description, ordre, icone}` | le module |
| Rattacher les permissions | `PATCH /admins/modules/{id}/permissions/ {permissions: string[]}` — la **liste complète** des codes | le module |
| Désactiver / réactiver | inchangés | |

Règles B2 : une permission `x.action` ne se rattache qu'au module `x` (D2) ; **retirer** une
permission d'un module la **retire de tous les rôles de toutes les entreprises** sur ce module ;
**ajouter** une permission ne l'accorde à **personne** (le DG l'a d'office ; chaque entreprise la
donne depuis ses rôles). Écritures réservées au superviseur (`peutParametrerPlateforme`, déjà lu par
l'écran).

## 3. Couche par couche

### 3.1 `features/administration/types.ts`

```ts
/** Une permission rattachée à un module du catalogue. */
export interface PermissionDuModule {
  id: string;
  code: string;
  libelle: string;
  description: string;
  ordre: number;
}

export interface ModulePlateforme {
  id: string;
  code: string;
  libelle: string;
  description: string;
  ordre: number;
  /** Nom d'une icône Lucide (`folder-kanban`) : le serveur le garde, les écrans clients le lisent. */
  icone: string;
  permissions: PermissionDuModule[];
  statut: StatutModule;
  creeLe: Date;
}

export interface DemandeModule {
  libelle: string;
  description: string;
  ordre: number;
  icone: string;
}
```

`accesParDefaut` **disparaît** des deux types.

### 3.2 `features/administration/adaptateur.ts`

- `ChargeModule` (l. 189) : `ordre`, `icone`, `permissions` (type privé `ChargePermissionDuModule`),
  sans `acces_par_defaut`.
- `versModule` (l. 317) : traduit ces champs ; permissions triées par (`ordre`, `code`).
- `corpsModule` (l. 330) : `{ libelle, description, ordre, icone }`.
- Nouvelle fonction, après `modifierModule` :
  ```ts
  /**
   * `PATCH /admins/modules/{id}/permissions/` — la liste **complète** des codes rattachés.
   * Retirer un code le retire de tous les rôles de toutes les entreprises ; en ajouter un ne
   * l'accorde à personne (B2).
   */
  export async function rattacherPermissionsModule(id: string, codes: string[]): Promise<ModulePlateforme>
  ```
- `import { accesNormalises }` (l. 29) se retire s'il ne sert plus.

### 3.3 `features/administration/validations.ts`

`schemaModule` : retirer `accesParDefaut` ; ajouter

- `ordre` : entier ≥ 0, ≤ 999 ; message `administration.parametres.modules.erreurOrdre`
  « L'ordre est un nombre entier entre 0 et 999. » ;
- `icone` : `^[a-z0-9]+(-[a-z0-9]+)*$`, 1 à 50 caractères ; message
  `administration.parametres.modules.erreurIcone` « Le nom d'icône s'écrit en minuscules, avec des
  tirets (ex. folder-kanban). ».

L'import d'`ACCES_MODULE` (l. 11) se retire s'il ne sert plus.

### 3.4 `features/administration/regles.ts`

```ts
/**
 * Les permissions du catalogue qui peuvent se rattacher à ce module : celles dont le code commence
 * par `{module.code}.` (B2, D2), qu'elles y soient rattachées ou non.
 */
export function permissionsRattachables(module: ModulePlateforme, catalogue: PermissionPlateforme[]): PermissionPlateforme[]

/** Ce qu'un nouvel ensemble de codes change : à ajouter, à retirer. */
export function differenceRattachement(module: ModulePlateforme, codes: string[]): { ajoutes: string[]; retires: string[] }
```

`trierModules` trie désormais par `ordre`, puis `libelle` (vérifier l'existant et l'aligner).

### 3.5 `ListeModules.tsx`

**Colonnes** (et export) :

| Colonne | Contenu |
|---|---|
| `colonneOrdre` « Ordre » | `ordre`, aligné à droite, `tabular-nums` |
| `colonneModule` (existe) | libellé + code (existant) |
| `colonneIcone` « Icône » | le nom, en `font-mono text-xs` |
| `colonneDescription` (existe) | existant |
| `colonnePermissions` « Permissions » | `{n, plural, =0 {Aucune} one {# permission} other {# permissions}}`, la liste des codes en `title` |
| `colonneStatut`, `colonneCreeLe`, actions | existants |

La colonne et l'export « Accès par défaut » **disparaissent**, ainsi que `SelecteurAcces` et
`useTranslations("roles")` s'ils ne servent plus.

**Formulaire** (modale existante) : intitulé, description, puis **ordre** (`Input type="number"`) et
**icône** (`Input`, aide `administration.parametres.modules.formulaire.iconeAide` « Nom d'une icône
Lucide, en minuscules (ex. folder-kanban, hard-hat). »). Le bloc « Accès par défaut » (l. 453-470)
et `ZonePreRemplie` qui l'entoure disparaissent. Valeurs vides : `{ libelle: "", description: "",
ordre: 0, icone: "box" }`.

**Nouvelle action « Permissions »** (`administration.parametres.modules.permissions`, icône `Key`
de `@phosphor-icons/react/dist/ssr`), entre « Modifier » et « Désactiver », `disabled={!peutAgir}` :

1. ouvre une `Modale` (`action: { type: "permissions"; module }`) qui charge le catalogue
   `listerPermissions()` (clé `CLES_ADMINISTRATION.permissions()` si elle existe, sinon l'ajouter
   dans `features/administration/cles.ts`) ;
2. liste `permissionsRattachables(module, catalogue)` : une `Checkbox` par permission (libellé,
   code en `font-mono`, et la mention `administration.parametres.modules.permissionInactive`
   « inactive » pour une permission désactivée) ; cochées = celles du module ;
   aucune rattachable : `administration.parametres.modules.aucunePermissionRattachable` « Aucune
   permission du catalogue ne commence par « {code}. ». Créez-la depuis l'écran des permissions. » ;
3. « Continuer » calcule `differenceRattachement` ; si rien ne change, il est désactivé ;
4. **étape de confirmation** dans la même modale (R8) :
   - ajouts : `Alerte type="info"` — « {n, plural, one {# permission sera ajoutée} other {#
     permissions seront ajoutées}} : elle ne sera accordée à aucun rôle. Le Directeur Général de
     chaque entreprise l'a d'office ; les autres rôles la reçoivent depuis l'écran des rôles. » ;
   - retraits : `Alerte type="avertissement"` — « {n, plural, one {# permission sera retirée}
     other {# permissions seront retirées}} de « {module} » : {codes}. Elle sera retirée de tous les
     rôles qui la détiennent, dans toutes les entreprises. La rattacher de nouveau ne la rendra à
     personne. » ;
   - bouton « Confirmer » (variante `danger` s'il y a des retraits, `primaire` sinon) →
     `rattacherPermissionsModule(module.id, codes)` → `remplacer(cible)`, toast
     `administration.parametres.modules.succesPermissions` « Permissions de « {libelle} » mises à
     jour. », modale fermée ; « Retour » revient à la liste des cases ;
5. une erreur du serveur s'affiche dans la modale (`erreurAction`, motif existant).

Invalider aussi `CLES_ADMINISTRATION.permissions()` après succès : l'écran des permissions affiche
les modules de chaque permission.

## 4. `messages/fr.json` (espace `administration.parametres.modules`)

Ajouter les clés citées, mot pour mot ; retirer `colonneAccesParDefaut`,
`formulaire.accesParDefaut` et toute clé de ce bloc que plus rien ne lit.

## 5. Vérification à l'écran (back-office local, compte superviseur)

1. La liste montre l'ordre, l'icône et le nombre de permissions de chaque module (Projets : 8).
2. Modifier la description de **Projets** → enregistré ; **ses 8 permissions sont toujours là**
   (c'est le défaut que `bf3ae8d` et cette tâche ferment).
3. « Permissions » de Projets : 8 cases cochées ; décocher `projets.voir_montants` → l'étape de
   confirmation annonce le retrait et la révocation ; confirmer → 7. Dans l'espace entreprise
   `demo`, le rôle CP n'a plus `projets.voir_montants`.
4. Recocher `projets.voir_montants` → l'étape annonce l'ajout « accordée à aucun rôle » ; confirmer
   → 8. Le CP **ne l'a pas** récupérée : la lui rendre depuis l'écran des rôles (DG de `demo`),
   pour remettre `demo` en état.
5. Compte **support** (non superviseur) : boutons désactivés.
6. 390 px : la liste et la modale des permissions.

## 6. Définition de terminé

- [ ] Plus aucun `accesParDefaut` / `acces_par_defaut` dans `features/administration/` ni dans l'écran.
- [ ] Ordre, icône, permissions affichés et édités ; rattachement avec confirmation de la propagation.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 6 vérifications faites.
- [ ] Commit : `feat(back-office): modules avec ordre, icone et permissions rattachees`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
