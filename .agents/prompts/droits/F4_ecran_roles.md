# F4 — L'écran des rôles : catalogue du serveur, cases par permission, règles DG / AD

Branche : `feature/droits-ecran-roles`
Prérequis : F3 fusionné. Lire le README de ce dossier, §3 (les trois réponses du serveur), avant
tout.

## 1. Le constat

`app/(entreprise)/parametres/roles/page.tsx` et `features/roles/` :

- **douze modules en dur** (`MODULES_CCD`) : les colonnes de la matrice, les lignes des deux tiroirs.
  Le serveur n'en connaît que cinq ; toute écriture part avec `finance`, `achats`… et revient en 400
  « Module inconnu : 'finance' » ;
- l'écran n'écrit que des **niveaux** (`permissions_modules`), jamais les codes : impossible
  d'accorder `projets.voir_montants` sans `projets.creer`, ou `projets.affecter_membres` seul ;
- la matrice de la page **s'édite cellule par cellule**, chaque clic part au serveur ;
- un nouveau rôle naît avec **tous les accès sur tous les modules** (`ModalNouveauRole.tsx:64-70`) ;
- l'écran entier est réservé au DG (`page.tsx:172`, `estDG`), alors que l'AD a
  `administration.roles_gerer` et que le serveur le laisse gérer les rôles personnalisés.

## 2. Ce que la tâche livre (R2, R3b, R5, R6, D1)

1. Les modules et leurs permissions viennent de `GET /modules/` (le catalogue **de celui qui
   regarde**).
2. La matrice de la page devient un **résumé en lecture** : un niveau par module (calculé par le
   serveur), plus aucune écriture depuis la page.
3. Les deux tiroirs éditent **permission par permission** (une case par permission), avec, par
   module, quatre raccourcis : Aucun, Lecture, Saisie, Validation.
4. L'écran envoie la **liste complète** `permissions: string[]`.
5. Règles : rôle DG en lecture seule pour tous ; rôles système modifiables par le DG seul ; l'AD
   gère les rôles personnalisés, avec son seul catalogue ; un rôle qui porte une permission hors du
   catalogue de l'AD garde sa matrice en lecture seule pour lui (D1) ; avertissements affichés.
6. Un nouveau rôle naît **sans aucun droit**.

La portée (badge, choix, changement) est **F5** : ne pas la traiter ici, sauf à laisser la place
prévue au §5.3.

## 3. Le domaine `features/roles`

### 3.1 `types.ts`

- **Retirer** de `RoleItem` le champ `permissions_modules`, et le type `ChargeAcces` d'`api.ts`.
- **Garder** `NiveauAcces`, `ACCES_MODULE`, `AccesModule`, `PermissionsModules`, `MODULES_CCD`,
  `CodeModule` : `features/habilitations` (table des routes, `Droits.permissions`) et
  `features/administration` s'en servent encore. Réécrire le commentaire de `MODULES_CCD` : « Les
  codes de module que la **table des routes** connaît (`features/habilitations/regles.ts`). Aucun
  écran ne s'en sert plus pour lister des modules : la liste vient du serveur (`GET /modules/`). »
- **Ajouter** :
  ```ts
  /** Un module du catalogue de l'entreprise, avec les permissions que le demandeur peut accorder. */
  export interface ModuleCatalogue {
    id: string;
    code: string;
    libelle: string;
    description: string;
    ordre: number;
    icone: string;
    permissions: PermissionCatalogue[];
  }

  /** Les quatre raccourcis d'un module, dans l'ordre d'affichage. */
  export const RACCOURCIS = ["aucun", "lecture", "saisie", "validation"] as const;
  export type Raccourci = (typeof RACCOURCIS)[number];
  ```

### 3.2 `api.ts`

```ts
export interface CreationRolePayload {
  code: string;
  libelle: string;
  description: string;
  portee: PorteeRole;          // F5 le fait choisir ; ici, toujours "PROJET"
  permissions: string[];
}

export interface ModificationRolePayload {
  libelle?: string;
  description?: string;
  /** La liste complète : elle remplace toute la matrice. Absente : la matrice ne change pas. */
  permissions?: string[];
  portee?: PorteeRole;         // F5
  confirmer?: boolean;         // F5
}

/** `GET /modules/` — le catalogue de celui qui demande (voir README §3). */
export async function listerModulesEntreprise(signal?: AbortSignal): Promise<ModuleCatalogue[]>
```

- `listerModulesEntreprise` : type `ChargeModuleCatalogue` privé, fonction `versModuleCatalogue` ;
  écarte `administration` ; trie les modules par (`ordre`, `code`) et les permissions par (`ordre`,
  `code`) ; codes en minuscules.
- `versRole` ne traduit plus `permissions_modules` (supprimé), garde ce que F1 a ajouté.
- Le gros commentaire d'en-tête (l. 14-22, « un niveau aujourd'hui, une liste demain ») est faux
  désormais : le remplacer par trois lignes qui disent le contrat réel (codes, liste complète).
- Ajouter une clé de cache dans `features/roles/cles.ts` (créer le fichier sur le modèle de
  `features/projets/cles.ts`) : `CLE_MODULES_ENTREPRISE = ["roles", "modules"] as const`.

### 3.3 `regles.ts` — règles pures, sans React

Garder `accesDepuisNiveau`, `accesNormalises`, `permissionsNormalisees`, `basculerAcces`,
`rangAccesMax` (encore lus ailleurs : `grep -rn` avant de retirer quoi que ce soit). Ajouter :

```ts
/** Les codes accordés au rôle, tous modules confondus, triés, sans doublon. */
export function codesDuRole(role: RoleItem): string[]

/**
 * Un code « de base » : celui qu'un raccourci coche. La correspondance du serveur
 * (`_normaliser_permissions_modules`) :
 *   lecture ← `.lire` ; saisie ← `.ecrire`, `.rediger` ; validation ← `.valider`, `projets.changer_statut`.
 */
export function accesDuCode(code: string): AccesModule | null

/**
 * Les codes de base qu'un raccourci coche sur ce module — cumulatif, comme les anciens niveaux :
 * « saisie » = lecture + saisie ; « validation » = les trois ; « aucun » = rien.
 * Seuls les codes **présents dans le catalogue du module** sont rendus.
 */
export function codesDuRaccourci(module: ModuleCatalogue, raccourci: Raccourci): string[]

/**
 * Applique un raccourci aux codes du rôle :
 * - « aucun » retire **tous** les codes du module (de base et fins) ;
 * - les autres remplacent les codes **de base** du module par ceux du raccourci et **laissent les
 *   codes fins** (`projets.creer`, `projets.voir_montants`…) tels qu'ils sont.
 * Renvoie une liste triée, sans doublon.
 */
export function appliquerRaccourci(codes: string[], module: ModuleCatalogue, raccourci: Raccourci): string[]

/** Le raccourci que les codes du module réalisent exactement, ou `null` (une combinaison libre). */
export function raccourciCourant(codes: string[], module: ModuleCatalogue): Raccourci | null

/** Coche ou décoche une permission. Triée, sans doublon. */
export function basculerCode(codes: string[], code: string, coche: boolean): string[]

/** Les codes du rôle absents du catalogue (D1 : un AD devant un rôle qui dépasse son périmètre). */
export function codesHorsCatalogue(codes: string[], catalogue: ModuleCatalogue[]): string[]

/**
 * Ce que ce compte peut faire de ce rôle — les règles du serveur (`apps/accounts/views/role.py`) :
 * - rôle `DG` : rien, pour personne (`modification_dg_interdite`) ;
 * - rôle système (`est_systeme`) : le DG seul (`modification_role_systeme_interdite`) ;
 * - matrice : pas si le compte n'est pas DG et que le rôle porte un code hors de son catalogue (D1) ;
 * - suppression : jamais un rôle système, jamais le DG.
 * `raison` est la clé du message qui explique une lecture seule (sous `roles.lectureSeule.*`).
 */
export function gestesSurRole(
  role: RoleItem,
  compte: { estDirection: boolean },
  catalogue: ModuleCatalogue[],
): {
  modifiable: boolean;            // intitulé, description
  matriceModifiable: boolean;
  supprimable: boolean;
  raison: "roleDg" | "roleSysteme" | "horsPerimetre" | null;
}
```

## 4. Les composants

### 4.1 `components/EditeurPermissions.tsx` (nouveau)

L'éditeur partagé par les deux tiroirs.

```ts
interface Props {
  catalogue: ModuleCatalogue[];
  codes: string[];
  onChange?: (codes: string[]) => void;   // absent : lecture seule
  disabled?: boolean;
}
```

Pour chaque module du catalogue, un bloc (bordure `border-neutral-200`, arrondi `rounded-md`) :

- **en-tête** : le libellé du module (servi par le serveur, **pas** de traduction), sa description en
  `text-xs text-neutral-500`, et, à droite, les **quatre raccourcis** en groupe de petits boutons
  (`Bouton` taille `sm`, variante `secondaire` ; celui de `raccourciCourant` en `primaire` ;
  `aria-pressed`) — libellés `roles.raccourcis.aucun|lecture|saisie|validation`. Sous 640 px, les
  raccourcis passent sous le titre ;
- **corps** : une `Checkbox` (`components/ui/checkbox.tsx`) par permission, avec son `libelle`
  (serveur), son code en `font-mono text-xs text-neutral-400`, sa description en `text-xs
  text-neutral-500` ; `<label htmlFor>` relié à la case ;
- lecture seule : cases désactivées, raccourcis absents.

Au-dessus des blocs, une ligne `text-xs text-neutral-500` : `roles.editeur.aide` « Cochez permission
par permission, ou partez d'un raccourci. Un raccourci ne retire pas les permissions particulières
(créer, voir les montants…) ; « Aucun » retire tout le module. »

Catalogue vide (un AD sans aucune permission accordable) : `EtatVide` avec
`roles.editeur.catalogueVide` « Vous ne détenez aucune permission que vous puissiez accorder. ».

### 4.2 `ModalNouveauRole.tsx`

- Reçoit `catalogue: ModuleCatalogue[]` ; l'état `permissions: Record<…>` devient `codes: string[]`,
  **vide** au départ.
- « Copier les droits de… » : `codes = codesDuRole(modele)` **filtrés au catalogue**. Si des codes
  ont été écartés, une `Alerte type="info"` sous le choix : `roles.copieFiltree` « {n, plural, one
  {# permission n'a pas été copiée} other {# permissions n'ont pas été copiées}} : vous ne la
  détenez pas. » (ICU, le pluriel est déjà utilisé ailleurs dans `fr.json` : en reprendre la forme).
- La table des douze modules (l. 207-238) est remplacée par `<EditeurPermissions catalogue codes
  onChange />`.
- Charge utile : `{ code, libelle, description, portee: "PROJET", permissions: codes }`.
- Les contrôles du libellé et du code (l. 92-122) restent tels quels.

### 4.3 `ModalModificationRole.tsx`

- Reçoit `catalogue` et `gestes` (le résultat de `gestesSurRole`).
- État `codes = codesDuRole(role)`.
- En tête du corps :
  - chaque avertissement du rôle en `Alerte type="avertissement"` : clé
    `roles.avertissements.<code>` ; pour `permission_globale_sur_role_projet` : « Ce rôle a une
    portée « projet », mais certaines de ses permissions (hors module Projets) ne se limitent pas aux
    chantiers de la personne. » Un code d'avertissement inconnu : `roles.avertissements.inconnu`
    « Le serveur signale un point à vérifier sur ce rôle ({code}). » ;
  - si `gestes.raison` : `Alerte type="info"` avec `roles.lectureSeule.<raison>` :
    - `roleDg` : « Le rôle Directeur Général ne se modifie pas : il a toujours tous les droits. »
    - `roleSysteme` : « Ce rôle système ne se modifie que par le Directeur Général. »
    - `horsPerimetre` : « Ce rôle porte des permissions que vous ne détenez pas : seul le Directeur
      Général peut modifier ses droits. Son intitulé et sa description restent modifiables. »
- Champs intitulé / description désactivés si `!gestes.modifiable`.
- Éditeur : `onChange` seulement si `gestes.matriceModifiable`. **Pour un AD devant un rôle hors
  périmètre, l'éditeur montre son propre catalogue** : les permissions du rôle qui n'y sont pas sont
  listées en dessous, en lecture, sous le titre `roles.horsPerimetreTitre` « Permissions accordées
  hors de votre périmètre » (libellé et code, lus dans `role.modules`).
- Charge utile : `{ libelle, description }`, plus `permissions: codes` **seulement si**
  `gestes.matriceModifiable` (sinon B-08 refuserait : D1). Bouton « Enregistrer » absent si
  `!gestes.modifiable`.
- Le titre devient `roles.titreConsultation` « {role} » quand rien n'est modifiable.

### 4.4 `MatricePermissionsTable.tsx` — le résumé en lecture

- Props : `roles`, `colonnes: { code: string; libelle: string; description: string }[]`,
  `onOuvrirRole: (role) => void`, `onSupprimerRole?: (role) => void`, `gestes: (role) => …` (le
  résultat de `gestesSurRole`).
- **Colonnes** = l'union, par code, des modules du catalogue et des modules présents dans
  `role.modules` de n'importe quel rôle, triée par `ordre` puis `code` ; l'en-tête est le libellé du
  serveur, la description en `title`. (Un AD voit ainsi les colonnes des modules qu'il ne peut pas
  accorder, en lecture.) Calculer ces colonnes dans `regles.ts` : `colonnesDeMatrice(roles,
  catalogue)`, pure.
- **Cellule** : `<SelecteurAcces valeur={accesDepuisNiveau(niveau)} />` **sans `onChange`** (une
  pastille), `niveau` lu dans `role.modules` (absent = 0). Son `title` liste les libellés des
  permissions accordées, séparés par des virgules, ou `roles.aucunePermission` « Aucune permission ».
- **Ligne** : libellé, badges `systeme` / `personnalise` (existants), code et nombre d'utilisateurs
  (existants) ; si `role.avertissements.length > 0`, une icône `WarningCircle`
  (`@phosphor-icons/react/dist/ssr`, ton `text-avertissement`) avec `aria-label` et `title`
  `roles.avertissementPresent` « Point à vérifier : ouvrez le rôle. ». Prévoir, après les badges,
  l'emplacement du badge de portée (F5).
- **Actions** : un bouton par ligne, `roles.modifier` « Modifier » si `gestes.modifiable`, sinon
  `roles.consulter` « Consulter » (icône `Eye`), qui ouvre le tiroir de modification ; la corbeille
  seulement si `gestes.supprimable` et `onSupprimerRole`.
- `onChangeAcces` **disparaît** : plus aucune écriture depuis la matrice.

### 4.5 `SelecteurAcces.tsx`, `ModalReassignationRole.tsx`

- `SelecteurAcces` ne change pas (sa version éditable sert encore au back-office jusqu'à F6).
- `ModalReassignationRole` ne change pas. **R6** : n'ajouter aucune option « supprimer les
  collaborateurs » à la suppression d'un rôle.

## 5. La page `app/(entreprise)/parametres/roles/page.tsx`

### 5.1 Données

Charger ensemble `listerRoles()`, `listerModulesEntreprise()` et `obtenirProfilMoi()` (le
`Promise.all` existant, l. 41-44 et 56) ; garder le motif de la page (états `chargement` /
`erreur`, `chargerDonnees` après chaque écriture). Le catalogue est rechargé avec le reste.

### 5.2 Droits de la page

- `const { estDirection, peutCode } = useDroits();` — **ne plus lire** `profil.is_dg` ni
  `role_global` (l. 172) ; le profil ne sert plus qu'à ce que d'autres lignes lisent encore (sinon
  le retirer du `Promise.all`).
- `peutGerer = peutCode("administration.roles_gerer")` (vrai pour le DG) : « Nouveau rôle » s'il est
  vrai.
- L'`Alerte` `restrictionDgMessage` (l. 198-202) **disparaît**. Pour qui n'est pas la direction,
  à sa place, une `Alerte type="info"` : `roles.perimetreNonDg` « Vous accordez seulement les
  permissions que vous détenez vous-même. Les rôles système se modifient par le Directeur Général. »
- La légende (l. 204-207) reste.

### 5.3 Gestes

- `handleChangementAcces` (l. 89-108) **disparaît**.
- `handleCreationRole` et `handleModificationRole` restent (charges utiles de §4.2 et §4.3) ;
  `Required<ModificationRolePayload>` devient `ModificationRolePayload`.
- Tiroir de modification : `key={roleAEditer?.id ?? "vide"}` (gardé), avec `catalogue` et
  `gestes={gestesSurRole(roleAEditer, { estDirection }, catalogue)}`.
- `handleDemandeSuppression` : `if (!gestesSurRole(...).supprimable) return;`.

## 6. `messages/fr.json` (espace `roles`)

Ajouter les clés citées ci-dessus, mot pour mot. **Retirer** les clés que plus aucun fichier ne lit
(`restrictionDgMessage`, `matriceDroitsTitre` si le titre change, `colonneAcces`, et
`roles.modules.<code>.nom|description` **si** `grep -rn "modules\.\${" app features` ne trouve plus
de lecteur dans l'espace `roles`). Ne jamais laisser une clé lue sans entrée, ni l'inverse.

## 7. `dev/rolesTest.ts` et `features/habilitations/adaptateur.ts`

`RoleItem` n'a plus `permissions_modules` :

- `dev/rolesTest.ts`, `roleTest(code, libelle, acces)` : construit `modules: ModuleRole[]` au lieu de
  `permissions_modules` — pour chaque module de la table, des codes **synthétiques** dérivés des
  accès : lecture → `{module}.lire`, saisie → `{module}.ecrire`, validation → `{module}.valider`
  (une fonction locale `codesDepuisAcces`), `niveau` = `rangAccesMax(acces)`. Les modules
  `finance`, `stocks`… y restent : c'est un outil de test de l'interface, les codes n'ont pas à
  exister au serveur. Retirer `permissionsNormalisees` et `NiveauAcces` des imports s'ils ne servent
  plus.
- `droitsDuRole` (F1) : le repli sur `role.permissions_modules` devient un repli sur
  `accesDepuisNiveau(module.niveau)` de `role.modules`.

## 8. Vérification à l'écran (schéma `demo`, backend local)

1. **DG** : les colonnes sont les modules du serveur (Projets, Suivi chantier, GED, Pilotage, Tiers)
   — plus de Finance, Achats… ; ouvrir CT (qui n'a pas `projets.voir_montants`), cocher cette seule
   case, enregistrer, **recharger** : la case est restée cochée, la pastille Projets n'a pas changé
   de niveau. **Remettre en état** : la décocher et enregistrer (les comptes de `demo` servent à
   d'autres vérifications).
2. **DG** : créer « Topographe » sans rien cocher → créé, tous ses niveaux à « Aucun » ; le
   rouvrir, raccourci « Saisie » sur Projets → `projets.lire` + `projets.ecrire` cochés, rien
   d'autre ; enregistrer, recharger : idem.
3. **DG** : le rôle DG s'ouvre en « Consulter », tout grisé, message `roleDg`.
4. **AD** : la page s'ouvre (menu « Rôles ») ; « Nouveau rôle » visible ; son éditeur ne montre pas
   `projets.voir_montants` ; créer un rôle avec `projets.creer` → 201 ; le rôle CP s'ouvre en
   « Consulter » (`roleSysteme`) ; le rôle « Topographe » du point 2, auquel le DG ajoute d'abord
   `projets.voir_montants`, s'ouvre pour l'AD avec la matrice en lecture (`horsPerimetre`), et l'AD
   en change la description avec succès. Supprimer « Topographe » à la fin (DG).
5. Un rôle portant `permission_globale_sur_role_projet` (CP de `demo`) : l'icône dans la matrice,
   l'alerte dans le tiroir.
6. Aucune requête ne part au clic dans la matrice ; aucune erreur « Module inconnu ».
7. 390 px : la matrice défile horizontalement, le tiroir et ses raccourcis restent utilisables.

## 9. Définition de terminé

- [ ] Plus aucune lecture de `MODULES_CCD` dans `features/roles/components/` ni dans la page.
- [ ] Plus aucun `permissions_modules` dans `features/roles/`, la page, `dev/` et `features/habilitations/`.
- [ ] Création et modification envoient `permissions: string[]` ; nouveau rôle vide ; D1 appliquée.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 7 vérifications faites.
- [ ] Commit : `feat(roles): matrice du serveur, permissions une a une, regles DG et AD`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
