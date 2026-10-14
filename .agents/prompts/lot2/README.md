# Lot 2 — Back-office de la plateforme : prompts pour l'agent d'implémentation (frontend)

Rédigé le 14/10/2026 par l'agent de cadrage (Claude), pour être exécuté par un autre agent
(Gemini sur Antigravity). **Toutes les décisions sont prises** : l'agent d'implémentation
n'arbitre rien. S'il rencontre un cas que ces fichiers ne tranchent pas, il **s'arrête et le
signale au développeur** au lieu d'inventer une règle.

Le backend a son dossier jumeau : `../API-Gestion-Chantier/.agents/prompts/lot2/`. **Lire
d'abord son `README.md`** : il porte la table des décisions (§3) et la règle des rôles (§2.6),
que ce dossier ne recopie pas.

---

## 1. Ordre d'exécution — impératif

Chaque tâche frontend se fait **après** sa jumelle backend, fusionnée dans `develop` du
backend : on se branche sur une route déjà servie et testée.

| Ordre | Backend d'abord | Puis frontend (ce dossier) | Tâche du plan |
|---|---|---|---|
| 1 | `B1_droits_superviseur.md` | `F1_role_reel.md` | 2.0 |
| 2 | `B2_echeance_abonnement.md` | `F2_echeance_abonnement.md` | 2.2 |
| 3 | `B3_modules_client.md` | `F3_modules_client.md` | 2.3 |
| 4 | — | `F4_messagerie.md` | 2.5 |
| 5 | `B4_journal_plateforme.md` | `F5_journal_plateforme.md` | 2.6 |
| 6 | — | `F6_permissions.md` | 2.7 |
| 7 | `B5_suppression_entreprise.md` | `F7_suppression_entreprise.md` | 2.4 (US 1.1) |
| 8 | — | `F8_cloture.md` | 2.8 |

La tâche **2.1** (mot de passe oublié du super-administrateur) est **faite** : ne pas y toucher.

---

## 2. Règles communes — à relire avant CHAQUE tâche

### 2.1 Lectures obligatoires avant d'écrire

1. `CLAUDE.md` de ce dépôt, **en entier** — en particulier « i18n and the "no hardcoded
   string" rule » et la section « Rules » (règles 1 à 12).
2. `.agents/skills/sprint-task-lifecycle/SKILL.md`, `.agents/skills/brancher-api/SKILL.md`,
   `.agents/skills/revue-frontend/SKILL.md`.
3. `features/projets/adaptateur.ts` — **la référence** de tout branchement d'API : types
   `Charge*` privés, fonctions `vers*`, noms à l'infinitif en français.
4. `features/administration/adaptateur.ts`, `types.ts`, `regles.ts`, `validations.ts` — le
   domaine qu'on étend.
5. Le fichier de la tâche, **en entier**, puis chaque fichier qu'il cite.

### 2.2 Les brouillons

`brouillons/` contient le travail local écarté le 13/10/2026 (stash du dépôt), recopié ici
pour qu'il ne se perde pas :

| Fichier | Sert à |
|---|---|
| `ModulesClient.tsx.txt` | F3 |
| `EcranMessagerie.tsx.txt` | F4 |
| `ListePermissions.tsx.txt` | F6 |
| `SuppressionClient.tsx.txt` | F7 |
| `adaptateur.ts.brouillon.txt`, `types.ts.brouillon.txt`, `validations.ts.brouillon.txt` | les fonctions, types et schémas correspondants (lignes citées dans chaque tâche) |
| `fr_administration.brouillon.json` | les libellés de l'époque, sous la clé `brouillon_administration` |

**Ce sont des points de départ, pas du code à recopier tel quel** : ils datent d'avant B1–B5 et
ignorent les règles posées depuis (motif, suspension préalable, `desactivable`, pagination…).
Chaque tâche dit ce qu'il faut garder et ce qu'il faut changer. Ne jamais importer un fichier de
`brouillons/` ; ne jamais le renommer en `.tsx` dans `brouillons/`.

### 2.3 Git — non négociable

```bash
git checkout develop
git pull
git checkout -b feature/lot2-<nom-court>     # nom donné dans chaque tâche
```

- Une branche par tâche ; `git add <fichiers précis>`, **jamais** `git add .` ni `-A`.
- Commit : `feat(administration): <description>`, en français.
- Fusion :
  ```bash
  git checkout develop
  git merge --no-ff feature/lot2-<nom-court> -m "merge: feature/lot2-<nom-court> into develop"
  git branch -d feature/lot2-<nom-court>
  ```
- **INTERDIT : `git push`.** Depuis le 14/10/2026, pousser `develop` **déploie le frontend en
  production**. Le push du lot est fait **une fois**, par le développeur, après relecture
  (Claude, skill `revue-frontend`) et vérification à l'écran. Jamais `--force`.
- Ne pas modifier `.claude/` (copie générée des skills), ni `eslint.config.mjs` pour ajouter
  une exemption (la seule modification permise est le **retrait** d'une exemption, en F8).

### 2.4 Vérifications obligatoires avant chaque commit

```bash
npm run lint
npm run typecheck
```

Les deux à **zéro erreur**. Ils tournent en CI avant le build : une erreur bloque le
déploiement de tout le monde.

### 2.5 Vérification à l'écran — obligatoire, contre le backend local

Il n'y a pas de lanceur de tests dans ce dépôt : **un écran que personne n'a ouvert n'est pas
vérifié**.

1. Backend local sur `http://localhost:8000` (voir son README §2.3 ; libérer le port s'il est
   pris, ne jamais basculer sur un autre).
2. `npm run dev` → `http://localhost:3000/admin/connexion`. Si le serveur de développement
   s'arrête faute de mémoire (« JavaScript heap out of memory »), fermer d'autres applications
   et relancer ; ne pas passer à la suite sans avoir vu l'écran.
3. Se connecter avec un compte **superviseur** local. Le demander au développeur s'il n'est pas
   fourni ; ne **jamais** écrire d'identifiant ni de mot de passe dans un fichier versionné ni
   dans le compte rendu. Pour la vue SUPPORT, créer un compte SUPPORT depuis
   « Paramétrage > Comptes » avec le superviseur.
4. Pour chaque tâche : faire le geste, **recharger la page** (la donnée doit venir du serveur),
   provoquer au moins un cas d'erreur, et regarder l'écran à **1440 px et 390 px** de large.
5. Noter dans le compte rendu ce qui a été vu et ce qui ne l'a pas été.

### 2.6 Conventions — rappel des pièges qui ont déjà coûté

- **Aucune chaîne française en dur** dans `.ts`/`.tsx` (ESLint en fait une erreur) : tout
  libellé va dans `messages/fr.json` sous `administration.*`, et se lit par
  `useTranslations("administration")` (composant) ou `texte("administration.…")`
  (`@/i18n/horsReact`, hors composant — schémas zod).
- Les identifiants techniques dans le JSX (ids de formulaire, codes) se sortent en constante
  hors du JSX (cf. `ID_FORM_SUSPENSION` dans `FicheClient.tsx:57`).
- **Une règle métier ne vit pas dans un composant** : elle va dans
  `features/administration/regles.ts`.
- **Aucun `fetch`** hors de `features/administration/adaptateur.ts` ; toujours
  `apiAdministration` (jamais `api`) : le back-office vit dans le schéma `public`.
- `apiAdministration` n'a que `lire` (GET), `creer` (POST), `modifier` (PATCH), `supprimer`
  (DELETE). **Pas de PUT** : le backend expose un alias `PATCH` quand il le faut.
- Clés de cache dans `app/(admin)/admin/cles.ts` (`CLES_ADMINISTRATION`), jamais écrites à la
  main dans un composant.
- Toute liste passe par `TableauListe` (`components/ui/tableau-liste.tsx`) avec un `exporter`
  CSV + PDF obligatoire.
- Tailwind seul, jetons de `styles/tokens.css`, tons de statut de `app/(admin)/admin/tons.ts`.
- Les messages d'erreur du serveur sont **en français et destinés à l'utilisateur** :
  `cause instanceof ErreurApi ? cause.message : t("erreurs.action")`, comme partout dans le
  back-office.
- **Le rôle grise, il ne masque pas** (commentaire de `FicheClient.tsx:80`) : un SUPPORT voit le
  bouton désactivé et lit pourquoi. Exception : la suppression définitive (F7), dont le
  bouton n'apparaît que pour le superviseur.

---

## 3. Fin du lot

Quand les huit tâches sont fusionnées dans `develop` (sans push) :

1. `git log --oneline develop ^origin/develop`.
2. Compte rendu au développeur : par tâche, ce qui est livré, ce qui a été vu à l'écran (et à
   quelles largeurs), ce qui ne l'a pas été.
3. **S'arrêter.** Relecture, push et mise à jour du plan (`docs/plan_alignement_api.md`, déjà
   préparée en F8) sont faits par le développeur.
