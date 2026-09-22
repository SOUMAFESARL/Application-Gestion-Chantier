# Diagnostic d'architecture — CCD Digital (frontend)

> Établi le 2026-09-16 sur `main` (`c788e3a`), par confrontation du dépôt à
> `docs/ARCHITECTURE_REUTILISABLE.md`. Aucune modification de code n'a été
> faite : ce document constate, `plan_refont.md` décide.

## 0. Résumé

Le dépôt est **sain sur le plan de l'exécution** — `npm run build`,
`npx tsc --noEmit` et `npx eslint .` passent tous les trois sans un
avertissement. Le problème n'est pas la qualité ponctuelle du code, qui est
souvent supérieure à la moyenne (le client HTTP et la gestion de session sont
meilleurs que ce que la doc de référence exige). Le problème est que
**l'architecture décrite dans `ARCHITECTURE_REUTILISABLE.md` n'est présente
nulle part**, et que la pile déclarée dans `package.json` n'est pas celle qui
tourne.

Mesuré :

| Brique attendue | Installée | Utilisée dans le dépôt |
| --- | --- | --- |
| Tailwind v4 | oui | **0 classe utilitaire** |
| shadcn/ui (`base-nova`) | `components.json` posé | **0 composant généré** |
| `@base-ui/react` | oui | **0 fichier** |
| zod | oui | **0 fichier** |
| react-hook-form + `@hookform/resolvers` | oui | **0 fichier** |
| lucide-react | oui | **0 fichier** (26 fichiers en `@phosphor-icons`) |
| date-fns / react-day-picker | oui | **0 fichier** |
| `cva` / `clsx` / `tailwind-merge` | oui | **0 fichier** |
| Server actions | — | **0 fichier** (`"use server"` absent) |
| `proxy.ts` (garde serveur) | — | **absent** |
| React Query | oui, configuré avec soin | **2 fichiers sur 116** |

Ce qui tourne réellement : **45 fichiers `*.module.css`, 5 600 lignes de CSS
Modules**, 43 fichiers `"use client"`, 18 écrans qui appellent l'API à la main
dans un `useEffect`, et une validation réécrite formulaire par formulaire.

Autrement dit : les dépendances de la nouvelle architecture ont été installées
(modification en cours, non versionnée) mais **aucune ligne de code ne les
consomme**. Le dépôt est à l'instant précis où la bascule doit être organisée —
d'où ce plan.

---

## 1. Ce qui est déjà juste, et qu'il ne faut pas casser

Ces briques dépassent l'exigence de la doc de référence. Elles sont le socle
sur lequel la refonte s'appuie ; **aucun lot n'a le droit de les dégrader.**

| Brique | Fichier | Pourquoi c'est un acquis |
| --- | --- | --- |
| Point de passage HTTP unique | `lib/api/client.ts` | Renouvellement 401 **partagé** (une seule tentative en vol), pivot du jeton de renouvellement pris en compte, panne réseau distinguée de l'erreur applicative, `ErreurApi` à `code` stable, événement `EVENEMENT_SESSION_EXPIREE` plutôt qu'une redirection depuis la couche HTTP. C'est le §3.1 de la doc, en mieux commenté. |
| Formatage centralisé | `lib/format/index.ts` | `ABSENT = "—"` : jamais « 0 FCFA » pour dire « non renseigné ». C'est exactement la seconde règle du §3.2. |
| Règles d'un domaine déjà isolées | `features/auth/etats.ts` | Un vrai `regles.ts` : il classe des issues, il ne rédige pas. **Preuve que le découpage est atteignable dans ce dépôt.** |
| Horloges de session | `lib/auth/session.ts` | Deux horloges indépendantes (inactivité 30 min extensible, plafond 8 h non négociable), synchronisation `BroadcastChannel`, sauvegarde des saisies au démontage. La doc de référence ne couvre pas ce sujet : c'est un actif net. |
| Réglages React Query | `app/providers.tsx` | `QueryClient` en `useState` (pas de fuite de cache entre utilisateurs en SSR), pas de retry sur 4xx, pas de retry sur mutation. Rien à reprendre. |
| Multi-tenant par sous-domaine | `lib/api/client.ts` (`baseApi`) | Le même build sert toutes les entreprises. Les deux échappatoires sont documentées avec leur mode de panne. |
| Double garde-fou i18n | `eslint.config.mjs` | `i18next/no-literal-string` **plus** l'interdiction de tout caractère accentué dans un littéral `.ts`/`.tsx`, avec une liste d'exemptions au fichier près et justifiée. Plus strict que ce que demande la doc. |
| Outillage de développement | `dev/` | Double verrou (variable d'environnement **et** hôte localhost), délibérément pas `NODE_ENV`. |

---

## 2. Anomalies de design et de styles

### D1 — Deux systèmes de jetons qui ne se connaissent pas *(bloquant)*

`app/globals.css` importe `../styles/tokens.css` (la charte :
`--color-primary-500: #D4652A`, `--space-*`, `--radius-md: 8px`) **et** déclare
à côté le socle shadcn (`--primary: oklch(0.205 0 0)`, `--radius: 0.625rem`).

Conséquence directe : `--primary` est un **quasi-noir en niveaux de gris**. Le
premier composant posé par `shadcn add` s'affichera en gris anthracite, pas en
terre cuite. La charte est perdue au premier composant généré.

Symétriquement, la palette de la charte **n'est exposée à Tailwind nulle
part** : `--color-primary-500` est une variable `:root` ordinaire, pas un jeton
`@theme`. L'utilitaire `bg-primary-500` n'existe donc pas. Écrire du Tailwind
aujourd'hui, c'est écrire hors charte.

### D2 — Collisions de noms d'utilitaires *(bloquant, silencieux)*

`styles/tokens.css:594-603` définit des classes qui portent **le nom
d'utilitaires Tailwind, avec des valeurs différentes** :

| Classe | `tokens.css` | Tailwind v4 | Écart |
| --- | --- | --- | --- |
| `.gap-5` | 24 px | 20 px | **+4 px** |
| `.gap-6` | 32 px | 24 px | **+8 px** |
| `.p-5` | 24 px | 20 px | **+4 px** |
| `.p-6` | 32 px | 24 px | **+8 px** |
| `.gap-1..4`, `.p-4` | identiques par coïncidence | | 0 |

`tokens.css` est importé **hors couche** (`@layer`), Tailwind émet ses
utilitaires dans `@layer utilities` : **le CSS non calqué l'emporte
systématiquement**. Le jour où quelqu'un écrit `gap-6`, il obtient 32 px et non
24, sans message, sans avertissement, et sans moyen de le voir autrement qu'à
la règle. C'est le piège le plus coûteux du dépôt aujourd'hui, parce qu'il
n'apparaît qu'*après* qu'on a commencé à écrire du Tailwind.

### D3 — L'échelle de rayons est déclarée deux fois avec deux valeurs

`tokens.css` : `--radius-sm: 4px` / `md: 8px` / `lg: 12px` / `xl: 16px`.
`globals.css` `@theme inline` : `--radius-sm: calc(var(--radius) * 0.6)` ≈ 6 px,
`md` ≈ 8 px, `lg` = 10 px, `xl` ≈ 14 px.

Les deux atterrissent dans `:root`. Le vainqueur dépend de l'ordre de
compilation, pas d'une décision.

### D4 — `--font-sans` est circulaire

`globals.css`, bloc `@theme inline` :

```css
--font-heading: var(--font-sans);
--font-sans: var(--font-sans);   /* se référence elle-même */
```

Une propriété personnalisée qui se référence est **invalide au moment du
calcul**. L'utilitaire `font-sans` ne résout rien, et
`@layer base { html { @apply font-sans } }` est au mieux sans effet. La police
ne tient aujourd'hui que par `body { font-family: var(--font-family-base) }`,
qui est du CSS classique — donc les composants shadcn, qui lisent `--font-sans`,
ne seront pas en Inter.

### D5 — Le mode sombre est mort-né

`globals.css` déclare `body { background: var(--color-neutral-50) }` **hors
couche**, puis `@layer base { body { @apply bg-background } }`. Le CSS non
calqué gagne : `--background` et toute la palette `.dark` (37 déclarations) ne
peuvent jamais s'appliquer au corps de page. Le `@custom-variant dark` et le
bloc `.dark` sont du code mort.

### D6 — Trois réinitialisations en cascade

Un reset dans `tokens.css:182-204`, un second dans `globals.css:57-68`, et le
preflight de Tailwind. Ils ne se contredisent pas encore, mais ils rendent
impossible de répondre à « d'où vient cette marge ».

`:focus-visible` est dans le même cas : `box-shadow` + `outline: none` dans
`tokens.css:605-608`, `outline: 2px solid` dans `globals.css:112-115`. Les deux
s'appliquent → double anneau de focus.

### D7 — Le white-label a deux mécanismes, dont un mort

1. `tokens.css:623-673` — cinq blocs `[data-theme="primary-*"]`. **Rien ne pose
   jamais l'attribut `data-theme`** (zéro occurrence hors de ce fichier). Code
   mort.
2. `styles/theme.ts:159` `appliquerCouleurPrimaire()` — calcule l'échelle
   50→900 en JavaScript et l'injecte sur `documentElement`. C'est le mécanisme
   réel, appelé depuis `(app)/layout.tsx:130` dans un `useEffect`, **après le
   premier rendu** : chaque client non terre-cuite voit donc la couleur par
   défaut clignoter à chaque chargement.
3. `styles/FournisseurTheme.tsx` — un fournisseur prévu exactement pour ça,
   **jamais monté**. Code mort également.

### D8 — Trois sources de vérité pour la couleur primaire

`#D4652A` est écrit en dur :

- dans `tokens.css:31` (le jeton, légitime) ;
- dans `styles/couleurs.ts:31` (`COULEUR_PRIMAIRE_DEFAUT`, pour le `<meta>`) ;
- dans `styles/theme.ts:9` (`COULEUR_TERRE_CUITE_DEFAUT`) ;
- **et 18 fois comme valeur de repli** dans des `var(--color-primary-500, #D4652A)`,
  réparties sur 9 fichiers CSS Modules et 4 fichiers TSX.

Le commentaire de `couleurs.ts` affirme que « c'est la seule paire du projet
dans ce cas ». Ce n'est plus vrai. Chaque repli en dur est un endroit où un
client en « Océan » reverra du terre cuite.

### D9 — La couleur en `style={{}}` échappe à tout

Environ 110 attributs `style={{ … }}`, dont une majorité porte une couleur —
`(app)/layout.tsx` (fonction `IconeMeteo`), `TableauDeBordClient.tsx` (25),
`ModalNouveauRole.tsx` (28). Ces valeurs échappent aux CSS Modules, au futur
Tailwind, et au lint. Elles ne peuvent pas être reprises en un fichier.

### D10 — Pas de vocabulaire de statut partagé

Le §7.1 de la doc demande un `components/statut/tons.ts` unique. Ici, la
correspondance statut → couleur est écrite **dans la page de démonstration**
(`app/design-system/page.tsx:81` : `EN_RETARD: "avertissement"`), donc dans
le seul écran qui n'est pas le produit. Chaque écran réel décide de sa teinte
localement.

---

## 3. Anomalies d'architecture

### A1 — Aucune couche domaine : les types de l'API sont les types des écrans *(structurant)*

`features/<domaine>/api.ts` exporte directement les charges utiles du
service, en `snake_case` :

```ts
// features/projets/api.ts
export interface ProjetDetail {
  budget_initial_montant: number | null;
  avancement_theorique: number;
  statut: "EN_ATTENTE" | "EN_COURS" | "EN_RETARD" | …;
}
```

et `(app)/layout.tsx` importe `ProfilUtilisateur`, `Abonnement`, `MeteoProjet`,
`DonneesEntreprise` depuis ces mêmes fichiers. Il n'existe **aucune fonction
`versX()`**. Le quatrième interdit du §3 est violé de bout en bout : un
renommage de champ côté Django traverse jusqu'au JSX.

### A2 — Les règles métier vivent dans le JSX, en double

L'écart d'avancement est calculé **deux fois, indépendamment** :

- `app/(app)/projets/[id]/page.tsx:92`
- `app/(app)/tableau-de-bord/TableauDeBordClient.tsx` (`ecart` consommé,
  seuil `< -5` codé en dur ligne 395)

Même chose pour le ratio de consommation budgétaire
(`TableauDeBordClient.tsx:237`) et pour les conversions centimes ↔ francs,
refaites à la main dans trois modales (`EtapeProjet.tsx:145,226`,
`ModalCreationProjet.tsx:112`, `ModalDefinirBudget.tsx:47`) alors que
`lib/format` sait déjà le faire. « Deux écrans qui recalculent la même chose
finissent par afficher deux vérités » — c'est déjà le cas.

Aucun fichier `regles.ts` n'existe, hors `features/auth/etats.ts`.

### A3 — Zéro server action, zéro validation partagée

`"use server"` : **0 occurrence**. Toutes les écritures partent du navigateur.
zod : **0 occurrence**. La validation est réécrite à la main dans chaque
formulaire — `FormulaireInscription.tsx:73` a sa propre fonction `valider()`,
sa propre expression rationnelle d'email, sa propre forme d'erreur
`Record<string, string>` ; `EcranActivation`, `EcranDefinition`,
`FormulaireOubli`, `ModalCreationProjet`, `ModalNouveauRole` ont chacun la
leur.

Conséquences :

- le même champ (email, montant, téléphone) est refusé différemment selon
  l'écran ;
- aucune validation n'est **rejouée côté serveur** — il n'y a pas de côté
  serveur ;
- la politique de mot de passe existe bien à un seul endroit
  (`features/auth/reglesMotDePasse.ts`, bon point) mais n'alimente aucun
  schéma.

### A4 — Aucune garde serveur *(sécurité)*

Ni `proxy.ts` ni `middleware.ts`. La protection des 21 routes de `(app)/` tient
entièrement à `(app)/layout.tsx:107` :

```ts
const estAuthentifie = useSyncExternalStore(abonnementSession, () => sessionOuverte(), () => null);
```

suivi d'un `router.replace`. C'est-à-dire : **après** l'envoi du bundle,
**après** l'hydratation, côté client. Un visiteur non authentifié télécharge la
coquille applicative complète et voit l'écran avant d'être renvoyé. Le §5 de la
doc pose la règle inverse : « masquer un bouton ne protège rien ».

Corollaire : le jeton de renouvellement est en `localStorage`
(`lib/api/jetons.ts`), ce que le fichier lui-même signale comme « à
trancher avant la mise en production ». Ce n'est pas un oubli, c'est la
conséquence mécanique de l'absence de session serveur.

### A5 — Pas de catalogue de permissions, pas de menu déclaratif

`features/roles/types.ts` définit un RBAC complet (`NiveauAcces` 0→3, douze
modules) — mais **rien ne s'en sert pour garder une route ou masquer une
rubrique**. Le menu est un arbre JSX écrit à la main dans `(app)/layout.tsx`,
**808 lignes**, composant client, avec les 24 icônes, la météo, l'abonnement,
le profil et l'entreprise chargés dedans. Il n'y a ni `lib/navigation/menu.ts`,
ni fil d'Ariane, ni pastilles.

### A6 — React Query configuré mais court-circuité

Le `QueryClient` est réglé finement… et `useQuery` n'apparaît que dans
`lib/api/enumerations.ts`. Les 18 autres écrans font `useEffect` +
`useState` + appel manuel : pas de cache partagé, pas de déduplication, pas de
politique de retry, et **chaque écran réimplémente ses états de chargement /
erreur / vide**.

### A7 — Composants monolithiques

| Fichier | Lignes |
| --- | --- |
| `app/(app)/layout.tsx` | 808 |
| `app/(app)/tableau-de-bord/TableauDeBordClient.tsx` | 763 |
| `app/(app)/configuration/EtapeEntreprise.tsx` | 517 |
| `app/(app)/configuration/EtapeProjet.tsx` | 463 |
| `lib/api/simulation.ts` | 456 |
| `app/(app)/configuration/EtapeEquipe.tsx` | 396 |

À quoi s'ajoutent leurs feuilles : `layout.module.css` 597 lignes,
`TableauDeBord.module.css` 649, `configuration/page.module.css` 1 117.

### A8 — Pas de motif de liste partagé

`components/ui/Tableau.tsx` (105 lignes) rend un `<table>`. Il n'a **ni
recherche, ni tri, ni pagination, ni repli en cartes sous `md`**, et ne
distingue pas « aucune donnée » de « aucun résultat » (§7.3). Les écrans de
liste (`parametres/utilisateurs`, `parametres/roles`) refont donc chacun leur
version.

### A9 — La couche de simulation accepte des écritures

`lib/api/simulation.ts:352` `enregistrerEntreprise()`, `:359`
`creerProjet()`. C'est précisément ce que le §3.2 interdit : « un décor qui
accepte une écriture est pire que pas de décor » — l'entité s'affiche comme
créée alors que la base ne l'a jamais vue. C'est de plus **un fichier unique
pour tous les domaines**, donc impossible à supprimer domaine par domaine au
fur et à mesure du branchement.

---

## 4. Anomalies d'outillage et de dépendances

| # | Constat | Détail |
| --- | --- | --- |
| O1 | Deux bibliothèques d'icônes | `@phosphor-icons/react` (26 fichiers, réel) et `lucide-react` (0 fichier, exigé par la doc et livré avec `base-nova`). |
| O2 | Dépendances mortes | `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `date-fns`, `react-day-picker`, `tw-animate-css` : installées, jamais importées. `clsx` et `tailwind-merge` le resteront, `lib/utils.ts` réexportant `cn` depuis le paquet `cn` (équivalent fonctionnel officiel shadcn — décision à assumer explicitement plutôt qu'à subir). |
| O3 | `@tailwindcss/postcss` en `dependencies` | Outil de compilation ; sa place est en `devDependencies`. |
| O4 | `packageManager` absent | La doc l'exige épinglé. Rien ne garantit aujourd'hui que deux machines résolvent le même arbre. |
| O5 | Pas de script `typecheck` | `npx tsc --noEmit` fonctionne mais n'est pas dans `package.json`, donc pas dans la CI. |
| O6 | Aucun test | Constaté, et conforme à `CLAUDE.md` — mais c'est ce qui rend la refonte risquée : le seul filet est `build` + `tsc` + `eslint`. |
| O7 | Trois documents de suivi manquants | `docs/DEMANDES_BACKEND.md`, `docs/SCHEMAS_ATTENDUS.md`, `docs/POINTS_OUVERTS.md` (§11). Sans le premier, chaque contournement devient une règle du projet. |
| O8 | Divergence d'arborescence | Le dépôt a `features/<domaine>/` ; la doc décrit `lib/<domaine>/` + `lib/api/<domaine>.ts` + `components/<domaine>/`. À arbitrer — voir `plan_refont.md` §2. |
| O9 | La CI ne vérifie que le build | `.github/workflows/deploy-cpanel.yml` enchaîne `npm ci` puis `npm run build`. Ni `lint` ni `tsc --noEmit` ne tournent. Le double garde-fou i18n — le meilleur acquis du dépôt — **n'est donc jamais appliqué automatiquement** : il ne tient qu'à la discipline de qui lance `eslint` à la main. |
| O10 | La production est épinglée sur un seul tenant | Le même workflow pose `NEXT_PUBLIC_API_URL: https://api-chantier.soumafe.com`. Or `client.ts` documente cette variable comme « à n'employer qu'en dernier recours », parce qu'elle **annule la résolution de l'API par sous-domaine**. Le build déployé interroge donc toujours le même hôte, quel que soit le sous-domaine visité — exactement le mode de panne que `CLAUDE.md` décrit (« un client fraîchement inscrit verrait sa connexion vérifiée contre la base d'une autre entreprise »). À confirmer avec l'hébergement : soit le déploiement actuel est mono-tenant et c'est assumé, soit c'est un défaut de production. **Hors périmètre de la refonte, mais à trancher en priorité.** |

---

## 5. Hiérarchie des causes

Beaucoup de ces constats n'en sont qu'un seul, vu de six côtés :

```
Absence de session serveur (A4)
  └─> tout est client (43 "use client")
        ├─> pas de server action possible (A3)
        ├─> jeton de renouvellement en localStorage (A4)
        ├─> chargement en useEffect (A6)
        └─> garde de route décorative (A4)

Absence de couche domaine (A1)
  ├─> les règles n'ont pas d'endroit où vivre  -> elles vont dans le JSX (A2)
  ├─> pas de schéma zod partageable            -> validation par écran (A3)
  └─> les écrans dépendent du contrat HTTP

Deux systèmes de jetons non réconciliés (D1)
  ├─> shadcn rendrait en gris                  -> personne ne génère de composant
  ├─> pas d'utilitaire de charte               -> personne n'écrit de Tailwind
  └─> chacun écrit son CSS Module              -> 5 600 lignes, 45 fichiers
```

**Il y a donc trois chantiers, pas vingt-huit.** C'est ce découpage que
`plan_refont.md` suit : réconcilier les jetons (D), reconstituer les couches
(A1→A3), puis déplacer la frontière client/serveur (A4).
