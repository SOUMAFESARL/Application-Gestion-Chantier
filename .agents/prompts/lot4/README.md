# Lot 4 — Gestion de projet : prompts pour l'agent d'implémentation (frontend)

Rédigé le 15/10/2026 par l'agent de cadrage (Claude), après validation du développeur.

**Lire d'abord** `../API-Gestion-Chantier/.agents/prompts/lot4/README.md` : l'ordre des quatorze
tâches (backend et frontend entrelacés, phase A puis phase B sans arrêt), le prérequis (lot 3
fusionné) et le tableau des décisions. Ce dossier ne les recopie pas.

## 1. Les tâches de ce dossier

| Tâche | Après (backend) | Contenu |
|---|---|---|
| `F1_budgets.md` | B1 | Budget d'activité dans le tableau ; somme des budgets ; budget du projet |
| `F2_dates.md` | B2 | Fin strictement après le début ; dates obligatoires et contenues |
| `F3_reprogrammation.md` | B2 | Prolonger les dates du projet, d'un lot, d'une activité ; historique |
| `F4_nom_et_duree.md` | B3 | Nom grisé hors DG / AD ; vérification de la durée |
| `F5_encadrement.md` | B4 | Encadrement par les affectations ; retrait ; dernier CP confirmé |
| `F6_equipes.md` | B5 | Équipes réelles ; fin de `simulationEquipes.ts` |
| `F7_sante_et_import.md` | B6 | Santé du projet dans la fiche ; import des lots par le serveur |
| `F8_cloture.md` | — | Plan d'alignement à jour |

## 2. Règles communes

**Identiques aux lots précédents** : `../lot2/README.md` §2 (lectures obligatoires, Git, `npm run
lint` et `npm run typecheck` à zéro erreur, vérification à l'écran contre le backend local à 1440
et 390 px). Domaine de ce lot : `features/projets/` (le plus gros du dépôt : lire son `README.md`
d'abord) et les écrans `app/(entreprise)/projets/…`.

- **`features/projets/adaptateur.ts` est la référence de style du dépôt** : y rester conforme à
  ce qu'il fait déjà (types `Charge*` privés, `vers*`, centimes partout).
- Les règles de calcul (sommes de budgets, dates contenues) vivent dans `features/projets/regles.ts`
  et se testent à l'œil par l'écran : les écrire **pures** (sans `Date.now()` caché, avec un
  paramètre `maintenant` quand il le faut, comme le reste du fichier).
- Les messages d'erreur du serveur s'affichent tels quels (`ErreurApi.message`), et sous le champ
  quand le serveur en désigne un (`cause.erreursParChamp`).
- Compte de vérification : DG, AD, CP et CT du schéma `demo` en local (le projet `CHANT-2026-001`
  a déjà un CP, un CT et un CC, lot 1 tâche 1.1). Demander les identifiants au développeur.

## 3. Fin du lot

Compte rendu par tâche (livré, vu à l'écran ou non, à quelles largeurs), puis **s'arrêter**.
