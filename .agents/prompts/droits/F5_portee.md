# F5 — La portée d'un rôle : badge, choix à la création, changement confirmé

Branche : `feature/droits-portee`
Prérequis : F4 fusionné.

## 1. Le contrat (R4)

La **portée** dit quels chantiers un rôle couvre :

| Valeur | Libellé (`roles.portee.<valeur>`) | Aide (`roles.portee.aide.<valeur>`) |
|---|---|---|
| `ENTREPRISE` | « Toute l'entreprise » | « Voit et agit sur tous les chantiers, sans y être affecté. » |
| `PROJET` | « Ses chantiers » | « Voit et agit seulement sur les chantiers où il est affecté. » |

Règles du serveur (`API-Gestion-Chantier/apps/accounts/views/role.py:199-239`) :

- à la **création**, quiconque gère les rôles choisit la portée ; défaut `PROJET` ;
- la **changer** : le **DG seul** (403 sinon : « Seul le Directeur Général peut modifier la portée
  d'un rôle. »), jamais celle du rôle DG ;
- un changement sans `confirmer: true` → **409** `confirmation_requise`, rien n'est écrit, et
  `details.personnes_touchees` donne le nombre de personnes actives qui ont ce rôle ;
- avec `confirmer: true` vers `ENTREPRISE` : **toutes les affectations de chantier actives** de ces
  personnes sont **désactivées** (elles ne tiennent plus de fonction — CP, CT, CC — sur aucun
  chantier, jusqu'à une nouvelle affectation).

## 2. Couche par couche

### 2.1 `lib/api/erreurs.ts`

Ajouter `"confirmation_requise"` à `CODES_METIER`, sous un commentaire `// Rôles — changement de
portée (apps/accounts/views/role.py)`.

### 2.2 `features/roles/regles.ts`

```ts
/**
 * Le nombre de personnes touchées si l'erreur est la demande de confirmation d'un changement de
 * portée ; `null` pour toute autre erreur. Le serveur l'envoie en nombre, `ErreurApi.details` le
 * type en chaîne : `Number(...)`.
 */
export function personnesTouchees(erreur: unknown): number | null

/** Changer la portée de ce rôle : la direction seule, jamais le rôle DG. */
export function peutChangerPortee(role: RoleItem, compte: { estDirection: boolean }): boolean
```

### 2.3 La matrice (`MatricePermissionsTable.tsx`)

Après les badges système / personnalisé (emplacement laissé par F4) : `Badge` de la portée,
variante `neutre` pour `PROJET`, `secondaire` pour `ENTREPRISE`, libellé du §1, aide en `title`.

### 2.4 `ModalNouveauRole.tsx`

Sous la description, un champ « Portée » (`roles.champPortee`) : `RadioGroup`
(`components/ui/radio-group.tsx`), deux options, chacune avec son libellé et son aide (§1) en
`text-xs text-neutral-500`. Défaut `PROJET`. La charge utile envoie le choix (F4 envoyait
`"PROJET"` en dur : le remplacer).

### 2.5 `ModalModificationRole.tsx`

- Le même champ, **modifiable seulement si `peutChangerPortee`** ; sinon la valeur en texte, avec
  l'aide, sans `RadioGroup`.
- La charge utile n'envoie `portee` **que s'il a changé**.
- L'enregistrement passe par la page (§2.6) ; le tiroir reste ouvert pendant la confirmation.

### 2.6 La page — la confirmation

`handleModificationRole(roleId, payload)` :

1. appelle `modifierRole(roleId, payload)` ;
2. si l'erreur donne `personnesTouchees(err) !== null` : **ne pas** afficher de toast ; ouvrir une
   `Modale` de confirmation (état `confirmationPortee: { roleId, payload, personnes, versEntreprise }`) ;
3. « Confirmer » : rappeler `modifierRole(roleId, { ...payload, confirmer: true })`, puis le succès
   habituel (toast, rechargement, tiroir fermé) ; « Annuler » : fermer la modale, le tiroir reste
   ouvert avec la saisie.

Textes de la modale (`roles.confirmationPortee.*`) :

- titre : « Changer la portée de « {role} » ? »
- personnes : « {n, plural, =0 {Aucune personne n'a ce rôle aujourd'hui.} one {# personne a ce rôle.} other {# personnes ont ce rôle.}} »
- vers `ENTREPRISE`, `Alerte type="avertissement"` : « Elles verront tous les chantiers de
  l'entreprise. Leurs affectations actuelles aux chantiers seront désactivées : elles ne tiendront
  plus aucune fonction sur un chantier (chef de projet, conducteur de travaux, chef de chantier)
  tant qu'on ne les y affecte pas de nouveau. »
- vers `PROJET`, `Alerte type="info"` : « Elles ne verront plus que les chantiers où elles sont
  affectées. »
- bouton : « Changer la portée » — variante `danger` vers `ENTREPRISE`, `primaire` vers `PROJET` ;
  `enCours` pendant l'appel.

L'avertissement vers `ENTREPRISE` s'affiche **même si** `n = 0` (le rôle peut être donné demain).

## 3. Vérification à l'écran (schéma `demo`)

1. **DG** : chaque ligne de la matrice porte son badge (AD, DG, DO : « Toute l'entreprise » ; CP,
   CT, CC… : « Ses chantiers »).
2. **DG** : créer « Inspecteur », portée « Toute l'entreprise » → le badge le dit après rechargement.
3. **DG** : passer « Inspecteur » en « Ses chantiers » → modale « Aucune personne… » + l'alerte
   « info » → confirmer → badge changé. Revenir en « Toute l'entreprise » → l'alerte
   « avertissement » ; **annuler** : rien n'a changé (recharger pour le voir).
4. **DG** : le rôle DG n'offre pas le choix de la portée.
5. **AD** : en création, il choisit la portée ; dans un rôle personnalisé existant, la portée est
   en texte, pas modifiable.
6. Supprimer « Inspecteur » à la fin.
7. 390 px : la modale de confirmation.

## 4. Définition de terminé

- [ ] Badge, choix à la création, changement DG seul avec la confirmation du §2.6 ; rien n'est
      écrit sans confirmation.
- [ ] `confirmation_requise` dans `CODES_METIER` ; aucun toast d'erreur sur un 409 de portée.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 7 vérifications faites.
- [ ] Commit : `feat(roles): portee d'un role, changement confirme par le DG`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
