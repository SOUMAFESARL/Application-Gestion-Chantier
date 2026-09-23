/**
 * Le jeu de démonstration du domaine Projets — en attendant les endpoints.
 *
 * **Pourquoi ce module existe.** `GET /projets/` et `POST /projets/` ne sont
 * pas encore branchés : sans lui, la liste des chantiers s'ouvrirait sur un
 * état d'erreur et le formulaire de création n'aurait nulle part où écrire.
 * L'écran serait donc livré sans jamais avoir été parcouru.
 *
 * **Ce qu'il n'est pas.** Il ne remplace pas le serveur. Les vrais appels
 * restent à leur place définitive dans `adaptateur.ts`, juste à côté de
 * l'aiguillage : le jour où les routes existent, `NEXT_PUBLIC_API_SIMULE`
 * passe à `0` et **aucun écran ne change**. C'est la règle de
 * `lib/api/simulation.ts`, appliquée à un domaine métier.
 *
 * **Il parle le domaine, pas le transport.** Les autres modules de simulation
 * rejouent des charges utiles `snake_case` parce que le contrat serveur est
 * spécifié et qu'il y a quelque chose à imiter. Ici, la forme exacte de la
 * réponse n'est pas encore connue : inventer un `snake_case` reviendrait à
 * inventer un contrat, puis à le traduire pour rien. On renvoie donc
 * directement les types de `types.ts`, et `versProjet` restera la seule
 * traduction le jour où la route arrivera.
 *
 * **Il se souvient le temps de l'onglet** (`sessionStorage`), pour qu'un
 * chantier créé survive à un rechargement de page sans s'installer pour
 * autant sur la machine — un jeu de démonstration qui persiste finit par se
 * faire prendre pour des données réelles.
 */

import type { TiersOption } from "@/features/tiers/types";
import { attendre, refuser } from "@/lib/api/simulation";

import type { ClientProjet, CreationProjet, Intervenant, Projet } from "./types";

const CLE_ETAT = "ccd.simulation.projets";

/** Assez court pour ne pas agacer, assez long pour voir passer l'état de chargement. */
const LATENCE_LECTURE = 400;
const LATENCE_ECRITURE = 600;

/* ------------------------------------------------------------------ *
 * Les référentiels de démonstration.
 * ------------------------------------------------------------------ */

/**
 * Les maîtres d'ouvrage proposés par le formulaire.
 *
 * Ils vivent **ici** et non dans la modale : c'est ce module qui devra
 * retrouver la raison sociale d'un client à partir de l'identifiant que le
 * formulaire lui envoie. Deux copies de cette liste, et un chantier créé
 * s'afficherait sous un client inconnu.
 */
export const CLIENTS_DEMONSTRATION: ClientProjet[] = [
  {
    id: "4a180182-e35b-4c4f-9e73-b5419b165b4c",
    raisonSociale: "SCI Les Lagunes",
    telephone: "+2250102030405",
    email: "contact@scilagunes.ci",
    ville: "Abidjan",
  },
  {
    id: "7a180182-e35b-4c4f-9e73-b5419b165b4d",
    raisonSociale: "Banque Atlantique CI",
    telephone: "+2250506070809",
    email: "projets@banqueatlantique.ci",
    ville: "Abidjan",
  },
  {
    id: "9a180182-e35b-4c4f-9e73-b5419b165b4e",
    raisonSociale: "Groupe Sifca",
    telephone: "+2250709080706",
    email: "immobilier@sifca.ci",
    ville: "Yamoussoukro",
  },
];

/** La même liste, réduite à ce qu'un sélecteur de tiers affiche. */
export const OPTIONS_CLIENTS_DEMONSTRATION: TiersOption[] = CLIENTS_DEMONSTRATION.map(
  ({ id, raisonSociale }) => ({ id, raisonSociale }),
);

/** Les collaborateurs désignables comme conducteur de travaux. */
export const COLLABORATEURS_DEMONSTRATION: Intervenant[] = [
  {
    id: "77e382d5-8276-4d10-8fa8-f40409c9ba1b",
    nom: "Zanfack",
    prenom: "Manson",
    nomComplet: "Manson Zanfack",
    email: "m.zanfack@demo.ci",
    telephone: "+2250701020304",
    statut: "ACTIF",
    lienWhatsApp: null,
  },
  {
    id: "88e382d5-8276-4d10-8fa8-f40409c9ba1c",
    nom: "Kouamé",
    prenom: "Koffi",
    nomComplet: "Koffi Kouamé",
    email: "k.kouame@demo.ci",
    telephone: "+2250705060708",
    statut: "ACTIF",
    lienWhatsApp: null,
  },
  {
    id: "99e382d5-8276-4d10-8fa8-f40409c9ba1d",
    nom: "Soro",
    prenom: "Awa",
    nomComplet: "Awa Soro",
    email: "a.soro@demo.ci",
    telephone: "+2250709101112",
    statut: "ACTIF",
    lienWhatsApp: null,
  },
];

/* ------------------------------------------------------------------ *
 * Le portefeuille initial.
 * ------------------------------------------------------------------ */

/**
 * Six chantiers, choisis pour que chaque état de la liste se voie sans
 * manipulation : un chantier en avance, un dans le bruit de mesure, un au
 * retard franc, un budget dépassé, un budget non défini, un terminé.
 */
const PORTEFEUILLE_INITIAL: Projet[] = [
  {
    id: "b1b72e51-4fa3-433b-821b-cfc1901ddfa2",
    reference: "PRJ-2026-001",
    nom: "Résidence Les Merveilles",
    description: "Programme immobilier R+4 de 16 logements avec sous-sol parking.",
    client: CLIENTS_DEMONSTRATION[0],
    ville: "Abidjan",
    quartier: "Cocody Angré",
    statut: "EN_COURS",
    avancementReel: 22.5,
    avancementTheorique: 25,
    budgetInitial: 650_000_000_00,
    budgetConsomme: 146_250_000_00,
    dateDebutPrevue: "2026-01-12",
    dateFinPrevue: "2027-03-31",
    dateDebutReelle: "2026-01-15",
    dateFinReelle: null,
    chefProjet: COLLABORATEURS_DEMONSTRATION[0],
    conducteurTravaux: COLLABORATEURS_DEMONSTRATION[0],
  },
  {
    id: "c2c83f62-5fb4-4a5c-932c-d02a12eeeb13",
    reference: "PRJ-2026-002",
    nom: "Siège Banque Atlantique",
    description: "Réhabilitation lourde du siège social, façade et lots techniques.",
    client: CLIENTS_DEMONSTRATION[1],
    ville: "Abidjan",
    quartier: "Plateau",
    statut: "EN_RETARD",
    avancementReel: 41,
    avancementTheorique: 58,
    budgetInitial: 1_200_000_000_00,
    budgetConsomme: 612_000_000_00,
    dateDebutPrevue: "2025-09-01",
    dateFinPrevue: "2026-11-30",
    dateDebutReelle: "2025-09-22",
    dateFinReelle: null,
    chefProjet: COLLABORATEURS_DEMONSTRATION[1],
    conducteurTravaux: COLLABORATEURS_DEMONSTRATION[1],
  },
  {
    id: "d3d94073-6fc5-4b6d-a43d-e13b23fffc24",
    reference: "PRJ-2026-003",
    nom: "Entrepôt logistique Sifca",
    description: "Construction d'un entrepôt de 4 200 m² et de ses voiries.",
    client: CLIENTS_DEMONSTRATION[2],
    ville: "Yamoussoukro",
    quartier: "Zone industrielle",
    statut: "CRITIQUE",
    avancementReel: 12,
    avancementTheorique: 34,
    budgetInitial: 480_000_000_00,
    budgetConsomme: 511_000_000_00,
    dateDebutPrevue: "2026-02-03",
    dateFinPrevue: "2026-12-18",
    dateDebutReelle: "2026-02-10",
    dateFinReelle: null,
    chefProjet: COLLABORATEURS_DEMONSTRATION[2],
    conducteurTravaux: COLLABORATEURS_DEMONSTRATION[2],
  },
  {
    id: "e4ea5184-70d6-4c7e-b54e-f24c34000d35",
    reference: "PRJ-2026-004",
    nom: "École primaire de Bingerville",
    description: "Six classes, bloc administratif et bloc sanitaire.",
    client: CLIENTS_DEMONSTRATION[0],
    ville: "Bingerville",
    quartier: "Centre",
    statut: "EN_ATTENTE",
    avancementReel: 0,
    avancementTheorique: 0,
    budgetInitial: null,
    budgetConsomme: 0,
    dateDebutPrevue: "2026-10-05",
    dateFinPrevue: "2027-04-30",
    dateDebutReelle: null,
    dateFinReelle: null,
    chefProjet: null,
    conducteurTravaux: null,
  },
  {
    id: "f5fb6295-81e7-4d8f-c65f-035d45111e46",
    reference: "PRJ-2025-018",
    nom: "Villa duplex Riviera Golf",
    description: "Villa individuelle R+1 avec piscine et local technique.",
    client: CLIENTS_DEMONSTRATION[0],
    ville: "Abidjan",
    quartier: "Riviera Golf",
    statut: "TERMINE",
    avancementReel: 100,
    avancementTheorique: 100,
    budgetInitial: 185_000_000_00,
    budgetConsomme: 179_400_000_00,
    dateDebutPrevue: "2025-01-08",
    dateFinPrevue: "2025-12-15",
    dateDebutReelle: "2025-01-08",
    dateFinReelle: "2025-12-02",
    chefProjet: COLLABORATEURS_DEMONSTRATION[0],
    conducteurTravaux: COLLABORATEURS_DEMONSTRATION[0],
  },
  {
    id: "a6ac73a6-92f8-4e90-d760-146e56222f57",
    reference: "PRJ-2026-005",
    nom: "Extension clinique Sainte-Anne",
    description: "Extension d'un niveau sur bâtiment existant, en site occupé.",
    client: CLIENTS_DEMONSTRATION[1],
    ville: "Bouaké",
    quartier: "Air France",
    statut: "SUSPENDU",
    avancementReel: 31,
    avancementTheorique: 33,
    budgetInitial: 320_000_000_00,
    budgetConsomme: 264_000_000_00,
    dateDebutPrevue: "2026-03-16",
    dateFinPrevue: "2027-01-29",
    dateDebutReelle: "2026-03-16",
    dateFinReelle: null,
    chefProjet: COLLABORATEURS_DEMONSTRATION[1],
    conducteurTravaux: COLLABORATEURS_DEMONSTRATION[1],
  },
];

/* ------------------------------------------------------------------ *
 * L'état, conservé le temps de l'onglet.
 * ------------------------------------------------------------------ */

function lireEtat(): Projet[] {
  if (typeof window === "undefined") return [...PORTEFEUILLE_INITIAL];
  try {
    const brut = window.sessionStorage.getItem(CLE_ETAT);
    return brut ? (JSON.parse(brut) as Projet[]) : [...PORTEFEUILLE_INITIAL];
  } catch {
    return [...PORTEFEUILLE_INITIAL];
  }
}

function ecrireEtat(projets: Projet[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_ETAT, JSON.stringify(projets));
  } catch {
    // Navigation privée saturée : la simulation perd sa mémoire, sans plus.
  }
}

/* ------------------------------------------------------------------ *
 * Ce que l'adaptateur appelle.
 * ------------------------------------------------------------------ */

/**
 * `PRJ-{AAAA}-{nnn}`, séquentiel sur l'année en cours.
 *
 * La référence est **engendrée**, jamais saisie : c'est la règle du serveur
 * (T-024 §4), et la simulation n'a pas à s'en écarter sous prétexte qu'elle
 * est plus simple à écrire autrement.
 */
function referenceSuivante(projets: Projet[]): string {
  const annee = new Date().getFullYear();
  const prefixe = `PRJ-${annee}-`;
  const dernier = projets
    .filter((projet) => projet.reference.startsWith(prefixe))
    .map((projet) => Number.parseInt(projet.reference.slice(prefixe.length), 10))
    .filter((rang) => Number.isFinite(rang))
    .reduce((maximum, rang) => Math.max(maximum, rang), 0);
  return `${prefixe}${String(dernier + 1).padStart(3, "0")}`;
}

function identifiant(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sim-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Le client du formulaire, ou le premier de la liste si l'identifiant est inconnu. */
function resoudreClient(clientId: string): ClientProjet {
  return (
    CLIENTS_DEMONSTRATION.find((client) => client.id === clientId) ?? CLIENTS_DEMONSTRATION[0]
  );
}

/**
 * Le responsable désigné : un collaborateur existant, ou la personne invitée.
 *
 * L'invitée ressort en `INVITE`, comme côté serveur — c'est ce statut que la
 * fiche chantier peint différemment, et l'ignorer ici ferait mentir l'écran.
 */
function resoudreResponsable(creation: CreationProjet): Intervenant | null {
  if (creation.conducteurTravauxId || creation.chefProjetId) {
    const id = creation.conducteurTravauxId ?? creation.chefProjetId;
    return COLLABORATEURS_DEMONSTRATION.find((personne) => personne.id === id) ?? null;
  }

  const invitation = creation.conducteurTravauxInvite ?? creation.chefProjetInvite;
  if (!invitation) return null;

  return {
    id: identifiant(),
    nom: invitation.nom,
    prenom: invitation.prenom,
    nomComplet: `${invitation.prenom} ${invitation.nom}`.trim() || invitation.email,
    email: invitation.email,
    telephone: invitation.telephone,
    statut: "INVITE",
    lienWhatsApp: null,
  };
}

export const simulationProjets = {
  /** Le portefeuille, le plus récemment créé en tête. */
  async lister(): Promise<Projet[]> {
    return attendre(lireEtat(), LATENCE_LECTURE);
  },

  async lire(id: string): Promise<Projet> {
    const projet = lireEtat().find((candidat) => candidat.id === id);
    if (!projet) {
      refuser("introuvable", "Ce chantier n'existe pas ou a été archivé.", 404);
    }
    return attendre(projet, LATENCE_LECTURE);
  },

  /**
   * Un chantier qui vient d'être ouvert n'a ni avancement ni consommation :
   * il part à zéro et en attente, comme le veut `regles.ts`. Le reproduire
   * autrement ici donnerait un chantier de démonstration qui ne ressemble à
   * aucun chantier réel.
   */
  async creer(creation: CreationProjet): Promise<Projet> {
    const projets = lireEtat();
    const responsable = resoudreResponsable(creation);

    const projet: Projet = {
      id: identifiant(),
      reference: referenceSuivante(projets),
      nom: creation.nom,
      description: creation.description ?? "",
      client: resoudreClient(creation.clientId),
      ville: creation.ville,
      quartier: creation.quartier ?? "",
      statut: "EN_ATTENTE",
      avancementReel: 0,
      avancementTheorique: 0,
      budgetInitial: creation.budgetInitial ?? null,
      budgetConsomme: 0,
      dateDebutPrevue: creation.dateDebutPrevue,
      dateFinPrevue: creation.dateFinPrevue,
      dateDebutReelle: null,
      dateFinReelle: null,
      chefProjet: responsable,
      conducteurTravaux: responsable,
    };

    ecrireEtat([projet, ...projets]);
    return attendre(projet, LATENCE_ECRITURE);
  },
};
