# F5 — Le logo de l'entreprise visible sur téléphone (3.6, US 2.2)

Branche : `feature/lot3-logo-telephone`
Prérequis : F1 à F4 fusionnées. Pas de backend.

## 1. La user story et ce qui existe

> *Given* un logo a été téléversé dans la configuration de l'entreprise ; *When* l'utilisateur ouvre
> l'interface ; *Then* le logo s'affiche aux emplacements prévus ; *And* en l'absence de logo, un
> visuel par défaut est affiché.

Déjà en place :

- envoi et traitement du logo (configuration de l'entreprise) — trois tailles côté serveur ;
- **en-tête** de l'espace entreprise : `app/(entreprise)/layout.tsx:828-866` — `Avatar` rond avec
  `logo_1x` / `logo` en `srcSet`, et **l'initiale de l'entreprise sur la couleur primaire** si
  aucun logo ou s'il ne charge pas (`AvatarFallback`) : c'est le visuel par défaut, validé ;
- **documents PDF** : `chargerImagePdf(entreprise?.logo_original ?? entreprise?.logo)`
  (`rapports/GenerationDocumentPdf.tsx:55`, `projets/[id]/GenerationFicheProjet.tsx:96`).

**Le manque** : le lien de l'en-tête porte `hidden … md:flex` (l. 838) — **sous 768 px, ni logo
ni nom**. Sur un téléphone, l'utilisateur ne voit jamais son entreprise.

Décision : afficher le **logo seul** sur téléphone (le nom à partir de `md`) ; pas de marque blanche
(la barre latérale garde le logo de la plateforme).

## 2. Ce qu'il faut faire — `app/(entreprise)/layout.tsx`

1. Le `Link` (l. 836-840) : remplacer `hidden … md:flex` par `flex` ; garder les autres classes.
   Sur téléphone, réduire le remplissage pour ne garder que l'avatar
   (`px-1 md:px-2`, à ajuster à l'œil).
2. Le `<span>` du nom (l. 860) : `hidden md:inline` en plus de ses classes.
3. Le lien garde son nom accessible sur téléphone : `aria-label={entreprise.nom_commercial || entreprise.raison_sociale}`
   sur le `Link` (le `title` existe déjà, mais il ne suffit pas aux lecteurs d'écran ; l'image a
   `alt=""`, ce qui est juste puisque le lien porte le nom).
4. Le squelette de chargement (l. 863-865) : `block` sur téléphone avec la taille de l'avatar
   (`size-8 rounded-full`), `md:h-7 md:w-24` au-dessus.
5. Vérifier la place : à 390 px, l'en-tête contient aussi la météo, les notifications et le menu ;
   si l'avatar fait passer un élément à la ligne, masquer **la météo** sous `sm` (et seulement
   elle), puisqu'elle est déjà condensée. Le dire dans le commentaire.
6. Mettre à jour le commentaire du bloc (l. 828-834) : « … visible à toutes les largeurs ; le nom
   n'apparaît qu'à partir de `md`, l'avatar seul suffit à reconnaître son entreprise sur
   téléphone. »

## 3. Vérification à l'écran

1. 1440 px : rien ne change (avatar + nom).
2. 390 px : l'avatar avec le logo apparaît dans l'en-tête ; un toucher mène à la configuration.
3. Retirer le logo (configuration > retirer) : l'initiale sur fond primaire apparaît, sans
   rechargement (l'événement `EVENEMENT_ENTREPRISE_MODIFIEE` le rafraîchit déjà).
4. Logo très large (bannière) : il est inscrit en entier dans le rond (`object-contain`), pas rogné.
5. 768 px : la transition est propre (pas de saut de mise en page).
6. Lecteur d'écran (ou arbre d'accessibilité des outils du navigateur) : le lien a un nom.

## 4. Définition de terminé

- [ ] Avatar visible à toutes les largeurs ; nom à partir de `md` ; lien nommé.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 6 vérifications faites.
- [ ] Commit : `feat(entreprise): le logo de l'entreprise s'affiche aussi sur telephone`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
