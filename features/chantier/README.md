# features/chantier

Module 2 — journal de chantier. Miroir de `backend/apps/chantier/`.

| Couche | Fichier | Rôle |
|---|---|---|
| Types | `types.ts` | Entrée de journal (lot × jour), rapport journalier, synthèse périodique, saisie du CC |
| Règles | `regles.ts` | Situations, circuit CC → CT → CP, délais, agrégation ; saisie : J-2, sections actives, alertes immédiates, avancement |
| Validations | `validations.ts` | Schéma zod de **soumission** (piloté par les sections du chantier), formulaire ↔ domaine |
| Adaptateur | `adaptateur.ts` | Routes proposées `/chantier/…` ; aiguillage vers la simulation |
| Simulation | `simulationJournal.ts` | Neuf semaines de rapports déterministes, relatives à aujourd'hui |
| Simulation | `simulationSaisie.ts` | Brouillons et rapports saisis (localStorage), sur les **vrais** lots ; rejoignent le journal |
| Navigateur | `photos.ts`, `brouillonLocal.ts` | Compression 1 200 px / 70 % + GPS ; copie locale de la saisie (coupure réseau) |
| Clés | `cles.ts` | Clés React Query partagées par les écrans |

Écrans : `app/(entreprise)/rapports/` (journal DG), `rapports/[id]` (rapport
journalier imprimable), `rapports/synthese` (synthèse périodique imprimable),
`rapports/saisie` (mes rapports : jour + chantier, et tous les rapports
attendus non remis) et `rapports/saisie/[projetId]?date=` (rédaction, mobile
d'abord) — SFD F2 v1.0.

**La saisie rédige un rapport par chantier et par jour**, tous ses lots en
cours réunis (décision produit du 05/10/2026, contre le « un lot, un jour »
du SFD) : sections = réunion de celles des modes des lots, activités
regroupées par lot, chacune déclarée à l'avancement ou par la production
selon le mode de son lot. **L'écran suit les six rubriques du cahier « Journal de chantier
intelligent » §2**, dans son ordre : Travaux réalisés · Ressources humaines ·
Matériels et engins · Matériaux / approvisionnement · Événements chantier ·
Photos et pièces jointes — encadrées par la journée (horaires, arrêt, météo)
et la synthèse (points d'attention, actions à engager). Toutes s'affichent ;
les sections du serveur (modes des lots) décident seulement des blocs qu'elles
contiennent. D'où, dans `SaisieRapport` : `localisation` par activité,
`retards` par catégorie, `dureeArret` par engin, `besoins` (ruptures, besoins
urgents), la `nature` d'un événement (8, `NATURES_EVENEMENT`) et ses horaires,
`piecesJointes`. **L'avancement se déclare lot par lot** : le CC
choisit les lots travaillés ce jour (`lotsTravailles`, parmi
`lotsSuivisAvancement`), puis fait le point sur chacun — quantités de ses
activités et observation du lot, obligatoire si rien n'a avancé ; seules les
activités des lots choisis partent. Le journal du DG compte encore en lignes
lot × jour : un rapport saisi y paraît en une ligne « Chantier » qui réunit
ses lots (`lotEnsemble`, simulation).

Le profil Directeur Général **consulte** : il ne saisit ni ne valide un rapport
(circuit CC → CT → CP). Il peut relancer un chef de chantier ou un signataire.
La rédaction est ouverte à l'accès « saisie » du module chantier, direction
comprise (`peutRedigerJournal`) ; mais seul le rédacteur hors direction voit
l'onglet « Aujourd'hui » tourné vers sa saisie (`estRedacteurJournal`).
