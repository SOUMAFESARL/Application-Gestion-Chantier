# Plan d'alignement frontend ↔ backend

Ouvert le 13 octobre 2026. Objet : brancher les API de `API-Gestion-Chantier` sur
ce frontend, et modifier les interfaces là où c'est nécessaire.

**Règle de conduite : un seul lot ouvert à la fois, du premier au dernier.**

| Lot ouvert | État |
|---|---|
| Lot 1 — Journal de chantier | Tâche 1.1 terminée le 13/10/2026 ; tâche 1.2 à ouvrir. Le lot 0 reste à fermer : sa tâche 0.1 attend de la mémoire sur le poste |

---

## 1. D'où vient ce plan

**La Sprint Review du 10/10/2026 n'a pas clôturé le Sprint 3.** Le journal de
chantier, réalisé côté API, n'a pas pu être démontré. La rétrospective du 12/10
en donne la cause racine : le branchement des interfaces sur les API n'a eu lieu
que dans les deux derniers jours, sans gestion de versions maîtrisée ni créneau
de tests.

Ce plan en tire trois conséquences :

1. **Le journal de chantier passe en tête** : sa démonstration est due au début
   du Sprint 4, qui démarre le 14/10/2026.
2. **Les douze user stories issues des retours du Directeur Général** sont
   rattachées au lot du domaine qu'elles modifient, au lieu d'être traitées à part.
3. **Les accords d'équipe deviennent les règles d'ouverture et de fermeture
   d'un lot** (§3).

**L'état mesuré le 13/10/2026**, par comparaison de chaque appel du frontend aux
174 routes réelles du backend :

| Domaine | Appels | Routes absentes du backend |
|---|---|---|
| Auth, configuration, invitations, plateforme, tiers | 16 | 0 |
| Administration | 26 | 1, plus 1 verbe non servi |
| Projets | 24 | 5 (`encadrement`, `membres` d'équipe) |
| Rôles | 7 | 2 (`permissions-roles` par projet) |
| Chantier | 9 | 2 (`syntheses`, `journal/{id}/relancer`) |
| Tableau de bord | 1 | 0 |
| Abonnement | 3 | 2 (`paiements`, `souscription`) |
| Stocks | 21 | 21 — aucune application `stocks` côté backend |

Cette comparaison porte sur les routes et les verbes, **pas sur la forme des
données**. Le contrôle champ par champ se fait à l'ouverture de chaque lot.

**La comparaison inverse** — les routes que le backend sert et qu'aucun code du
frontend n'appelle — en trouve environ 80, une fois retirés les alias
(`/admin/*`, `/rapports/*`) et les faux positifs. Elles sont réparties ci-dessous
dans le lot de leur domaine, sous « Servi, jamais appelé ». Pour chacune, le lot
décide : écran à créer, écran existant à compléter, ou route sans usage.

---

## 2. Les lots

### Lot 0 — Socle

| Tâche | État |
|---|---|
| **0.1** Environnement local | `.env.local` vise le backend local, en hôte unique comme la production (l'ancien, branché sur la production, est dans `.env.local.sauvegarde-production`). Migrations locales appliquées. Connexion du compte de démonstration vérifiée. **Bloqué** : `next dev` s'arrête sur « Fatal process out of memory » dès le deuxième écran — le poste n'a plus de mémoire validable |
| **0.2** Script de comparaison | Fait : `scripts/comparer_routes_frontend.py` dans le dépôt backend, dans les deux sens, filtrable par `--domaine` |
| **0.3** `CLAUDE.md` | Fait : `app/(entreprise)/`, chemin du backend, existence de l'API du back-office |

Pour lancer les deux serveurs : backend `python manage.py runserver 8000`,
frontend `npm run dev`, puis ouvrir `http://localhost:3000`. **Comme en
production, il n'y a pas de sous-domaine** : `.env.local` désigne un hôte
unique, `http://localhost:8000`, et l'entreprise voyage dans le jeton de
connexion. Vérifié le 13/10/2026 : connexion sur `localhost:8000`, jeton
portant `schema: demo`, `/projets/` et `/tableau-de-bord/` en 200.

Les 18 routes absentes du schéma OpenAPI, dont 15 du module projets, sont
reportées au lot 4.

### Lot 1 — Journal et rapports de chantier

**À démontrer au début du Sprint 4.** Cadrage du 13/10/2026 : le backend du
journal est complet (33 tests passent) et a été écrit pour correspondre à
l'adaptateur ; le frontend ne l'appelle pas, ses deux interrupteurs étant figés
sur « simulé ».

| Tâche | Contenu | État |
|---|---|---|
| **1.1** Données locales | Module chantier activé pour `demo` ; projet CHANT-2026-001 doté d'un chef de chantier, d'un conducteur de travaux, d'un chef de projet, et de quatre activités sur ses deux lots | **Fait le 13/10/2026.** `GET /chantier/journal/` répond 200 (144 lignes), la préparation de saisie aussi |
| **1.2** Saisie | Les 5 appels de saisie au réel ; suppression de `simulationSaisie.ts` reportée à la 1.7, le journal simulé s'en servant encore | **Fait le 14/10/2026.** API : brouillon, sauvegarde, soumission et refus attendus vérifiés avec le compte chef de chantier. Écran : formulaire ouvert sur la préparation réelle, brouillon enregistré (201), note relue du serveur après rechargement sans copie locale — avec le compte DG, le chef de chantier ne voyant pas encore son chantier (voir 1.2 bis). Défaut corrigé au passage : les habilitations du profil arrivent en capitales |
| **1.2 bis** Affectations visibles | Le projet renvoyé par le backend porte désormais `chef_projet`, `conducteurs_travaux` et `chefs_chantier`, construits depuis les affectations en vigueur, sans requête par projet (option 1, décision du 14/10/2026) | **Fait côté backend le 14/10/2026** (`9c81f33`, 5 tests). Vérifié par l'API : chacun des trois comptes de rôle figure dans l'encadrement de CHANT-2026-001. **Vérifié à l'écran le 14/10/2026** : le chef de chantier voit son chantier et ses rapports à rédiger |
| **1.3** Journal et rapport | `lireJournal` et `lireRapport` au réel ; valeurs vides acceptées (température, humidité, prix masqué, photo sans position) | **Fait le 14/10/2026.** API : journal et rapport conformes à l'adaptateur pour les quatre rôles. Écran, avec le chef de chantier : journal réel (« en attente de validation : 1 »), rapport du 12/10 affiché en entier avec son circuit. La relance et la synthèse restent simulées jusqu'aux tâches 1.5 et 1.6 |
| **1.4** Validation | `validerRapport`, `approuverRapport`, `rejeterRapport` dans l'adaptateur ; bandeau de signature sur le rapport, visible du seul signataire attendu | **Fait le 14/10/2026.** Écran : le conducteur de travaux valide le rapport du 12 puis rejette celui du 13 (motif de 20 caractères exigé, bouton désactivé en deçà) ; le chef de projet approuve le 12. Après rechargement : « Approuvé CP », trois signatures horodatées ; le chef de chantier retrouve le 13 rejeté avec son motif **Règle de signature arrêtée le 14/10/2026 (option 3)** : signe celui qui tient la fonction sur le chantier ; le DG signe l'étape dont il tient la fonction (vérifié : DG chef de projet désigné de CHANT-2026-002 approuve, sans bandeau ailleurs, refusé à l'étape CT), le super-administrateur de la plateforme ne signe jamais. Même règle côté backend |
| **1.5** Relance | Route backend `relancer` par e-mail, une relance par ligne et par jour, relance automatique à 17 h 30 (Celery Beat et commande pour le cron cPanel) | **Fait le 14/10/2026.** 9 tests backend. Écran : le DG relance le chef de chantier de CHANT-2026-001, e-mail rendu en console, « Relancé à 09:31 » conservé après rechargement. **Reste ouvert** : l'écran promet aussi une alerte du CT et du CP à 18 h et une notification interne, non implémentées |
| **1.6** Synthèse | Synthèse complète, demandée le 14/10/2026 : calcul par Django, rédaction et signature du CT, approbation ou rejet du CP | **Fait le 14/10/2026.** Backend : 5 routes `/chantier/syntheses/…`, modèle `SynthesePeriodique` (migration 0007), 14 tests. Le calcul est figé à la signature du CT. Seules les semaines (lundi → vendredi) et les mois clos se signent ; une période personnalisée se consulte. Frontend : panneau `CircuitSynthese` (rédaction du CT, décision du CP), bandeaux selon le statut, état de chaque synthèse dans les raccourcis. Circuit complet vérifié sur la base locale avec les comptes CT, CP et DG (brouillon caché au CP, DG refusé, rejet puis nouvelle signature, approbation, réécriture refusée). Le masquage du matin (`SYNTHESE_DISPONIBLE`) reste en place comme interrupteur, désormais ouvert |
| **1.7** Clôture | Suppression de `simulationJournal.ts` et `simulationSaisie.ts`, README du domaine | **Fait le 14/10/2026** avec la 1.6 : plus aucun appel du journal n'est simulé, et l'agrégation dupliquée côté frontend (`agregerSynthese`) a disparu avec la simulation |

Décisions du 13/10/2026 :

- la **synthèse périodique** est masquée pour la démonstration, sa route backend
  vient après — *dépassé le 14/10/2026 : la synthèse est livrée entière dans le
  lot 1* ;
- la **validation** conducteur de travaux / chef de projet fait partie du lot ;
- les **photos restent encodées dans le rapport, en base**, pour ce lot : c'est
  une dette, à traiter avec le stockage objet (US-006) ;
- le **module chantier doit être activé en production** pour chaque entreprise,
  sans quoi tout appel au journal répond 403 — à vérifier avant la démonstration.

Constats à reprendre ailleurs :

- **35 tests des modules projets et chantier échouent déjà sur `develop`** (relevé du 14/10/2026), sans lien avec ce chantier. La CI ne lance que `tests/acceptation`, si bien qu'ils ne bloquent aucun déploiement ;

- l'activation d'un module par entreprise porte sa logique dans la vue
  (`ActiverModuleClientPlateformeView`), pas dans un service ;
- en local, cette activation tente d'envoyer un vrai courriel au directeur de
  l'entreprise : le poste est configuré avec un serveur SMTP réel.

### Lot 2 — Back-office de la plateforme

- Deux écarts : `POST /auth/mot-de-passe/oublie/` n'existe pas ;
  `PATCH /admins/clients/{id}/` n'est pas servi.
- Écrans à créer pour des routes déjà servies : messagerie, inscriptions à
  approuver, journal de la plateforme, permissions, modules d'un client.
- **US 1.1** — suppression d'une entreprise avec motif obligatoire.
- Suppression de `lib/api/simulationAdministration.ts`.
- Le stash « travail local ecarte avant pull du 2026-10-13 » contient une partie
  de ces écrans.
- **Servi, jamais appelé** : assistance à une entreprise (`entreprises/{id}/assistance/`,
  `utilisateurs/`, `assistance/deconnexion/`) ; mot de passe administrateur
  (`mot-de-passe/demande|verifier|reinitialiser/`) ; activation d'un module par
  client ; aperçu avant suppression ; `verifier-acces/`.

Cadrage du 14/10/2026. En production le back-office appelle déjà le backend :
`simulationAdministration.ts` ne sert qu'en mode démonstration. Décisions :
**pas d'écran des inscriptions à valider** (le backend ne met jamais une demande
dans l'état `A_VALIDER`) ; **l'assistance à une entreprise est reportée** à un
lot dédié ; **motif de suppression obligatoire, 20 caractères au moins,
journalisé** ; la suppression reste coupée en production
(`SUPPRESSION_ENTREPRISE_ACTIVEE`) tant que l'utilisateur ne l'allume pas.

| Tâche | Contenu | État |
|---|---|---|
| **2.0** Droits superviseur / support | Dérivation serveur du vrai rôle (`SUPERVISEUR` / `SUPPORT`) dans `/admins/moi/` et `/admins/connexion/`. Contrôle d'écriture strict au superviseur (`exiger_superviseur`). Frontend aligné : affichage du vrai rôle, actions d'écriture masquées ou grisées pour le support. | **Fait le 14/10/2026.** Vérifié : superviseur peut agir, support consulte en lecture seule sans pouvoir déclencher d'écriture. |
| **2.1** Mot de passe oublié | L'écran appelait `/auth/mot-de-passe/oublie/` (inexistant) : il appelle `/admins/mot-de-passe/demande/`. Page `/admin/mot-de-passe/definir` créée (cible du lien de l'e-mail) : l'écran des entreprises, paramétré par `espace`, vérifie et consomme le jeton sur `/admins/…` | **Fait le 14/10/2026.** Chaîne vérifiée par le backend local : demande 202 identique pour une adresse inconnue, e-mail avec le lien `/admin/mot-de-passe/definir#jeton=…`, vérification 200 (motif `OUBLI`, retour `/admin/connexion`), jeton faux 410. |
| **2.2** Date de fin d'abonnement | Endpoint `PATCH /admins/clients/{id}/abonnement/` avec modification de l'échéance et motif obligatoire (≥ 10 caractères) journalisé. Modale `ModaleFinAbonnement` côté frontend avec vérification des bornes. | **Fait le 14/10/2026.** Vérifié : modification de date d'échéance réussie, motif tracé au journal, rafraîchissement réactif du cache. |
| **2.3** Modules d'un client | Module obligatoire non désactivable (`PROJETS`) côté backend (400 `module_obligatoire`). Modale et cartes de gestion des modules par entreprise côté frontend avec interrupteurs clairs. | **Fait le 14/10/2026.** Vérifié : le module Projets ne peut être désactivé ni par l'API ni par l'interface, les autres basculent sans perte de données. |
| **2.4** Suppression (US 1.1) | 8 barrières strictes au serveur (superviseur, non protégée, interrupteur activé, suspendue, motif ≥ 20 car., confirmation slug, dump schéma bloquant, notification préalable DG). Carte « Zone dangereuse » et modale complète côté frontend. | **Fait le 14/10/2026.** Vérifié : refus si non suspendue, refus si motif court, confirmation par slug, dump `.dump` et `.json` compagnon générés avant suppression. |
| **2.5** Messagerie | Réglage SMTP plateforme et test d'envoi d'e-mail en direct avec diagnostic précis des anomalies de connexion / chiffrement. | **Fait le 14/10/2026.** Vérifié : écran de messagerie fonctionnel, test SMTP interactif avec rapport visuel immédiat. |
| **2.6** Journal de la plateforme | Journalisation de toutes les actions super admin au schéma public. Filtres par date, agent, entreprise, type d'action, pagination serveur et export CSV / XLSX. | **Fait le 14/10/2026.** Vérifié : consultation, filtrage multi-critères et export du journal conformes. |
| **2.7** Catalogue des permissions | Catalogue complet des permissions de la plateforme, affectation aux modules, activation/désactivation, filtres et export. | **Fait le 14/10/2026.** Vérifié : listing, recherche, tri et consultation des permissions sans simulation. |
| **2.8** Clôture | Retrait de `simulationAdministration.ts`, extraction de `simulationParametresPublics.ts` pour l'espace entreprise, adaptateur d'administration 100% réel. | **Fait le 14/10/2026.** Vérifié : 0 branche simulée dans l'adaptateur admin, build et typage validés. |

*Lot 2 fusionné dans `develop` des deux dépôts le 14/10/2026, **non poussé** : push et vérification finale par le développeur.*

### Lot 3 — Paramétrage et accès de l'entreprise

- Rôles, collaborateurs, invitations, identité de la plateforme : retrait des
  simulations résiduelles.
- `permissions-roles` par projet : absent du backend, à trancher.
- **US 2.1** — plusieurs numéros de contact par entreprise.
- **US 2.2** — affichage du logo de l'entreprise.
- **Servi, jamais appelé** : suspension et réactivation d'un collaborateur ;
  liste et détail des invitations ; catalogue `/modules/` ; `/entreprise/` ;
  changement de mot de passe du profil (`auth/profil/mot-de-passe/`) ; étapes
  de l'assistant de configuration (`etapes/{code}/passer|valider/`,
  `recapitulatif/`, `terminer/`) ; suite de l'inscription (`activer/`,
  `etat/{suivi}/`, `verifier/`), à contrôler car ce domaine construit ses
  chemins autrement.

### Lot 4 — Gestion de projet

- **US 3.1** durée en mois et années · **US 3.3** budget d'une activité ·
  **US 3.4** cohérence des budgets activité / lot / projet · **US 3.5** date de
  début dans le passé · **US 3.6** et **3.7** dates obligatoires avant de créer
  un lot ou une activité · **US 3.8** prolongation des dates · **US 3.9**
  modification du budget.
- **US 3.2** — protection du nom du projet : **à discuter**, non planifiable
  tant que la règle n'est pas arbitrée.
- Équipes et encadrement : alignement sur le modèle d'affectations du backend.
- Backend : déclarer au schéma OpenAPI les 18 routes qui en sont absentes.
- **Servi, jamais appelé** : santé du projet (`sante/`, `detail/`,
  `historique/`) ; reprogrammation et historique des dates, pour le projet, le
  lot et l'activité ; journal et motifs de report ; activation d'un lot ou
  d'une activité ; import de lots côté serveur et son modèle (le frontend lit
  aujourd'hui le fichier Excel lui-même) ; affectations et collaborateurs
  affectables ; statistiques d'équipes ; détail et modification d'un tiers ;
  référentiel des villes (le frontend embarque sa propre liste).

### Lot 5 — Tableau de bord

- Branchement de `/tableau-de-bord/`.
- Les trois validations (achats, avenants, bons de paiement) n'ont pas de
  backend : à masquer ou à reporter.

### Lot 6 — Abonnement et facturation

- Plans, factures, paiement CinetPay.
- **Servi, jamais appelé** : `/plans/`, `/factures/` et leur PDF,
  `cinetpay/initier|statut|annuler/`, `abonnement/notifications/`.
- Dépend du prix des plans, non arbitré (point A7 du projet).

### Lot 7 — Tests de bout en bout et clôture

- Les trois tâches de test non exécutées au Sprint 3 : tests des règles métier,
  revue technique et d'intégration, recette finale backend.
- **Deux jours réservés avant la Sprint Review.**
- Suppression du drapeau `NEXT_PUBLIC_API_SIMULE`, de `lib/api/simulation.ts` et
  du bandeau de simulation.
- Reprise des skills `brancher-api` et `revue-frontend`, écrits le 13/10/2026,
  avec ce que les lots auront réellement appris.

### Hors chantier — Stocks

Aucune application `stocks` n'existe côté backend : c'est un développement neuf,
pas un alignement. L'écran reste simulé.

---

## 3. Un lot est une suite de tâches

**Chaque tâche suit le cycle du skill `sprint-task-lifecycle`**, et chaque
branchement le skill `brancher-api` (`.agents/skills/` de ce dépôt). Le lot ne remplace pas ce cycle : il range les tâches dans
l'ordre.

### À l'ouverture du lot

1. `git pull` sur les deux dépôts.
2. Comparer les contrats champ par champ : ce que l'adaptateur attend, ce que
   l'API renvoie réellement.
3. **Découper le lot en tâches**, une par écart ou par écran. Une tâche tient
   dans une branche et se démontre seule.

### Pour chaque tâche

| Étape du cycle | Dans ce chantier |
|---|---|
| **1. Cadrage**, sans modifier de fichier | Lire l'adaptateur, l'écran et la vue Django. Dire ce qui est en place, ce qui manque, ce qui s'écarte. Restituer en situation, complication, question, orientation, puis le résultat vu par l'utilisateur. Poser les arbitrages : par défaut le frontend s'aligne sur le backend ; une route n'est ajoutée au backend que si l'écran perdrait une fonction |
| **2. Plan, dans le chat** | Fichiers dans l'ordre, contrat à tenir, deux ou trois pièges propres à la tâche avec le test qui les révèle. **L'agent écrit le code de tout ce chantier** — décision du 13/10/2026 |
| **3. Branche** | `feature/<nom-court>` depuis `develop`, dans chaque dépôt touché |
| **4. Implémentation et tests** | Frontend : style du §4, puis `npm run lint`, `npm run typecheck`, et vérification à l'écran contre le backend local — il n'y a pas de lanceur de tests. Backend : tests écrits avec le code, `ruff check` et `pytest` sur le module |
| **5. Intégration** | Commit conventionnel, `merge --no-ff` dans `develop`, branche supprimée. Résumé de ce qui est livré, vérifié et non vérifié, puis la question « Homo Docens » |

### Une tâche est terminée quand

1. La donnée est **persistée en base**, vérifiée après rechargement de la page.
2. L'appel répond en réel, **vérifié à l'écran**.
3. Les validations de l'étape 4 passent.

### Le lot est fermé quand

1. Toutes ses tâches sont terminées et fusionnées dans `develop`.
2. Le fichier de simulation du domaine est supprimé, pas seulement désactivé.
3. Le script de comparaison ne signale plus aucun écart sur le domaine.

**Le push se fait quand le développeur le demande.** Côté frontend, pousser
`develop` à la fermeture de chaque lot est recommandé : cela ne déploie rien, et
c'est ce qui évite de diverger à nouveau. Côté backend, un push de `develop`
déploie en production.

---

## 4. Méthode de branchement

**Un nouveau branchement reprend la méthode et le style des branchements
existants.** La référence est `features/projets/adaptateur.ts`.

- `features/<domaine>/adaptateur.ts` est le seul fichier du domaine qui sait que
  le serveur existe.
- Types de transport `Charge*`, privés au fichier, en `snake_case`.
- `vers*` traduit le serveur vers le domaine, `versCharge*` l'inverse ; les
  écrans ne manipulent que les types de `types.ts`.
- Fonctions exportées en français, verbe à l'infinitif : `listerProjets`,
  `lireProjet`, `creerProjet`, `modifierProjet`.
- Client `api`, `apiAdministration` ou `apiPlateforme` de `@/lib/api`.
- Une liste peut arriver nue ou paginée : les deux formes sont acceptées.
- Clés React Query dans `cles.ts` ; invalidation après chaque écriture.
- Une erreur se traite sur `ErreurApi.code`, jamais sur son message.
- Un groupe de routes passe de `routesSimulees(false)` à `routesSimulees(true)`
  le jour où Django le sert ; son fichier `simulation*.ts` disparaît ensuite.
