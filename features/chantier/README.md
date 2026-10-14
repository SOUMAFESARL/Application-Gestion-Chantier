# features/chantier

Module 2 — journal de chantier. Miroir de `backend/apps/chantier/`.

| Couche | Fichier | Rôle |
|---|---|---|
| Types | `types.ts` | Entrée de journal (chantier × jour), rapport journalier, synthèse périodique, saisie du CC |
| Règles | `regles.ts` | Situations, circuit CC → CT → CP, délais ; saisie : J-2, sections actives, alertes immédiates, avancement ; synthèse : étape attendue, rédaction signable |
| Validations | `validations.ts` | Schéma zod de **soumission** (piloté par les sections du chantier), formulaire ↔ domaine |
| Adaptateur | `adaptateur.ts` | Routes `/chantier/…`, **toutes réelles** depuis le 14/10/2026 : saisie, journal, rapport, circuit de validation, relance par e-mail, synthèse périodique et son circuit. `SYNTHESE_DISPONIBLE` masque d'un coup l'onglet et la page de la synthèse s'il le faut |
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
CC, activités). Écran, PDF du rapport et synthèse suivent ce découpage.

**La synthèse périodique est agrégée par Django** à la demande, des rapports
de la période, absences comprises (`apps/chantier/selectors/synthese.py`).
Seules les **semaines (lundi → vendredi) et les mois clos** passent par le
circuit (décision du 14/10/2026) : le conducteur de travaux rédige son
appréciation et les objectifs suivants, puis signe — la synthèse est alors
figée —, le chef de projet approuve ou la lui renvoie avec un motif
(`rapports/synthese/CircuitSynthese.tsx`). Une période personnalisée se
consulte et s'exporte, sans circuit (`statut` `LIBRE`). Le brouillon du CT
n'est montré qu'à lui.

**Signe celui qui tient la fonction sur le chantier, et lui seul** (décision
du 14/10/2026, appliquée de la même façon par le serveur) : le conducteur de
travaux, puis le chef de projet du chantier, depuis le rapport lui-même
(`rapports/[id]/SignatureRapport.tsx`, règle `etapeASigner`) — et de même
sur la synthèse (`tientEtape`). Le Directeur
Général **consulte** — sauf sur un chantier dont il est le chef de projet
désigné, où il approuve comme tel. Le super-administrateur de la plateforme ne
signe jamais. Il peut relancer un chef de chantier ou un signataire.
La rédaction est ouverte à l'accès « saisie » du module chantier, direction
comprise (`peutRedigerJournal`) ; mais seul le rédacteur hors direction voit
l'onglet « Aujourd'hui » tourné vers sa saisie (`estRedacteurJournal`).
