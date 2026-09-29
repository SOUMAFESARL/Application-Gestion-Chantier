/**
 * Le jeu de démonstration du tableau de bord DG — en attendant l'API.
 *
 * Même contrat que `features/projets/simulationProjets.ts` : les vrais appels
 * restent à leur place dans `adaptateur.ts`, et le jour où la route existe,
 * `NEXT_PUBLIC_API_SIMULE` passe à `0` sans qu'aucun écran ne change. Le
 * propriétaire du produit a demandé des données de démonstration **sans
 * bandeau** (24/09/2026) : les API seront fournies plus tard.
 *
 * **Les chantiers ne sont pas recopiés, ils sont lus** dans la simulation du
 * domaine Projets, puis enrichis de ce que seul le tableau de bord porte
 * (marché, marge, santé). Un chantier créé depuis le tiroir apparaît donc ici
 * comme dans la liste — deux jeux de démonstration séparés se seraient
 * contredits au premier clic.
 *
 * **Les dates sont relatives à aujourd'hui** : une échéance écrite en dur
 * serait passée dans un mois, et le bloc « Échéances » se viderait tout seul.
 */

import type { Projet } from "@/features/projets/types";
import { INDICE_SANTE_INITIAL, ecartAvancement } from "@/features/projets/regles";
import { simulationProjets } from "@/features/projets/simulationProjets";
import { attendre } from "@/lib/api/simulation";

import type {
  AlertePilotage,
  Echeance,
  ElementAValider,
  LigneChantier,
  ResultatValidation,
  SyntheseQhse,
  TableauDeBord,
} from "./types";

const CLE_VALIDES = "ccd.simulation.tableauDeBord.valides";
const LATENCE_ECRITURE = 500;

/* ------------------------------------------------------------------ *
 * Ce que le tableau de bord ajoute aux chantiers de démonstration.
 * ------------------------------------------------------------------ */

interface Complement {
  montantMarche: number;
  margePrevisionnelle: number | null;
  indiceSante: number;
}

/**
 * Indexé par l'identifiant des chantiers de `simulationProjets`. Chaque
 * niveau de santé se voit : Les Merveilles au vert, le siège Banque
 * Atlantique et la clinique à l'orange, l'entrepôt Sifca au rouge avec une
 * marge négative, l'école sans budget.
 */
const COMPLEMENTS: Record<string, Complement> = {
  "b1b72e51-4fa3-433b-821b-cfc1901ddfa2": {
    montantMarche: 775_000_000_00,
    margePrevisionnelle: 16.1,
    indiceSante: 86,
  },
  "c2c83f62-5fb4-4a5c-932c-d02a12eeeb13": {
    montantMarche: 1_340_000_000_00,
    margePrevisionnelle: 8.4,
    indiceSante: 64,
  },
  "d3d94073-6fc5-4b6d-a43d-e13b23fffc24": {
    montantMarche: 505_000_000_00,
    margePrevisionnelle: -4.2,
    indiceSante: 38,
  },
  "e4ea5184-70d6-4c7e-b54e-f24c34000d35": {
    montantMarche: 210_000_000_00,
    margePrevisionnelle: null,
    indiceSante: INDICE_SANTE_INITIAL,
  },
  "f5fb6295-81e7-4d8f-c65f-035d45111e46": {
    montantMarche: 205_000_000_00,
    margePrevisionnelle: 12.5,
    indiceSante: 95,
  },
  "a6ac73a6-92f8-4e90-d760-146e56222f57": {
    montantMarche: 360_000_000_00,
    margePrevisionnelle: 5.8,
    indiceSante: 67,
  },
};

const ID_MERVEILLES = "b1b72e51-4fa3-433b-821b-cfc1901ddfa2";
const ID_BANQUE = "c2c83f62-5fb4-4a5c-932c-d02a12eeeb13";
const ID_SIFCA = "d3d94073-6fc5-4b6d-a43d-e13b23fffc24";
const ID_ECOLE = "e4ea5184-70d6-4c7e-b54e-f24c34000d35";
const ID_CLINIQUE = "a6ac73a6-92f8-4e90-d760-146e56222f57";

/** Un chantier créé pendant la démonstration n'a ni marché saisi ni historique. */
function versLigne(projet: Projet): LigneChantier {
  const complement = COMPLEMENTS[projet.id];
  return {
    id: projet.id,
    reference: projet.reference,
    nom: projet.nom,
    clientNom: projet.client.raisonSociale,
    ville: projet.ville,
    quartier: projet.quartier,
    statut: projet.statut,
    chefProjetNom: projet.chefProjet?.nomComplet ?? "",
    avancementReel: projet.avancementReel,
    avancementTheorique: projet.avancementTheorique,
    ecart: ecartAvancement(projet.avancementReel, projet.avancementTheorique),
    budgetInitial: projet.budgetInitial,
    budgetConsomme: projet.budgetConsomme,
    montantMarche: complement?.montantMarche ?? null,
    margePrevisionnelle: complement?.margePrevisionnelle ?? null,
    dateFinPrevue: projet.dateFinPrevue,
    indiceSante: complement?.indiceSante ?? INDICE_SANTE_INITIAL,
  };
}

/* ------------------------------------------------------------------ *
 * Les dates relatives.
 * ------------------------------------------------------------------ */

function decaler(jours: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + jours);
  return date;
}

function jourIso(jours: number): string {
  return decaler(jours).toISOString().slice(0, 10);
}

function instantIso(jours: number, heures = 9): string {
  const date = decaler(jours);
  date.setHours(heures, 0, 0, 0);
  return date.toISOString();
}

/* ------------------------------------------------------------------ *
 * Le reste de l'écran.
 * ------------------------------------------------------------------ */

function validations(): ElementAValider[] {
  return [
    {
      id: "val-bdp-042",
      type: "BON_PAIEMENT",
      reference: "BDP-2026-042",
      objet: "Koffi Kouamé (tâcheron) — maçonnerie R+2",
      chantierNom: "Résidence Les Merveilles",
      montant: 3_450_000_00,
      demandeur: "Manson Zanfack",
      demandeLe: instantIso(-1, 16),
    },
    {
      id: "val-da-017",
      type: "DEMANDE_ACHAT",
      reference: "DA-2026-017",
      objet: "Acier HA12 — 18 t (Sotaci)",
      chantierNom: "Siège Banque Atlantique",
      montant: 14_760_000_00,
      demandeur: "Koffi Kouamé",
      demandeLe: instantIso(-2, 11),
    },
    {
      id: "val-av-003",
      type: "AVENANT",
      reference: "AV-2026-003",
      objet: "Renforcement des fondations — sol argileux",
      chantierNom: "Entrepôt logistique Sifca",
      montant: 38_500_000_00,
      demandeur: "Awa Soro",
      demandeLe: instantIso(-3, 10),
    },
    {
      id: "val-bdp-044",
      type: "BON_PAIEMENT",
      reference: "BDP-2026-044",
      objet: "Ivoire Élec (sous-traitant) — incorporation dalles",
      chantierNom: "Siège Banque Atlantique",
      montant: 2_800_000_00,
      demandeur: "Koffi Kouamé",
      demandeLe: instantIso(-3, 15),
    },
  ];
}

function alertes(): AlertePilotage[] {
  return [
    {
      id: "al-1",
      type: "INCIDENT_SECURITE",
      gravite: "CRITIQUE",
      chantierId: ID_SIFCA,
      chantierNom: "Entrepôt logistique Sifca",
      sujet: "Chute de plain-pied, ouvrier blessé à la main",
      montant: null,
      jours: null,
      survenueLe: instantIso(0, 8),
    },
    {
      id: "al-2",
      type: "PAIEMENT_RETARD",
      gravite: "CRITIQUE",
      chantierId: ID_BANQUE,
      chantierNom: "Siège Banque Atlantique",
      sujet: "Lafarge Holcim CI",
      montant: 22_300_000_00,
      jours: 18,
      survenueLe: instantIso(-1, 7),
    },
    {
      id: "al-3",
      type: "DEPENSE_INHABITUELLE",
      gravite: "ATTENTION",
      chantierId: ID_SIFCA,
      chantierNom: "Entrepôt logistique Sifca",
      sujet: "Gasoil — 1 850 L en une semaine",
      montant: 1_387_500_00,
      jours: null,
      survenueLe: instantIso(-1, 14),
    },
    {
      id: "al-4",
      type: "ECHEANCE_CONTRAT",
      gravite: "ATTENTION",
      chantierId: ID_BANQUE,
      chantierNom: "Siège Banque Atlantique",
      sujet: "Pénalités de retard (clause 12.3)",
      montant: null,
      jours: 12,
      survenueLe: instantIso(-2, 9),
    },
    {
      id: "al-5",
      type: "RUPTURE_STOCK",
      gravite: "ATTENTION",
      chantierId: ID_MERVEILLES,
      chantierNom: "Résidence Les Merveilles",
      sujet: "Ciment CPJ 42.5",
      montant: null,
      jours: 3,
      survenueLe: instantIso(0, 7),
    },
    {
      id: "al-6",
      type: "INTEMPERIES",
      gravite: "ATTENTION",
      chantierId: ID_CLINIQUE,
      chantierNom: "Extension clinique Sainte-Anne",
      sujet: "Bouaké",
      montant: null,
      jours: null,
      survenueLe: instantIso(0, 6),
    },
  ];
}

function echeances(): Echeance[] {
  return [
    {
      id: "ech-1",
      type: "SITUATION_TRAVAUX",
      libelle: "Situation n° 9 à transmettre au maître d'ouvrage",
      chantierId: ID_BANQUE,
      chantierNom: "Siège Banque Atlantique",
      date: jourIso(3),
    },
    {
      id: "ech-2",
      type: "RECEPTION_TRAVAUX",
      libelle: "Réception du lot gros œuvre R+2",
      chantierId: ID_MERVEILLES,
      chantierNom: "Résidence Les Merveilles",
      date: jourIso(6),
    },
    {
      id: "ech-3",
      type: "CAUTION",
      libelle: "Échéance de la caution d'avance de démarrage",
      chantierId: ID_SIFCA,
      chantierNom: "Entrepôt logistique Sifca",
      date: jourIso(11),
    },
    {
      id: "ech-4",
      type: "LIVRAISON_CHANTIER",
      libelle: "Démarrage des travaux — ordre de service attendu",
      chantierId: ID_ECOLE,
      chantierNom: "École primaire de Bingerville",
      date: jourIso(17),
    },
    {
      id: "ech-5",
      type: "FIN_CONTRAT",
      libelle: "Fin du contrat de sous-traitance étanchéité (Etancheo)",
      chantierId: ID_CLINIQUE,
      chantierNom: "Extension clinique Sainte-Anne",
      date: jourIso(26),
    },
  ];
}

const QHSE: SyntheseQhse = {
  joursSansAccident: 0,
  accidentsMois: 1,
  presqueAccidentsMois: 4,
  nonConformitesOuvertes: 7,
  nonConformitesEnRetard: 2,
};

/* ------------------------------------------------------------------ *
 * La mémoire des validations, le temps de l'onglet.
 * ------------------------------------------------------------------ */

function lireValides(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.sessionStorage.getItem(CLE_VALIDES);
    return brut ? (JSON.parse(brut) as string[]) : [];
  } catch {
    return [];
  }
}

function ecrireValides(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_VALIDES, JSON.stringify(ids));
  } catch {
    // Stockage indisponible : la validation ne survivra pas au rechargement, sans plus.
  }
}

export const simulationTableauDeBord = {
  async lire(): Promise<TableauDeBord> {
    const projets = await simulationProjets.lister();
    const valides = new Set(lireValides());
    return {
      chantiers: projets.map(versLigne),
      validations: validations().filter((element) => !valides.has(element.id)),
      alertes: alertes(),
      echeances: echeances(),
      qhse: QHSE,
    };
  },

  async valider(id: string): Promise<ResultatValidation> {
    ecrireValides([...new Set([...lireValides(), id])]);
    return attendre({ id, valideLe: new Date().toISOString() }, LATENCE_ECRITURE);
  },
};
