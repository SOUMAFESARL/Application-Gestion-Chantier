# Plan : le frontend sur le découpage en arbre

Ouvert le 30 octobre 2026. Objet : adapter le frontend au backend de `develop`, qui a remplacé
le découpage Lot → Activité par un arbre de cases (refonte livrée et déployée le 30/10/2026), et
combler au backend les manques relevés pendant le cadrage.

**Ce plan fait foi pour ce chantier.** Il a été cadré et validé point par point avec le
développeur le 30/10/2026 ; ce qui n'y figure pas n'est pas décidé.

| Lot ouvert | État |
|---|---|
| Backend 1, 5, 10 · Frontend 3, 4, 7, 8, 9, 12, 13 | Plan validé le 30/10/2026 ; exécution dans le cloud la nuit du 30/10 (§7) |

---

## 1. Point de départ

- **Le backend de `develop` est en production avec l'arbre.** Les routes `/lots/`, `/activites/`,
  `/projets/{id}/lots/*` et `/projets/{id}/equipes/candidats/` n'existent plus. Le frontend en
  production les appelle encore : ces écrans sont cassés. **On ne les masque pas** ; chaque lot
  livré en répare une partie.
- Aucun client n'utilise le logiciel en production : rien à reprendre.
- Références, par ordre d'autorité :
  1. **le backend tel qu'il est** — en cas d'écart avec un document, il tranche ;
  2. le PowerPoint « Découper un projet » v2 (`Downloads/Decoupage-projet-25-diapos-v2.pptx`) ;
  3. les décisions v1.2 (`04_Conception/specifications_fonctionnelles/F1_gestion_projets/F1_Decoupage_Projet_decisions_v1.2.md`, copie dans `API-Gestion-Chantier/docs/decoupage/`) ;
  4. le prototype HTML (`F1_prototype_decoupage.html`) : **inspiration seulement**, ni style ni
     disposition. Les écrans suivent les composants et le style déjà en place.

## 2. Décisions de cadrage (30/10/2026)

### Conduite

- **Claude écrit tout le code**, backend et frontend.
- **Vérification sans navigateur.** Pas de recette rejouée à l'écran. Au frontend : `npm run lint`
  et `npm run typecheck`. Au backend : `python manage.py check` et `makemigrations --check`.
  **Aucun test pytest** n'est écrit (décision du 29/10/2026). C'est le développeur qui teste à
  l'écran.
- **Contrat avant écran** : au début de chaque lot, le serializer Django est confronté à
  l'adaptateur, champ par champ, et le contrat est écrit dans `API-Gestion-Chantier/docs/`.
- **Pas de reconstruction des données de démonstration** pour l'instant.
- **Une session par lot**, qui repart de ce plan (§5), pour économiser les jetons.
- **Branches** : un lot = une branche courte `decoupage/lot-N-<objet>`, créée depuis `develop`
  dans chaque dépôt touché, fusionnée dans `develop` (`--no-ff`) quand sa vérification passe.
  **Le push se fait quand le développeur le demande.** Pour un lot qui touche les deux dépôts,
  **le backend est poussé avant le frontend** : sinon l'écran déployé appelle une route absente.
- Traductions : **next-intl**, `messages/fr.json` seul.
- Style de branchement : celui de `features/projets/adaptateur.ts` (types `Charge*` privés,
  fonctions `vers*` / `versCharge*`, clés dans `cles.ts`, erreurs sur `ErreurApi.code`).

### Produit

| # | Décision |
|---|---|
| P1 | La page `parametres/listes` devient **« Listes et modèles »** : types de projet, modes d'exécution, listes de valeurs, modèles d'entreprise |
| P2 | **L'ancien référentiel des lots est retiré** (backend et frontend) : la liste « Lots » du découpage est la seule source. Types de projet et modes d'exécution restent |
| P3 | **Les listes et modèles de la plateforme** sont dans le chantier, au back-office : le SUPERVISEUR écrit, le SUPPORT lit |
| P4 | Le **tableau de démarrage** est une page dédiée, `/projets/[id]/decoupage`, ouverte après le tiroir de création (inchangé) ; grille sur `@tanstack/react-table`, sans nouvelle bibliothèque ; l'Excel est analysé par le serveur |
| P5 | La **fiche projet** prend des **onglets portés par l'URL** : `/projets/[id]` (synthèse), `/decoupage`, `/avancement`, `/equipes`, `/avenants` |
| P6 | Onglet Découpage : **tableau en arbre** (élément, niveau, dates, montant, physique, temporel, écart, statut) et **tiroir de détail** de la case. **Réglages des niveaux** (libellé, liste, « Alerter à ce niveau ») dans cet onglet |
| P7 | Une action non permise : **bouton grisé, permission manquante en infobulle**. Sans `projets.voir_montants` : « ••• ». Numéro calculé (« 1.2.3 ») et code libre affichés |
| P8 | Le **PDF de la fiche projet** contient **tous les niveaux** de l'arbre |
| P9 | Avenants dans un onglet ; « +45 j sur l'origine, dont 30 accordés » dans l'en-tête de la fiche et le tiroir de la case ; courbe en S (`recharts`) dans l'onglet Avancement ; un enfant qui dépasse son parent : confirmation, motif, prolongation |
| P10 | **Dépendances** : un seul type de lien (B commence après la fin de A), plusieurs prédécesseurs, entre feuilles, **sans délai**, entre branches permis, boucles refusées ; planifier B avant la fin de A est **refusé** ; reprogrammer A propose « décaler aussi » (coché) pour ses successeurs ; détailler une feuille donne ses prédécesseurs à chaque enfant ; désactiver retire ses liens (tracé) ; saisie dans le tiroir de la case ; flèches au planning ; permission `projets.planifier` |
| P11 | **Registre de main-d'œuvre** : page **Projets → Main-d'œuvre** (`/projets/main-oeuvre`), lecture `projets.lire`, écriture `projets.main_oeuvre_gerer` ; ajout rapide depuis une équipe. Pas dans Paramètres : le chef de projet n'y entre pas forcément |
| P12 | Les **équipes** passent dans l'onglet Équipes de la fiche projet ; on affecte une équipe à une case depuis le tiroir de la case (héritage affiché) et depuis la fiche de l'équipe |
| P13 | Affectation d'un collaborateur : **rôle propre au projet** et **périmètre** (cases de l'arbre) ; geste « Remplacer » dans sa propre fenêtre ; case **« unique par projet »** sur la page Rôles, avec l'avertissement « déjà plusieurs titulaires sur… » |
| P14 | **Journal** : écran pensé pour un rédacteur par jour, sans casser s'il y en a plusieurs ; présentation actuelle gardée, contenu des sections refondu (tâches de la partie, équipes et présents, heures, production par ouvrier) ; signataires attendus et état de chacun |
| P15 | Alertes : causes classées et jalon manqué ; le seuil vient des permissions du rôle. Planning : arbre dépliable, mêmes barres. Tableau de bord : on corrige ce qui casse |
| P16 | Téléphone : la saisie du journal reste utilisable à 390 px ; tableau de démarrage, arbre et planning pour ordinateur et tablette ; sur téléphone, l'arbre se consulte sans gestes |
| P17 | **Ajouts au backend** (manques des décisions v1.2) : dupliquer une branche ; import DQE qui **met à jour** les feuilles existantes (bilan, puis application) ; historique des modifications d'une case, **lu dans `JournalAudit`** (les gestes y écrivent déjà), sans nouvelle table |

### Hors chantier

Le journal hors connexion (planifié plus tard), une colonne « prédécesseurs » dans le tableau
Excel, le module stocks (son `lot_id` reste tel quel).

## 3. Les lots

« B » : backend (`API-Gestion-Chantier`), « F » : frontend (`Application-Gestion-Chantier`).

### Lot 1 — B : ancien référentiel et back-office des listes et modèles

- Retirer la catégorie `lots` de `referentiels/(…)` (`apps/projets/urls.py`,
  `services/referentiels.py`) et de `admins/referentiels/(…)` (`apps/platform_admin/urls.py`).
- Routes du back-office pour les **listes et valeurs** et les **modèles** de la plateforme
  (`/admins/decoupage/…`), écriture SUPERVISEUR, lecture SUPPORT.
- Contrat dans `docs/api-decoupage-listes-modeles.md` (routes tenant et back-office).

### Lot 2 — F : Listes et modèles

- `parametres/listes` → « Listes et modèles » : types de projet, modes d'exécution, listes de
  valeurs (plateforme + entreprise, ajout en masse), modèles d'entreprise (créer, modifier,
  personnaliser un modèle plateforme).
- Back-office `admin/parametres/referentiels` : listes et modèles de la plateforme.
- Retrait de `REFERENTIEL_LOTS`, `ComboboxNomLot`, `features/referentiels/lots.ts`.

### Lot 3 — F : onglets de la fiche projet et tableau de démarrage

- Onglets par URL (P5) ; la synthèse garde les cartes actuelles.
- `/projets/[id]/decoupage` quand l'arbre n'existe pas encore : modèle du type de projet,
  niveaux, grille, vérification C-1 à C-7 (bloquants, avertissements), import et export Excel,
  application ; enchaînement depuis `TiroirCreationProjet`.

### Lot 4 — F : vue en arbre et premiers gestes

- Arbre (`GET /projets/{id}/arbre/`), tiroir de case, réglages des niveaux.
- Gestes : ajouter, renommer, mesurer, planifier, clôturer, désactiver / réactiver.
- Permissions dans le périmètre (P7) ; constantes dans `features/habilitations/permissions.ts`.
- Suppression de `/projets/lots-activites`, `/projets/[id]/lots/[lotId]`, `TiroirLot`,
  `TiroirActivite`, `ImportLots`, `ModaleSuppressionLot`, `ModaleSuppressionActivite` ; retrait de
  l'entrée « Lots et activités » du menu.

### Lot 5 — B : dupliquer, import DQE, historique des modifications

- Dupliquer une branche (§13quinquies.1 : structure, unités, quantités, montants, mode,
  titulaire ; ni mesures, ni dates, ni baselines, ni affectations, ni équipes), sous
  `projets.decouper`.
- Import DQE : bilan (mises à jour, nouvelles feuilles, refus motivés) puis application ;
  rapprochement par chemin ; « Prix unitaire » sert au calcul et n'est pas gardé.
- `GET /elements/{id}/historique/` lu dans `JournalAudit`.
- Contrats dans `docs/`.

### Lot 6 — F : gestes avancés

Déplacer avec aperçu des effets, détailler, insérer un niveau, suspendre, rouvrir, dupliquer,
historique des modifications, import DQE.

### Lot 7 — F : affectations, rôles et main-d'œuvre

- Tiroir d'affectation : rôle propre au projet, périmètre choisi dans l'arbre ; « Remplacer » ;
  chef de chantier (`/projets/{id}/chef-chantier/`).
- Page Rôles : case « unique par projet ».
- `/projets/main-oeuvre` (P11).

### Lot 8 — F : équipes dans la fiche projet

Onglet Équipes : équipe rattachée à notre entreprise ou à un partenaire, chef d'équipe, membres
datés pris dans le registre (ajout rapide), avertissement « deux équipes le même jour » ;
affectation d'équipe à une case. Suppression de `/projets/equipe-affectations` et de son entrée
de menu.

### Lot 9 — F : dates et avenants

Trois dates (origine, contractuelle, prévue), dérive affichée, prolongation confirmée
(`projets.prolonger`), reprogrammation d'une case ; onglet Avenants (liste, création, document
joint, retrait sous `projets.avenants_gerer`).

### Lot 10 — B : dépendances

Modèle et migration, routes (ajouter, retirer, lister les liens d'une case), refus des boucles et
des planifications trop tôt, « décaler aussi » dans l'aperçu de reprogrammation, effets de
« détailler » et « désactiver » (P10), journal d'audit. Contrat dans `docs/`.

### Lot 11 — F : dépendances

Section « Prédécesseurs » du tiroir de case ; « décaler aussi » dans la fenêtre de
reprogrammation ; messages de refus.

### Lot 12 — F : avancement

Onglet Avancement : courbe en S et fin estimée (`/projets/{id}/courbe/`), « partiel » et
« indisponible » au lieu d'un faux 0 %, dépassement, « Clôturer ? ».

### Lot 13 — F : journal

`FormulaireRapport` et `SectionsTerrain` refondus sur le contexte du serveur (P14), document du
rapport et son PDF, signature et signataires attendus, file de validation, historique, synthèse.

### Lot 14 — F : alertes, planning, tableau de bord, PDF de la fiche projet

Alertes (causes, jalon manqué), planning en arbre avec flèches de dépendances, tableau de bord
réparé, PDF de la fiche projet sur tous les niveaux (P8).

## 4. Ordre

```
1 ─► 2 ─► 3 ─► 4 ─┬─► 5 ─► 6
                  ├─► 7 ─► 8 ─► 13
                  ├─► 9 ─► 10 ─► 11 ─► 14
                  └─► 12 ──────────────► 14
```

On suit les numéros, un lot à la fois : la machine n'en supporte pas deux (mémoire).

## 5. Reprise d'un lot dans une nouvelle session

1. Lire ce plan (le tableau « Lot ouvert » et le §6), `AGENTS.md` et `CLAUDE.md` des deux dépôts.
2. `git pull` sur `develop` des deux dépôts, puis créer `decoupage/lot-N-<objet>`.
3. Lire seulement ce dont le lot a besoin : les vues et serializers du backend concernés,
   l'adaptateur et les écrans du frontend concernés, et le paragraphe des décisions v1.2 cité.
4. Écrire ou mettre à jour le contrat dans `API-Gestion-Chantier/docs/`.
5. Implémenter ; vérifier (§2, « Vérification sans navigateur ») ; commiter ses seuls fichiers
   (`git add <fichiers>`).
6. Fusionner dans `develop` (`--no-ff`), mettre à jour le §6 et le tableau d'en-tête, **ne pas
   pousser** sans l'accord du développeur.
7. Finir par un compte rendu court : ce qui est fait, ce qui ne l'est pas, ce qui reste à pousser.

## 6. Avancement

| Lot | Dépôts | État | Fusionné le | Poussé le |
|---|---|---|---|---|
| 1 | B | à faire | | |
| 2 | F | à faire | | |
| 3 | F | à faire | | |
| 4 | F | à faire | | |
| 5 | B | à faire | | |
| 6 | F | à faire | | |
| 7 | F | à faire | | |
| 8 | F | à faire | | |
| 9 | F | à faire | | |
| 10 | B | à faire | | |
| 11 | F | à faire | | |
| 12 | F | à faire | | |
| 13 | F | à faire | | |
| 14 | F | à faire | | |

## 7. Exécution dans le cloud (nuit du 30 au 31/10/2026)

Le développeur part ; le travail continue dans deux sessions cloud, une par dépôt, qui tournent en
même temps. Ce qui change par rapport au §2 et au §5 :

- **Rien n'entre dans `develop`.** Une session cloud n'existe que par ce qu'elle pousse ; pousser
  `develop` déploierait en production. Chaque lot est donc **poussé sur sa propre branche**
  `decoupage/lot-N-<objet>`, **créée depuis la branche du lot précédent** de la même session (la
  dernière branche contient tout). Jamais de push sur `develop` ni `main`, jamais `--force`.
- **Backend** : lots 1 → 5 → 10, la première branche part de `develop`.
- **Frontend** : lots 3 → 4 → 7 → 8 → 9 → 12 → 13, aussi loin que possible ; la première branche
  part de `decoupage/plan`. Les lots 2, 6, 11 et 14 attendent le backend de cette nuit.
- **Chaque session enchaîne ses lots seule** et s'arrête au premier blocage, en le décrivant.
- **Compte rendu** : chaque session écrit `docs/compte-rendu-nuit-30-10.md` dans son dépôt, sur sa
  dernière branche (lots faits, branches poussées, vérifications passées ou impossibles, points
  ouverts), et met à jour le §6 de ce plan dans sa copie (frontend).
- Au retour du développeur : contrôle, fusion dans `develop`, push du backend avant le frontend.
