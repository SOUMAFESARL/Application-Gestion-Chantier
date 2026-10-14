# F5 — Écran du journal de la plateforme (tâche 2.6)

Branche : `feature/lot2-journal-plateforme`
Prérequis : backend `B4_journal_plateforme.md` fusionné ; F1 à F4 fusionnées.
Pas de brouillon : écran neuf.

## 1. Ce que l'utilisateur obtient

Une entrée **« Journal »** dans la navigation principale du back-office, entre « Abonnements » et
le bas du menu. L'écran liste qui a fait quoi, sur quelle entreprise, quand, depuis quelle
adresse — filtré par période (30 derniers jours par défaut), par agent, par entreprise et par
action, avec une recherche libre et l'export CSV / PDF. Les deux rôles y ont accès.

## 2. Le contrat servi (rappel de B4 §2)

```
GET /admins/journal-plateforme/?du=AAAA-MM-JJ&au=AAAA-MM-JJ&utilisateur_id=&entreprise_id=&action=&page=1&taille_page=100
→ { total, page, nombre_pages, suivant, precedent,
    resultats: [{ id, utilisateur_id, utilisateur_nom, entreprise_id, entreprise_nom,
                  action, detail, adresse_ip, appareil, horodatage }] }

GET /admins/journal-plateforme/actions/   → { actions: ["ACTIVATION_MODULE", …] }
```

400 sur `du` / `au` / identifiants invalides (`details.<champ>`).

## 3. Le choix de chargement — à respecter

`TableauListe` pagine **côté client** (10 lignes par page) et l'export porte sur **toutes** les
lignes filtrées (règle 10 du `CLAUDE.md`). Le journal, lui, est paginé **côté serveur**. Pour
concilier les deux :

- les **filtres serveur** (période, agent, entreprise, action) relancent la requête ;
- l'adaptateur **lit toutes les pages** de la sélection, par 100, **jusqu'à 2 000 lignes au
  plus** ;
- au-delà, l'écran affiche un avis (`journal.tronque`) qui invite à resserrer la période ;
- la recherche libre (`RechercheTableau`) filtre **localement** les lignes chargées.

La période est **toujours bornée** (défaut : du jour J-29 à aujourd'hui) : on ne télécharge
jamais tout l'historique d'un coup.

## 4. Couche par couche

### 4.1 `features/administration/types.ts`

```ts
/** Une ligne du journal de la plateforme : un geste d'un agent, immuable. */
export interface EntreeJournalPlateforme {
  id: number;
  agentId: string | null;
  agent: string;
  entrepriseId: string | null;
  entreprise: string;
  action: string;
  detail: Record<string, unknown>;
  adresseIp: string | null;
  appareil: string;
  horodatage: Date;
}

export interface FiltresJournalPlateforme {
  /** `AAAA-MM-JJ`, inclus. */
  du: string;
  au: string;
  agentId: string;
  entrepriseId: string;
  action: string;
}

export interface PageJournalPlateforme {
  entrees: EntreeJournalPlateforme[];
  /** Le nombre de lignes de la sélection côté serveur — peut dépasser `entrees.length`. */
  total: number;
  /** Vrai quand la sélection dépasse le plafond de chargement. */
  tronque: boolean;
}
```

### 4.2 `features/administration/regles.ts`

```ts
/** Le plafond de lignes chargées pour une sélection du journal. */
export const PLAFOND_JOURNAL = 2000;

/** La période par défaut : les 30 derniers jours, aujourd'hui compris. */
export function periodeJournalParDefaut(maintenant: Date = new Date()): { du: string; au: string }
// au = aujourdhuiIso(maintenant) (fonction posée en F2) ; du = même calcul sur maintenant - 29 jours.

export function filtresJournalVides(maintenant?: Date): FiltresJournalPlateforme
// { ...periodeJournalParDefaut(maintenant), agentId: "", entrepriseId: "", action: "" }

/** Recherche libre sur les lignes chargées : agent, entreprise, action, adresse IP, détail. */
export function filtrerJournal(entrees: EntreeJournalPlateforme[], recherche: string): EntreeJournalPlateforme[]
// normaliser comme filtrerClients (l. 187) : minuscules, sans accents ; JSON.stringify(detail) pour le détail.

/** Les paires à afficher pour le détail d'une ligne, dans l'ordre des clés. */
export function lignesDetailJournal(detail: Record<string, unknown>): { cle: string; valeur: string }[]
// valeur : chaîne telle quelle, nombre/booléen en String, objet/tableau en JSON.stringify ; null → "".
```

Regarder `filtrerClients` et sa normalisation, et **réutiliser** la même fonction de
normalisation (ne pas en écrire une seconde).

### 4.3 `features/administration/adaptateur.ts`

```ts
interface ChargeEntreeJournal {
  id: number;
  utilisateur_id: string | null;
  utilisateur_nom: string;
  entreprise_id: string | null;
  entreprise_nom: string;
  action: string;
  detail: Record<string, unknown> | null;
  adresse_ip: string | null;
  appareil: string;
  horodatage: string;
}

interface ChargePageJournal {
  total: number;
  page: number;
  nombre_pages: number;
  suivant: string | null;
  precedent: string | null;
  resultats: ChargeEntreeJournal[];
}

const TAILLE_PAGE_JOURNAL = 100;

function versEntreeJournal(charge: ChargeEntreeJournal): EntreeJournalPlateforme { ... }

/**
 * Le journal de la plateforme pour une sélection — `GET /admins/journal-plateforme/`.
 *
 * Toutes les pages, par 100, jusqu'au plafond : l'écran pagine et exporte côté client, et un
 * export qui ne porterait que sur la page affichée mentirait sur ce qu'il contient.
 */
export async function listerJournalPlateforme(
  filtres: FiltresJournalPlateforme,
  signal?: AbortSignal,
): Promise<PageJournalPlateforme> {
  const parametres = {
    du: filtres.du, au: filtres.au,
    ...(filtres.agentId && { utilisateur_id: filtres.agentId }),
    ...(filtres.entrepriseId && { entreprise_id: filtres.entrepriseId }),
    ...(filtres.action && { action: filtres.action }),
    taille_page: TAILLE_PAGE_JOURNAL,
  };
  // boucle page = 1, 2, … tant que page <= nombre_pages ET entrees.length < PLAFOND_JOURNAL
  // apiAdministration.lire<ChargePageJournal>("/admins/journal-plateforme/", { ...parametres, page }, signal)
  // retour : { entrees: entrees.slice(0, PLAFOND_JOURNAL), total, tronque: total > PLAFOND_JOURNAL }
}

/** Les codes d'action présents au journal — `GET /admins/journal-plateforme/actions/`. */
export async function listerActionsJournal(signal?: AbortSignal): Promise<string[]> { ... }
```

Vérifier le type `Options["parametres"]` de `lib/api/client.ts` (nombres acceptés ou chaînes
seulement ; convertir en `String(...)` si besoin).

### 4.4 `app/(admin)/admin/cles.ts`

```ts
journal: (filtres: FiltresJournalPlateforme) => ["administration", "journal", filtres] as const,
actionsJournal: () => ["administration", "journal", "actions"] as const,
```

### 4.5 L'écran

- `app/(admin)/admin/journal/page.tsx` — sur le modèle de `app/(admin)/admin/clients/page.tsx`
  (13 lignes) : `generateMetadata` (titre `journal.meta.titre`), `EnTetePage` (titre
  `journal.titre`, description `journal.description`), puis `<JournalPlateforme />`.
- `app/(admin)/admin/journal/JournalPlateforme.tsx` (`"use client"`), sur le modèle de
  `ListeClients.tsx` :
  - état `filtres` (initialisé par `filtresJournalVides()`) et `recherche` ;
  - `useQuery({ queryKey: CLES_ADMINISTRATION.journal(filtres), queryFn: ({signal}) => listerJournalPlateforme(filtres, signal) })` ;
  - trois requêtes d'options : `listerAdministrateurs` (clé `CLES_ADMINISTRATION.comptes()`),
    `listerClients` (`CLES_ADMINISTRATION.clients()`), `listerActionsJournal`
    (`CLES_ADMINISTRATION.actionsJournal()`). **Réutiliser les clés existantes** : la liste des
    clients est déjà en cache si l'agent vient de la liste.
  - `outils` de `TableauListe` : `RechercheTableau`, deux `SelecteurDate` (« Du », « Au » ;
    `auPlusTot` de « Au » = « Du », `auPlusTard` de « Du » = « Au » si le composant le permet),
    trois `FiltreTableau` (agent, entreprise, action). Le libellé d'une action :
    `t.has(\`journal.actions.${code}\`) ? t(...) : code`.
  - colonnes : **Date** (`formaterDateHeure` de `lib/format`, l. 214 — ne pas formater à la main),
    **Agent**, **Action** (libellé), **Entreprise** (vide → `ABSENT`), **Adresse IP**, et une
    colonne d'action **Détail** : bouton `ghost` `taille="sm"` qui ouvre une `Modale` listant
    `lignesDetailJournal(entree.detail)` (`<dl>` avec `LIGNE_DEFINITION` / `LIGNE_LIBELLE` /
    `LIGNE_VALEUR` de `tons.ts`) plus l'appareil (User-Agent).
  - `exporter` : titre `journal.export.titre` (« Journal de la plateforme »), `nomFichier`
    `journal-plateforme`, colonnes : date ISO complète, agent, action (code **et** libellé, deux
    colonnes), entreprise, adresse IP, appareil, détail (`JSON.stringify(detail)`).
  - `onReinitialiser` : remet `filtresJournalVides()` et la recherche vide ; `filtresActifs` vrai
    dès qu'un filtre diffère du défaut.
  - `cleCriteres` : `JSON.stringify({ filtres, recherche })`.
  - avis `Alerte type="information"` au-dessus du tableau quand `tronque` :
    `journal.tronque` (« {total} lignes correspondent : seules les {plafond} plus récentes sont
    affichées. Resserrez la période pour voir les autres. »).
  - erreur de chargement : `EtatErreur` avec `onReessayer`, comme `FicheClient`. Une erreur 400
    sur la période (cas théorique, l'écran borne les dates) : afficher `cause.message`.

### 4.6 Navigation — `app/(admin)/admin/layout.tsx`

Dans `entrees` (l. 230-234), ajouter après « Abonnements » :
`{ href: "/admin/journal", icone: ScrollText, libelle: t("navigation.journal") }` (import
`ScrollText` depuis `lucide-react`).

### 4.7 `messages/fr.json` — sous `administration`

- `navigation.journal` : « Journal ».
- `journal` : `meta.titre` (« Journal de la plateforme »), `titre`, `description` (« Les gestes
  des agents de la plateforme : qui a fait quoi, sur quelle entreprise, et quand. Ce journal ne
  se modifie pas. »), `colonnes.date|agent|action|entreprise|adresseIp|detail`, `filtres.du|au|
  agent|agentTous|entreprise|entrepriseTous|action|actionTous|recherche`, `vide` (« Aucune action
  sur cette période. »), `detail.titre` (« Détail de l'action »), `detail.appareil`
  (« Appareil »), `detail.fermer`, `tronque`, `export.titre`, `export.colonneCode` (« Code »).
- `journal.actions` : un libellé par code. Au minimum (relever les autres avec
  `grep -rhoE 'action="[A-Z_]+"' ../API-Gestion-Chantier/apps --include=*.py | sort -u` et
  `grep -rhoE '"[A-Z_]{6,}",' ../API-Gestion-Chantier/apps/platform_admin/views/parametres.py ../API-Gestion-Chantier/apps/platform_admin/views/messagerie.py`) :

  | Code | Libellé |
  |---|---|
  | `SUSPENSION_CLIENT` | Suspension d'une entreprise |
  | `REACTIVATION_CLIENT` | Réactivation d'une entreprise |
  | `CHANGEMENT_PLAN` | Changement de forfait |
  | `MODIFICATION_ECHEANCE` | Modification de l'échéance |
  | `ACTIVATION_MODULE` | Activation d'un module |
  | `DESACTIVATION_MODULE` | Retrait d'un module |
  | `SUPPRESSION_DEFINITIVE_ENTREPRISE` | Suppression définitive d'une entreprise |
  | `MODIFICATION_MESSAGERIE` | Modification de la messagerie |
  | `REINITIALISATION_MESSAGERIE` | Retour au réglage serveur de la messagerie |
  | `TEST_MESSAGERIE` | Test de la messagerie |
  | `CONNEXION_ASSISTANCE` | Ouverture d'une session d'assistance |
  | `DECONNEXION_ASSISTANCE` | Fin d'une session d'assistance |
  | `TENTATIVE_ECRITURE_BLOQUEE` | Écriture bloquée pendant une assistance |

  Un code sans libellé s'affiche brut : ce n'est pas une erreur, mais en relever le plus possible.

## 5. Vérification à l'écran

1. Superviseur : faire 3 gestes (suspendre puis réactiver un client, modifier une échéance),
   ouvrir « Journal » : les 3 lignes en tête, avec le nom de l'agent (pas un UUID).
2. Ouvrir le détail de la modification d'échéance : ancienne / nouvelle date, motif.
3. Filtrer par action « Suspension » → une ligne ; « Tout afficher » → tout revient.
4. Période du 01/01 au 31/01 de l'année passée → message vide.
5. Exporter en CSV : le fichier contient toutes les lignes filtrées, pas seulement les 10
   affichées ; la colonne détail est du JSON.
6. Exporter en PDF : aperçu correct.
7. SUPPORT : l'écran s'ouvre, identique.
8. 390 px : barre d'outils repliée proprement, tableau défilable horizontalement **dans** sa
   carte (pas la page).

## 6. Définition de terminé

- [ ] Route `/admin/journal`, entrée de navigation, chargement par pages jusqu'au plafond.
- [ ] Filtres serveur + recherche locale + export CSV/PDF ; détail en modale.
- [ ] `npm run lint` et `npm run typecheck` à zéro erreur ; les 8 vérifications faites.
- [ ] Commit : `feat(administration): ecran du journal de la plateforme, filtres et export`
- [ ] Fusion `--no-ff` dans `develop`, branche supprimée, **pas de push**.
