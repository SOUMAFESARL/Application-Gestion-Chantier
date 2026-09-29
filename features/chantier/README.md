# features/chantier

Module 2 — journal de chantier. Miroir de `backend/apps/chantier/`.

| Couche | Fichier | Rôle |
|---|---|---|
| Types | `types.ts` | Entrée de journal (lot × jour), rapport journalier, synthèse périodique |
| Règles | `regles.ts` | Situations, circuit CC → CT → CP, délais, filtres, agrégation de la synthèse |
| Adaptateur | `adaptateur.ts` | Routes proposées `/chantier/…` ; aiguillage vers la simulation |
| Simulation | `simulationJournal.ts` | Neuf semaines de rapports déterministes, relatives à aujourd'hui |
| Clés | `cles.ts` | Clés React Query partagées par les écrans |

Écrans : `app/(app)/rapports/` (journal DG), `rapports/[id]` (rapport journalier
imprimable), `rapports/synthese` (synthèse périodique imprimable).

Le profil Directeur Général **consulte** : il ne saisit ni ne valide un rapport
(circuit CC → CT → CP). Il peut relancer un chef de chantier ou un signataire.
