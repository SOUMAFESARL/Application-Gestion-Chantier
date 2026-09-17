# Recette visuelle

Il n'y a pas de test dans ce dépôt (O6). Le filet de la refonte est donc
`build` + `tsc` + `eslint` **plus ces captures** — et pour le lot 1, dont le
critère de réussite est littéralement « rien n'a changé à l'écran », ce sont
les captures qui font foi. Une comparaison à l'œil deux semaines plus tard ne
vaut rien.

## Produire un jeu de captures

Prérequis :

1. le backend Django du tenant `demo` répond sur `demo.localhost:8000` — c'est
   le **sous-domaine** qui désigne le tenant (`src/lib/api/client.ts`), jamais
   `localhost` tout court ;
2. le frontend tourne en **production** (`next build && next start`), pas en
   `next dev` : le serveur de développement injecte son indicateur dans la
   page et pollue les captures ;
3. `NEXT_PUBLIC_API_SIMULE=1` dans `.env.local`, pour les écrans d'onboarding.

```bash
npm run build
npx next start -p 3002
npm run recette:capture -- --base=http://demo.localhost:3002 --dossier=avant
```

Options : `--dossier=apres`, `--ecran=<sous-chaîne>` (filtre),
`--email=`, `--motdepasse=` (compte de recette).

## Comparer

Les PNG sont versionnés. Après un lot :

```bash
npm run recette:capture -- --base=http://demo.localhost:3002 --dossier=avant
git diff --stat docs/recette/
```

Un `git diff --stat` vide = aucun pixel n'a bougé. Un fichier qui apparaît dans
le diff nomme l'écran à examiner. **On écrase volontairement `avant/`** : la
référence est le dernier état recetté et accepté, pas un état figé au lot 0.
Pour garder l'ancien sous la main le temps d'un arbitrage, capturer dans
`--dossier=apres` et comparer les deux dossiers.

## Ce que les captures ne couvrent pas

- **Les écrans à lien** (`04-mot-de-passe-definir`, `05-activation`,
  `06-invitation`) sont atteints avec un jeton factice : ils rendent donc leur
  variante **« lien expiré »**, pas leur formulaire nominal. C'est un état réel
  et déterministe, mais le formulaire lui-même reste hors référence. Pour le
  couvrir, il faudrait un jeton valide émis par le backend — à faire quand ces
  écrans passeront au lot 7.
- **Les écrans authentifiés** lisent la vraie base du tenant `demo` : les
  captures ne sont reproductibles que tant que cette base ne bouge pas. Un
  diff sur `13-tableau-de-bord` peut donc signaler une donnée modifiée plutôt
  qu'une régression de style — vérifier avant de conclure.
- **Les états transitoires** (survol, focus, chargement, modales ouvertes) ne
  sont pas capturés. Ils restent à la recette manuelle.

## Écrans capturés

| # | Écran | Session |
| --- | --- | --- |
| 01 | `/connexion` | non |
| 02 | `/inscription` | non |
| 03 | `/mot-de-passe/oublie` | non |
| 04 | `/mot-de-passe/definir` | non |
| 05 | `/activation` | non |
| 06 | `/invitation` | non |
| 07 | `/not-found` | non |
| 08 | `/design-system` | non |
| 09-12 | `/configuration`, les 4 étapes | oui |
| 13 | `/tableau-de-bord` | oui |
| 14 | `/projets` | oui |
| 15 | `/projets/[id]` | oui |
| 16 | `/parametres/roles` | oui |
| 17 | `/parametres/utilisateurs` | oui |

Chacun en 1440, 768 et 390 px.

Le script écrit un `RAPPORT.md` dans le dossier de sortie : il nomme les écrans
qu'il n'a **pas** réussi à capturer. Un échec n'y produit jamais une capture
silencieusement fausse — c'est ce qui permet de faire confiance au diff.
