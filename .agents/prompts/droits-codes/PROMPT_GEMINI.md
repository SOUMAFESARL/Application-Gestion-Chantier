# Suite du chantier « plus de niveaux » — prompt pour Gemini (Antigravity)

Rédigé le 16/10/2026 par Claude, qui a fait la première partie et passe la main.
**Lis ce fichier en entier avant toute commande.** Toutes les décisions sont prises ; en cas de doute,
**arrête-toi et demande au développeur**, n'invente aucune règle.

Dépôts :
- backend : `C:\Users\Administrator\Desktop\SOUMAFE\Gestion_Chantier\05_Developpement\API-Gestion-Chantier`
- frontend : `C:\Users\Administrator\Desktop\SOUMAFE\Gestion_Chantier\05_Developpement\Application-Gestion-Chantier`

Lectures obligatoires : `AGENTS.md` (backend), `CLAUDE.md` (frontend), puis ce fichier.

---

## 1. La décision du développeur (16/10/2026)

> **Il n'y a plus de niveaux sur les permissions.** Les permissions sont celles que **chaque module
> définit** au catalogue ; leur nombre varie d'un module à l'autre. Plus de « lecture / saisie /
> validation », plus de « Aucun / Lecture / Saisie / Validation », plus de niveau 0-3, plus
> d'« accès par défaut ». **C'est valable aussi pour le super admin (back-office).**

Un droit = un **code de permission** (`projets.creer`, `chantier.valider`…). Rien d'autre.

> **Précision du développeur, 16/10/2026 — ce n'est pas un point à discuter :** « Enlever toute la
> logique concernant les niveaux. On est sur les permissions uniquement. Les permissions sont fonction
> des modules. Les niveaux ne servent à rien. Même si les tests des lots 1 à 4 en dépendent, tu les
> modifies pour qu'ils tiennent compte de la nouvelle façon de travailler. »
>
> Cette phrase **vaut accord écrit** pour modifier les tests d'acceptation `tests/acceptation/lot1` à
> `lot4` **dans la seule mesure** où ils testent des niveaux. Ne rien garder « par prudence » : un
> niveau laissé quelque part est un défaut.

## 2. Ce qui est déjà fait (par Claude) — à ne pas refaire

Branche frontend **`feature/droits-codes-seuls`**, commit `8d06823`, **non fusionnée, non poussée** :

- `features/habilitations` : `Droits` = `{ estDirection, codes, portee }` ; `peut(module, acces)`,
  `Droits.permissions`, `accesDepuisCodes` supprimés ; routes par code (`CONDITIONS_ROUTES`,
  `permission("projets.lire")`…) ; `peutRelancerJournal` (`chantier.valider`) ; signatures CT
  (`chantier.valider`) et CP (`chantier.rediger`) ; `SiDroit` prend un `code`.
- `features/roles` : raccourcis, `AccesModule`, `NiveauAcces`, `ACCES_MODULE`, `MODULES_CCD`,
  `RACCOURCIS`, `ModuleRole.niveau`, `SelecteurAcces.tsx` (pastilles L·S·V et légende) **supprimés** ;
  nouvelle règle `permissionsDuModule(role, codeModule)`.
- `/parametres/roles` : plus de légende ; chaque cellule de la matrice affiche le **nombre réel** de
  permissions accordées sur le module (`roles.nbPermissions`, ICU : « Aucune / 1 permission /
  N permissions »), liste des libellés au survol ; l'éditeur ne garde que les cases à cocher.
- Profil (`app/(entreprise)/profil/EcranProfil.tsx`) : le bloc « Mes habilitations » liste les
  permissions détenues module par module (`GET /modules/`), plus les niveaux.
- Tableau de bord, stock, rapports : `peutCode("finance.valider")`, `"stocks.ecrire"`, etc.
- `dev/rolesTest.ts` : rôles de test en codes explicites.
- `messages/fr.json` : `roles.acces`, `roles.raccourcis`, `roles.modules`, `roles.legendeTitre`
  supprimés ; `roles.editeur.aide` réécrit.
- `npm run lint` et `npx tsc --noEmit` : **zéro erreur** sur ce commit.

Le backend n'a **pas** été modifié pour ce chantier (voir §3.2).

## 3. Ce qui reste à faire, dans l'ordre

### 3.1 Frontend, back-office (super admin) — branche `feature/droits-codes-seuls` (la même)

```bash
git checkout feature/droits-codes-seuls
```

Chercher tout reste du modèle par niveaux dans le back-office :

```bash
grep -rnEi "acces_?par_?defaut|accesParDefaut|niveau|lecture|saisie|validation|AccesModule|ACCES_MODULE" app/\(admin\) features/administration --include=*.ts --include=*.tsx
```

Pour chaque résultat, **ne retirer que ce qui décrit un niveau d'accès d'une permission ou d'un
module** (attention : « validation » d'un formulaire zod, `validations.ts`, « niveau » d'un blocage ou
de santé ne sont **pas** concernés). Cas attendus :
- modules d'un client (`ModulesClient`, adaptateur `ChargeModuleClient` / `versModuleClient`) : s'ils
  affichent ou envoient un accès par défaut ou un niveau, le retirer ;
- textes de `messages/fr.json` sous `administration.*` qui parlent d'« accès par défaut », de
  « Lecture / Saisie / Validation » d'un module : les retirer ou les réécrire en termes de
  permissions ;
- tout commentaire de code devenu faux.

Puis, dans tout le frontend, vérifier qu'il ne reste rien :

```bash
grep -rnE "AccesModule|ACCES_MODULE|NiveauAcces|accesNormalises|permissionsNormalisees|basculerAcces|rangAccesMax|accesDepuisNiveau|SelecteurAcces|LegendeAcces|Raccourci|peut\(droits, \"" app features components dev lib --include=*.ts --include=*.tsx
```

→ **aucun résultat** attendu.

### 3.2 Backend — branche `fix/droits-sans-niveaux` (à créer depuis `develop`)

**But : il ne reste plus un seul niveau dans le backend.** Le droit effectif d'un rôle est la liste
des permissions cochées (`RoleModulePermission.permissions_catalogue`), rien d'autre — c'est déjà ce
que lit `permissions_effectives` (`apps/core/droits.py`).

#### a) Inventaire (à faire en premier, à recopier dans le compte rendu)

```bash
grep -rnE "niveau|NiveauAcces|niveaux_supportes|acces_par_defaut|_calculer_niveau|LECTURE|ECRITURE|VALIDATION|SUPPRESSION|\"lecture\"|\"saisie\"|\"validation\"|habilitations" apps config tests --include=*.py | grep -v "/migrations/"
```

Classer chaque résultat : **niveau d'accès d'une permission** (à supprimer) ou **autre sens**
(« niveau » d'un blocage de chantier, de santé, de vigilance budgétaire… : ne pas toucher).

#### b) Ce qui disparaît

1. **Le modèle** : le champ `RoleModulePermission.niveau` (`apps/accounts/models/role.py`) et l'énumération
   `NiveauAcces` (`apps/core/enums.py`) s'ils ne servent plus qu'aux niveaux.
   - Migration : `.\.venv\Scripts\python.exe manage.py makemigrations accounts` (une seule migration,
     nommée `suppression_niveaux`). `apps.accounts` est **à la fois partagée et tenant** : la migration
     s'applique à tous les schémas par `migrate_schemas` — en local :
     `.\.venv\Scripts\python.exe manage.py migrate_schemas`. En production, `passenger_wsgi.py`
     l'applique au démarrage.
   - Aucune migration de données n'est nécessaire : on supprime une colonne ; les permissions cochées
     restent.
2. **Les calculs et alias** : `_calculer_niveau_scalaire`, la traduction « lecture → `.lire`, saisie →
   `.ecrire`, validation → `.valider` » de `_normaliser_permissions_modules`
   (`apps/accounts/services/roles.py`) — l'API des rôles n'accepte plus que **des codes** :
   `permissions: string[]` (liste complète), ou `permissions_modules: {module: [codes]}`. Un alias
   `lecture`/`saisie`/`validation` reçu → **400** « Permission inconnue : « lecture ». » (même message
   que le catalogue, `apps/platform_admin/services/catalogue.py`).
3. **Les matrices par défaut des rôles système** : là où elles s'écrivent en niveaux
   (`initialiser_roles_par_defaut`, tables `{"projets": 2, …}` dans `apps/accounts/services/roles.py`),
   les réécrire en **listes de codes**, en gardant exactement les droits effectifs actuels (relever les
   codes que chaque rôle système détient aujourd'hui avant de réécrire, par la base locale `demo`, et
   les recopier).
4. **Les vérifications par niveau** : tout `rmp.niveau == …`, `niveau >= …` dans le code de droits
   (ex. `apps/core/permissions.py` vers la l. 421) devient une vérification de codes.
5. **L'API** :
   - rôles (`apps/accounts/serializers/role.py`) : plus de `niveau` dans `modules[]`, plus d'alias dans
     `permissions_modules` (seulement des codes) ;
   - profil (`apps/accounts/services/profil.py`, `serializers/profil.py`) : plus de `habilitations` ;
     `permissions` (codes) et `portee` restent ;
   - `GET /modules/` (`apps/referentiels/views/module.py`, `serializers/module.py`) : plus de
     `niveaux_supportes` ni `acces_par_defaut` ;
   - back-office (`apps/platform_admin/serializers/modules.py`) : plus de champ `acces_par_defaut`
     (ni en entrée, ni en sortie).
6. **L'ancien référentiel en niveaux** : les permissions `LECTURE`, `ECRITURE`, `VALIDATION`,
   `SUPPRESSION` (`accounts.Permission` et leurs lignes supprimées logiquement dans
   `catalogue.CataloguePermission`) ne sont plus créées par aucune graine ni commande
   (`initialiser_permissions_par_defaut`, commandes de `management/`). Ne pas supprimer les lignes
   existantes en base (suppression logique déjà faite) ; supprimer le code qui les crée ou les lit.

#### c) Les tests

- **Tests d'acceptation `tests/acceptation/lot1` à `lot4`** (accord du développeur, §1) : pour chaque
  test qui vérifie un niveau (ex. `lot1/test_migration_niveaux.py`, assertions sur `niveau`,
  `habilitations`, `niveaux_supportes`, alias), le réécrire pour vérifier **la même règle en codes**
  (la bonne liste de codes pour le bon rôle). Un test qui ne vérifiait **que** le calcul des niveaux
  se supprime, et le compte rendu le dit, fichier et nom du test.
  Ne toucher à **aucune autre** assertion de ces fichiers.
  Si un fichier `verifier_verrouillage.py` contrôle l'empreinte des tests (lot9 en a un), mettre à
  jour l'empreinte du fichier modifié, et le dire.
- Tests unitaires (`apps/*/tests`) qui lisent un niveau : même traitement.
- Ajouter un test : `POST /parametres/roles/` avec `permissions_modules: {"projets": ["lecture"]}`
  → 400 ; avec `permissions: ["projets.lire", "projets.creer"]` → 201 et exactement ces deux codes.

#### d) Adresse du frontend

Dans `config/settings/base.py` (l. ~460), remplacer `"https://app-chantier.soumafe.com"` (adresse qui
n'existe pas) par `"https://gchantier.soumafe.com"`, et la même chaîne dans
`apps/accounts/tests/test_plateforme.py` (l. 138 et 144).

#### e) Vérifications backend (une commande lourde à la fois)

```powershell
.\.venv\Scripts\python.exe -m pytest tests/acceptation/lot1 tests/acceptation/lot2 tests/acceptation/lot3 tests/acceptation/lot4 -q -p no:cacheprovider
.\.venv\Scripts\python.exe -m pytest apps/platform_admin/tests apps/accounts/tests -q -p no:cacheprovider
```

- Acceptation : **tout passe** (le nombre peut baisser si des tests de niveaux ont été supprimés :
  donner l'ancien et le nouveau total).
- `apps/accounts/tests` : 25 échecs existaient **avant** ce chantier (tests de rôles anciens). Relever
  la liste des échecs sur `develop` **avant** de commencer, et n'en ajouter **aucun**.
- Refaire l'inventaire du §3.2 a) : il ne doit plus rester que des « autres sens ».
- `ruff check` sur les fichiers touchés : aucune erreur nouvelle.
- Si PostgreSQL tombe (« connection timeout ») : `Start-Service postgresql-x64-16`.

#### f) Frontend, conséquence

Le frontend de la branche `feature/droits-codes-seuls` ne lit déjà plus aucun de ces champs. Après le
backend, relancer le frontend en local et refaire les vérifications du §3.3 contre le **nouveau**
backend.

### 3.3 Vérification à l'écran (obligatoire avant tout push)

Lancer le backend (`.\.venv\Scripts\python.exe manage.py runserver 8000` dans le backend) et le
frontend (`npm run dev` dans le frontend). **Ports 8000 et 3000 : libérer un port occupé, ne jamais
en prendre un autre.** Comptes : `C:\Users\Administrator\Desktop\Comptes_tests_locaux.txt` (ne
jamais recopier le mot de passe dans un fichier versionné ni dans le compte rendu).

1. **DG** — `/parametres/roles` : aucune légende, aucun bouton Lecture/Saisie/Validation ; chaque
   cellule dit « N permissions » ou « Aucune », la liste apparaît au survol ; ouvrir un rôle
   personnalisé, cocher une permission, enregistrer, recharger : elle est restée.
2. **AD** — mêmes constats ; le rôle CP s'ouvre en « Consulter ».
3. **CP** (test.cp@demo.ci) — `/projets` montre CHANT-2026-001 ; `/rapports` s'ouvre.
4. **CC** — `/rapports/saisie` s'ouvre (il a `chantier.rediger`).
5. **Profil** de l'AD — « Mes habilitations » liste des permissions (ex. « Consulter les projets,
   Créer un projet… »), plus de « Validation ».
6. **Super admin** (`/admin/connexion`, compte superviseur) — modules et permissions : plus aucune
   mention d'accès par défaut ni de niveau ; modules d'un client : idem.
7. 390 px : `/parametres/roles` sans défilement horizontal de la page.
8. Console du navigateur : aucune erreur `MISSING_MESSAGE` (une clé de traduction retirée à tort).

## 4. Git, fusion, push et production

Règles : `git add <fichiers précis>` (jamais `git add .` ni `-A`) ; jamais `--force` ; une branche
par dépôt ; fusion `--no-ff` dans `develop` ; branche supprimée après fusion.

1. Frontend : `npm run lint`, `npx tsc --noEmit`, puis `npm run build` (seul, la machine manque de
   mémoire ; `NODE_OPTIONS=--max-old-space-size=3072`). Tout à zéro erreur.
2. Fusionner : frontend `feature/droits-codes-seuls` → `develop` ; backend
   `fix/droits-sans-niveaux` → `develop`.
3. **Un push sur `develop` déploie en production** (frontend : lint, typage, build puis cPanel,
   ~10 min ; backend : tests lot1-4 puis cPanel, la migration s'applique au démarrage).
   **Pousser le FRONTEND d'abord** : le frontend en production aujourd'hui lit encore `niveau` et
   `habilitations` ; si le backend partait en premier, l'écran des rôles et le profil seraient faux
   pendant le déploiement. Le nouveau frontend, lui, fonctionne déjà avec l'ancien backend.
   ```bash
   git push origin develop
   gh run list --branch develop --limit 1
   gh run watch <id> --exit-status
   ```
   Attendre « success » sur tous les jobs. **Si un job échoue : ne pas pousser le backend**, lire
   `gh run view <id> --log-failed`, corriger, recommencer. Le `develop` local du frontend contient
   aussi deux commits de documentation non poussés (`50fef05`, `b592b90`) : ils partent avec, c'est
   voulu.
4. Puis le backend, même suivi.
5. Vérifier la production :
   - backend : `https://api-chantier.soumafe.com/api/v1/schema/` répond 200 ;
   - frontend : `https://gchantier.soumafe.com/` s'ouvre ; se connecter avec un compte réel fourni
     par le développeur **seulement s'il le propose** ; sinon, s'arrêter à l'ouverture de la page.
6. Branches locales finales : seulement `develop` et `main` dans chaque dépôt (`git branch`).

## 5. Pièges connus

- **Un seul chef de projet par projet** : le serveur désactive l'ancien CP à chaque désignation
  (`apps/projets/services/affectations.py`). Ne rien coder qui suppose plusieurs CP.
- Le serveur **retire** les montants pour qui n'a pas `projets.voir_montants` : ne pas réintroduire
  de « 0 FCFA ».
- `docs/plan_alignement_api.md` est suivi par Git malgré `.gitignore` : `git add -f` pour le modifier.
- Les fichiers ont des fins de ligne CRLF : préférer l'outil d'édition à des remplacements de texte
  par script.
- Ne pas faire confiance à un compte rendu : chaque « vérifié » de ton compte rendu doit
  correspondre à une vérification réellement faite.

## 6. Compte rendu final (dans le chat)

- ce qui a été retiré côté back-office et côté backend, fichier par fichier ;
- l'inventaire du §3.2 a) avant et après ; les tests d'acceptation modifiés ou supprimés, fichier par fichier, avec la raison ;
- les sorties : tests d'acceptation (`N passed`), lint, typage, build ;
- les identifiants des runs CI et leur conclusion, backend et frontend ;
- les vérifications à l'écran **réellement faites** (compte, largeur) ;
- `git log --oneline -5` et `git branch` des deux dépôts.
