# F4 — Écran de la messagerie de la plateforme (tâche 2.5)

Branche : `feature/lot2-messagerie`
Prérequis : F1 à F3 fusionnées. **Aucune tâche backend** : les routes sont complètes, B1 les a
déjà réservées au superviseur en écriture.
Brouillon : `brouillons/EcranMessagerie.tsx.txt` (382 lignes) — **presque complet**, à
reprendre ; fonctions et types dans `adaptateur.ts.brouillon.txt` (types `ChargeMessagerie` l. 109 et `ChargeDiagnosticMessagerie` l. 124 ; fonctions l. 668-735) et
`types.ts.brouillon.txt` (l. 227-300).

## 1. Le contrat servi (`../API-Gestion-Chantier/apps/platform_admin/views/messagerie.py`)

| Route | Qui | Réponse |
|---|---|---|
| `GET /admins/parametres/messagerie/` | les deux rôles | `{saisi: {hote, port, chiffrement, identifiant, expediteur, mot_de_passe_defini, modifie_le}, effectif: {source: "application" \| "serveur", hote, port, chiffrement, identifiant, expediteur}, frontend_url, frontend_url_locale}` |
| `PATCH /admins/parametres/messagerie/` (alias du PUT) | superviseur | même forme ; corps `{hote, port, chiffrement, identifiant, mot_de_passe?, expediteur?}` ; `mot_de_passe` vide = on garde l'actuel ; obligatoire la 1ʳᵉ fois (400 `details.mot_de_passe`) ; `hote` avec `://`, `/` ou espace → 400 `details.hote` |
| `DELETE /admins/parametres/messagerie/` | superviseur | 200, le réglage retombe sur le `.env` du serveur |
| `POST /admins/parametres/messagerie/tester/` | superviseur | `{succes, etape: "connexion"\|"envoi"\|null, erreur, conseil, sonde, alternatives, backend, reglage}` — **une panne d'envoi n'est pas une erreur HTTP** : elle revient en 200 avec `succes: false` |

`chiffrement` ∈ `STARTTLS` (587), `SSL` (465), `AUCUN`. Le mot de passe **n'est jamais renvoyé**.

## 2. Couche par couche

### 2.1 `features/administration/types.ts`

Recopier du brouillon (l. 227-300) : `ChiffrementMessagerie`, `SourceMessagerie`,
`ReglageEffectifMessagerie`, `ReglageMessagerie`, `DemandeMessagerie`, `EtapeSondeMessagerie`,
`SondeMessagerie`, `AlternativeMessagerie`, `ResultatDiagnosticMessagerie`. Vérifier chaque
champ contre `apps/platform_admin/services/messagerie.py` (`serialiser`, `reglage_effectif`,
`diagnostiquer_envoi`, et la sonde plus bas dans ce fichier) ; un champ que le serveur ne renvoie
pas devient facultatif (`?`) ou disparaît.

### 2.2 `features/administration/validations.ts`

Le brouillon valide à la main (`valider()`, l. 146). **Le remplacer par un schéma zod**, comme
tous les formulaires du domaine :

```ts
/** Le serveur SMTP saisi par le superviseur. Le mot de passe n'est exigé que la première fois. */
export function schemaMessagerie(motDePasseRequis: boolean) {
  return z.object({
    hote: chaineNonVide(texte("administration.messagerie.erreurHoteRequis")).refine(
      (valeur) => !/[\s/]|:\/\//.test(valeur),
      texte("administration.messagerie.erreurHoteForme"),
    ),
    port: z.coerce.number().int().min(1, texte("administration.messagerie.erreurPort"))
      .max(65535, texte("administration.messagerie.erreurPort")),
    chiffrement: z.enum(["STARTTLS", "SSL", "AUCUN"]),
    identifiant: chaineNonVide(texte("administration.messagerie.erreurIdentifiantRequis")),
    motDePasse: motDePasseRequis
      ? chaineNonVide(texte("administration.messagerie.motDePasseRequis"))
      : z.string(),
    expediteur: z.string().trim(),
  });
}

export const schemaTestMessagerie = z.object({
  destinataire: email(
    texte("administration.messagerie.test.erreurAdresse"),
    texte("administration.messagerie.test.erreurAdresse"),
  ),
});
```

(`chaineNonVide` et `email` existent déjà dans le fichier ; vérifier leur signature.)

### 2.3 `features/administration/adaptateur.ts`

Recopier du brouillon `versMessagerie`, `lireMessagerie`, `enregistrerMessagerie`,
`reinitialiserMessagerie`, `testerMessagerie` et leurs `Charge*` privés. Corriger :

- le commentaire de `enregistrerMessagerie` : la route appelée est `PATCH` (alias du PUT) ;
- `modifie_le` → `Date | null` (`charge.saisi.modifie_le ? new Date(...) : null`) ;
- aucune branche `SIMULATION_ACTIVE` : toujours réel.

### 2.4 `app/(admin)/admin/cles.ts`

Ajouter `messagerie: () => ["administration", "messagerie"] as const,`.

### 2.5 L'écran

Créer :

- `app/(admin)/admin/parametres/messagerie/page.tsx` — sur le modèle **exact** de
  `app/(admin)/admin/parametres/tarifs/page.tsx` (19 lignes : `generateMetadata`,
  `EnTeteParametrage`, l'écran) ;
- `app/(admin)/admin/parametres/messagerie/EcranMessagerie.tsx` — depuis le brouillon.

Dans `EnTeteParametrage.tsx`, ajouter `"messagerie"` à `SectionParametrage` (l. 11).

Changements à faire au brouillon :

1. Le formulaire passe par `react-hook-form` + `zodResolver(schemaMessagerie(motDePasseRequis))`,
   comme `ModaleFinAbonnement.tsx` ; `motDePasseRequis = !reglage.saisi.motDePasseDefini`.
2. Les erreurs 400 du serveur (`hote`, `mot_de_passe`) se posent sur les champs
   (`cause.erreursParChamp`, `mot_de_passe` → `motDePasse`).
3. **Lecture seule pour le SUPPORT** (`!peutParametrerPlateforme(profil)`) : tous les champs et
   boutons `disabled` ; la carte de test aussi (le test est réservé au superviseur).
4. **La configuration active en tête** (décision 2.5) : la carte « Réglage actuel » est la
   première ; son badge dit d'où vient le réglage :
   - `source === "application"` → badge ton succès, `messagerie.source.application`
     (« Réglage saisi dans l'application ») ;
   - `source === "serveur"` → badge ton neutre, `messagerie.source.serveur` (« Réglage du serveur
     (.env) ») et la phrase `messagerie.sourceServeurAide` (« Aucun réglage n'a été saisi ici :
     la plateforme utilise celui du fichier de configuration du serveur. »).
   Utiliser `BADGE` et un ton existant de `app/(admin)/admin/tons.ts` ; ne pas créer de couleur.
5. « Revenir au réglage du serveur » (`reinitialiserMessagerie`) passe par une **Modale de
   confirmation** (`messagerie.reinitialiserConfirmerTitre` / `…Texte` : « Le serveur SMTP saisi
   ici sera oublié, mot de passe compris. La plateforme utilisera le réglage du fichier de
   configuration du serveur. »).
6. Le bouton « Gmail » du brouillon (`appliquerGmail`, l. 165) préremplit `smtp.gmail.com`, 587,
   STARTTLS : le garder, via `formulaire.setValue`.
7. Les constantes techniques (`smtp.gmail.com`, ports) en constantes hors JSX.
8. Après enregistrement / réinitialisation : `cache.setQueryData(CLES_ADMINISTRATION.messagerie(), reglage)`.
9. `modifieLe` affiché dans la carte « Réglage actuel » si présent, avec `formaterDateHeure`
   (`lib/format`, l. 214).

### 2.6 Navigation

`app/(admin)/admin/layout.tsx`, tableau `SOUS_MENU_PARAMETRAGE` (l. 73-78) : ajouter
`{ href: "/admin/parametres/messagerie", cle: "parametrageMessagerie" }` **après** « globaux ».

### 2.7 `messages/fr.json`

- `administration.navigation.parametrageMessagerie` : « Messagerie ».
- `administration.parametres.messagerie.titre` : « Messagerie de la plateforme » ;
  `…description` : « Le serveur qui envoie les courriels de la plateforme : invitations,
  réinitialisations de mot de passe, avis aux dirigeants. »
- `administration.messagerie.*` : partir de `brouillon_administration.parametres.messagerie`
  (ou de la clé où le brouillon les avait mises — chercher `"gmail"` dans
  `brouillons/fr_administration.brouillon.json`), **déplacer** sous `administration.messagerie`,
  et ajouter les clés nouvelles de ce fichier (`erreurHoteForme` : « Saisissez seulement le nom du
  serveur, par exemple smtp.gmail.com. », `source.*`, `sourceServeurAide`,
  `reinitialiserConfirmerTitre`, `reinitialiserConfirmerTexte`, `test.erreurAdresse` : « Saisissez
  une adresse e-mail valide. »). Toute clé utilisée par le composant doit exister : `npm run
  typecheck` ne le vérifie pas, **l'écran si** (une clé absente s'affiche brute).

## 3. Vérification à l'écran

1. Superviseur → Paramétrage > Messagerie : la carte « Réglage actuel » dit « Réglage du serveur
   (.env) » si rien n'est saisi.
2. Saisir un serveur (Gmail + un compte de test **fourni par le développeur**, jamais écrit dans
   un fichier), enregistrer, **recharger** : le badge passe à « Réglage saisi dans l'application »,
   le champ mot de passe est vide avec l'aide « déjà enregistré ».
3. « Envoyer un message de test » à une adresse du développeur : succès, ou échec avec l'étape et
   le conseil affichés.
4. Saisir `https://smtp.gmail.com` → erreur sous le champ, avant tout envoi.
5. Revenir au réglage du serveur → confirmation → la carte repasse à « serveur ».
6. SUPPORT : tout est visible, rien n'est modifiable, avis lecture seule en tête.
7. 390 px : les deux cartes s'empilent, les codes d'erreur longs passent à la ligne (`break-all`).

## 4. Définition de terminé

- [ ] Écran `/admin/parametres/messagerie`, entrée de sous-menu, schéma zod.
- [ ] Source du réglage visible en tête ; réinitialisation confirmée ; SUPPORT en lecture seule.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 7 vérifications faites.
- [ ] Commit : `feat(administration): ecran de la messagerie de la plateforme`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
