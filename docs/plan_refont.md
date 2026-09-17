# Plan de refonte — alignement sur `docs/ARCHITECTURE_REUTILISABLE.md`

> **État : en cours. Lot 0 terminé le 2026-09-17 ; `src/` n'a pas encore été touché.**
> Avancement détaillé : §8 en fin de document.
> Diagnostic complet : [`docs/DIAGNOSTIC_ARCHITECTURE.md`](docs/DIAGNOSTIC_ARCHITECTURE.md).
> Les références `D1…D10`, `A1…A9`, `O1…O10` renvoient à ce diagnostic.

---

## 0. Principes

On ne repart pas de zéro. Le dépôt contient des briques meilleures que ce que
la doc de référence exige (client HTTP, horloges de session, double garde-fou
i18n). La refonte les **conserve** et remplace ce qui manque : les jetons
réconciliés, les couches, la frontière client/serveur.

Cinq règles tiennent tout le plan.

1. **Aucun lot ne casse `main`.** À la fin de chaque lot, `npm run lint`,
   `npx tsc --noEmit` et `npm run build` passent, et les 12 écrans réels du
   produit se comportent comme avant. Un lot qui ne peut pas être livré ainsi
   est un lot mal découpé, à redécouper.
2. **Cohabitation assumée, pas migration simultanée.** CSS Modules et Tailwind
   vivent ensemble pendant toute la refonte. Un écran est migré *entièrement*
   ou pas du tout — jamais à moitié. C'est la seule façon de garder une
   référence visuelle valable.
3. **L'ancienne interface publique survit à la nouvelle implémentation.**
   `import { Bouton, Champ } from "@/components/ui"` doit continuer de
   fonctionner pendant que `Bouton` devient une enveloppe sur shadcn. Les 19
   écrans ne sont pas touchés par le lot 2.
4. **Ce qu'on ne peut pas vérifier, on ne le migre pas en lot.** Il n'y a pas de
   test (O6). Le filet est donc : `build` + `tsc` + `eslint` + une **recette
   visuelle** (§7) écran par écran. Le rythme du plan s'aligne sur ce filet, pas
   sur l'envie d'avancer.
5. **Chaque contournement porte le numéro de la demande qui le lèvera**, dans
   `docs/DEMANDES_BACKEND.md`. Sans cela, un contournement devient une règle du
   projet (doc §11).

---

## 1. Le point technique qui commande tout

**Tout le lot 1 tient dans une décision : les jetons shadcn doivent pointer sur
les jetons de la charte, en `@theme inline`, et jamais l'inverse.**

Aujourd'hui `globals.css` déclare deux palettes qui s'ignorent (D1) :
`--primary: oklch(0.205 0 0)` (shadcn, gris) à côté de
`--color-primary-500: #D4652A` (charte, terre cuite). Le premier composant
généré rendra en gris.

La correction n'est pas de recopier le terre cuite dans `--primary` — ce serait
une quatrième source de vérité (D8) et cela **casserait le white-label** :
`appliquerCouleurPrimaire()` injecte l'échelle 50→900 à l'exécution sur
`documentElement`, donc une valeur figée à la compilation ne bougerait jamais.

La correction est de **brancher** :

```css
@theme inline {
  /* `inline` : Tailwind émet `var(--color-primary-500)` DANS l'utilitaire,
     au lieu de résoudre la valeur à la compilation. C'est ce qui fait que
     `bg-primary` suit la couleur injectée à l'exécution par le white-label. */
  --color-primary: var(--color-primary-500);
  --color-primary-foreground: var(--color-neutral-0);
  --color-background: var(--color-neutral-50);
  --color-foreground: var(--color-neutral-700);
  --color-border: var(--color-neutral-200);
  /* … et toute l'échelle de charte exposée telle quelle : */
  --color-primary-50: var(--color-primary-50);   /* etc. 50 → 900 */
}
```

Conséquences, toutes souhaitables :

- `bg-primary`, `text-primary`, `border-primary` (shadcn) **et**
  `bg-primary-600`, `text-neutral-500` (charte) existent et désignent la même
  palette ;
- un composant posé par `shadcn add` est en charte **sans retouche** ;
- le white-label continue de fonctionner à l'exécution, sur le Tailwind comme
  sur les CSS Modules existants ;
- `tokens.css` reste la **seule** déclaration de valeurs, conformément à son
  propre en-tête (« la charte est la source de vérité »).

Si ce mécanisme ne fonctionne pas comme décrit après essai, **le lot 1
s'arrête** et l'arbitrage A4 ci-dessous (« figer la couleur au rendu serveur »)
devient obligatoire avant de continuer. Rien d'autre ne dépend de ce choix.

---

## 2. Arbitrages à valider avant de démarrer

Quatre décisions changent la forme du plan. Chacune a une recommandation ; il
faut les trancher, pas les reporter — le lot 4 et le lot 5 en dépendent.

### A1 — `features/` ou `lib/<domaine>` ?

La doc décrit `lib/<domaine>/types.ts` + `lib/api/<domaine>.ts` +
`components/<domaine>/`. Le dépôt a `src/features/<domaine>/`, et `CLAUDE.md`
en fait un invariant : « `features/projets` ↔ `backend/apps/projets/` ».

> **Recommandation : garder `src/features/<domaine>/`, adopter le découpage en
> cinq couches à l'intérieur.** Ce que la doc impose est la *stratification*,
> pas le nom des dossiers. Déplacer 116 fichiers pour renommer un dossier
> consomme le budget de la refonte sans rien acheter, et casse la
> correspondance avec les apps Django.

Cible retenue :

```
src/features/<domaine>/
  types.ts          les types du domaine, aucune forme HTTP
  regles.ts         les règles métier — pures, zéro React
  validations.ts    les schémas zod des écritures
  adaptateur.ts     API <-> domaine (ex-`api.ts`), mapping `versX()` + codes
  actions.ts        les server actions ("use server")
  components/       les écrans du domaine
```

À inscrire dans `CLAUDE.md` comme **écart délibéré** à la doc de référence,
avec sa raison — sans quoi le prochain intervenant le corrigera « à
l'envers ».

### A2 — Phosphor ou lucide ?

26 fichiers en `@phosphor-icons/react`, 0 en `lucide-react`. Les composants
`base-nova` sont écrits avec lucide.

> **Recommandation : lucide, par étranglement.** Une règle ESLint
> `no-restricted-imports` interdit tout **nouvel** import Phosphor ; les
> fichiers existants migrent quand un autre lot les touche de toute façon.
> Mélanger deux jeux d'icônes dans la même barre d'outils se voit — mais une
> migration en bloc de 26 fichiers dans un lot dédié ne rapporte rien de
> vérifiable.

### A3 — Mode sombre : on le répare ou on le supprime ?

Le bloc `.dark` (37 déclarations) et `@custom-variant dark` sont du code mort
(D5), et la charte CCD ne mentionne pas de thème sombre.

> **Recommandation : le supprimer.** Un mode sombre jamais atteignable est du
> CSS qui vieillit, pas une fonctionnalité en attente. S'il est un jour au
> cahier des charges, il se réintroduira proprement sur les jetons réconciliés
> — ce sera même beaucoup plus simple après le lot 1.
> *Décision contraire acceptable, à condition de le rendre atteignable dans le
> lot 1 (poser `.dark` sur `<html>` au rendu serveur) et de le recetter.*

### A4 — Frontière client/serveur : jusqu'où va-t-on ? **(la décision structurante)**

C'est la seule décision qui dépend du backend. La doc de référence suppose une
session en **cookies `httpOnly`** posés côté serveur, ce qui rend possibles les
gardes serveur, les server actions et le rendu serveur des écrans. Le dépôt a
un jeton d'accès en mémoire + un jeton de renouvellement en `localStorage`
(A4), donc **rien de tout cela**.

| | Option B — cible de la doc | Option A — statu quo durci |
| --- | --- | --- |
| Session | cookie `httpOnly` + `SameSite=Strict` | mémoire + `localStorage` |
| Garde de route | `proxy.ts`, avant l'envoi du bundle | client, après hydratation |
| Écritures | server actions, droit revérifié serveur | `fetch` client |
| Lectures | server components + React Query pour l'interactif | React Query |
| Dépendance backend | **oui** : Django doit poser le cookie à la connexion | non |
| Lève le risque `localStorage` | oui | non |

> **Recommandation : viser l'option B, via une demande backend ouverte dès le
> lot 0.** C'est ce que la doc impose, c'est ce que `jetons.ts` réclame
> lui-même (« à trancher avant la mise en production »), et c'est la seule qui
> transforme la garde de route en garde réelle.
>
> **Les lots 0 à 4 et 6 sont écrits pour être rentables dans les deux cas.**
> Seul le lot 5 branche. Si le backend ne peut pas suivre dans le délai, le lot
> 5 se réduit à sa variante A (§Lot 5, repli) et le reste du plan est
> inchangé.

---

## 3. Vue d'ensemble des lots

| Lot | Objet | Dépend de | Impact visuel | Risque |
| --- | --- | --- | --- | --- |
| **0** *(terminé)* | Filet, documentation, CI | — | aucun | nul |
| **1** | Réconciliation des jetons | 0 | **nul attendu, à recetter** | moyen |
| **2** | Socle shadcn + vocabulaire de statut | 1 | nul (enveloppes) | moyen |
| **3** | zod + react-hook-form | 2 | nul | faible |
| **4** | Couche domaine (types / règles / adaptateurs) | — (parallélisable avec 1-2) | nul | faible |
| **5** | Frontière client/serveur, gardes, permissions | 3, 4, **backend** | moyen | **élevé** |
| **6** | React Query généralisé | 4 | faible | faible |
| **7** | Retrait des CSS Modules, écran par écran | 2 | **fort, par écran** | faible mais long |
| **8** | Nettoyage final | tous | aucun | nul |

Les lots 1-2-3 forment une chaîne. Le lot 4 est indépendant et peut démarrer en
parallèle dès le lot 0 — c'est le meilleur endroit où mettre une seconde
personne.

---

## Lot 0 — Filet de sécurité et socle documentaire *(terminé)*

**Objectif** : pouvoir constater une régression. Aucune ligne de `src/` n'est
modifiée.

**Contenu**

1. Créer les trois documents du §11 de la doc :
   - `docs/DEMANDES_BACKEND.md` — numéroté. **Première entrée : `B-001`**,
     « poser le jeton de session en cookie `httpOnly` à la connexion »
     (arbitrage A4) ;
   - `docs/SCHEMAS_ATTENDUS.md` — amorcé avec les charges utiles déjà relevées
     dans `features/*/api.ts` ;
   - `docs/POINTS_OUVERTS.md` — amorcé avec les quatre arbitrages du §2, plus
     **O10** (production épinglée sur un seul tenant par
     `NEXT_PUBLIC_API_URL`), qui n'est pas un sujet de refonte mais qui doit
     être tranché avant elle.
2. `package.json` : épingler `packageManager`, ajouter
   `"typecheck": "tsc --noEmit"`, déplacer `@tailwindcss/postcss` en
   `devDependencies` (O3, O4, O5).
3. CI (`.github/workflows/deploy-cpanel.yml`) : ajouter `npm run lint` et
   `npm run typecheck` **avant** le build (O9). Sans cela, le double garde-fou
   i18n — le meilleur acquis du dépôt — ne s'applique jamais automatiquement.
4. **Recette visuelle de référence** : capturer les 12 écrans réels du produit,
   en 1440 px, 768 px et 390 px, avec l'API simulée (`NEXT_PUBLIC_API_SIMULE=1`)
   pour que les captures soient reproductibles. Les ranger dans
   `docs/recette/avant/`. C'est le seul étalon dont disposeront les lots 1, 2
   et 7.

   > Écrans : `/connexion`, `/inscription`, `/mot-de-passe/oublie`,
   > `/mot-de-passe/definir`, `/activation`, `/invitation`, `/configuration`
   > (4 étapes), `/tableau-de-bord`, `/projets/[id]`, `/parametres/roles`,
   > `/parametres/utilisateurs`, `/design-system`, `/not-found`.

5. Inscrire dans `CLAUDE.md` les arbitrages A1, A2, A3 une fois tranchés.

**Recette** : `lint`, `typecheck`, `build` verts ; `git diff --stat src/` vide.

---

## Lot 1 — Réconciliation des jetons

**Objectif** : que Tailwind et shadcn parlent la charte, sans qu'un pixel
bouge. C'est le lot qui déverrouille tous les suivants — et le seul dont le
critère de réussite est « rien n'a changé à l'écran ».

**Contenu**, dans cet ordre (chaque point est vérifiable seul) :

1. **Un seul reset.** Retirer le reset de `tokens.css:182-204` et les styles de
   base `html`/`body` qu'il porte ; `globals.css` + le preflight Tailwind
   suffisent (D6). Retirer le `:focus-visible` de `tokens.css:605-608`
   (double anneau).
2. **Supprimer les collisions d'utilitaires** : les classes `.gap-1..6` et
   `.p-4..6` de `tokens.css:594-603` (D2). *Vérifier d'abord leur usage réel
   dans les CSS Modules et le JSX — s'il y en a, les remplacer par la valeur du
   jeton avant suppression.* C'est le point le plus dangereux du lot, parce
   qu'il est silencieux : `gap-6` vaudrait 32 px au lieu de 24.
3. **Une seule échelle de rayons.** Supprimer le bloc `--radius-*` en
   `calc(var(--radius) * …)` du `@theme inline` ; exposer à la place les rayons
   de la charte (`--radius-md: var(--radius-md)` en `inline`), et aligner
   `--radius` (le jeton que shadcn lit) sur `--radius-md` (D3).
4. **Réparer `--font-sans`** : le faire pointer sur `--font-family-base`, et non
   sur lui-même (D4). Vérifier ensuite qu'un composant shadcn rend bien en
   Inter.
5. **Brancher `@theme inline` sur les jetons de charte** — le §1 ci-dessus.
   Exposer : la palette `primary` 50→900 + l'alias `--color-primary`, les
   `neutral` 0→900, les `secondary`, les sémantiques, les `--space-*` en
   `--spacing-*`, les ombres.
6. **Fond de page et mode sombre** : supprimer `body { background: … }` hors
   couche (D5) ; selon l'arbitrage A3, supprimer le bloc `.dark` et
   `@custom-variant dark`, ou les rendre atteignables.
7. **White-label : un seul mécanisme** (D7).
   - Supprimer les blocs `[data-theme="primary-*"]` de `tokens.css:623-673`
     (jamais atteints) **ou** supprimer `appliquerCouleurPrimaire()` au profit
     de `data-theme` — pas les deux. *Recommandation : garder la génération JS,
     qui couvre l'échelle complète 50→900 et les couleurs hors palette (logo
     client), et supprimer les blocs `data-theme`, qui n'en couvrent que cinq
     nuances.*
   - Supprimer `src/styles/FournisseurTheme.tsx`, jamais monté.
   - **Tuer le clignotement** : la couleur d'entreprise doit être posée avant
     le premier rendu, pas dans un `useEffect` de `(app)/layout.tsx:130`. Deux
     voies, selon l'arbitrage A4 : un script bloquant minimal dans `<head>`
     (option A), ou l'attribut posé au rendu serveur depuis la session (option
     B, plus propre). **En attendant, ouvrir `B-002` : la couleur de
     l'entreprise doit être lisible côté serveur.**
8. **Supprimer les 18 replis `#D4652A`** dans les `var(--color-primary-500,
   #D4652A)` (D8). Le jeton est toujours défini : le repli ne sert qu'à
   afficher du terre cuite chez un client qui a choisi autre chose. Réduire à
   **une** source : `tokens.css`. `couleurs.ts` et `theme.ts` doivent lire la
   même constante, pas la recopier.

**Recette**

- Les 12 écrans de `docs/recette/avant/` sont **identiques au pixel** (aux trois
  largeurs). C'est le critère, pas un accessoire : c'est ce qui prouve que le
  lot n'a rien cassé.
- Une page d'essai jetable utilisant `bg-primary`, `bg-primary-600`,
  `text-neutral-500`, `rounded-md`, `gap-6` rend les valeurs de la charte.
- Changer la couleur primaire dans `/configuration` repeint l'interface **sans
  rechargement**, comme aujourd'hui.
- Charger `/tableau-de-bord` en tant que client « Océan » : **aucun éclat terre
  cuite** au premier rendu.

**Réversibilité** : un seul commit, révocable. Aucun fichier de `src/app` ou
`src/components` n'est touché hors `globals.css` et `styles/`.

---

## Lot 2 — Socle shadcn et vocabulaire de statut

**Objectif** : disposer des primitives et des motifs de la doc, **sans toucher
un seul écran**.

**Contenu**

1. **`src/components/statut/tons.ts`** (doc §7.1) — le vocabulaire de couleur,
   avant tout le reste. Huit tons (`acquis`, `encours`, `jalon`, `attente`,
   `critique`, `inactif`, `engagement`, `distinction`), quatre classes chacun
   (`surface` **opaque**, `fond`, `texte`, `texteVif`). Les surfaces sont
   construites dans la teinte, jamais diluées dans un blanc froid.
   - Y **rapatrier** la correspondance statut → ton aujourd'hui enfermée dans
     `design-system/page.tsx:81` (D10).
   - Contraintes non négociables : contraste vérifié **par paire** (texte sur sa
     propre surface), et **la couleur ne porte jamais l'information seule** —
     un badge écrit son libellé et le double d'une icône.
2. **Générer les primitives** par `npx shadcn@latest add` (jamais à la main) :
   `button`, `input`, `label`, `select`, `checkbox`, `radio-group`, `textarea`,
   `dialog`, `sheet`, `popover`, `calendar`, `table`, `badge`, `alert`,
   `tooltip`, `dropdown-menu`, `skeleton`, `sonner`, `form`.
   Elles atterrissent dans `src/components/ui/` — **en minuscules**
   (`button.tsx`), à côté des composants français existants (`Bouton.tsx`).
   Aucune collision : la casse diffère, et c'est ce qui permet la cohabitation.
3. **Réécrire les 9 composants maison en enveloppes**, en conservant **exactement
   leur interface publique française** : `Bouton` (`variante="primaire"`,
   `enCours`, `pleineLargeur`, `iconeGauche`), `Champ` (`libelle`, `erreur`,
   `aide`), `Carte`, `Badge`, `Alerte`, `Modale`, `Tableau`, `Etats`.
   `src/components/ui/index.ts` ne change pas d'une ligne → **les 19 écrans ne
   sont pas touchés**.
   - Conserver les acquis terrain que shadcn n'a pas : cible tactile de 48 px
     sous `(pointer: coarse)`, `aria-busy` sur `enCours`, `aria-describedby`
     reliant l'erreur au champ, anneau de focus jamais supprimé.
   - Supprimer le `*.module.css` correspondant **dans le même commit**.
4. **Les motifs partagés manquants** (doc §7.2), chacun en un seul fichier :
   - `components/tableau/table-donnees.tsx` — recherche, tri, pagination
     (10 lignes, la même partout), repli en cartes sous `md`, et **deux états
     vides distincts** : « aucune donnée » ≠ « aucun résultat ». Travaille sur
     la liste **déjà chargée** : pas d'aller-retour réseau par frappe.
   - `components/tableau/declencheur-filtre.tsx` — prop `libelle` **obligatoire**
     (elle sert d'`aria-label` : sans elle, un lecteur d'écran annonce « Tous
     les statuts » sans dire ce que cela restreint).
   - `components/statut/` : `badge-ton`, `carte-section`, `bandeau-fiche`,
     `grille-champs`, `en-tete-tiroir`.
   - `components/tableau-de-bord/en-tete-page.tsx`.
   - `components/formulaire/champ-date.tsx` (Popover + Calendar, chaîne
     `AAAA-MM-JJ`, conversion **locale** et non UTC), `champ-heure`,
     `champ-fichier` (multipart direct, **jamais de base64**), `bouton-soumettre`.
5. **`Toaster` monté une fois** dans `app/layout.tsx` (doc §7.5).
6. **Règle ESLint `no-restricted-imports`** interdisant `@phosphor-icons/react`
   (arbitrage A2). Les 26 fichiers existants sont exemptés nommément, la liste
   ne fait que décroître.
7. **`/design-system` devient la recette du lot** : il catalogue les primitives
   générées, les huit tons, les motifs partagés. Un composant qui n'y figure pas
   n'existe pas.

**Recette**

- Les 12 écrans de référence sont **inchangés** (les enveloppes rendent la même
  chose).
- `/design-system` montre les huit tons avec leur paire de contrastes mesurée.
- `grep -r "module.css" src/components/ui/` ne renvoie rien.
- Aucun import modifié dans `src/app/`.

**Risque** : c'est le lot où une enveloppe peut trahir subtilement l'original
(hauteur de 1 px, graisse). D'où la recette au pixel, et l'ordre : un composant
par commit, recetté seul.

---

## Lot 3 — zod et react-hook-form

**Objectif** : une seule façon de refuser une donnée dans tout le projet (A3).

**Contenu**

1. **`src/lib/validations/champs.ts`** — les briques partagées, pour que deux
   formulaires refusent la même nature de donnée de la même façon : `entier`
   (le navigateur renvoie une chaîne, une server action peut recevoir un
   nombre — les deux entrées aboutissent au même entier ou au même refus),
   `email`, `montantFcfa` (centimes), `telephoneE164`, `dateIso`,
   `chaineNonVide`. Tous les messages passent par `texte()` — la règle
   « aucune phrase française dans un littéral » s'applique.
2. **`features/auth/validations.ts`** en premier, alimenté par
   `features/auth/reglesMotDePasse.ts` **sans le recopier** : un seul fichier
   alimente le schéma zod *et* la liste de contrôle affichée à l'écran.
3. **Migration formulaire par formulaire**, du plus simple au plus complexe —
   un commit, une recette :

   | # | Formulaire | Lignes | Particularité |
   | --- | --- | --- | --- |
   | 1 | `mot-de-passe/oublie/FormulaireOubli` | 175 | un champ — sert de gabarit |
   | 2 | `mot-de-passe/definir/EcranDefinition` | 284 | politique de mot de passe |
   | 3 | `invitation/EcranInvitation` | 233 | |
   | 4 | `activation/EcranActivation` | 386 | |
   | 5 | `connexion/FormulaireConnexion` | 311 | compteur de tentatives client |
   | 6 | `inscription/FormulaireInscription` | 347 | identifiant fourni par le client (anti double-clic) |
   | 7 | `ModalDefinirBudget` | 101 | centimes |
   | 8 | `ModalCreationProjet` | 334 | |
   | 9 | `ModalNouveauRole` | 291 | matrice de permissions |
   | 10-12 | `configuration/Etape*` | 1 376 | assistant à état — **en dernier** |

**Invariants à ne pas perdre** (ils existent aujourd'hui et sont justes) :

- l'erreur d'un champ **disparaît dès que ce champ change** — la laisser
  affichée sous une valeur corrigée, c'est afficher un chiffre faux ;
- les erreurs par champ renvoyées par l'API (`ErreurApi.erreursParChamp`) sont
  **relues champ par champ** et remettent le focus sur le bon champ, jamais
  traitées par le seul statut HTTP ;
- **aucune prose d'aide sous un champ** (doc §7.4). Trois exceptions seulement,
  qui ne décrivent pas le champ : le diagnostic d'une liste vide, le retour
  calculé sur la saisie, le refus destructif. Chacune ne s'affiche **que quand
  elle s'applique** — jamais comme branche `else` d'un ternaire dont l'autre
  branche était de la prose.

**Recette par formulaire** : mêmes messages (issus de `messages/fr.json`), même
comportement à la frappe, même comportement hors ligne, même comportement sur
un refus `422` par champ.

---

## Lot 4 — Couche domaine

**Objectif** : que plus aucun écran ne connaisse la forme HTTP (A1), et que
chaque notion métier ait **une seule implémentation** (A2).
**Ce lot est indépendant des lots 1-3 et peut être mené en parallèle.**

**Contenu, par domaine**, dans l'ordre : `projets` → `tableauDeBord` → `roles`
→ `configuration` → `finance` → `abonnement` → `invitations` → `inscription`.

Pour chacun, dans l'ordre de dépendance (doc §12) :

1. `types.ts` — les types du domaine, **aucun type HTTP**, nommage français.
   `budget_initial_montant` devient `budgetInitial`, `avancement_theorique`
   devient `avancementTheorique`.
2. `regles.ts` — pur, zéro React. C'est ici qu'atterrissent les calculs
   aujourd'hui dans le JSX :
   - l'**écart d'avancement**, aujourd'hui calculé deux fois
     (`projets/[id]/page.tsx:92` et `TableauDeBordClient.tsx`) ;
   - le **seuil de retard** (`< -5`, en dur à `TableauDeBordClient.tsx:395`) ;
   - le **ratio de consommation budgétaire** (`TableauDeBordClient.tsx:237`) ;
   - l'**indice de santé** et sa couleur ;
   - les **conversions centimes ↔ francs**, refaites à la main dans trois
     modales alors que `lib/format` sait déjà le faire ;
   - les **bornes de saisie** (min, max, défauts), **reprises telles quelles**
     par les schémas zod du lot 3 : le formulaire et la règle ne peuvent alors
     pas diverger.
3. `validations.ts` — un schéma par écriture, réutilisant `champs.ts` et les
   bornes de `regles.ts`.
4. `adaptateur.ts` (l'actuel `api.ts`) — mapping `versProjet(charge)`,
   `versLigneTableauDeBord(charge)`, et **traduction des refus en codes
   métier** (`DROITS_INSUFFISANTS`, `DONNEES_INVALIDES`, `INTROUVABLE`,
   `ENTITE_UTILISEE`, `SERVICE_INDISPONIBLE`), jamais en statuts HTTP.
   - Prévoir le cas §3.4 : une lecture qui peut légitimement recevoir un `403`
     ne lève pas, elle renvoie `{ lignes, refus }` — l'écran **nomme le motif**
     au lieu d'afficher une liste vide, qui se lirait « il n'y a rien » alors
     que la réponse est « on ne sait pas ».
5. Découper le monolithe correspondant au passage (A7) — c'est le seul moment
   où c'est gratuit.

**Garde-fou à poser dès le premier domaine migré** : une règle ESLint
interdisant l'import d'un identifiant `snake_case` depuis `src/app/**` et
`src/components/**`. Sans elle, la couche se reperce en trois semaines.

**Recette** : `tsc` vert ; chaque notion métier n'a **qu'une** définition
(vérifiable par recherche : un seul `ecart`, un seul seuil de retard) ; les
écrans affichent les mêmes valeurs qu'avant.

---

## Lot 5 — Frontière client/serveur *(branche selon l'arbitrage A4)*

**Objectif** : que le droit soit vérifié là où il ne peut pas être contourné.

### Variante B — cible de la doc *(recommandée)*

**Prérequis backend** : `B-001` livré (cookie `httpOnly` posé à la connexion).

1. **`proxy.ts` à la racine** (Next 16 : `middleware.ts` n'existe plus).
   D'abord **passant**, avec son `matcher` excluant les ressources statiques —
   un fichier vide empêche la compilation. Puis fermé, **après avoir listé les
   routes publiques** : `/connexion`, `/inscription`, `/mot-de-passe/*`,
   `/activation`, `/invitation`, `/partage/[jeton]`.
2. **`src/lib/auth/`** complété selon le §5 :
   `constantes.ts` (noms de cookies, durées, `ROUTE_PAR_PROFIL`,
   `ROUTE_CONNEXION`), `session.ts` **serveur** (pose et lecture des cookies —
   à ne pas confondre avec l'actuel `session.ts`, qui porte les horloges
   d'inactivité et **reste tel quel**), `autorisation.ts`, `permissions.ts`,
   `correspondances.ts`.
   - Les **défis** ont chacun leur cookie, tous `httpOnly`, et **aucun n'ouvre
     d'espace** : second facteur en attente, changement de mot de passe imposé,
     code de réinitialisation. Le cookie de session n'est posé qu'une fois
     l'étape franchie — c'est ce qui rend le changement à la première connexion
     réellement imposé, et ce qui empêche un code de réinitialisation de valoir
     connexion. Le parcours d'activation/invitation existant en dépend
     directement.
   - Trois gardes : `sessionCourante()` (ne redirige pas),
     `exigerPermission(p)` (vers la connexion sans session, vers l'espace du
     profil quand le droit manque — **jamais vers une page vide**),
     `refuserSiConnecte()` (écrans d'accès).
   - **Les rôles sont de la donnée, pas du code** : ils viennent du service.
     `features/roles/types.ts` a déjà les douze modules et les quatre niveaux —
     c'est le catalogue de permissions qui manque. Ce qui reste en dur,
     délibérément : les **espaces** (routes + menu) et les verrous du cahier
     des charges.
3. **`src/lib/navigation/`** — extraire le menu des 808 lignes de
   `(app)/layout.tsx` (A5) : `types.ts`, `menu.ts` (`menuPourProfil`),
   `fil-ariane.ts`, `compteurs.ts`.
   - Le menu est **déclaratif** : une rubrique décrit les permissions qu'elle
     exige, jamais qui a le droit de la voir.
   - Le fil d'Ariane résout les **correspondances exactes d'abord** — sans cela
     une rubrique parente et sa sous-rubrique s'allument ensemble.
   - Les **pastilles** sont calculées par la coquille, et **seulement pour les
     rubriques réellement présentes** dans le menu de ce compte. Une lecture
     refusée ne donne **pas** de pastille, jamais un zéro ; zéro ne s'affiche
     pas non plus, c'est du bruit. Le nombre est doublé d'une mention
     `sr-only`.
4. **`features/<domaine>/actions.ts`** — le gabarit du §4, sans écart :
   garde revérifiée serveur → zod **rejoué** serveur → adaptateur →
   `revalidatePath` → **échec typé** (une action ne lève pas : l'écran doit
   rester ouvert, saisie intacte). Côté client, `useTransition` +
   `zodResolver`.
   Migrer domaine par domaine, en commençant par l'écriture la plus simple.
5. **Retirer `localStorage`** de `jetons.ts` une fois toutes les écritures
   passées en actions.

### Variante A — repli si `B-001` n'arrive pas

- `proxy.ts` posé et **passant**, avec son `matcher` — pour qu'il existe.
- Garde de route sur un cookie **témoin** non sensible (pas le jeton) posé par
  le client à la connexion : cela supprime l'affichage fugace de la coquille
  applicative à un visiteur non authentifié, **sans prétendre à une garde de
  sécurité** — le commentaire doit le dire, et renvoyer à `B-001`.
- Menu déclaratif et catalogue de permissions **quand même** (lot 5.3) : ils ne
  dépendent pas du cookie et sont rentables dans les deux variantes.
- Pas de server action. Les écritures restent client, validées par le même zod
  du lot 3.

**Recette** : un visiteur non authentifié sur `/tableau-de-bord` est renvoyé
**sans avoir reçu la coquille** (variante B) ; un profil sans le droit
`parametrer-roles` ne voit pas la rubrique **et** reçoit
`DROITS_INSUFFISANTS` s'il appelle l'action directement ; le changement de mot
de passe imposé ne peut pas être contourné en naviguant à la main.

---

## Lot 6 — React Query généralisé

**Objectif** : supprimer les 18 `useEffect` de chargement (A6), et avec eux les
18 réimplémentations de « chargement / erreur / vide ».

**Contenu**

- Un `queryKey` par domaine, dérivé des types du lot 4.
- Migration écran par écran, en commençant par `parametres/utilisateurs` et
  `parametres/roles` (listes simples), puis `tableau-de-bord`, `projets/[id]`,
  `configuration`.
- Les états de chargement passent par `EtatChargement` / `EtatErreur` /
  `EtatVide`, jamais réécrits sur place.
- Sous la variante B du lot 5, les lectures qui peuvent être servies par un
  server component le sont ; React Query ne garde que l'interactif.
- **Ne jamais afficher une valeur inventée à la place d'une valeur non servie**
  (doc §3.2) : « 0 dossier », « 0 % », « aucun élément » sont des affirmations,
  pas des cases vides. `lib/format` a déjà `ABSENT = "—"` — c'est le bon
  réflexe, il faut le généraliser.

---

## Lot 7 — Retrait des CSS Modules

**Objectif** : une seule façon de styler. 45 fichiers, 5 600 lignes.
**C'est le lot le plus long et le moins risqué** — il peut s'étaler et
s'interrompre sans conséquence.

**Méthode** : un écran = un commit = une recette visuelle contre
`docs/recette/avant/`. Jamais deux écrans dans le même commit. Les styles
communs remontent dans les motifs du lot 2 dès leur **deuxième** apparition —
« vingt copies d'un en-tête dérivent d'un pixel et d'une graisse ».

**Ordre** (du moins risqué au plus risqué, par volume de CSS) :

| Rang | Écran | CSS |
| --- | --- | --- |
| 1 | pages tuiles (`documents`, `stocks`, `rh`, …) | 3 lignes chacune |
| 2 | `not-found`, `BandeauSimulation`, `MarqueCCD`, `BadgeEssai` | 20-80 |
| 3 | écrans d'accès (`connexion`, `oublie`, `definir`, `invitation`, `activation`) | 41-209 |
| 4 | `inscription`, `CarteAuth`, `ModalSession` | 157-197 |
| 5 | `parametres/roles`, `parametres/utilisateurs`, composants `roles/` | 50-228 |
| 6 | `projets/[id]` | 290 |
| 7 | `(app)/layout` | 597 |
| 8 | `tableau-de-bord` | 649 + 90 |
| 9 | `configuration` (4 étapes) | 1 117 |

**À traiter dans le même passage** : les ~110 `style={{ … }}` porteurs de
couleur (D9), qui échappent au lint comme aux jetons.

**Point d'arrêt acceptable** : le lot peut s'arrêter après le rang 6 et
reprendre plus tard. Les rangs 7-9 sont les monolithes — s'ils ont déjà été
découpés au lot 4, ils deviennent faciles ; sinon, ils restent la partie
coûteuse.

---

## Lot 8 — Nettoyage

- **Découper `lib/api/simulation.ts`** (456 lignes, tous domaines confondus) en
  `features/<domaine>/mock/`, derrière `apiConfiguree("<domaine>")` — pour
  qu'un décor puisse être **supprimé domaine par domaine** au fur et à mesure du
  branchement.
- **Rendre les décors en lecture seule** (A9) : retirer `enregistrerEntreprise`
  et `creerProjet`. « Un décor qui accepte une écriture est pire que pas de
  décor » — l'entité s'affiche comme créée alors que la base ne l'a jamais vue.
  Une écriture non servie doit **refuser explicitement**, avec le numéro de
  demande backend correspondant.
- **Supprimer le code mort** : `FournisseurTheme.tsx`, blocs `[data-theme]`,
  bloc `.dark` (selon A3), dépendances jamais importées (O2).
- **Compléter `lib/api/client.ts`** sur les deux points où la doc va plus loin
  que l'existant : un **délai maximal** (`AbortController`) — indispensable sur
  une connexion de chantier — et une **trace de développement** conditionnée par
  une variable d'environnement, masquant les secrets et résumant les fichiers
  d'un `FormData` à nom/type/poids. Sous la variante B du lot 5, les actions
  s'exécutant côté serveur, l'onglet « Réseau » ne montre plus rien : sans cette
  trace, un refus devient indébogable.
- **Réécrire `CLAUDE.md`** sur l'architecture atteinte, et retirer de
  `eslint.config.mjs` les exemptions devenues inutiles (`tableau-de-bord/page.tsx`
  et `ModalCreationProjet.tsx` y sont exemptés pour des jeux de démonstration
  « à supprimer avec le branchement de l'API »).

---

## 4. Ordre d'exécution

```
Lot 0  ──┬─> Lot 1 ──> Lot 2 ──> Lot 3 ──┐
         │                               ├──> Lot 5 ──> Lot 6 ──> Lot 8
         └─> Lot 4 ─────────────────────┘
                        └─> Lot 7 (à partir du lot 2, en continu, interruptible)
```

- **Chemin critique** : 0 → 1 → 2 → 3 → 5. C'est là que passe l'effort.
- **Parallélisable** : le lot 4 dès la fin du lot 0 ; le lot 7 dès la fin du
  lot 2.
- **Point de non-retour** : aucun. Chaque lot est un commit révocable, et la
  cohabitation CSS Modules / Tailwind rend une interruption sans conséquence à
  n'importe quel rang du lot 7.
- **Seul blocage externe** : `B-001` (cookie `httpOnly`) pour la variante B du
  lot 5. À ouvrir au lot 0 pour laisser au backend le temps des lots 1 à 4.

---

## 5. Règles de coexistence pendant la migration

À inscrire dans `CLAUDE.md` dès le lot 1, sans quoi la cohabitation dégénère :

1. **Un écran est migré entièrement ou pas du tout.** Pas de moitié Tailwind,
   moitié CSS Module dans le même fichier.
2. **Aucun nouveau `*.module.css`.** Tout nouvel écran est en Tailwind + shadcn.
3. **Aucune nouvelle couleur en `style={{}}`** — elle passe par un ton
   (`components/statut/tons.ts`) ou par un utilitaire de charte.
4. **Aucune valeur en dur** : ni couleur, ni espacement, ni rayon. Le jeton
   existe ou il faut l'ajouter à `tokens.css`, qui reste la source unique.
5. **Aucun nouveau `fetch` hors `features/<domaine>/adaptateur.ts`.**
6. **Aucune nouvelle règle métier dans un composant.**
7. **Aucun nouvel import `@phosphor-icons/react`** (arbitrage A2).
8. Les règles i18n existantes ne se relâchent pas : toute exemption ajoutée à
   `eslint.config.mjs` est **un fichier**, jamais un dossier, et se justifie en
   une ligne.

---

## 6. Ce que ce plan ne traite pas

- **Les tests.** Il n'y en a pas (O6) et ce plan n'en introduit pas : ce serait
  un chantier à part entière, et la recette visuelle est un filet suffisant
  pour des lots de cette forme. À rouvrir après le lot 5 — c'est à ce
  moment-là que les `regles.ts` deviennent testables sans React, donc à ce
  moment-là que le premier test rapporte le plus.
- **O10 — la production épinglée sur un seul tenant** par `NEXT_PUBLIC_API_URL`
  dans le workflow de déploiement. Ce n'est pas un sujet d'architecture front,
  mais c'est potentiellement un défaut de production sérieux. **À trancher
  avant la refonte**, dans `docs/POINTS_OUVERTS.md`.
- **Le backend**, hors des demandes numérotées de `docs/DEMANDES_BACKEND.md`.
- **Les fonctionnalités.** Aucun lot n'ajoute d'écran ni ne change un
  comportement métier. Si un besoin fonctionnel apparaît en cours de route, il
  passe par un commit séparé — mélanger les deux rend la recette visuelle
  ininterprétable.

---

## 7. Suivi

| Livrable | Où |
| --- | --- |
| Diagnostic | `docs/DIAGNOSTIC_ARCHITECTURE.md` |
| Ce plan | `plan_refont.md` |
| Demandes backend numérotées | `docs/DEMANDES_BACKEND.md` *(lot 0)* |
| Charges utiles relevées | `docs/SCHEMAS_ATTENDUS.md` *(lot 0)* |
| Arbitrages non tranchés | `docs/POINTS_OUVERTS.md` *(lot 0)* |
| Référence visuelle | `docs/recette/avant/` *(lot 0)* |
| Règles applicables aux contributeurs | `CLAUDE.md` *(mis à jour à chaque lot)* |

**Définition de « lot terminé »** : `npm run lint`, `npm run typecheck` et
`npm run build` verts ; recette visuelle conforme ; `CLAUDE.md` à jour ; aucune
demande backend ouverte sans numéro.

---

## 8. Avancement

### Lot 0 — **terminé** (2026-09-17)

`lint`, `typecheck` et `build` verts ; `git diff --stat src/` vide.

| Point du lot | État |
| --- | --- |
| `docs/DEMANDES_BACKEND.md`, `docs/SCHEMAS_ATTENDUS.md`, `docs/POINTS_OUVERTS.md` | **écartés** — reportés sur décision explicite |
| `package.json` : `packageManager`, `typecheck`, dépendances en `devDependencies` | fait |
| CI : `lint` + `typecheck` avant le build | fait |
| Recette visuelle de référence | **partielle** — 24 captures sur 51 |
| Arbitrages inscrits dans `CLAUDE.md` | fait |

Ajout hors plan, rendu nécessaire par le constat ci-dessous : `package.json`
**déclare désormais tout le jeu de dépendances**. Tailwind, shadcn, lucide,
`cva`, `clsx`, `tailwind-merge`, `date-fns`, `react-day-picker`,
`@base-ui/react`, `tw-animate-css` et `cn` étaient installés dans
`node_modules` sans être enregistrés : `npm ci` en CI produisait un arbre
différent de toute machine de développement. Rien ne les importe encore.

### Dettes ouvertes à l'entrée du lot 1

1. **La recette visuelle ne couvre pas les écrans authentifiés.** Les 9 écrans
   sous session — `/configuration` (4 étapes), `/tableau-de-bord`, `/projets`,
   `/projets/[id]`, `/parametres/roles`, `/parametres/utilisateurs` — n'ont pas
   été capturés : les identifiants documentés (`admin@demo.ci` / `Demo1234!`,
   `CLAUDE.md` et `README.md`) reçoivent un `401` de
   `demo.localhost:8000/api/v1/auth/token/` dès la première tentative. Le
   script les capture dès qu'on lui passe un compte valide
   (`--email=`, `--motdepasse=`).
   **Conséquence assumée : sur plus de la moitié du produit, le lot 1 avancera
   sans le critère objectif que la règle n°4 du §0 exige.** Ces écrans sont
   aussi les plus lourds en CSS Modules (rangs 5 à 9 du lot 7), donc ceux où la
   référence manquera le plus.
2. **`B-001` n'est ouvert nulle part.** L'arbitrage A4 a retenu l'option B —
   cookie `httpOnly` posé par Django — mais le registre des demandes backend a
   été écarté du lot 0. Le lot 5 en dépend ; le délai que le plan voulait
   laisser au backend (les lots 1 à 4) a commencé à courir sans que la demande
   soit formulée.

### Ce que le lot 1 doit faire différemment du plan

Le diagnostic décrit un état que le dépôt n'a pas. Vérifié sur `main` :
`components.json` est absent, et `src/app/globals.css` ne contient ni
`@theme inline`, ni `--primary: oklch(…)`, ni bloc `.dark` ni
`@custom-variant dark`. Il n'y a **qu'une** palette, celle de la charte, dans
`src/styles/tokens.css`. Aucun stash ne porte l'état décrit.

- **D1, D3, D4, D5 n'existent pas ici.** Il n'y a pas deux systèmes de jetons
  qui s'ignorent, pas de double échelle de rayons, pas de `--font-sans`
  circulaire, pas de mode sombre mort-né.
- **D2, D6, D7, D8 sont bien présents** et restent au programme du lot 1 :
  collisions `.gap-*`/`.p-*` (`tokens.css:594-603`), double reset
  (`tokens.css:182-204`), double `:focus-visible` (`tokens.css:605-608`),
  blocs `[data-theme="primary-*"]` (`tokens.css:623-673`), replis `#D4652A`.
- **Le §1 change de nature** : le lot 1 n'a pas à *réconcilier* deux systèmes,
  il doit **installer Tailwind v4** (`postcss.config`, `@import "tailwindcss"`)
  et **créer** le `@theme inline` branché sur les jetons de charte. C'est plus
  simple et moins risqué — on n'hérite jamais des valeurs shadcn par défaut —
  mais le critère de sortie ne change pas : les captures de
  `docs/recette/avant/` doivent rester identiques au pixel.
- **A3 devient sans objet** : il n'y a pas de mode sombre à supprimer. La
  décision tient pour la suite — on n'en introduit pas.

### Écran de connexion — refondu (2026-09-17)

Première tâche produit menée selon la règle de marche retenue : **le plan
s'applique au besoin d'un écran, pas en une passe**. Seul ce que la connexion
exigeait a été pris du lot 1 ; le reste du lot n'a pas été touché.

**Fait**

| Élément | Détail |
| --- | --- |
| Socle Tailwind v4 | `postcss.config.mjs`, `@import "tailwindcss/…"`, `components.json` |
| `@theme inline` | Branché sur les jetons de charte — palettes, rayons, ombres, points de rupture (lot 1, points 3 à 5) |
| Un seul reset | Le doublon de `tokens.css:182-204` retiré, le reset de `globals.css` passé en couche `base` (point 1) |
| Collisions d'utilitaires | `.gap-1…6` et `.p-4…6` retirées de `tokens.css` — aucun `className` ne les utilisait (point 2) |
| Écran | `CadreAuthDouble` (photo floutée + voile à gauche, formulaire à droite), `FormulaireConnexion` en shadcn + zod + react-hook-form, `page.module.css` supprimé |
| Validation | `features/auth/validations.ts` + `lib/validations/champs.ts` — hors composant, donc réutilisable par une server action le jour de `B-001` |

**Preuve** : `lint`, `typecheck` et `build` verts. Recette rejouée sur les trois
largeurs. Les écrans non repris sont identiques au pixel à `docs/recette/avant/`
— seul le badge de développement Next.js diffère. La connexion, elle, change
volontairement : c'est la maquette demandée.

Vérification fonctionnelle (Playwright, navigateur réel) : message zod sur
adresse mal formée, bascule afficher/masquer du mot de passe, refus serveur →
alerte + compteur de tentatives + mot de passe vidé, `?session=expiree` →
bandeau de session expirée.

**Non fait du lot 1, et assumé** — rien de tout cela n'était nécessaire à cet
écran, et chacun touche des fichiers qu'il n'ouvre pas :

- point 7 : les blocs morts `[data-theme="primary-*"]` de `tokens.css` et
  `src/styles/FournisseurTheme.tsx` (jamais monté) sont toujours là ; le
  clignotement de la couleur d'entreprise attend `B-002`.
- point 8 : les replis `var(--color-primary-500, #D4652A)` subsistent.

**Constat relevé au passage, à traiter quand un écran concerné sera repris** :
huit fichiers utilisent des variables CSS qui ne sont **définies nulle part** —
`--p500`, `--p600`, `--n0…--n900`, `--war`, `--err`, `--suc`, `--inf`,
`--color-warning-*`, `--color-danger-*`, `--color-info-*`. Leur repli n'est donc
pas un filet : c'est la valeur réellement affichée, une couleur en dur qui
ignore le white-label. `--p500` rend du terre cuite chez un client « Océan ».
