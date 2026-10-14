# features/chantier

Module 2 — journal de chantier. Miroir de `backend/apps/chantier/`.

| Couche | Fichier | Rôle |
|---|---|---|
| Types | `types.ts` | Entrée de journal (chantier × jour), rapport journalier, synthèse périodique, saisie du CC |
| Règles | `regles.ts` | Situations, circuit CC → CT → CP, délais, agrégation ; saisie : J-2, sections actives, alertes immédiates, avancement |
| Validations | `validations.ts` | Schéma zod de **soumission** (piloté par les sections du chantier), formulaire ↔ domaine |
| Adaptateur | `adaptateur.ts` | Routes `/chantier/…`. **La saisie, le journal, le rapport lu et le circuit de validation (valider, approuver, rejeter) et la relance par e-mail sont réels** ; la synthèse passe encore par la simulation, faute de route côté Django |
| Simulation | `simulationJournal.ts` | Ne sert plus qu'à la synthèse ; disparaît quand sa route existe |
| Simulation | `simulationSaisie.ts` | N'est plus appelé par la saisie. Ne sert plus qu'à `simulationJournal.ts`, et disparaît avec lui |
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
activités des lots choisis partent.

**Le journal du DG compte lui aussi en chantier × jour** (demande produit du
05/10/2026) : un rapport porte le nom du **projet**, jamais celui d'un lot.
`EntreeJournal` a un `chantier` et la liste des `lots` travaillés ce jour ;
`RapportJournalier.travaux` rend compte lot par lot (avancement, point du
CC, activités). Écran, PDF du rapport, synthèse et données simulées suivent
ce découpage.

**Le journal montre des données simulées jusqu'au branchement de l'API**
(demande produit, 05/10/2026). Les chantiers sont les vrais : un chantier
`EN_COURS` / `EN_RETARD` / `CRITIQUE` attend un rapport chaque jour ouvré
depuis son démarrage (neuf semaines au plus). Chaque jour attendu porte, par
priorité, le rapport soumis depuis `/rapports/saisie` (stocké dans le
`localStorage` du poste, il reste « Soumis » faute d'écran CT / CP), sinon un
rapport de démonstration bâti sur les vrais lots et activités du chantier
(tiré d'une graine chantier × jour, donc stable), sinon une absence. La
démonstration couvre aussi les projets **en attente** (quatre semaines), avec
des lots, un avancement et des intervenants fictifs quand le projet n'en a
pas encore.

**Signe celui qui tient la fonction sur le chantier, et lui seul** (décision
du 14/10/2026, appliquée de la même façon par le serveur) : le conducteur de
travaux, puis le chef de projet du chantier, depuis le rapport lui-même
(`rapports/[id]/SignatureRapport.tsx`, règle `etapeASigner`). Le Directeur
Général **consulte** — sauf sur un chantier dont il est le chef de projet
désigné, où il approuve comme tel. Le super-administrateur de la plateforme ne
signe jamais. Il peut relancer un chef de chantier ou un signataire.
La rédaction est ouverte à l'accès « saisie » du module chantier, direction
comprise (`peutRedigerJournal`) ; mais seul le rédacteur hors direction voit
l'onglet « Aujourd'hui » tourné vers sa saisie (`estRedacteurJournal`).
