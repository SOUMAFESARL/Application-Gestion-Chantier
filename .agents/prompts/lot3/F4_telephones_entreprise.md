# F4 — Plusieurs numéros de contact par entreprise, tous pays (3.5, US 2.1)

Branche : `feature/lot3-telephones-entreprise`
Prérequis : backend `B3_telephones_entreprise.md` fusionné ; F1 à F3 fusionnées.

## 1. Le constat — l'écran promettait déjà, le serveur jetait

`app/(entreprise)/parametres/configuration/ConfigurationEntreprise.tsx` (614 lignes) propose un
numéro principal (`telephone_contact`), un fixe (`telephone_fixe`) et des numéros secondaires en
nombre libre (`telephones_secondaires`, l. 192-240 et 538-590). `features/configuration/api.ts`
(l. 59-68) le reconnaît : « **Pas encore servis par Django** ». Le serveur les ignorait sans
erreur : la personne voyait « Enregistré » et perdait ses numéros au rechargement.

Deuxième limite : `ChampTelephone` (`components/metier/ChampTelephone.tsx`) ne connaît que les
**neuf pays** de `features/referentiels/telephone.ts` (`PAYS_TELEPHONE`, l. 43). Un numéro
français ou chinois s'y affiche faussement sous le drapeau du pays par défaut
(`analyserTelephone`, l. 103-110). **Décision du développeur : format international validé pour
tous les pays.**

## 2. Le contrat servi (B3 §5)

Lecture (`GET /parametres/configuration/`) — en plus des champs actuels :

```json
"telephones": [
  {"id": "…", "libelle": "MOBILE", "libelle_affiche": "Mobile", "numero": "+2250700000000", "principal": true}
]
```

Écriture (`PATCH /parametres/configuration/`) :

- JSON : `"telephones": [{"id": "…" | null, "libelle": "…", "numero": "+…", "principal": true|false}]`
  — la liste **complète**, dans l'ordre d'affichage ; un numéro absent est retiré ;
- multipart (avec logo) : **le même tableau en chaîne JSON** sous la clé `telephones` ;
- ne plus envoyer `telephone_contact`, `telephone_fixe`, `telephones_secondaires` : le serveur
  recopie lui-même le principal dans `telephone_contact`.

Libellés : `MOBILE`, `FIXE`, `WHATSAPP`, `STANDARD`, `COMPTABILITE`, `AUTRE`. **1 à 5 numéros, un
et un seul principal**, pas de doublon, chaque numéro en E.164 (`^\+[1-9]\d{7,14}$`).

Erreurs 400 (`erreur.details`) : `telephones` est **soit une chaîne** (règle de liste : « Cinq
numéros au plus par entreprise. », « Désignez un, et un seul, numéro principal. »…), **soit un
tableau** aligné sur la liste envoyée, dont l'élément `i` est `{}` ou `{"numero": ["…"]}` /
`{"libelle": ["…"]}`. Vérifier la forme exacte en provoquant l'erreur contre le backend local avant
d'écrire le traitement.

## 3. Couche par couche

### 3.1 `features/referentiels/telephone.ts` — le format international

Ajouter (et documenter comme le reste du fichier) :

```ts
/** Le pseudo-pays « autre indicatif » : un numéro hors des neuf pays, saisi en entier. */
export const CODE_INTERNATIONAL = "INTL";

/** E.164 : `+`, un indicatif qui ne commence pas par 0, 8 à 15 chiffres en tout. */
const E164 = /^\+[1-9]\d{7,14}$/;

/** Retire espaces, points, tirets, parenthèses, barres ; `00…` devient `+…`. N'invente rien. */
export function normaliserTelephone(valeur: string): string

export function estE164(valeur: string): boolean

/**
 * Valide un numéro **de n'importe quel pays** : les neuf pays gardent leurs règles de longueur
 * (`telephoneValide`), les autres doivent être E.164.
 */
export function telephoneInternationalValide(valeur: string, paysDefaut: string): boolean
```

Et une option à `analyserTelephone(valeur, paysDefaut, { international = false } = {})` : en mode
international, un numéro `+…` dont l'indicatif n'est pas l'un des neuf rend
`{ pays: CODE_INTERNATIONAL, national: <tous les chiffres après le +>, indicatifExplicite: true }`
au lieu de retomber sur le pays par défaut. **Sans l'option, le comportement ne change pas** (il
sert au profil, aux collaborateurs, à l'abonnement).

`afficherTelephone` (l. ~166) : un numéro hors des neuf pays s'affiche `+` puis ses chiffres par
groupes de trois.

### 3.2 `components/metier/ChampTelephone.tsx` — la prop `international`

- `international?: boolean` (défaut `false`, aucun autre écran ne change).
- Quand elle est vraie, la liste des pays ajoute, **en dernier**, une entrée « Autre pays »
  (`t("autrePays")`, icône `Globe` de lucide-react à la place du drapeau, `value` de recherche
  `"autre international"`).
- En mode `INTL` : le bouton montre `Globe` et `+` ; le champ attend **l'indicatif et le numéro**
  (`placeholder={t("gabaritInternational")}` → « 33 6 12 34 56 78 ») ; à la saisie, garder les
  chiffres (15 au plus) et rendre `onChange("+" + chiffres)` ; l'affichage groupe par trois.
- Choisir un des neuf pays depuis `INTL` garde les chiffres saisis comme numéro national
  (comportement actuel de `auChangementDePays`).
- Lire le `README.md` de `components/metier/` et y documenter la prop.

### 3.3 `features/configuration/api.ts`

Dans `DonneesEntreprise` (l. 38) :

- **retirer** `telephones_secondaires` et `telephone_fixe` et leurs commentaires ;
- `telephone_contact` reste, en **lecture seule** (commentaire : « recopie du principal, renvoyée
  par le serveur ; ne plus l'envoyer ») ;
- ajouter :
  ```ts
  /** Les canaux d'un numéro — `TelephoneEntreprise.Libelle` côté Django. */
  export type LibelleTelephone = "MOBILE" | "FIXE" | "WHATSAPP" | "STANDARD" | "COMPTABILITE" | "AUTRE";

  export interface TelephoneEntreprise {
    /** `null` pour un numéro pas encore enregistré. */
    id: string | null;
    libelle: LibelleTelephone;
    numero: string;
    principal: boolean;
  }
  ```
  et `telephones?: TelephoneEntreprise[]` dans `DonneesEntreprise`.

Dans `enregistrerEntreprise` (l. ~120-155) :

- JSON : envoyer `telephones` (sans `libelle_affiche`) et **ne pas** envoyer `telephone_contact` ;
- FormData : la boucle actuelle ajoute un tableau **élément par élément** (l. 140-141) — pour
  `telephones`, faire `formData.append("telephones", JSON.stringify(telephones))` à la place.
  Exclure aussi `telephone_contact` de la boucle.

### 3.4 Nouveau fichier `features/configuration/regles.ts`

```ts
export const TELEPHONES_MAX = 5;
export const LIBELLES_TELEPHONE: LibelleTelephone[] = ["MOBILE", "FIXE", "WHATSAPP", "STANDARD", "COMPTABILITE", "AUTRE"];

/** La liste de départ : celle du serveur ; à défaut l'ancien numéro seul ; à défaut une ligne vide principale. */
export function telephonesInitiaux(entreprise: DonneesEntreprise): TelephoneEntreprise[]

export function peutAjouterTelephone(liste: TelephoneEntreprise[]): boolean  // < 5

/** Retirer le principal fait passer le premier restant principal. On ne retire pas le dernier numéro. */
export function retirerTelephone(liste: TelephoneEntreprise[], index: number): TelephoneEntreprise[]

export function definirPrincipal(liste: TelephoneEntreprise[], index: number): TelephoneEntreprise[]

/**
 * Les erreurs, avant envoi, avec les mêmes règles que le serveur. Clés : `telephones` (règle de
 * liste) et `telephones.<index>.numero` (une ligne). Une ligne vide ajoutée puis laissée vide est
 * une erreur (« Saisissez ce numéro, ou retirez la ligne. »), pas un numéro ignoré.
 */
export function erreursTelephones(liste: TelephoneEntreprise[], paysDefaut: string): Record<string, string>

/** Traduit `erreur.details.telephones` du serveur (chaîne ou tableau, §2) vers les mêmes clés. */
export function erreursTelephonesServeur(details: Record<string, unknown>): Record<string, string>
```

Tous les messages par `texte("configuration.telephones.…")` (`@/i18n/horsReact`).

### 3.5 L'écran `ConfigurationEntreprise.tsx`

Dans la section « Coordonnées » (l. 474-590) :

1. **Retirer** le champ « Téléphone fixe », la boucle des secondaires, le bouton « Ajouter un
   numéro secondaire », et les fonctions / états qui ne servaient qu'à eux (`secondaires`,
   `modifierSecondaire`, `ajouterSecondaire`, `retirerSecondaire`, les contrôles l. 288-297).
2. **Ajouter** un bloc « Numéros de contact » (`t("telephones.titre")`, aide
   `t("telephones.aide")` : « Jusqu’à cinq numéros. Le principal figure sur les factures et les
   documents. ») : une ligne par numéro, en grille `sm:grid-cols-[10rem_1fr_auto]` :
   - un `Select` (`components/ui/select`) du libellé, `t(\`telephones.libelles.${code}\`)` ;
   - `ChampTelephone` avec `international`, `paysDefaut={pays}`, `erreur={erreurs[\`telephones.${i}.numero\`]}` ;
   - à droite : si la ligne est principale, un `Badge` « Principal » ; sinon un bouton `ghost`
     `taille="sm"` « Définir comme principal » ; puis le bouton corbeille (comme l'actuel,
     l. 566-578), désactivé s'il ne reste qu'une ligne.
   - sous les lignes : « Ajouter un numéro » (le `BoutonCharte` actuel, l. 580-588), désactivé à 5,
     avec l'aide `t("telephones.maximum")` quand il l'est.
   - l'erreur de liste `erreurs.telephones` en `text-xs font-medium text-erreur` sous le bloc.
3. État : `donnees.telephones` initialisé par `telephonesInitiaux` ; `modifie` (bouton
   Enregistrer actif) doit tenir compte des numéros (comparer à `reference.telephones` par
   `JSON.stringify` de `{libelle, numero, principal}`).
4. `soumettre` : `erreursTelephones(...)` fusionnées aux autres erreurs ; à l'échec serveur,
   `erreursTelephonesServeur(cause.details)` posées sur les lignes.
5. Après succès, `telephones` de la réponse remplace l'état (les nouvelles lignes reçoivent leur
   `id`).
6. Les champs restent marqués « enregistré » comme les autres (`classeEnregistre`).
7. **Mobile (390 px)** : la grille passe en colonne ; le libellé au-dessus du numéro ; les
   boutons sur une ligne en dessous.

### 3.6 Le back-office — fiche client (affichage)

- `features/administration/types.ts` : `TelephoneClient { libelle: string; libelleAffiche: string; numero: string; principal: boolean }`
  et `telephones: TelephoneClient[]` dans `ClientPlateforme`.
- `features/administration/adaptateur.ts` : `telephones?: {libelle, libelle_affiche, numero, principal}[]`
  dans `ChargeClient` ; `versClient` : `telephones: (charge.telephones ?? []).map(...)`.
- `lib/api/simulationAdministration.ts` n'existe plus après le lot 2 ; si `typecheck` signale
  une autre fabrique de `ChargeClient`, y ajouter `telephones: []`.
- `app/(admin)/admin/clients/[id]/FicheClient.tsx` (l. 240) : remplacer la ligne
  `fiche.telephoneContact` par une ligne par numéro — libellé `libelleAffiche`, valeur
  `afficherTelephone(numero)` suivie de « (principal) » pour le principal ; aucun numéro →
  `ABSENT`. Clé `administration.fiche.telephones` (« Téléphones ») et
  `administration.fiche.principal` (« principal »).

### 3.7 `messages/fr.json`

- `telephone.autrePays` (« Autre pays »), `telephone.gabaritInternational` (« 33 6 12 34 56 78 »).
- `configuration.telephones.*` : `titre` (« Numéros de contact »), `aide`, `libelle` (« Usage »),
  `libelles.MOBILE` … `libelles.AUTRE` (« Mobile », « Fixe », « WhatsApp », « Standard »,
  « Comptabilité », « Autre »), `principal` (« Principal »), `definirPrincipal` (« Définir comme
  principal »), `ajouter` (« Ajouter un numéro »), `retirer` (« Retirer ce numéro »), `maximum`
  (« Cinq numéros au plus. »), `erreurVide` (« Saisissez ce numéro, ou retirez la ligne. »),
  `erreurFormat` (« Saisissez le numéro au format international : + suivi de l’indicatif du pays
  et du numéro. »), `erreurDoublon` (« Ce numéro figure deux fois. »), `erreurPrincipal`
  (« Désignez un, et un seul, numéro principal. »), `erreurAucun` (« Renseignez au moins un
  numéro de contact. »).
- Retirer les clés devenues inutiles (`champTelephoneFixe`, `champTelephoneSecondaire`,
  `ajouterTelephoneSecondaire`, `retirerTelephoneSecondaire`, et l'ancien libellé du champ
  principal s'il ne sert plus) — **après** vérification par `grep` qu'aucun autre fichier ne les lit.
- Trouver l'espace de noms réel de l'écran (`useTranslations("…")` en tête du composant) et y
  placer les clés `telephones.*`.

## 4. Vérification à l'écran (DG du schéma `demo`)

1. Paramètres > Configuration : le numéro existant apparaît en ligne principale.
2. Ajouter un **WhatsApp ivoirien** et un **mobile français** (« Autre pays » puis
   `33 6 12 34 56 78`) ; enregistrer ; **recharger** : les trois numéros sont là, dans l'ordre,
   chacun sous le bon drapeau (globe pour la France).
3. Désigner le WhatsApp principal ; enregistrer ; recharger : principal changé.
4. Ajouter jusqu'à 5 : le bouton se désactive. Saisir deux fois le même numéro : erreur sous la ligne.
5. Laisser une ligne vide : erreur, rien n'est envoyé.
6. Changer le logo **et** un numéro dans le même enregistrement (envoi multipart) : les deux sont
   gardés.
7. Back-office (superviseur) → fiche du client `demo` : les trois numéros, le principal marqué.
8. Une facture ou un PDF de l'entreprise, s'il en existe un en local : le numéro est le principal.
9. 390 px : chaque ligne tient sans débordement horizontal.

## 5. Définition de terminé

- [ ] Plus de `telephone_fixe` ni de `telephones_secondaires` dans le frontend.
- [ ] `ChampTelephone international` ; validation E.164 tous pays côté écran.
- [ ] Liste de 1 à 5 numéros, un principal, enregistrée en JSON et en multipart ; fiche back-office.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 9 vérifications faites.
- [ ] Commit : `feat(configuration): plusieurs numeros de contact, format international tous pays`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
