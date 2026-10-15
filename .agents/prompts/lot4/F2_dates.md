# F2 — Dates : fin après début, dates obligatoires et contenues (US 3.5, 3.6, 3.7)

Branche : `feature/lot4-dates`
Prérequis : backend `B2_dates.md` fusionné ; F1 fusionnée.

## 1. Ce que dit le serveur depuis B2

- Un lot ne se crée (formulaire, import) ni ne s'active sans **les deux** dates du projet ; une
  activité ne se crée ni ne s'active sans les deux dates de son lot.
- Les dates d'un lot sont dans celles du projet ; celles d'une activité dans celles de son lot.
- Le projet exige une fin **strictement** après le début ; le début peut être dans le passé.

Messages du serveur (à afficher tels quels s'il refuse) : voir B2 §3.

## 2. Couche par couche

### 2.1 `features/projets/regles.ts`

- `datesChantierCoherentes` (l. 379) accepte aujourd'hui `fin == debut` : le passer à **`fin > debut`**
  (US 3.5 : « début < fin reste appliqué ») et corriger son commentaire (« un chantier ne finit pas
  le jour où il commence »). Vérifier ses appelants : si un **lot** ou une **activité** l'utilise,
  leur garder « fin ≥ début » par une fonction distincte `periodeCoherente(debut, fin)` — le serveur
  accepte un lot ou une activité d'un jour.
- Nouvelles fonctions pures :

```ts
/** Le projet a-t-il ses deux dates — condition pour créer ou activer un lot (US 3.6). */
export function lotCreable(projet: Pick<Projet, "dateDebutPrevue" | "dateFinPrevue">): boolean
/** Le lot a-t-il ses deux dates — condition pour créer ou activer une activité (US 3.7). */
export function activiteCreable(lot: Pick<Lot, "dateDebutPrevue" | "dateFinPrevue">): boolean
/** La période est-elle contenue dans celle du parent ; un parent sans dates ne borne rien. */
export function periodeContenue(enfant: { debut: string | null; fin: string | null }, parent: { debut: string | null; fin: string | null }): "AVANT" | "APRES" | null
```

(`planningDefini`, l. 228, existe déjà pour le projet : le réutiliser dans `lotCreable`.)

### 2.2 `features/projets/validations.ts`

- Formulaire de lot : refuser une date hors du projet (messages « Le lot ne peut pas commencer avant
  le début du projet ({date}). » / « … finir après la fin du projet ({date}). »).
- Formulaire d'activité : idem par rapport au lot.
- Les sélecteurs de date reçoivent `auPlusTot` / `auPlusTard` du parent (`SelecteurDate` les
  accepte : vérifier le nom exact de la seconde prop dans `components/ui/SelecteurDate.tsx`).

### 2.3 Les écrans

1. Partout où l'on **ajoute un lot** (bouton « Nouveau lot », import de lots, création du projet si
   elle propose des lots) : si `!lotCreable(projet)`, le bouton est **désactivé** et une
   `Alerte type="information"` dit `projets.lotsActivites.datesProjetRequises` (« Renseignez
   d’abord les dates de début et de fin du projet : un lot se cadre dans le calendrier du projet. »)
   avec, pour qui peut cadrer le projet (`peutCadrerProjet`, `FicheProjet.tsx:224`), un lien ou
   bouton « Définir le planning » qui ouvre la modale de cadrage.
2. Partout où l'on **ajoute une activité** : même chose avec `activiteCreable(lot)` et
   `datesLotRequises` (« … du lot : une activité se cadre dans le calendrier du lot. »), et un bouton
   « Définir les dates du lot » qui ouvre le tiroir du lot.
3. Le **calendrier** de saisie respecte les bornes du parent.
4. Toute erreur serveur de ce type s'affiche (toast ou sous le champ, selon qu'elle désigne un
   champ).

### 2.4 `messages/fr.json`

`datesProjetRequises`, `datesLotRequises`, `definirPlanning`, `definirDatesLot`, et les messages de
bornes, dans les espaces de noms des écrans concernés.

## 3. Vérification à l'écran

1. Projet **sans** dates : « Nouveau lot » désactivé, l'alerte explique, « Définir le planning »
   ouvre la modale ; après saisie des dates, le bouton s'active.
2. Lot sans dates : « Nouvelle activité » désactivé, même logique.
3. Le calendrier d'un lot ne propose pas de jour hors du projet ; forcer une date hors cadre au
   clavier → erreur sous le champ.
4. Projet avec début dans le passé (il y a 3 mois) : accepté.
5. Projet avec fin = début : refusé à l'écran.
6. 390 px.

## 4. Définition de terminé

- [ ] Fin > début pour le projet ; règles de création et de contenance dans `regles.ts` et les schémas.
- [ ] Boutons désactivés avec explication et raccourci vers les dates ; calendriers bornés.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 6 vérifications faites.
- [ ] Commit : `feat(projets): dates obligatoires et contenues avant de creer un lot ou une activite`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
