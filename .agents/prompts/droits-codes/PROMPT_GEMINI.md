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

**Règle absolue** : la CI ne déploie que si `tests/acceptation/lot1` à `lot4` passent (177 tests
aujourd'hui). **Ces tests ne se modifient jamais sans l'accord écrit du développeur.**

1. Champs « niveau » exposés par l'API (le frontend ne les lit plus) :
   `niveau` et alias `lecture/LECTURE/saisie/…` dans `permissions_modules` des rôles
   (`apps/accounts/serializers/role.py`), `habilitations` du profil, `niveaux_supportes` et
   `acces_par_defaut` de `GET /modules/` (`apps/referentiels/views/module.py`), `acces_par_defaut` du
   back-office (`apps/platform_admin/serializers/modules.py`).
   **Avant de retirer un champ**, chercher s'il est lu par un test d'acceptation :
   ```bash
   grep -rn "niveau\|niveaux_supportes\|acces_par_defaut\|habilitations\|permissions_modules" tests/acceptation/lot1 tests/acceptation/lot2 tests/acceptation/lot3 tests/acceptation/lot4
   ```
   - s'il est lu par l'un d'eux : **ne pas le retirer**, le noter dans le compte rendu ;
   - sinon : le retirer de la réponse, et adapter les tests unitaires (`apps/*/tests`) qui le lisaient.
   Ne **pas** toucher au modèle ni aux migrations (`RoleModulePermission.niveau` reste en base) :
   on retire seulement ce que l'API expose.
2. Adresse du frontend : dans `config/settings/base.py` (l. ~460), remplacer
   `"https://app-chantier.soumafe.com"` (adresse qui n'existe plus) par
   `"https://gchantier.soumafe.com"`, et la même chaîne dans
   `apps/accounts/tests/test_plateforme.py` (l. 138 et 144).
3. Tests, un à la fois (la machine manque de mémoire) :
   ```powershell
   .\.venv\Scripts\python.exe -m pytest tests/acceptation/lot1 tests/acceptation/lot2 tests/acceptation/lot3 tests/acceptation/lot4 -q -p no:cacheprovider
   .\.venv\Scripts\python.exe -m pytest apps/platform_admin/tests apps/accounts/tests/test_droits_b1.py apps/accounts/tests/test_plateforme.py -q -p no:cacheprovider
   ```
   177 passent pour le premier, tout passe pour le second. Sinon : **s'arrêter**.
   Si PostgreSQL tombe (« connection timeout ») : `Start-Service postgresql-x64-16`.
4. `ruff check` sur les fichiers touchés : aucune erreur **nouvelle**.

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
2. Fusionner : backend `fix/droits-sans-niveaux` → `develop` ; frontend
   `feature/droits-codes-seuls` → `develop`.
3. **Un push sur `develop` déploie en production** (backend : tests lot1-4 puis cPanel ; frontend :
   lint, typage, build puis cPanel, ~10 min). Pousser **le backend d'abord** :
   ```bash
   git push origin develop
   gh run list --branch develop --limit 1
   gh run watch <id> --exit-status
   ```
   Attendre « success » sur tous les jobs. **Si un job échoue : ne pas pousser le frontend**, lire
   `gh run view <id> --log-failed`, corriger, recommencer.
4. Puis le frontend, même suivi. Le `develop` local du frontend contient aussi deux commits de
   documentation non poussés (`50fef05`, `b592b90`) : ils partent avec, c'est voulu.
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
- les champs backend **gardés** parce qu'un test d'acceptation les lit ;
- les sorties : tests d'acceptation (`N passed`), lint, typage, build ;
- les identifiants des runs CI et leur conclusion, backend et frontend ;
- les vérifications à l'écran **réellement faites** (compte, largeur) ;
- `git log --oneline -5` et `git branch` des deux dépôts.
