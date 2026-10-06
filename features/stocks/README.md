# features/stocks

Module F9 — gestion de stock de chantier (`F9_Gestion_Stock_Chantier_v1.2.pdf`).
Miroir de `backend/apps/stocks/`. Plan et matrice des droits :
`docs/PLAN_F9_STOCK.md`.

| Couche | Fichier | Rôle |
|---|---|---|
| Types | `types.ts` | DA, BC, livraison / BRV, mouvement, transfert, inventaire, seuil, référentiel |
| Règles | `regles.ts` | Stock = cumul des mouvements ; statuts ; double condition RG-STK-01 ; alertes RG-STK-11 ; gestes (matrice §3.2) ; tâches « À faire » |
| Validations | `validations.ts` | Schémas zod des écritures, justificatifs |
| Adaptateur | `adaptateur.ts` | Routes proposées `/stocks/…` ; aiguillage `STOCK_SIMULE` |
| Simulation | `simulationStock.ts` | Le serveur rejoué (règles bloquantes, numérotation, SHA-256) ; démonstration sur les vrais chantiers |
| Clés | `cles.ts` | `CLE_STOCK` |

Écran : `app/(entreprise)/stocks/` (onglets À faire · Stock · Demandes ·
Commandes · Réceptions · Mouvements · Inventaires · Référentiel). Le tableau
de bord y puise la file des DA (direction) et l'état du stock (encadrement) ;
la saisie du journal (F2) y lit les matériaux consommables (RG-STK-02).

**Les rôles du cahier ne sont pas codés.** La matrice §3.2 se traduit en
accès de module (`achats`, `stocks`) et en fonction tenue sur le chantier
(conducteur de travaux, chef de projet) — voir `gestesStock`.
