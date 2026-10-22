/**
 * L'accès aux données du domaine Alertes de retard — `/alertes-retard/`.
 *
 * **C'est le seul fichier du domaine qui sait que le serveur existe**, et le
 * seul qui connaisse la forme de ce qu'il envoie. Même méthode que
 * `features/projets/adaptateur.ts` : charges `snake_case` privées, traductions
 * `vers*`, fonctions exportées au verbe à l'infinitif.
 *
 * Le contrat vient de `apps/projets/serializers/alertes_retard.py` et de
 * `apps/projets/views/alertes_retard.py`.
 */

import { api } from "@/lib/api";

import type {
  AlerteRetard,
  CausesAlerte,
  LotAlerte,
  NiveauAlerte,
  ProjetAlerte,
  StatutAlerte,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur — la seule zone en `snake_case`.
 * ------------------------------------------------------------------ */

interface ChargeProjetAlerte {
  id: string;
  reference: string;
  nom: string;
}

interface ChargeLotAlerte {
  id: string;
  code: string;
  libelle: string;
}

/**
 * Les causes sont un `JSONField` : la forme est celle que le service de détection
 * écrit, mais le champ n'est pas contraint — chaque clé peut manquer.
 */
interface ChargeCauses {
  absences?: number | null;
  blocages_ouverts?: string[] | null;
  incidents?: number | null;
}

interface ChargeAlerteRetard {
  id: string;
  projet: ChargeProjetAlerte;
  lot: ChargeLotAlerte | null;
  niveau: NiveauAlerte;
  /** Un `DecimalField` : Django peut l'envoyer en chaîne. */
  delta_pts: number | string | null;
  indice_sante: number | null;
  date_detection: string;
  statut: StatutAlerte;
  causes?: ChargeCauses | null;
  actions_recommandees?: string[] | null;
  commentaire_resolution?: string | null;
  resolue_par?: string | null;
  resolue_le?: string | null;
}

/**
 * L'enveloppe de pagination **de ce serveur** (`PaginationStandard`) : `resultats`,
 * et non le `results` de DRF. `suivant` est l'adresse de la page d'après, `null`
 * à la dernière.
 */
interface ChargePageAlertes {
  total: number;
  page: number;
  nombre_pages: number;
  suivant: string | null;
  resultats: ChargeAlerteRetard[];
}

/** La charge de `PATCH /alertes-retard/{id}/resoudre/`. */
interface ChargeResolution {
  commentaire_resolution: string;
}

/* ------------------------------------------------------------------ *
 * Traductions — serveur vers domaine.
 * ------------------------------------------------------------------ */

/** Un `DecimalField` arrive en chaîne : on la lit, sans l'arrondir en chemin. */
function versNombre(valeur: number | string | null | undefined): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const nombre = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(nombre) ? nombre : null;
}

function versProjetAlerte(charge: ChargeProjetAlerte): ProjetAlerte {
  return { id: charge.id, reference: charge.reference, nom: charge.nom };
}

function versLotAlerte(charge: ChargeLotAlerte | null): LotAlerte | null {
  return charge ? { id: charge.id, code: charge.code, libelle: charge.libelle } : null;
}

function versCauses(charge: ChargeCauses | null | undefined): CausesAlerte {
  return {
    absences: charge?.absences ?? 0,
    blocagesOuverts: charge?.blocages_ouverts ?? [],
    incidents: charge?.incidents ?? 0,
  };
}

function versAlerte(charge: ChargeAlerteRetard): AlerteRetard {
  return {
    id: charge.id,
    projet: versProjetAlerte(charge.projet),
    lot: versLotAlerte(charge.lot),
    niveau: charge.niveau,
    deltaPts: versNombre(charge.delta_pts),
    indiceSante: charge.indice_sante,
    dateDetection: charge.date_detection,
    statut: charge.statut,
    causes: versCauses(charge.causes),
    actionsRecommandees: charge.actions_recommandees ?? [],
    commentaireResolution: charge.commentaire_resolution ?? "",
    resoluePar: charge.resolue_par || null,
    resolueLe: charge.resolue_le ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Les appels.
 * ------------------------------------------------------------------ */

/** Le maximum que le serveur accepte par page (`max_page_size`). */
const TAILLE_PAGE_ALERTES = 100;

/** Un garde-fou contre une pagination qui ne finirait jamais : 1 000 alertes. */
const PLAFOND_PAGES_ALERTES = 10;

/**
 * Les alertes de retard visibles par le compte — `GET /alertes-retard/`.
 *
 * Toutes les pages, par 100, jusqu'au plafond : l'écran filtre, pagine et
 * exporte côté client, et un export qui ne porterait que sur la première page
 * mentirait sur ce qu'il contient. Le serveur sait aussi filtrer (`niveau`,
 * `projet`, `statut`) ; l'écran n'en a pas besoin tant que la liste tient en
 * quelques pages, et lui garde ainsi les compteurs de ses filtres.
 *
 * Le périmètre, lui, est celui du serveur : le DG et le DO voient tout, les
 * autres ne voient que les alertes dont ils sont destinataires.
 */
export async function listerAlertes(signal?: AbortSignal): Promise<AlerteRetard[]> {
  const alertes: AlerteRetard[] = [];

  for (let page = 1; page <= PLAFOND_PAGES_ALERTES; page++) {
    const charge = await api.lire<ChargePageAlertes>(
      "/alertes-retard/",
      { taille_page: TAILLE_PAGE_ALERTES, page },
      signal,
    );
    alertes.push(...(charge.resultats ?? []).map(versAlerte));
    if (!charge.suivant || (charge.resultats ?? []).length === 0) break;
  }

  return alertes;
}

/**
 * Clôture une alerte — `PATCH /alertes-retard/{id}/resoudre/`. Le serveur
 * renvoie l'alerte résolue, avec qui l'a clôturée et quand.
 *
 * Refus attendus : 403 (ni chef de projet du chantier, ni DO), 422 (déjà
 * résolue ou ignorée), 400 (commentaire de moins de 10 caractères). Chacun
 * porte son `erreur.message`, que l'écran affiche tel quel.
 */
export async function cloturerAlerte(id: string, commentaire: string): Promise<AlerteRetard> {
  const corps: ChargeResolution = { commentaire_resolution: commentaire };
  const charge = await api.modifier<ChargeAlerteRetard>(`/alertes-retard/${id}/resoudre/`, corps);
  return versAlerte(charge);
}
