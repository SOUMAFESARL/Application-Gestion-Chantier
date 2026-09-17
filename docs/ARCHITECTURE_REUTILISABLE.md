# Architecture de référence — application métier Next.js

Ce document décrit l'architecture, les conventions et les briques à reprendre
pour démarrer un nouveau projet sur le même socle. Il est **autonome** : rien
n'y dépend du domaine du projet d'origine. Copiez-le à la racine du nouveau
dépôt (par exemple sous `ARCHITECTURE.md`, ou intégrez-le à `CLAUDE.md` /
`AGENTS.md` pour qu'un agent le lise avant d'écrire du code).

---

## 1. Pile technique

| Rôle | Choix | Remarque |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router) | Le `middleware` n'existe plus : son remplaçant est `proxy.ts` à la racine |
| Runtime UI | **React 19.2** | Server Components par défaut, `"use client"` à la demande |
| Langage | **TypeScript strict** | `strict: true`, `noEmit`, alias `@/*` → racine |
| Styles | **Tailwind v4** | Configuré **entièrement dans `app/globals.css`** (`@theme inline`) — pas de `tailwind.config.*` |
| Composants | **shadcn/ui, style `base-nova` sur `@base-ui/react`** | Ce n'est **pas** Radix : les extraits de la doc shadcn/Radix ne se collent pas tels quels |
| Formulaires | **react-hook-form + zod v4** via `@hookform/resolvers` | Un schéma zod par écriture, partagé formulaire ↔ server action |
| Icônes | **lucide-react** | Une icône double toujours une couleur (accessibilité) |
| Dates | **date-fns** + `react-day-picker` | Une seule arithmétique de dates dans le projet |
| Gestionnaire | **npm**, épinglé par `packageManager` | |

Dépendances complémentaires utiles : `class-variance-authority`, `clsx`,
`tailwind-merge`, `tw-animate-css`, `input-otp` (si second facteur).

### Mise en place

```bash
pnpm create next-app@latest mon-projet --typescript --app --tailwind --eslint
cd mon-projet
pnpm dlx shadcn@latest init          # style base-nova, cssVariables: true
pnpm add react-hook-form zod @hookform/resolvers lucide-react date-fns \
         class-variance-authority clsx tailwind-merge tw-animate-css
```

Scripts attendus :

```bash
pnpm dev            # serveur de développement
pnpm build          # build de production (typecheck inclus)
pnpm lint           # eslint (flat config)
npx tsc --noEmit    # typecheck seul
```

**Règle** : les composants `components/ui/` sont posés par
`pnpm dlx shadcn@latest add <composant>` — on ne les écrit jamais à la main,
on les *retouche* ensuite si besoin.

---

## 2. Arborescence

```
app/
  (auth)/               écrans d'accès : connexion, second facteur, changement
                        de mot de passe, mot de passe oublié
  (dashboard)/
    layout.tsx          coquille commune : barre latérale + barre supérieure
    actions.ts          server actions transverses
    actions-<domaine>.ts une par domaine métier
    <espace>/           un dossier par espace/profil applicatif
  api/                  route handlers (uniquement quand rien d'autre ne marche)
  globals.css           thème Tailwind v4 : @theme inline + jetons oklch
  layout.tsx
components/
  ui/                   primitives shadcn (générées)
  <domaine>/            écrans et composants d'un domaine
  formulaire/           briques de saisie partagées (date, heure, fichier…)
  tableau/              table de données, recherche, filtres
  statut/               vocabulaire visuel : tons, badges, cartes, bandeaux
  navigation/           fil d'Ariane, page introuvable
hooks/
lib/
  api/                  ADAPTATEURS : le seul endroit qui parle au backend
    client.ts           point de passage unique (fetch, erreurs, délai)
    <domaine>.ts        un adaptateur par domaine
    mock/               décors, un fichier par domaine
  auth/                 session, permissions, autorisation, correspondances
  navigation/           menu, fil d'Ariane, compteurs de pastilles
  validations/          schémas zod, un fichier par domaine + champs.ts partagé
  format/               csv, dates, fichiers, poids — utilitaires de rendu
  <domaine>/            types.ts + regles.ts (métier pur, sans React)
  utils.ts              cn()
docs/                   cahier des charges, maquettes, demandes backend
proxy.ts                remplaçant du middleware (Next 16)
```

---

## 3. Le découpage en couches — la règle centrale

Un domaine métier se décline **toujours** en cinq fichiers, dans cet ordre de
dépendance (chaque couche ne connaît que celles du dessus) :

```
lib/<domaine>/types.ts                 les types du domaine, aucun type HTTP
lib/<domaine>/regles.ts                les règles métier — pures, zéro React
lib/validations/<domaine>.ts           les schémas zod des écritures
lib/api/<domaine>.ts                   l'adaptateur : traduit API ↔ domaine
app/(dashboard)/actions-<domaine>.ts   les server actions (garde + zod + appel)
components/<domaine>/ecran-*.tsx       les écrans
```

Quatre interdits qui tiennent tout le reste :

1. **Aucun composant n'appelle `fetch`.** Le réseau passe par `lib/api/`, et
   `lib/api/` seul passe par `lib/api/client.ts`. Un changement d'URL, de
   format d'erreur ou d'authentification ne doit toucher qu'un fichier.
2. **Aucune règle métier dans un composant.** Si un calcul décide quelque
   chose (un seuil, une moyenne, une éligibilité, un libellé d'état), il vit
   dans `regles.ts` et il n'a **qu'une seule implémentation**. Deux écrans qui
   recalculent la même chose finissent par afficher deux vérités.
3. **Aucune écriture sans server action.** On préfère les server actions au
   fetch côté client ; c'est là que se posent la garde de droits et le zod.
4. **Aucun type de l'API dans les écrans.** L'adaptateur mappe la charge utile
   du service vers les types du domaine (`versX(...)`), et traduit les refus
   en **codes métier**, jamais en statuts HTTP.

### 3.1 `lib/api/client.ts` — le point de passage unique

Il porte, une fois pour tout le projet :

- l'URL de base, lue dans l'environnement ;
- un **délai maximal** (`AbortController`) — indispensable si la cible est une
  connexion lente ;
- la classe d'erreur de transport :

```ts
export class ErreurApi extends Error {
  readonly statut: number;
  readonly code: string;
  /** Message brut du service : jamais affiché tel quel (langue, formulation
   *  non contractuelle). Sert seulement à départager des cas que le statut
   *  HTTP confond. */
  readonly messageApi: string;
  /** Erreurs par champ, telles que renvoyées par le service. */
  readonly erreursChamps: Readonly<Record<string, readonly string[]>>;
}
```

- l'en-tête d'authentification (`Bearer`), la composition d'URL publique pour
  les fichiers, et une **trace de développement** conditionnée par une
  variable d'environnement, qui masque les secrets (mots de passe, codes,
  jetons) et résume les fichiers d'un `FormData` à nom/type/poids. Les server
  actions s'exécutant côté serveur, l'onglet « Network » du navigateur ne
  montre rien : sans cette trace, un refus est indébogable.

### 3.2 Bouchons (décors) et interrupteur

Tant qu'un endpoint n'existe pas, l'adaptateur se replie sur un décor
`lib/api/mock/<domaine>.mock.ts`, derrière un interrupteur :

```ts
export function apiConfiguree(module: string | null = null): boolean {
  if (!process.env.API_URL) return false;
  const actifs = (process.env.API_MODULES ?? "")
    .split(",")
    .map((nom) => nom.trim())
    .filter(Boolean);
  if (actifs.includes("*")) return true;
  return module !== null && actifs.includes(module);
}
```

Deux règles apprises à l'usage :

- **Un décor qui accepte une écriture est pire que pas de décor.** Une entité
  « enregistrée » en mémoire de processus s'affiche comme créée alors que la
  base ne l'a jamais vue. Dès qu'un domaine est servi, on **supprime** son
  décor plutôt que de le garder « au cas où ».
- **Ne jamais afficher une valeur inventée à la place d'une valeur non
  servie.** « 0 dossier », « 0 % », « aucun élément » sont des *affirmations*,
  pas des cases vides. Un composant dédié doit dire « le service ne sert pas
  encore cette donnée ».

### 3.3 Les refus se traduisent en codes, et les codes en actions correctives

L'adaptateur convertit le transport en code métier :

```ts
export type CodeErreurDomaine =
  | "DROITS_INSUFFISANTS" | "DONNEES_INVALIDES" | "INTROUVABLE"
  | "CODE_DEJA_UTILISE"   | "ENTITE_UTILISEE"   | "SERVICE_INDISPONIBLE";
```

La server action détient la table des messages, et **chaque message dit quoi
faire** :

```ts
const MESSAGES: Record<CodeErreurDomaine, string> = {
  ENTITE_UTILISEE:
    "Suppression impossible : des dossiers s'y rattachent. Passez son statut à « Archivée » pour la retirer des listes sans amputer ces dossiers.",
  SERVICE_INDISPONIBLE:
    "Le service est momentanément indisponible. Réessayez dans quelques instants.",
  // …
};
```

Quand le service refuse par champ (style Laravel `422` + `errors`), on relit
le refus **champ par champ** pour remettre le focus sur le bon champ — jamais
par le statut HTTP seul.

### 3.4 Une lecture peut renvoyer son refus avec la liste

Lorsqu'une route peut légitimement répondre `403` à un profil qui a pourtant
l'écran, la lecture ne lève pas : elle renvoie `{ lignes, refus }`. L'écran
**nomme le motif** au lieu d'afficher une liste vide, qui se lirait « il n'y a
rien » alors que la réponse est « on ne sait pas ».

---

## 4. Server actions — le gabarit

```ts
"use server";

import { revalidatePath } from "next/cache";
import { autoriser } from "@/lib/auth/autorisation";
import { schemaEntite } from "@/lib/validations/domaine";
import { creerEntite } from "@/lib/api/domaine";

export async function creerEntiteAction(
  saisie: unknown
): Promise<EchecDomaine | void> {
  // 1. Garde : le droit est REVÉRIFIÉ ici. Masquer un bouton ne protège rien,
  //    une action reste appelable de l'extérieur.
  const acces = await autoriser("parametrer-domaine");
  if (!acces) return echec("DROITS_INSUFFISANTS");

  // 2. Validation serveur : le zod du formulaire est rejoué ici.
  const analyse = schemaEntite.safeParse(saisie);
  if (!analyse.success) return echec("DONNEES_INVALIDES");

  // 3. Appel de l'adaptateur.
  const resultat = await creerEntite(acces.jeton, analyse.data);
  if (!resultat.ok) return echec(resultat.code);

  // 4. Rafraîchissement.
  revalidatePath(`${racine(acces.compte.profil)}/entites`);
}
```

Quatre points non négociables :

- la garde est **re-appliquée côté serveur**, pas seulement cachée dans l'UI ;
- le zod du formulaire est **rejoué** côté serveur (l'un valide la saisie,
  l'autre fait foi) ;
- une action **retourne un échec typé**, elle ne lève pas : l'écran doit
  pouvoir rester ouvert avec la saisie intacte ;
- ce que le serveur peut relire lui-même ne transite pas par le navigateur.

Côté client, le formulaire consomme l'action par `useTransition` :

```tsx
const [enCours, demarrerTransition] = useTransition();
const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);

const form = useForm<Saisie>({ resolver: zodResolver(schemaEntite) });

function onSubmit(valeurs: Saisie) {
  demarrerTransition(async () => {
    const echec = await creerEntiteAction(valeurs);
    if (echec) {
      setErreurGlobale(echec.message); // le dialogue reste ouvert, saisie intacte
      return;
    }
    onOuvertChange(false);
  });
}
```

---

## 5. Accès, session et droits

```
lib/auth/
  types.ts           CompteUtilisateur, Profil, Permission
  constantes.ts      noms de cookies, durées, ROUTE_PAR_PROFIL, ROUTE_CONNEXION
  session.ts         pose et lecture des cookies (httpOnly)
  autorisation.ts    gardes d'écran et de server action
  permissions.ts     catalogue des droits, verrous du cahier des charges
  correspondances.ts rôle du service → espace applicatif
  mot-de-passe.ts    la politique de mot de passe, à un seul endroit
```

**Session et défis.** Une session, et des *défis* qui n'en sont pas : second
facteur en attente, changement de mot de passe imposé, code de
réinitialisation. Chacun a son cookie, tous `httpOnly`, **aucun n'ouvre
d'espace**. Le cookie de session n'est posé qu'une fois l'étape franchie :
c'est ce qui rend le changement à la première connexion réellement imposé, et
ce qui empêche un code de réinitialisation de valoir connexion.

**Les gardes.**

```ts
export async function sessionCourante(): Promise<AccesAutorise | null>;  // ne redirige pas
export async function exigerPermission(p: CodePermission): Promise<AccesAutorise>;
export async function refuserSiConnecte(): Promise<void>;                // écrans d'accès
```

`exigerPermission` renvoie vers la connexion sans session, et vers l'espace du
profil quand le droit manque — jamais vers une page vide.

**Les rôles sont de la donnée, pas du code.** Ils viennent du service ; ne
codez pas une liste de rôles en dur. Ce qui reste en dur, délibérément : les
**espaces** (routes physiques + menu) et les **verrous** du cahier des
charges, qui portent sur l'espace et non sur le rôle. Un rôle qui ne résout
aucun espace n'ouvre aucune session — on ne devine jamais un espace.

**La politique de mot de passe vit dans un seul fichier**, qui alimente le
schéma zod *et* la liste de contrôle affichée à l'écran ; le service prononce
le refus final.

---

## 6. Navigation

```
lib/navigation/
  types.ts      GroupeMenu / ElementMenu / SousElementMenu
  menu.ts       menuPourProfil(compte) — confronte les exigences aux droits
  fil-ariane.ts résolution du fil, correspondances EXACTES d'abord
  compteurs.ts  pastilles du menu
```

Le menu est **déclaratif** : une rubrique décrit les permissions qu'elle
exige, jamais qui a le droit de la voir.

```ts
export type ElementMenu = {
  cle: string;
  libelle: string;
  href: string;
  icone: LucideIcon;
  /** La rubrique ne désigne que cette adresse, jamais ses pages filles.
   *  À poser sur une rubrique installée à la racine d'un espace. */
  exact?: boolean;
  permissions?: readonly Permission[];
  enfants?: readonly SousElementMenu[];
};
```

Le fil d'Ariane résout **les correspondances exactes en premier**, avant toute
couverture par préfixe : sans cela, une rubrique parente et sa sous-rubrique
s'allument en même temps.

Les **pastilles** sont calculées par la coquille (le layout), jamais par la
barre elle-même, et **seulement pour les rubriques réellement présentes** dans
le menu de ce compte — un profil qui ne voit pas la rubrique ne paie pas sa
lecture. Une lecture refusée ne donne **pas de pastille**, jamais un zéro ;
zéro ne s'affiche pas non plus, c'est du bruit. Le nombre est doublé d'une
mention `sr-only` de ce qu'il compte.

---

## 7. Conventions d'interface

### 7.1 Le vocabulaire de couleur — `components/statut/tons.ts`

**Un seul** vocabulaire de couleur pour tout le projet. Une pastille, une
tuile, une carte, un tableau désignent leur couleur par un **ton**, jamais par
une classe Tailwind. C'est ce qui permet de reprendre la charte en un fichier
au lieu de vingt, et ce qui interdit à deux écrans de teinter différemment le
même état.

```ts
export type TonStatut =
  | "acquis"       // validé, admis, soldé, à jour
  | "encours"      // ouvert, engagé, qui suit son cours
  | "jalon"        // étape de circuit franchie, qui attend la suivante
  | "attente"      // ce qui appelle une action
  | "critique"     // refus, échec, seuil dépassé
  | "inactif"      // rien ne s'y passe : clôturé, archivé, suspendu
  | "engagement"   // engagement financier ou contractuel
  | "distinction"; // mention, distinction
```

Quatre classes par ton : `surface` (fond **plein**, jamais une teinte à faible
opacité — une carte translucide change de couleur selon ce qu'elle recouvre),
`fond` (la même teinte à faible opacité, pour ce qui se pose *sur* une surface
déjà teintée), `texte`, `texteVif`.

**La couleur ne porte jamais l'information seule** : un badge écrit son
libellé et le double d'une icône, une tuile écrit sa précision sous le
chiffre. Exigence d'accessibilité.

Les contrastes se vérifient **par paire** (texte sur sa propre surface, le cas
le plus exigeant) et les deux jeux — surfaces et textes — se retouchent
ensemble, jamais l'un sans l'autre.

### 7.2 Une seule implémentation par motif d'interface

| Motif | Fichier unique |
| --- | --- |
| Liste | `components/tableau/table-donnees.tsx` |
| Filtre | `components/tableau/declencheur-filtre.tsx` |
| En-tête de page | `components/tableau-de-bord/en-tete-page.tsx` |
| En-tête de tiroir | `components/statut/en-tete-tiroir.tsx` |
| Carte de section | `components/statut/carte-section.tsx` |
| Bandeau de fiche | `components/statut/bandeau-fiche.tsx` |
| Grille de champs | `components/statut/grille-champs.tsx` |
| Badge d'état | `components/statut/badge-ton.tsx` |
| Champ date / heure / fichier | `components/formulaire/champ-*.tsx` |

Vingt copies d'un en-tête dérivent d'un pixel et d'une graisse. Dès qu'un
motif apparaît une deuxième fois, il devient un composant.

### 7.3 Les listes

`TableDonnees<T>` est un composant **client** prenant des *render props* :
recherche, tri par colonne, pagination (10 lignes, la même partout), repli en
cartes sous `md`, et **deux états vides distincts** — « aucune donnée » et
« aucun résultat », qui ne disent pas la même chose. Un écran serveur
l'atteint par une table cliente dédiée (`TableauEntites`).

Recherche, tri et pagination travaillent sur la liste **déjà chargée** : c'est
le service qui borne en amont. Un aller-retour réseau par frappe est
inutilisable sur une connexion lente.

Les filtres ont **tous la même forme** : un `Select` dont le déclencheur est
`DeclencheurFiltre` (icône, valeur retenue en `font-medium`, chevron à droite,
hauteur et largeur fixes pour s'aligner sur le champ de recherche). Un filtre
n'a pas de libellé visible — la valeur affichée en tient lieu — donc la prop
`libelle` est **obligatoire** et sert d'`aria-label` : sans elle un lecteur
d'écran annonce « Tous les statuts » sans dire ce que cela restreint. Les
filtres se rangent comme on restreint : périmètre d'abord, statut en dernier.

Exception assumée : un **sélecteur en cascade** qui choisit *ce qu'on charge*
(et non ce qu'on filtre) garde son libellé visible — ce n'est pas un filtre.

### 7.4 Les formulaires

- **Aucune prose d'aide sous un champ.** Le libellé, le placeholder et le
  message d'erreur disent ce qu'est le champ ; une description répète et
  pousse les champs sous la ligne de flottaison. Trois exceptions, qui *ne
  décrivent pas le champ* : le **diagnostic d'une liste vide ou non servie**
  (« Aucun niveau actif : déclarez-en un dans la rubrique Niveaux »), le
  **retour calculé sur la saisie** (« Écriture portée au journal : −15 000 »),
  et le **refus destructif**, qui est une erreur et non de la prose. Chacune
  ne s'affiche **que quand elle s'applique**, jamais comme branche `else` d'un
  ternaire dont l'autre branche était de la prose.
- Les briques de saisie partagées vivent dans `components/formulaire/` : date
  (Popover + Calendar, chaîne `AAAA-MM-JJ`, conversion **locale** et non UTC),
  heure, fichier, bouton de soumission avec état d'attente, libellé
  obligatoire.
- `lib/validations/champs.ts` porte les briques zod partagées pour que deux
  formulaires refusent la même nature de donnée de la même façon :

```ts
/** Champ numérique alimenté par un <input> : le navigateur renvoie une
 *  chaîne, la server action peut recevoir un nombre. Les deux entrées
 *  aboutissent au même entier, ou au même refus. */
export function entier(options: { min: number; max: number; requis: string; hors: string }) {
  return z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : v.trim()))
    .refine((v) => v !== "", { error: options.requis })
    .transform(Number)
    .refine(Number.isInteger, { error: options.hors })
    .refine((v) => v >= options.min && v <= options.max, { error: options.hors });
}
```

- Les **bornes de saisie** (min, max, valeurs par défaut) sont déclarées dans
  `regles.ts` et **reprises telles quelles** par les schémas zod : le
  formulaire et la règle ne peuvent pas diverger.

### 7.5 Exigences transverses

- **Responsive** desktop / tablette / mobile.
- **Fil d'Ariane** sur les écrans profonds.
- **États doublés couleur + icône**.
- **Messages d'erreur orientés vers l'action corrective** — jamais « une
  erreur est survenue ».
- **Utilisable sur connexion lente** : pas d'appel par frappe, pas de lecture
  par ligne de liste, pas d'encodage base64 des pièces jointes (multipart
  direct), délai de requête borné.
- Les notifications transitoires (`Toaster`) sont montées **une fois** dans le
  layout, pas écran par écran.

---

## 8. Thème — Tailwind v4 dans `app/globals.css`

Tout est dans le CSS : pas de `tailwind.config.*`, et `components.json` laisse
volontairement `tailwind.config` vide.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  /* … le socle shadcn, puis les jetons propres à la charte */
  --color-jalon: var(--jalon);
  --color-engagement: var(--engagement);
  --color-distinction: var(--distinction);
}

:root { /* palette claire, en oklch */ }
.dark { /* palette sombre */ }
```

Les surfaces teintées sont **opaques** et construites dans la teinte
elle-même (teinte propre, saturation soutenue, clarté tenue) — pas la teinte
diluée dans un blanc froid, qui les fait toutes se ressembler à un mètre.

---

## 9. Spécificités Next 16 à connaître

- **`middleware.ts` n'existe plus** : écrire `proxy.ts` à la racine.

```ts
import { NextResponse } from "next/server";

export function proxy() {
  return NextResponse.next();
}

export const config = {
  // Exclut les ressources statiques : sans cela le proxy s'exécute aussi
  // pour le CSS, le JS et les images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|png|svg|webp)$).*)"],
};
```

  Un fichier vide empêche la compilation ; laissez-le passant tant que le
  cloisonnement n'est pas posé, et **listez les routes publiques** avant de le
  fermer (écrans d'accès, formulaires publics).

- Les types de props de layout et de page viennent de **helpers globaux
  générés** : `LayoutProps<"/">`, `PageProps<"/chemin/[id]">`.
- Consultez `node_modules/next/dist/docs/` avant d'écrire du code de
  framework : les API diffèrent des versions antérieures, et les notes de
  dépréciation y sont à jour.
- Les **route handlers** (`app/api/…`) sont un dernier recours : on n'en écrit
  un que lorsque le navigateur doit atteindre une ressource protégée par un
  jeton conservé dans un cookie `httpOnly` (relais de téléchargement). Une URL
  signée à durée limitée servie par le backend le supprime.

---

## 10. Nommage et langue

- **L'interface, les routes et les messages sont dans la langue du produit** —
  ici le français : `/connexion`, `/mot-de-passe-oublie`. Le code suit.
- Préfixes stables, qui se lisent seuls :
  `lister…` / `creer…` / `modifier…` / `supprimer…` (adaptateur),
  `…Action` (server action), `schema…` (zod), `Donnees…` (charge d'écriture),
  `Resultat…` (retour d'écriture), `vers…` (mapping API → domaine),
  `Ecran…` (écran), `Tableau…` (table cliente), `Dialogue…` / `Tiroir…`,
  `libelle…` (rendu), `motif…` (raison d'un refus), `…Mock` (décor).
- **Les commentaires expliquent pourquoi, jamais quoi.** Un commentaire utile
  dit la décision et ce qu'elle écarte (« une carte translucide changerait de
  couleur selon ce qu'elle recouvre ») ; il survit à la relecture. Un
  commentaire qui paraphrase la ligne suivante ne sert à rien.

---

## 11. Documentation du dépôt

Quatre fichiers valent d'être tenus dès le premier jour :

| Fichier | Contenu |
| --- | --- |
| `docs/DEMANDES_BACKEND.md` | Ce qui manque au service, numéroté ; chaque contournement du front y renvoie |
| `docs/SCHEMAS_ATTENDUS.md` | Les charges utiles attendues, relevées en exécution |
| `docs/POINTS_OUVERTS.md` | Les questions non tranchées par le maître d'ouvrage |
| `CLAUDE.md` / `AGENTS.md` | Les règles que tout contributeur — humain ou agent — doit appliquer |

Toute solution d'attente porte dans son commentaire le numéro de la demande
qui la lèvera. Sans cela, un contournement devient une règle du projet.

---

## 12. Liste de contrôle avant d'ouvrir un domaine

1. `lib/<domaine>/types.ts` — les types, sans forme HTTP.
2. `lib/<domaine>/regles.ts` — les règles, pures, **une seule implémentation**
   par notion (un seuil, une moyenne, un libellé d'état).
3. `lib/validations/<domaine>.ts` — un schéma par écriture, réutilisant
   `champs.ts` et les bornes de `regles.ts`.
4. `lib/api/<domaine>.ts` — l'adaptateur : mapping, codes d'erreur, et repli
   sur le décor derrière `apiConfiguree("<domaine>")` si l'endpoint manque.
5. `app/(dashboard)/actions-<domaine>.ts` — garde, zod rejoué, appel,
   `revalidatePath`, échec typé.
6. `components/<domaine>/ecran-*.tsx` — composition des briques partagées ;
   aucune règle, aucun `fetch`, aucun `fetch` déguisé.
7. La rubrique dans `lib/navigation/menu.ts`, avec les permissions exigées.
8. Le droit dans le catalogue des permissions, verrouillé à son espace si le
   cahier des charges l'impose.
