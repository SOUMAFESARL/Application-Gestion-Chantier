# F5 — Encadrement par les affectations ; retrait d'un collaborateur ; dernier CP confirmé (phase B)

Branche : `feature/lot4-encadrement`
Prérequis : backend `B4_encadrement_et_retrait.md` fusionné ; toute la phase A fusionnée.

## 1. Le constat

`ajouterMembreEncadrement` / `retirerMembreEncadrement` (`features/projets/adaptateur.ts:528-550`)
appellent `POST /projets/{id}/encadrement/` et `DELETE /projets/{id}/encadrement/{fonction}/{utilisateur}/`
— **routes inexistantes** (404). Consommateurs : `ModaleAjoutEncadrement.tsx`,
`ModaleRetraitEncadrement.tsx`, montés par `GestionProjet.tsx` ; l'écran
`app/(entreprise)/projets/[id]/EquipeEncadrement.tsx` affiche l'encadrement.

## 2. Le contrat servi (B4)

| Geste | Route |
|---|---|
| Lire l'encadrement | le projet : `chef_projet`, `conducteurs_travaux`, `chefs_chantier` (+ `zone`), `autres_membres` (+ `fonction`), chacun avec `affectation_id` |
| Ajouter | `POST /projets/{id}/affectations/ {utilisateur_id, role_projet, zone?, fonction_membre?}` |
| Modifier zone / fonction | `PATCH /projets/{id}/affectations/{affectation_id}/ {zone?, fonction_membre?}` |
| Retirer | `DELETE /projets/{id}/affectations/{affectation_id}/?hard=true` (effacement physique, journalisé) |
| Candidats | `GET /projets/{id}/collaborateurs-affectables/` → `[{id, nom, role}]` |

Correspondance des fonctions de l'écran (`FonctionProjet`, `types.ts:143`) :

| Écran | `role_projet` |
|---|---|
| `CHEF_PROJET` | `CP` |
| `CONDUCTEUR_TRAVAUX` | `CT` |
| `CHEF_CHANTIER` (+ zone) | `CC` (+ `zone`) |
| `AUTRE_MEMBRE` (+ fonction) | `VI` (+ `fonction_membre`) |

**Une personne, une fonction par projet** (contrainte serveur) : `AffectationProjet.fonctions:
FonctionProjet[]` (`types.ts:187-192`, « au moins une ») devient `fonction: FonctionProjet` ; retirer
les cas où l'écran proposait deux fonctions à la même personne (le serveur répond 400).

Règles de retrait (B4) : DG et AD partout ; CP et CT sur leurs projets ; **personne ne se retire
soi-même**. L'écran ne propose le geste qu'à ceux qui peuvent le faire ; le serveur reste juge.

## 3. Couche par couche

### 3.1 `features/projets/types.ts`

- `Intervenant` (ou les types d'encadrement) gagne `affectationId: string`.
- `AffectationProjet.fonctions` → `fonction` (et adapter tous les usages ; `grep -rn "fonctions" app features`).

### 3.2 `features/projets/regles.ts`

```ts
export const ROLE_PROJET_PAR_FONCTION: Record<FonctionProjet, "CP" | "CT" | "CC" | "VI">;

/**
 * Qui peut retirer quelqu'un de ce projet : DG et AD partout ; CP et CT s'ils y sont affectés ;
 * jamais soi-même. Ne protège rien : décide d'un bouton.
 */
export function peutRetirerDuProjet(
  profil: { id: string; estDg: boolean; estAdministrateur: boolean },
  projet: Projet,
  cibleId: string,
): boolean

/** Retirer cette personne laisse-t-il le projet sans chef de projet ? */
export function retraitDuDernierCp(projet: Projet, cibleId: string): boolean
```

Le profil vient de `obtenirProfilMoi` / du contexte de l'espace entreprise (regarder comment
`FicheProjet.tsx` obtient `droits` et `estDirecteurGeneral` dans `features/projets/regles.ts`).
« Affecté comme CP / CT » se lit dans l'encadrement du projet.

### 3.3 `features/projets/adaptateur.ts`

- `ChargeIntervenant` / `ChargeChefChantier` / `ChargeAutreMembre` : `affectation_id`, `zone`,
  `fonction` ; `versProjet` les lit.
- Réécrire :
  ```ts
  export async function ajouterMembreEncadrement(projetId, ajout): Promise<Projet>
  // POST /projets/{id}/affectations/ {utilisateur_id, role_projet: ROLE_PROJET_PAR_FONCTION[ajout.fonction],
  //   zone (CC), fonction_membre (VI)} — puis relire le projet (lireProjet) : la réponse est l'affectation.
  export async function retirerMembreEncadrement(projetId, affectationId): Promise<Projet>
  // DELETE /projets/{id}/affectations/{affectationId}/?hard=true — puis lireProjet.
  export async function modifierMembreEncadrement(projetId, affectationId, { zone?, fonctionMembre? }): Promise<Projet>
  export async function listerAffectables(projetId, signal?): Promise<{ id: string; nom: string; role: string }[]>
  ```
  Supprimer le commentaire « Routes proposées par le frontend, pas encore livrées » (l. 520-526).
- Le paramètre `hard` passe par les `parametres` du client si `api.supprimer` les accepte ; sinon
  dans le chemin (`…/?hard=true`).

### 3.4 Les modales

- `ModaleAjoutEncadrement.tsx` : la liste de personnes vient de `listerAffectables` (et plus de la
  liste générale des utilisateurs, si c'est le cas aujourd'hui) ; une personne **déjà** dans
  l'encadrement n'est pas proposée.
- `ModaleRetraitEncadrement.tsx` :
  - reçoit l'`affectationId` ;
  - **dernier CP** (`retraitDuDernierCp`) : la modale le dit explicitement, en `Alerte type="avertissement"` :
    `projets.encadrement.dernierCpTitre` (« {nom} est le seul chef de projet de ce chantier. ») et
    `dernierCpTexte` (« Sans chef de projet, personne ne pourra plus signer l’approbation des
    rapports ni cadrer le planning et le budget, jusqu’à ce que vous en désigniez un autre. »),
    et le bouton devient `danger` « Retirer quand même » ;
  - dans tous les cas, le texte rappelle `retraitTexte` (« {nom} n’aura plus accès à ce chantier. Ses
    saisies et signatures passées restent dans le journal. Le retrait est enregistré. »).
- Le bouton « Retirer » d'une ligne de l'encadrement n'apparaît que si
  `peutRetirerDuProjet(profil, projet, personne.id)`.
- Le DG n'apparaît jamais comme candidat (il ne tient aucune fonction, lot 1) : vérifier que la
  liste des affectables l'exclut, sinon le filtrer avec `peutTenirFonctionChantier`
  (`features/projets/regles.ts`).

### 3.5 `messages/fr.json`

Sous l'espace de noms de l'encadrement : `dernierCpTitre`, `dernierCpTexte`, `retirerQuandMeme`,
`retraitTexte`, `zone`, `zoneAide` (« Un lot, un bâtiment… Vide : tout le chantier. »),
`fonctionMembre`, et ce que les modales réécrites demandent.

## 4. Vérification à l'écran

1. DG : ajouter un CT, un CC avec zone « Bâtiment B », un autre membre QHSE → **recharger** : les
   trois apparaissent, zone et fonction comprises.
2. DG : retirer le CC → disparu ; le réaffecter aussitôt → accepté (l'effacement physique libère la
   place).
3. CP du projet : peut retirer un CC ; ne voit pas « Retirer » sur sa propre ligne.
4. CT du projet : peut retirer un CC ; sur un **autre** projet où il n'est pas affecté, ne voit pas le
   bouton (et le serveur refuserait).
5. Retirer le seul CP → la modale l'annonce et demande « Retirer quand même » ; après, la fiche
   indique l'absence de CP.
6. 390 px : la liste et les modales.

## 5. Définition de terminé

- [ ] Plus aucun appel à `/encadrement/` ; ajout, modification, retrait par les affectations.
- [ ] Une fonction par personne ; règles de retrait ; dernier CP confirmé.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 6 vérifications faites.
- [ ] Commit : `feat(projets): encadrement par les affectations, retrait d'un collaborateur`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
