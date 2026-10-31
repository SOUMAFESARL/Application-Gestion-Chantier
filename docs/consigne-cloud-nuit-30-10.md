# Consigne de la session cloud frontend — nuit du 30 au 31/10/2026

## Contexte

Dépôt `SOUMAFESARL/Application-Gestion-Chantier` : frontend Next.js 16 / React 19 / TypeScript /
Tailwind / next-intl du SaaS BTP « CCD Digital », tout en français. Le backend
(`SOUMAFESARL/API-Gestion-Chantier`, branche `develop`, en production) a remplacé le 30/10/2026 le
découpage Lot → Activité par un arbre de cases ; le frontend appelle encore `/lots/` et
`/activites/`, qui n'existent plus. Le développeur a cadré et validé point par point un plan de
14 lots : `docs/plan_decoupage_arbre.md` sur la branche `decoupage/plan`, qui fait foi (décisions
P1 à P17, lots, §5 reprise, §7 exécution dans le cloud). Une autre session cloud fait en parallèle
les lots backend 1, 5 et 10. Personne ne peut répondre à tes questions cette nuit : tranche selon
le plan, ou arrête-toi et décris le blocage.

## Tâche

Fais, dans l'ordre et seul, les lots frontend **3 → 4 → 7 → 8 → 9 → 12 → 13** du plan, aussi loin
que tu peux aller avec soin.

## Avant tout

1. `git fetch origin && git checkout decoupage/plan` (la branche par défaut est `main`, ne
   travaille pas dessus). Lis le plan en entier, puis `AGENTS.md` et `CLAUDE.md` du dépôt, et les
   skills `.agents/skills/brancher-api` et `revue-frontend` s'ils sont présents.
2. `npm ci`.
3. **Le code du backend est indispensable** pour confronter les contrats :
   `git clone --depth 1 -b develop https://github.com/SOUMAFESARL/API-Gestion-Chantier.git ../API-Gestion-Chantier`
   (ou `gh repo clone`). Lis-y les vues, serializers et selectors utiles (`apps/projets/urls.py`,
   `views/decoupage.py`, `selectors/arbre_api.py`, `serializers/decoupage.py`,
   `views/affectation.py`, `views/equipe.py`, `views/avenants.py`,
   `apps/chantier/urls_journal.py`, `services/journal.py`, `apps/core/registre_permissions.py`)
   et `docs/decoupage/decisions-v1.2.md`. **Si le clone est refusé, n'écris aucun écran à
   l'aveugle** : écris le compte rendu (voir la fin) et arrête-toi.

## Règles (fixées par le développeur)

- **Contrat avant écran** : au début de chaque lot, compare le serializer Django à l'adaptateur,
  champ par champ.
- **Style de branchement** : celui de `features/projets/adaptateur.ts`. Un seul fichier par
  domaine parle au serveur (`features/<domaine>/adaptateur.ts`) ; types de transport
  `interface Charge*` privés en `snake_case` ; fonctions `vers*` / `versCharge*` ; fonctions
  exportées en français à l'infinitif (`lireArbre`, `creerElement`…) qui renvoient des types de
  `types.ts` ; client `api.lire/creer/modifier/supprimer` de `@/lib/api` (`apiAdministration`
  pour le back-office) ; liste nue ou paginée tolérée ; clés React Query dans `cles.ts`,
  invalidation après écriture ; erreurs sur `ErreurApi.code`, jamais sur le message ; règles dans
  `regles.ts`, schémas zod dans `validations.ts`.
- **Aucune chaîne en dur** : textes dans `messages/fr.json` (next-intl, `t()`), français seul.
  Tailwind seul. Composants existants (`components/ui/`, `TableauListe`, tiroirs, fenêtres) ; le
  prototype HTML et les maquettes ne sont qu'une inspiration, ni style ni disposition.
- **Garder l'existant** autant que possible ; ne modifier que si nécessaire.
- Grille et arbre sur `@tanstack/react-table`, courbe sur `recharts` (déjà installés) :
  **aucune nouvelle dépendance**.
- Permissions : boutons grisés avec la permission manquante en infobulle ; montants « ••• » sans
  `projets.voir_montants` ; constantes des nouveaux codes dans
  `features/habilitations/permissions.ts`.
- Téléphone : la saisie du journal reste utilisable à 390 px ; tableau, arbre et planning pour
  ordinateur et tablette.
- **Vérification sans navigateur** : `npm run lint` et `npm run typecheck` doivent passer à chaque
  lot. Aucune capture, aucun serveur lancé.

## Branches et push (impératif)

- Un lot = une branche créée depuis la branche du lot précédent : `decoupage/lot-3-onglets-tableau`
  depuis `decoupage/plan`, puis `decoupage/lot-4-arbre`, `decoupage/lot-7-affectations-main-oeuvre`,
  `decoupage/lot-8-equipes`, `decoupage/lot-9-dates-avenants`, `decoupage/lot-12-avancement`,
  `decoupage/lot-13-journal`.
- **Pousse chaque branche de lot** quand son lint et son typecheck passent. **Ne pousse jamais
  `develop` ni `main`** (un push de `develop` déploie en production), ne fusionne rien dans
  `develop`, jamais `--force`.
- `git add <fichiers>`, jamais `git add .`. Le dossier `docs/` est ignoré par `.gitignore` mais
  ses plans sont suivis : `git add -f docs/<fichier>`.
- Commits en français (`feat(decoupage): …`), terminés par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Mets à jour le §6 du plan (état, branche) à chaque lot.

## Contenu des lots (le détail est dans le plan)

- **3** : onglets de la fiche projet portés par l'URL (`/projets/[id]` synthèse avec les cartes
  actuelles, `/decoupage`, `/avancement`, `/equipes`, `/avenants`) ; tableau de démarrage sur
  `/projets/[id]/decoupage` quand l'arbre n'existe pas (`decoupage_cree` du projet) : modèle du
  type de projet, niveaux, grille, vérification C-1 à C-7, import et export Excel analysés par le
  serveur, application ; enchaînement depuis `TiroirCreationProjet`.
- **4** : arbre (`GET /projets/{id}/arbre/`), tiroir de case, réglages des niveaux dans l'onglet
  Découpage ; gestes ajouter, renommer, mesurer, planifier, clôturer, désactiver/réactiver ;
  suppression de `/projets/lots-activites`, `/projets/[id]/lots/[lotId]`, `TiroirLot`,
  `TiroirActivite`, `ImportLots`, `ModaleSuppressionLot`, `ModaleSuppressionActivite` et de
  l'entrée de menu. Ne touche pas encore à `REFERENTIEL_LOTS` / `ComboboxNomLot` (lot 2, plus
  tard) sauf si un écran supprimé était leur seul usage.
- **7** : affectation d'un collaborateur avec rôle propre au projet et périmètre choisi dans
  l'arbre, « Remplacer », chef de chantier ; case « unique par projet » sur la page Rôles ; page
  Projets → Main-d'œuvre (`/projets/main-oeuvre`, lecture `projets.lire`, écriture
  `projets.main_oeuvre_gerer`).
- **8** : équipes dans l'onglet Équipes (partenaire, chef, membres datés pris dans le registre
  avec ajout rapide, avertissement deux équipes le même jour), affectation d'équipe à une case avec
  héritage ; suppression de `/projets/equipe-affectations` et de son entrée de menu.
- **9** : trois dates, dérive « +N j sur l'origine, dont M accordés », prolongation confirmée,
  reprogrammation d'une case ; onglet Avenants.
- **12** : onglet Avancement, courbe en S et fin estimée, « partiel » et « indisponible »,
  dépassement, « Clôturer ? ».
- **13** : journal refondu sur le contexte du serveur (tâches de la partie, équipes et présents,
  heures, production par ouvrier), signataires attendus, document et PDF du rapport, file de
  validation, synthèse. Le mode hors connexion est hors chantier.

## À la fin

Écris `docs/compte-rendu-nuit-30-10.md` (ajouté avec `-f`) sur la dernière branche poussée : lots
faits, branches poussées, résultats de lint et typecheck, écarts trouvés entre backend et plan,
décisions prises seul, points ouverts. Pousse-le. Termine par un résumé court dans ton dernier
message. Si un lot bloque, pousse ce qui est fait (s'il passe lint et typecheck), écris le compte
rendu et arrête-toi.
