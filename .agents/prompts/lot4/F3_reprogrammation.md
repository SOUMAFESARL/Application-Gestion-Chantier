# F3 — Prolonger les dates du projet, d'un lot, d'une activité ; historique (US 3.8)

Branche : `feature/lot4-reprogrammation`
Prérequis : F2 fusionnée.

## 1. Le défaut actuel

`definirPlanningProjet` (`features/projets/adaptateur.ts:503`) envoie
`PATCH /projets/{id}/ {date_debut_prevue, date_fin_prevue}`. **Dès que le projet a des dates, le
serveur refuse** : « La modification des dates prévisionnelles requiert un motif et une
justification (RG-11) » (`apps/projets/serializers/__init__.py`, ~l. 340-355). Même règle pour un lot
(`serializers/lot.py:79-84`, « RG-11 : reprogrammez le lot avec motif et justification ») et une
activité. **Aujourd'hui, on ne peut donc modifier les dates de rien une fois qu'elles existent.**

## 2. Le contrat servi

```
POST /api/v1/projets/{id}/reprogrammer/      (et /lots/{id}/reprogrammer/, /activites/{id}/reprogrammer/)
{ "date_debut_prevue": "AAAA-MM-JJ" | null (facultatif), "date_fin_prevue": "AAAA-MM-JJ",
  "motif_id": "uuid", "justification": "≥ 30 caractères" }
→ 200 { id, type_objet, date_debut_prevue, date_fin_prevue, date_debut_baseline, date_fin_baseline,
        jours_derive_baseline, alerte_dg_declenchee }

GET /api/v1/referentiels/motifs-report/        → les motifs [{id, code, libelle, …}]
GET /api/v1/projets/{id}/journal-reports/      → l'historique consolidé du projet (projet, lots, activités)
GET /api/v1/{projets|lots|activites}/{id}/historique-dates/  → l'historique d'un objet
   éléments : {id, type_objet, champ, valeur_avant, valeur_apres, ecart_jours, motif, justification,
               auteur_nom, objet_libelle, cree_le, …}
```

Vérifier chaque champ dans `apps/projets/serializers/reprogrammation.py` (l. 8-140) et la forme de
`motifs-report` (`MotifReportSerializer`, l. 8) avant d'écrire les types. Erreurs : 400
`details.justification` (« au moins 30 caractères (RG-11) »), règles de B2 (D6, D7 : sortie du cadre
du parent).

**La première fixation des dates** (projet ou lot qui n'en avait pas) reste un simple `PATCH` : le
serveur ne l'oblige à la reprogrammation que lorsqu'une date existe.

## 3. Couche par couche

### 3.1 `features/projets/types.ts`

`MotifReport { id; code; libelle }`, `Reprogrammation { dateDebutPrevue: string | null; dateFinPrevue: string; motifId: string; justification: string }`,
`ResultatReprogrammation { dateDebutPrevue; dateFinPrevue; joursDeriveBaseline: number; alerteDg: boolean }`,
`EvenementDate { id; typeObjet: "PROJET" | "LOT" | "ACTIVITE"; champ: string; avant: string | null; apres: string | null; ecartJours: number | null; motif: string; justification: string; auteur: string; objet: string; le: Date }`
(adapter aux valeurs réelles de `type_objet` et `champ`).

### 3.2 `features/projets/adaptateur.ts`

`listerMotifsReport()`, `reprogrammer(objet: "projets" | "lots" | "activites", id, reprogrammation)`,
`lireHistoriqueDates(objet, id)`, `lireJournalReports(projetId)` — avec leurs `Charge*` privés et
leurs `vers*`. Clés de cache dans `features/projets/cles.ts`.

### 3.3 `features/projets/validations.ts`

```ts
export const JUSTIFICATION_MIN = 30; // RG-11, même valeur que le serveur
export function schemaReprogrammation(bornes: { debutMin?: string; finMax?: string }) // motif requis, justification ≥ 30, fin > début (projet) ou ≥ (lot, activité), bornes du parent
```

### 3.4 Un composant partagé — `features/projets/components/ModaleReprogrammation.tsx`

Une modale pour les trois objets : dates (début facultatif, fin obligatoire), **motif** (`Select`
des motifs du référentiel), **justification** (zone de texte, compteur « {n} / 30 »), et en tête un
rappel « Dates actuelles : du {debut} au {fin} — prévu à l’origine : du {baselineDebut} au
{baselineFin} ». Succès : toast, et si `alerteDg` : `toast.info(t("alerteDg"))` (« Le décalage par
rapport au planning initial a été signalé au Directeur Général. »). Invalidation : le projet, ses
lots, l'historique.

### 3.5 Les branchements

1. **Projet** — `ModaleCadrageProjet.tsx` (mode « planning ») : si le projet **n'a pas** de dates →
   comportement actuel (`definirPlanningProjet`) ; s'il en a → ouvrir `ModaleReprogrammation`
   (« Prolonger / modifier les dates »). Le bouton de la fiche (`FicheProjet.tsx:346`,
   `BoutonCadrage`) change de libellé selon le cas.
2. **Lot** — le tiroir de lot (`TiroirLot.tsx`) : si le lot a déjà des dates, ses champs de date
   sont en lecture seule, avec un bouton « Modifier les dates » qui ouvre `ModaleReprogrammation`
   (les autres champs du lot restent modifiables par le `PATCH` normal, **sans** envoyer les dates).
3. **Activité** — idem dans `TiroirActivite.tsx`.
4. **Historique** :
   - fiche projet : une section « Historique des dates » (`lireJournalReports`) — tableau `TableauListe`
     (date, objet, avant → après, écart en jours, motif, justification, auteur) avec **export**
     (règle 10) ; vide → « Aucune modification de dates. » ;
   - tiroirs de lot et d'activité : la liste courte de leur `historique-dates`.

### 3.6 `messages/fr.json`

Un espace de noms `projets.reprogrammation` : `titre` (« Modifier les dates de {objet} »),
`datesActuelles`, `planningInitial`, `debut`, `fin`, `motif`, `motifPlaceholder`, `justification`,
`justificationAide` (« Expliquez la cause du décalage : elle reste dans l’historique du projet. »),
`compteur`, `erreurMotifRequis`, `erreurJustificationCourte` (« La justification doit comporter au
moins 30 caractères. »), `enregistrer`, `enCours`, `succes`, `alerteDg`, `historiqueTitre`,
`historiqueVide`, colonnes du tableau, `modifierDates`, `prolonger`.

## 4. Vérification à l'écran (CP de `CHANT-2026-001`)

1. Projet avec dates : « Modifier les dates » → modale ; repousser la fin d'un mois, motif,
   justification de 30 caractères → enregistré ; recharger : nouvelle fin ; l'historique montre la
   ligne (avant → après, motif, auteur).
2. Justification de 29 caractères : bouton grisé / erreur sous le champ.
3. Repousser la fin d'un **lot** au-delà de la fin du projet → message du serveur « Reprogrammez
   d’abord le projet. ».
4. Avancer la fin du projet avant la fin d'un lot → message D7 avec le code du lot.
5. Activité : modifier ses dates dans le cadre du lot → enregistré, historique du tiroir.
6. Un projet **sans** dates : la modale de cadrage fixe les dates par le `PATCH` habituel.
7. Export CSV de l'historique.
8. 390 px.

## 5. Définition de terminé

- [ ] Reprogrammation du projet, d'un lot, d'une activité ; première fixation inchangée.
- [ ] Historique consolidé dans la fiche (avec export), historique court dans les tiroirs.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 8 vérifications faites.
- [ ] Commit : `feat(projets): reprogrammer les dates avec motif, historique des dates`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
