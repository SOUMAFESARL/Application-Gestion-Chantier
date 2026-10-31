# Compte rendu — session cloud frontend, nuit du 30 au 31/10/2026

Consigne : `docs/consigne-cloud-nuit-30-10.md`. Plan qui fait foi : `docs/plan_decoupage_arbre.md`.
Backend lu : `SOUMAFESARL/API-Gestion-Chantier`, branche `develop` (clone du 30/10, `d4675fb`).

## 1. En bref

| Lot | Branche | Commit | Lint | Typecheck | Poussé |
|---|---|---|---|---|---|
| 3 — onglets et tableau de démarrage | `decoupage/lot-3-onglets-tableau` | `b944678` | OK | OK | **non** |
| 4 — arbre et premiers gestes | `decoupage/lot-4-arbre` | `622d31a` | OK | OK | **non** |
| 7 — affectations, rôles, main-d'œuvre | `decoupage/lot-7-affectations-main-oeuvre` | `a0facfc` | OK | OK | **non** |
| 8 — équipes | `decoupage/lot-8-equipes` | `1fd230c` | OK | OK | **non** |
| 9 — dates et avenants | `decoupage/lot-9-dates-avenants` | `9a40e37` | OK | OK | **non** |
| 12 — avancement | `decoupage/lot-12-avancement` | `319b3be` | OK | OK | **non** |
| 13 — journal | `decoupage/lot-13-journal` | `d1b4a67` | OK | OK | **non** |

Chaque branche part de la précédente ; la dernière (`decoupage/lot-13-journal`) contient tout.
`npm run i18n:espaces -- --verifier` passe aussi sur chacune (la CI le vérifie avant le build).
Aucun écran n'a été ouvert, aucun serveur lancé (consigne) : **rien n'a été vu à l'écran**.

## 2. Blocage : aucun push n'a été possible

Tous les `git push` ont été refusés (HTTP 403 : « Claude doesn't have GitHub access to
SOUMAFESARL/Application-Gestion-Chantier for your organization »), quelle que soit la branche ;
l'API GitHub refuse aussi l'écriture (« Resource not accessible by integration »). La lecture
fonctionne. Il faut installer ou reconnecter l'application GitHub de Claude sur l'organisation
(paramètres des connecteurs de claude.ai).

Plutôt que de m'arrêter au lot 3, j'ai continué les lots en local et transmis le travail dans la
conversation sous forme de *git bundle* (`decoupage-lots-3-4.bundle`, puis le bundle final). Pour
récupérer toutes les branches depuis le bundle final :

```bash
git fetch decoupage-lots-3-13.bundle 'refs/heads/decoupage/*:refs/heads/decoupage/*'
```

Ce compte rendu est commité sur `decoupage/lot-13-journal`, non poussé pour la même raison.

## 3. Ce qui est fait, lot par lot

### Lot 3
- Fiche projet à onglets portés par l'URL : un `layout.tsx` sous `/projets/[id]` porte l'en-tête
  (nom, type, statut, actions) dans `CadreFicheProjet` et la barre `OngletsProjet` ; la synthèse
  garde les cartes. Fil d'Ariane nommé pour chaque onglet.
- Nouveau domaine `features/decoupage` (types, règles, clés, validations, adaptateur).
- Tableau de démarrage (`TableauDemarrage`) quand `decoupage_cree` est faux : modèle du type de
  projet, niveaux (libellé, liste, alerter, ordre), grille `@tanstack/react-table` (cellules
  stables via un contexte pour ne pas perdre le focus), vérification C-1 à C-7 par le serveur avec
  lignes surlignées, import Excel/CSV analysé par le serveur, export CSV réimportable,
  application avec confirmation des avertissements. Le tiroir de création enchaîne sur
  `/projets/{id}/decoupage`.
- `features/habilitations/permissions.ts` (constantes) et `BoutonPermis` (grisé, permission
  manquante en infobulle).

### Lot 4
- Vue en arbre (`VueArbre`) : tableau dépliable, numéro, code, niveau, dates, montant (« ••• »),
  physique (partiel / indisponible / dépassement), temporel, écart, statut. Tiroir de case
  (`TiroirCase`), gestes dans `FenetreGeste` : ajouter, modifier (renommer, code, mesure,
  montant ou enveloppe), planifier (avec prolongation confirmée), mesurer, clôturer, désactiver,
  réactiver. Réglages des niveaux. Export Excel/CSV de l'arbre par le serveur.
- Supprimés : `/projets/lots-activites`, `/projets/[id]/lots/[lotId]`, `TiroirLot`,
  `TiroirActivite`, `ImportLots`, `ModaleSuppressionLot`, `ModaleSuppressionActivite`, l'entrée de
  menu, et les écritures lots/activités de `features/projets/adaptateur.ts`.
- Synthèse : le bloc Structure lit `/statistiques/` recompté sur l'arbre.

### Lot 7
- Panneau « Collaborateurs affectés » dans la synthèse : rôle propre au projet, périmètre choisi
  dans l'arbre (`SelecteurPerimetre`), modification, « Remplacer » (fenêtre dédiée), changement de
  chef de chantier, retrait.
- L'encadrement existant envoie `perimetres_ids` au lieu de `lot_id`.
- Page Rôles : case « unique par projet » et avertissement « déjà plusieurs titulaires sur… ».
- Domaine `features/equipes` et page Projets → Main-d'œuvre (`/projets/main-oeuvre`).

### Lot 8
- Onglet Équipes : cartes et tiroir d'équipe (identité, membres datés pris dans le registre avec
  ajout rapide, chef, départ daté, cases de l'arbre). Avertissements du serveur affichés sans
  bloquer. Affectation d'une équipe depuis le tiroir de case (héritage affiché).
- Supprimés : `/projets/equipe-affectations`, son entrée de menu, l'ancienne fiche d'équipe et
  ses modales. `/projets/[id]/equipes/[equipeId]` ouvre l'onglet sur l'équipe.

### Lot 9
- Trois dates et dérive (« +N j sur l'origine, dont M accordés ») dans l'en-tête et le tiroir.
- Reprogrammer une case (`/elements/{id}/reprogrammer/`) ; la modale de reprogrammation gère
  `prolongation_requise` (projet comme case).
- Onglet Avenants : liste, enregistrement multipart avec document, téléchargement, retrait.

### Lot 12
- Onglet Avancement : avancement physique (partiel / indisponible), courbe en S `recharts`
  (projet ou case), fin estimée et rythme, « Clôturer ? », dépassements.

### Lot 13 (en partie)
- Fait : équipes du jour et présents (section `EQUIPES`, 390 px), heures, qualité, motif ;
  production par ouvrier (`personne_id`) ; contrôles de soumission alignés sur
  `exiger_equipes` ; tous les signataires attendus de chaque étape et leur état.
- Pas fait : la section équipes/présents et la production par ouvrier **dans le document et le
  PDF du rapport** (consultation) ; la file de validation, l'historique et la synthèse n'ont pas
  été retouchés — le serveur a gardé leur contrat compatible, ils n'ont pas été vérifiés à
  l'écran.

## 4. Écarts trouvés entre le backend et le plan

1. **Temporel et écart par case** : `GET /projets/{id}/arbre/` ne les porte pas ; ils viennent de
   `GET /projets/{id}/planning/` (cases actives seulement). L'adaptateur fait les deux lectures et
   les réunit ; un planning illisible laisse ces colonnes vides.
2. **« Montant (FCFA) » des fichiers Excel** : le serveur exporte et réimporte cette colonne en
   **centimes** (champ `montant` stocké tel quel). Le frontend s'aligne (export CSV et import
   traitent la valeur en centimes) ; à corriger côté serveur (conversion ×100) ou à renommer.
3. **Périmètre par case** : le frontend ne connaît que les permissions du rôle sur le projet ;
   un geste hors périmètre n'est pas grisé, le serveur le refuse (403, message affiché).
4. **Statistiques** : `/projets/{id}/statistiques/` rend désormais `cases_count`,
   `feuilles_count`, `avancement_pondere` (nul possible), `feuilles_en_retard` ; le domaine a été
   aligné (`StatistiquesProjet`).
5. **Projet** : `jours_accordes`, `date_fin_contractuelle`, `date_*_baseline`, `decoupage_cree`
   ajoutés au domaine.
6. **Courbe en S** : `fin_estimee` peut tomber après le dernier point ; sur l'axe catégoriel de
   recharts, son repère ne s'affiche alors pas.

## 5. Décisions prises seul

- **Nouveaux domaines** `features/decoupage`, `features/equipes`, `features/avenants` plutôt que
  de grossir `features/projets/adaptateur.ts` (1 700 lignes) ; ils restent miroirs de
  `apps/projets`.
- Le panneau des affectations est placé dans l'onglet **Synthèse** (le plan ne dit pas où).
- `listerLots` est gardé dans `features/projets/adaptateur.ts` (la route n'existe plus) tant
  que le PDF de la fiche (lot 14) le lit ; le PDF sort sans lots (`.catch(() => [])`).
- `listerEquipes` (ancien) est gardé et lit les membres du registre, pour l'effectif de la
  synthèse et le PDF.
- Sur téléphone, les gestes du tiroir de case sont masqués (P16 « l'arbre se consulte sans
  gestes »).
- Clé de cache des équipes v2 : `["projets", id, "equipes-chantier"]`, distincte de l'ancienne.

## 6. Points ouverts

- **Pousser les sept branches** dès l'accès GitHub rétabli, puis contrôle, fusion dans
  `develop` (backend poussé avant le frontend, §7 du plan).
- **Tout tester à l'écran** : aucun écran n'a été ouvert. En priorité : tableau de démarrage
  (saisie, import, application), arbre et gestes, saisie du journal à 390 px.
- Messages i18n orphelins à nettoyer : `projets.lotsActivites.*` (encore lu par `Periode` et la
  saisie), `squelettes.avancementDuProjet`, `tableauDeBord.navigation.projetsLots/projetsEquipe`.
- Règles orphelines dans `features/projets/regles.ts` (`lireLotsImportes`, règles de lots) et
  `REFERENTIEL_LOTS` / `ComboboxNomLot` : à retirer au lot 2.
- Lot 13 : sections équipes et production par ouvrier dans le document et le PDF du rapport.
- Lots 2, 6, 11 et 14 : non commencés (attendent le backend de cette nuit, §7 du plan).
