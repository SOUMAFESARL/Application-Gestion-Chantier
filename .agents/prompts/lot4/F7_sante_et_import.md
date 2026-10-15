# F7 — Santé du projet dans la fiche ; import des lots par le serveur (phase B)

Branche : `feature/lot4-sante-import`
Prérequis : backend `B6_openapi.md` fusionné ; F6 fusionnée.

## 1. La santé du projet

### 1.1 Ce qui existe

La fiche ne lit que `indice_sante` (un nombre, `adaptateur.ts:121, 327`). Le serveur sert, sans
consommateur (`apps/projets/views/sante.py`, serializers `serializers/sante.py`) :

| Route | Contenu |
|---|---|
| `GET /projets/{id}/sante/` | aperçu : `indice_sante`, `badge_sante`, `avancement_reel`, `avancement_theorique`, `ecart`, `calcule_le` |
| `GET /projets/{id}/sante/detail/` | `score`, `badge`, `badge_brut`, `etat_calcul` (`NON_DEMARRE`, `ACTIF`, `FIGE`) et la décomposition — lire le serializer `SanteDetailResponseSerializer` en entier |
| `GET /projets/{id}/sante/historique/` | instantanés : `score`, `badge`, `penalite_delais`, `penalite_blocages`, `penalite_reporting`, `retard_pts`, `avancement_physique`, `avancement_temporel`, `taux_reporting`, `calcule_le` |

### 1.2 Ce qu'il faut faire

1. `features/projets/types.ts` : `SanteProjet` (détail) et `InstantaneSante` (historique), aux
   champs réels.
2. `features/projets/adaptateur.ts` : `lireSanteProjet(id)` (détail) et `lireHistoriqueSante(id)` ;
   clés dans `cles.ts`.
3. `regles.ts` : `tonSante(badge)` (le ton de statut existant le plus proche, `components/statut/tons.ts`),
   et `principalePenalite(sante)` (celle qui retire le plus de points, pour la phrase d'explication).
4. Une carte **« Santé du projet »** dans `FicheProjet.tsx`, à côté des cartes planning / budget :
   - le score et son badge ;
   - les trois pénalités (délais, blocages, rapports), chacune en points, avec une jauge (`Jauge`,
     déjà importée par la fiche) ;
   - une phrase : `sante.explication` (« Ce qui pèse le plus : {penalite}. ») ;
   - l'état du calcul : `NON_DEMARRE` → « Le calcul démarre avec le premier rapport journalier. » ;
     `FIGE` → « Calcul figé (projet terminé ou suspendu). » ;
   - une **courbe** de l'historique du score : réutiliser le composant de mini-courbe du dépôt s'il en
     existe un (`grep -rln "Sparkline\|Etincelle" components app` — le back-office a `Etincelle.tsx`) ;
     sinon une liste des cinq derniers instantanés (date, score). **Ne pas ajouter de bibliothèque.**
5. Masquer la carte à qui ne peut pas lire le projet (même condition que les autres cartes).

## 2. L'import des lots par le serveur

### 2.1 Ce qui existe

`ImportLots.tsx` lit le classeur **dans le navigateur** (`lireFichierLots`, `adaptateur.ts:834`),
montre un aperçu, puis `importerLots` (l. 850) crée les lots **un par un** par `creerLot` : une
erreur au 7ᵉ lot laisse six lots créés. Le serveur sert un import **atomique** :

```
POST /api/v1/projets/{id}/lots/import/   multipart : fichier .xlsx (5 Mo, 1000 lignes)
→ 201 [lots]   |   400 {fichier | lignes: [...]} — aucun lot créé
GET  /api/v1/projets/{id}/lots/modele/   → le modèle Excel
```

(`apps/projets/views/lot.py:~120-160`, `services/lots.py:67-160`.) Depuis B1 et B2, il applique aussi
la somme des budgets et les dates du projet.

### 2.2 Ce qu'il faut faire

1. Garder l'**aperçu** local (`lireFichierLots`) : il montre ce qui sera importé et repère les
   erreurs évidentes avant l'envoi.
2. À la confirmation : `importerLots(projetId, fichier: File)` envoie **le fichier** au serveur
   (`FormData`, champ `fichier` — vérifier le nom dans la vue) et renvoie les lots créés ; supprimer
   la boucle de `creerLot`.
3. Les erreurs du serveur (`details.fichier`, `details.lignes[i]`) s'affichent dans l'aperçu, ligne
   par ligne quand le serveur les désigne.
4. Le lien « Télécharger le modèle » pointe vers `GET …/lots/modele/` (téléchargement authentifié :
   regarder comment le dépôt télécharge déjà un fichier protégé, par exemple un contrat de projet,
   et faire pareil). Si `ImportLots` fabriquait le modèle localement, retirer cette fabrication.

## 3. Vérification à l'écran

1. Fiche d'un projet avec rapports : carte santé avec score, pénalités, explication, courbe ou liste.
2. Projet sans rapport : « Le calcul démarre avec le premier rapport journalier. »
3. Import d'un classeur valide → lots créés ; **recharger** : présents.
4. Import d'un classeur dont une ligne est fausse → message sous la ligne, **aucun** lot créé.
5. Import dont la somme dépasse le budget du projet → message du serveur, aucun lot créé.
6. « Télécharger le modèle » → un `.xlsx` qui s'ouvre.
7. 390 px.

## 4. Définition de terminé

- [ ] Carte santé (détail + historique) ; import par le serveur, atomique ; modèle servi par le serveur.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 7 vérifications faites.
- [ ] Commit : `feat(projets): sante du projet dans la fiche, import des lots par le serveur`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
