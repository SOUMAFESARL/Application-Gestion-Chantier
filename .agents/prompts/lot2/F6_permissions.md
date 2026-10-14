# F6 — Catalogue des permissions (tâche 2.7)

Branche : `feature/lot2-permissions`
Prérequis : F1 à F5 fusionnées. **Aucune tâche backend** en plus de B1 (qui a réservé toutes les
écritures au superviseur).
Brouillon : `brouillons/ListePermissions.tsx.txt` (86 lignes, tableau HTML nu et simple bascule)
— à **refaire** sur `TableauListe` ; types `PermissionPlateforme` (`types.ts.brouillon.txt`
l. 137-144) et `versPermission` / `listerPermissions` / `basculerPermission`
(`adaptateur.ts.brouillon.txt` l. 893-932) réutilisables.

## 1. Le contrat servi (`../API-Gestion-Chantier/apps/platform_admin/views/permissions.py`)

| Route | Qui | Corps / réponse |
|---|---|---|
| `GET /admins/permissions/` | les deux rôles | `[{id, code, libelle, description, ordre, est_actif, modules: [{id, code, libelle, icone}], modules_codes: [..], cree_le, modifie_le}]` — **tableau nu** |
| `POST /admins/permissions/` | superviseur | `{code, libelle, description?, ordre?, est_actif?, modules?: [codes ou ids]}` → 201 la permission. `code` doit appartenir au **REGISTRE** du serveur (400 `details.code` : « Le code 'x' n'appartient pas au REGISTRE officiel des permissions. ») et ne pas exister déjà |
| `PATCH /admins/permissions/{id}/` | superviseur | `{libelle?, description?, ordre?, est_actif?, modules?}` → 200. Le `code` ne se modifie pas |
| `POST /admins/permissions/{id}/modules/` | superviseur | `{modules: [codes ou ids]}` (liste vide permise) → 200. Rattache la permission **exclusivement** à ces modules, l'accorde aux rôles de direction sur ces modules, la retire de tous les autres |
| `DELETE /admins/permissions/{id}/` | superviseur | 200 `{message, permission_supprimee: "<code>"}`. Suppression logique **propagée à toutes les entreprises** : la permission disparaît de tous les rôles |

Le catalogue des modules : `listerModules()` existe déjà (`adaptateur.ts:607`).

## 2. Ce que l'utilisateur obtient

Une page **Paramétrage > Permissions** : la liste des permissions (code, libellé, modules qui la
portent, active ou non), recherche et filtre par module, export. Le superviseur peut activer /
désactiver une permission, changer ses modules, la renommer, en recréer une du registre, la
supprimer — chaque geste qui touche toutes les entreprises est **confirmé avec son impact**. Le
SUPPORT voit tout en lecture seule.

## 3. Couche par couche

### 3.1 `features/administration/types.ts`

`PermissionPlateforme` du brouillon, avec `modules: ModulePermission[]` au lieu de `string[]` :

```ts
export interface ModulePermission { id: string; code: string; libelle: string }

export interface PermissionPlateforme {
  id: string;
  code: string;
  libelle: string;
  description: string;
  ordre: number;
  actif: boolean;
  modules: ModulePermission[];
}

export interface DemandePermission {
  code: string;
  libelle: string;
  description: string;
  /** Codes de modules. */
  modules: string[];
}

export interface CriteresPermissions { recherche: string; module: string; etat: "" | "ACTIVE" | "INACTIVE" }
```

### 3.2 `features/administration/regles.ts`

- `CRITERES_PERMISSIONS_VIDES`, `criteresPermissionsActifs(criteres)`,
  `filtrerPermissions(permissions, criteres)` — **calquées** sur `CRITERES_COMPTES_VIDES` /
  `criteresComptesActifs` / `filtrerComptes` (l. 504-525) ; recherche sur code + libellé +
  description, filtre module sur `modules[].code`, filtre état sur `actif`.
- `trierPermissions(permissions)` : par `ordre`, puis `code`.
- `modulesPresentsDansPermissions(permissions)` : les modules distincts, pour les options du
  filtre (règle « ne proposer que ce que la liste contient », cf. `FiltreTableau`).

### 3.3 `features/administration/validations.ts`

```ts
export const schemaPermission = z.object({
  code: chaineNonVide(texte("administration.permissions.erreurCodeRequis")).regex(
    /^[a-z0-9_]+(\.[a-z0-9_]+)+$/,
    texte("administration.permissions.erreurCodeForme"),
  ),
  libelle: chaineNonVide(texte("administration.permissions.erreurLibelleRequis")).max(100),
  description: z.string().trim(),
  modules: z.array(z.string()),
});
export const schemaModificationPermission = schemaPermission.omit({ code: true, modules: true });
```

(Forme du code : `module.action`, comme `qualite.audit` — c'est la forme du REGISTRE ; la
**vraie** vérification reste celle du serveur, dont le message s'affiche sous le champ.)

### 3.4 `features/administration/adaptateur.ts`

Depuis le brouillon, avec `ChargePermission` complété (`ordre`, `modules: {id, code, libelle,
icone}[]`), toujours réel :

- `listerPermissions(signal?)` — `GET /admins/permissions/` ;
- `creerPermission(demande: DemandePermission)` — `POST /admins/permissions/` ;
- `modifierPermission(id, { libelle, description })` — `PATCH /admins/permissions/{id}/` ;
- `basculerPermission(id, actif)` — `PATCH … { est_actif }` (brouillon) ;
- `rattacherPermission(id, modules: string[])` — `POST /admins/permissions/{id}/modules/` ;
- `supprimerPermission(id): Promise<string>` — `DELETE /admins/permissions/{id}/`. **Attention** :
  `apiAdministration.supprimer` renvoie `void` et ne lit pas le corps. Retourner simplement le
  code de la permission connu de l'appelant ; ne pas modifier `lib/api/client.ts`.

Un commentaire d'en-tête de section explique : « le catalogue vient du REGISTRE du serveur : on
n'invente pas de permission, on rétablit une permission du registre, on change ses modules ou
on la retire de toutes les entreprises ».

### 3.5 `app/(admin)/admin/cles.ts`

`permissions: () => ["administration", "permissions"] as const,`

### 3.6 L'écran

- `app/(admin)/admin/parametres/permissions/page.tsx` — modèle de `parametres/modules/page.tsx`
  (`EnTeteParametrage section="permissions"`, ajouter `"permissions"` à `SectionParametrage`).
- `app/(admin)/admin/parametres/permissions/ListePermissions.tsx` — modèle de
  `parametres/modules/ListeModules.tsx` (544 lignes : c'est la liste la plus proche, avec ses
  modales de création / modification et son grisage par `peutParametrerPlateforme`). Le lire en
  entier avant d'écrire, et reprendre sa structure.

Contenu :

1. `TableauListe` : colonnes **Code** (`font-mono`), **Libellé** (+ description en
   `text-xs text-neutral-500` dessous), **Modules** (un `BADGE` par module ; aucun → texte
   `permissions.aucunModule`), **Active** (case à cocher) et **Actions** (menu ou boutons :
   Modifier, Modules, Supprimer).
2. `outils` : `RechercheTableau`, `FiltreTableau` module, `FiltreTableau` état.
3. `actions` : bouton « Rétablir une permission » (`permissions.nouvelle`) — ouvre la modale de
   création.
4. `exporter` : `permissions` / « Catalogue des permissions » ; colonnes code, libellé,
   description, modules (codes séparés par `, `), active (« Oui » / « Non » via `t`).
5. **Toutes** les commandes sont `disabled` si `!peutParametrerPlateforme(profil)`.
6. **Confirmations avec impact** (une `Modale` chacune) :
   - désactivation : `permissions.desactiverTexte` — « {code} ne sera plus accordée dans aucune
     entreprise tant qu'elle reste désactivée. Les rôles la retrouveront à sa réactivation. » ;
   - changement de modules : la modale liste les modules du catalogue (`listerModules`, cases à
     cocher, pré-cochées sur les modules actuels) et, sous la liste, `permissions.modulesTexte` —
     « Les rôles de direction la reçoivent sur les modules cochés ; elle est retirée de tous les
     rôles, dans toutes les entreprises, sur les modules décochés. » ;
   - suppression : bouton `danger`, `permissions.supprimerTexte` — « {code} sera retirée de tous
     les rôles de toutes les entreprises. Cette action ne s'annule pas depuis l'écran : il faudra
     la rétablir et la réattribuer rôle par rôle. » La saisie du code est **exigée** pour activer
     le bouton (champ `Input`, comparaison exacte, comme la suppression d'entreprise en F7).
7. Activation (case recochée) : pas de confirmation, toast simple.
8. Après chaque succès : `invalidateQueries({ queryKey: CLES_ADMINISTRATION.permissions() })`
   **et** `CLES_ADMINISTRATION.modules()` (le catalogue des modules affiche ses permissions).
9. Erreurs : sous le champ quand le serveur en désigne un (`erreursParChamp`), toast sinon. Les
   erreurs de `propager_*` arrivent en `details.detail` : les afficher en toast.

### 3.7 Navigation et messages

- `layout.tsx`, `SOUS_MENU_PARAMETRAGE` : `{ href: "/admin/parametres/permissions", cle: "parametragePermissions" }`
  **après** « modules ».
- `messages/fr.json` : `administration.navigation.parametragePermissions` (« Permissions »),
  `administration.parametres.permissions.titre|description` (« Catalogue des permissions » ;
  « Les droits fins que les rôles des entreprises peuvent porter, et les modules qui les
  portent. »), et le bloc `administration.permissions.*` avec toutes les clés citées
  (`colonnes.*`, `filtres.*`, `nouvelle`, `aucunModule`, `vide`, `desactiverTitre|Texte|Confirmer`,
  `modulesTitre|Texte|Confirmer`, `supprimerTitre|Texte|Confirmer|SaisieLibelle|SaisieAide`,
  `creerTitre`, `modifierTitre`, `champs.code|libelle|description|modules`, `codeAide` (« Un code
  du registre, de la forme module.action — par exemple qualite.audit. »), `erreurCodeRequis`,
  `erreurCodeForme` (« Le code a la forme module.action, en minuscules. »),
  `erreurLibelleRequis`, `succes.*`, `oui`, `non`). Les libellés du brouillon
  (`brouillon_administration.parametres.modules.cataloguePermissions*`) peuvent servir de base.

## 4. Vérification à l'écran

1. Superviseur → Paramétrage > Permissions : la liste se charge, triée, avec ses modules.
2. Désactiver une permission → confirmation → recharger : décochée. La réactiver.
3. Changer les modules d'une permission → confirmation → recharger : badges à jour ; ouvrir
   Paramétrage > Modules : cohérent.
4. Rétablir avec un code hors registre (`essai.inexistant`) → message serveur sous le champ.
5. Supprimer une permission **de test** (en rétablir une d'abord si besoin, ou demander au
   développeur laquelle) → le bouton reste grisé tant que le code n'est pas retapé → supprimée.
6. SUPPORT : tout grisé, avis lecture seule.
7. Export CSV et PDF.
8. 390 px.

## 5. Définition de terminé

- [ ] Page `/admin/parametres/permissions`, sous-menu, `TableauListe` avec export.
- [ ] Bascule, modules, renommage, rétablissement, suppression — confirmations avec impact.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 8 vérifications faites.
- [ ] Commit : `feat(administration): catalogue des permissions de la plateforme`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
