/**
 * Le jeu de démonstration des lots et activités — en attendant les routes.
 *
 * Même contrat que `simulationProjets.ts`, dont il est le prolongement : il
 * parle le domaine (les types de `types.ts`), pas un transport inventé ; il
 * se souvient le temps de l'onglet (`sessionStorage`) ; et les vrais appels
 * restent à leur place dans `adaptateur.ts`, derrière `SIMULATION_ACTIVE`.
 *
 * Il vit dans son propre fichier parce qu'il porte des libellés d'activités
 * de chantier — de la donnée, pas du texte d'interface — et que l'exemption
 * i18n d'`eslint.config.mjs` se donne fichier par fichier.
 *
 * Les dates sont choisies pour que chaque état se voie à l'ouverture : des
 * activités terminées, en cours, à venir et en retard sur le même chantier.
 */

import { attendre, refuser } from "@/lib/api/simulation";

import {
  changerRoleMembre,
  codeActiviteSuivant,
  codeLot,
  codeLotSuivant,
  collaborateurDansEquipe,
  effectifEquipe,
  retirerMembre,
  ROLE_MEMBRE_PAR_DEFAUT,
} from "./regles";
import type {
  Activite,
  CreationEquipe,
  CreationLot,
  CreationLotProjet,
  Equipe,
  EquipeChantier,
  Lot,
  MembreEquipe,
  NatureEquipe,
  RoleMembreEquipe,
  SaisieActiviteDomaine,
  SaisieMembreEquipe,
} from "./types";

/**
 * `v2` : les équipes sont devenues propres à chaque chantier. Un état gardé
 * sous l'ancienne clé porterait des équipes qui n'existent plus.
 */
const CLE_ETAT = "ccd.simulation.lots.v2";
/** `v2` : chaque membre porte désormais son rôle dans l'équipe. */
const CLE_EQUIPES = "ccd.simulation.equipes.v2";

const LATENCE_LECTURE = 350;
const LATENCE_ECRITURE = 500;

/* ------------------------------------------------------------------ *
 * Les équipes de chantier.
 * ------------------------------------------------------------------ */

const ID_RESIDENCE = "b1b72e51-4fa3-433b-821b-cfc1901ddfa2";
const ID_SIEGE = "c2c83f62-5fb4-4a5c-932c-d02a12eeeb13";
const ID_ENTREPOT = "d3d94073-6fc5-4b6d-a43d-e13b23fffc24";

/** « Koffi Kouassi » → un membre, prénom puis nom. */
function personne(id: string, nomComplet: string, role: RoleMembreEquipe): MembreEquipe {
  const [prenom, ...nom] = nomComplet.split(" ");
  return { id, prenom, nom: nom.join(" "), role, collaborateurId: null };
}

/**
 * Le rôle d'un membre de démonstration, d'après son rang : les premiers sont
 * qualifiés, le dernier d'une équipe fournie est manœuvre, et une équipe
 * d'engins a son conducteur en tête.
 */
function roleDeDemonstration(specialite: string, rang: number, total: number): RoleMembreEquipe {
  if (rang === 0 && specialite.includes("engins")) return "CONDUCTEUR_ENGIN";
  if (rang < 2) return "OUVRIER_QUALIFIE";
  if (total >= 4 && rang === total - 1) return "MANOEUVRE";
  return "OUVRIER";
}

function equipe(
  projetId: string,
  cle: string,
  nom: string,
  nature: NatureEquipe,
  specialite: string,
  chef: string,
  membres: string[],
): Equipe {
  const id = `eq-${cle}`;
  const resultat = {
    id,
    projetId,
    nom,
    nature,
    specialite,
    chef: personne(`${id}-chef`, chef, "CHEF_EQUIPE"),
    membres: membres.map((nomComplet, rang) =>
      personne(`${id}-m${rang + 1}`, nomComplet, roleDeDemonstration(specialite, rang, membres.length)),
    ),
  };
  return { ...resultat, effectif: effectifEquipe(resultat) };
}

/** La forme courte qu'une activité porte : sans la liste des membres. */
function resume(detail: Equipe): EquipeChantier {
  return { id: detail.id, nom: detail.nom, effectif: detail.effectif };
}

const MACONNERIE = equipe(ID_RESIDENCE, "maconnerie-a", "Équipe Maçonnerie A", "INTERNE",
  "Maçonnerie / coffrage", "Koffi Kouassi", [
    "Yao N'Guessan", "Brice Kouadio", "Serge Aka", "Ibrahim Ouattara",
    "Didier Gnahoré", "Firmin Tanoh", "Lassina Coulibaly",
  ]);
const FERRAILLAGE = equipe(ID_RESIDENCE, "ferraillage", "Équipe Ferraillage", "INTERNE",
  "Ferraillage", "Seydou Traoré", ["Moussa Koné", "Alain Kacou", "Hervé Bamba", "Issa Sangaré"]);
const TERRASSEMENT = equipe(ID_RESIDENCE, "terrassement", "Équipe Terrassement", "INTERNE",
  "Terrassement + engins", "Adama Yao", ["Paul Kra", "Souleymane Diarra", "Eric Djédjé"]);
const ELECTRICITE = equipe(ID_RESIDENCE, "elec-ci", "ELEC-CI SARL", "SOUS_TRAITANT",
  "Électricité", "Mamadou Diabaté", [
    "Arsène Lago", "Karim Touré", "Olivier Zadi", "Bakary Fofana", "Jules Ehui",
  ]);
const PLOMBERIE = equipe(ID_RESIDENCE, "plomberie-konan", "Plomberie Konan & Fils", "SOUS_TRAITANT",
  "Plomberie sanitaire", "Jean Konan", ["Marc Konan", "Luc Konan", "Adou Assi"]);

const FACADE = equipe(ID_SIEGE, "alu-facades", "Alu Façades CI", "SOUS_TRAITANT",
  "Façade vitrée", "Patrice Gbagbo", ["Rodrigue Aboa", "Cyrille Dago", "Ange Kobenan"]);
const CLIMATISATION = equipe(ID_SIEGE, "froid-ci", "FROID-CI Services", "SOUS_TRAITANT",
  "Climatisation", "Ismaël Cissé", ["Noël Amani", "Fabrice Yapi", "Salif Dembélé", "Gildas Oka"]);
const DEPOSE = equipe(ID_SIEGE, "depose", "Équipe Dépose", "INTERNE",
  "Curage / démolition", "Roger Kouamé", ["Blaise Tiémoko", "Honoré Kipré"]);

const TERRASSEMENT_NORD = equipe(ID_ENTREPOT, "terrassement-nord", "Équipe Terrassement Nord",
  "INTERNE", "Terrassement + engins", "Drissa Koné", [
    "Abou Sylla", "Mathieu Kassi", "Zié Soro", "Venance Aké", "Kader Dosso",
  ]);

/** Les équipes déjà constituées, chantier par chantier. */
const EQUIPES_INITIALES: Record<string, Equipe[]> = {
  [ID_RESIDENCE]: [MACONNERIE, FERRAILLAGE, TERRASSEMENT, ELECTRICITE, PLOMBERIE],
  [ID_SIEGE]: [DEPOSE, FACADE, CLIMATISATION],
  [ID_ENTREPOT]: [TERRASSEMENT_NORD],
};

/* ------------------------------------------------------------------ *
 * Les structures initiales.
 * ------------------------------------------------------------------ */

type GabaritActivite = Omit<Activite, "id" | "lotId" | "code">;
type GabaritLot = Pick<Lot, "nom" | "modeExecution" | "typeBordereau"> & {
  activites: (GabaritActivite & { cle?: string; apres?: string })[];
};

/** Des millions de FCFA, en centimes. */
function millions(valeur: number): number {
  return Math.round(valeur * 1_000_000 * 100);
}

function activite(
  libelle: string,
  quantitePrevue: number | null,
  unite: Activite["unite"],
  dateDebutPrevue: string,
  dateFinPrevue: string,
  budgetMillions: number,
  avancement: number,
  options: { equipe?: EquipeChantier; critique?: boolean; cle?: string; apres?: string } = {},
): GabaritActivite & { cle?: string; apres?: string } {
  return {
    libelle,
    quantitePrevue,
    unite,
    dateDebutPrevue,
    dateFinPrevue,
    budget: millions(budgetMillions),
    avancement,
    surCheminCritique: options.critique ?? false,
    dependanceId: null,
    equipe: options.equipe ?? null,
    cle: options.cle,
    apres: options.apres,
  };
}

/** L'immeuble R+4 de Cocody : sept lots, treize activités, quatre retards. */
const STRUCTURE_RESIDENCE: GabaritLot[] = [
  {
    nom: "Installation de chantier",
    modeExecution: "REGIE_DIRECTE",
    typeBordereau: "FORFAIT_GLOBAL",
    activites: [
      activite("Clôture et portail", 220, "ML", "2026-07-01", "2026-07-08", 4.5, 100),
      activite("Base vie et bureaux", 1, "FFT", "2026-07-05", "2026-07-15", 6, 100),
    ],
  },
  {
    nom: "Terrassement",
    modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
    typeBordereau: "PRIX_UNITAIRE",
    activites: [
      activite("Décapage et fouilles en masse", 1800, "M3", "2026-07-10", "2026-07-24", 7, 100, {
        equipe: resume(TERRASSEMENT),
      }),
      activite("Remblais compactés", 950, "M3", "2026-07-22", "2026-08-02", 4, 100, {
        equipe: resume(TERRASSEMENT),
      }),
    ],
  },
  {
    nom: "Gros œuvre",
    modeExecution: "REGIE_DIRECTE",
    typeBordereau: "PRIX_UNITAIRE",
    activites: [
      activite("Fondations (semelles)", 145, "M3", "2026-08-01", "2026-08-25", 38, 100, {
        equipe: resume(MACONNERIE),
        critique: true,
        cle: "fondations",
      }),
      activite("Poteaux et dalle RDC", 420, "M2", "2026-08-25", "2026-09-20", 52, 85, {
        equipe: resume(MACONNERIE),
        critique: true,
        cle: "dalleRdc",
        apres: "fondations",
      }),
      activite("Ferraillage dalle R+1", 14500, "KG", "2026-09-15", "2026-10-05", 21, 40, {
        equipe: resume(FERRAILLAGE),
        critique: true,
        cle: "ferraillageR1",
        apres: "dalleRdc",
      }),
      activite("Coffrage et coulage dalle R+1", 420, "M2", "2026-10-06", "2026-10-20", 41.5, 0, {
        critique: true,
        apres: "ferraillageR1",
      }),
      activite("Maçonnerie des élévations", 1250, "M2", "2026-09-20", "2026-10-20", 24, 0, {
        equipe: resume(MACONNERIE),
        apres: "dalleRdc",
      }),
    ],
  },
  {
    nom: "Charpente et couverture",
    modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
    typeBordereau: "FORFAIT_GLOBAL",
    activites: [
      activite("Charpente métallique", 8500, "KG", "2026-09-01", "2026-10-31", 30, 10),
    ],
  },
  {
    nom: "Menuiseries",
    modeExecution: "SOUS_TRAITANCE_INFORMELLE",
    typeBordereau: "PRIX_UNITAIRE",
    activites: [
      activite("Menuiseries aluminium", 64, "U", "2026-11-02", "2026-12-15", 18, 0),
    ],
  },
  {
    nom: "Électricité",
    modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
    typeBordereau: "FORFAIT_GLOBAL",
    activites: [
      activite("Réseaux et tableaux électriques", 1, "ENS", "2026-10-15", "2027-01-15", 22, 0, {
        equipe: resume(ELECTRICITE),
      }),
    ],
  },
  {
    nom: "Plomberie sanitaire",
    modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
    typeBordereau: "FORFAIT_GLOBAL",
    activites: [
      activite("Réseaux eau froide et eau chaude", 1, "ENS", "2026-10-15", "2027-01-15", 20, 0, {
        equipe: resume(PLOMBERIE),
      }),
    ],
  },
];

/** Le siège de la Banque Atlantique : une réhabilitation, trois lots. */
const STRUCTURE_SIEGE: GabaritLot[] = [
  {
    nom: "Curage et démolition",
    modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
    typeBordereau: "FORFAIT_GLOBAL",
    activites: [
      activite("Dépose des cloisons et faux plafonds", 2400, "M2", "2025-09-22", "2025-11-15", 45, 100, {
        equipe: resume(DEPOSE),
      }),
      activite("Désamiantage des gaines", 1, "FFT", "2025-10-15", "2025-12-20", 60, 100),
    ],
  },
  {
    nom: "Façade",
    modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
    typeBordereau: "PRIX_UNITAIRE",
    activites: [
      activite("Mur rideau vitré", 1850, "M2", "2026-02-01", "2026-09-30", 310, 55, {
        equipe: resume(FACADE),
        critique: true,
      }),
      activite("Ravalement des pignons", 900, "M2", "2026-06-01", "2026-08-31", 40, 70),
    ],
  },
  {
    nom: "Lots techniques",
    modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
    typeBordereau: "FORFAIT_GLOBAL",
    activites: [
      activite("Climatisation centralisée", 1, "ENS", "2026-05-01", "2026-11-15", 180, 35, {
        equipe: resume(CLIMATISATION),
      }),
    ],
  },
];

/** L'entrepôt Sifca : deux lots, dont un terrassement qui dérape. */
const STRUCTURE_ENTREPOT: GabaritLot[] = [
  {
    nom: "Terrassement et plateforme",
    modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
    typeBordereau: "PRIX_UNITAIRE",
    activites: [
      activite("Fouilles en masse", 6200, "M3", "2026-02-10", "2026-04-30", 55, 70, {
        equipe: resume(TERRASSEMENT_NORD),
        critique: true,
      }),
      activite("Couche de forme", 4200, "M2", "2026-04-15", "2026-06-15", 38, 20, { critique: true }),
    ],
  },
  {
    nom: "Charpente métallique",
    modeExecution: "SOUS_TRAITANCE_STRUCTUREE",
    typeBordereau: "FORFAIT_GLOBAL",
    activites: [activite("Portiques et pannes", 96, "T", "2026-07-01", "2026-10-15", 140, 0)],
  },
];

/** Les chantiers de `simulationProjets.ts` qui ont déjà une structure. */
const STRUCTURES_INITIALES: Record<string, GabaritLot[]> = {
  [ID_RESIDENCE]: STRUCTURE_RESIDENCE,
  [ID_SIEGE]: STRUCTURE_SIEGE,
  [ID_ENTREPOT]: STRUCTURE_ENTREPOT,
};

/**
 * Un gabarit, déplié en lots complets. Les identifiants sont **stables**
 * (dérivés du chantier et du code) : une dépendance s'écrit sur un
 * identifiant, et il doit survivre au rechargement de l'état initial.
 */
function deplier(projetId: string, gabarits: GabaritLot[]): Lot[] {
  const idsParCle = new Map<string, string>();
  /** Les dépendances en attente : l'activité, et la clé de celle qu'elle attend. */
  const enAttente = new Map<string, string>();

  const lots = gabarits.map((gabarit, rangLot): Lot => {
    const code = codeLot(rangLot);
    const lotId = `${projetId}-lot-${code}`;
    return {
      id: lotId,
      projetId,
      code,
      nom: gabarit.nom,
      modeExecution: gabarit.modeExecution,
      typeBordereau: gabarit.typeBordereau,
      dateDebut: null,
      dateFin: null,
      activites: gabarit.activites.map(({ cle, apres, ...reste }, rang) => {
        const codeAct = `${code}.${String(rang + 1).padStart(2, "0")}`;
        const id = `${projetId}-act-${codeAct}`;
        if (cle) idsParCle.set(cle, id);
        if (apres) enAttente.set(id, apres);
        return { ...reste, id, lotId, code: codeAct };
      }),
    };
  });

  // Les dépendances se résolvent une fois tous les identifiants connus.
  return lots.map((lot) => ({
    ...lot,
    activites: lot.activites.map((act) => {
      const apres = enAttente.get(act.id);
      return { ...act, dependanceId: apres ? (idsParCle.get(apres) ?? null) : null };
    }),
  }));
}

type EtatLots = Record<string, Lot[]>;

function etatInitial(): EtatLots {
  return Object.fromEntries(
    Object.entries(STRUCTURES_INITIALES).map(([projetId, gabarits]) => [
      projetId,
      deplier(projetId, gabarits),
    ]),
  );
}

function lireEtat(): EtatLots {
  if (typeof window === "undefined") return etatInitial();
  try {
    const brut = window.sessionStorage.getItem(CLE_ETAT);
    return brut ? (JSON.parse(brut) as EtatLots) : etatInitial();
  } catch {
    return etatInitial();
  }
}

function ecrireEtat(etat: EtatLots): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_ETAT, JSON.stringify(etat));
  } catch {
    // Navigation privée saturée : la simulation perd sa mémoire, sans plus.
  }
}

function identifiant(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sim-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

type EtatEquipes = Record<string, Equipe[]>;

function lireEquipes(): EtatEquipes {
  if (typeof window === "undefined") return EQUIPES_INITIALES;
  try {
    const brut = window.sessionStorage.getItem(CLE_EQUIPES);
    return brut ? (JSON.parse(brut) as EtatEquipes) : EQUIPES_INITIALES;
  } catch {
    return EQUIPES_INITIALES;
  }
}

function ecrireEquipes(etat: EtatEquipes): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_EQUIPES, JSON.stringify(etat));
  } catch {
    // Même repli que pour les lots.
  }
}

/**
 * L'équipe désignée par une saisie, parmi celles **du chantier** : une équipe
 * d'un autre chantier est refusée, comme le ferait le serveur.
 */
function resoudreEquipe(projetId: string, id: string | null): EquipeChantier | null {
  if (!id) return null;
  const trouvee = (lireEquipes()[projetId] ?? []).find((candidate) => candidate.id === id);
  if (!trouvee) refuser("introuvable", "Cette équipe n'existe pas sur ce chantier.", 404);
  return resume(trouvee);
}

/**
 * Réécrit une équipe du chantier, effectif recompté. L'effectif que portent
 * les activités (leur forme courte de l'équipe) suit : sans quoi la liste des
 * affectations continuerait d'afficher l'ancien chiffre.
 */
function modifierEquipe(
  projetId: string,
  equipeId: string,
  transformation: (equipe: Equipe) => Equipe,
): Equipe {
  const etat = lireEquipes();
  const equipes = etat[projetId] ?? [];
  const ancienne = equipes.find((candidate) => candidate.id === equipeId);
  if (!ancienne) refuser("introuvable", "Cette équipe n'existe pas sur ce chantier.", 404);
  const transformee = transformation(ancienne);
  const modifiee: Equipe = { ...transformee, effectif: effectifEquipe(transformee) };
  ecrireEquipes({
    ...etat,
    [projetId]: equipes.map((candidate) => (candidate.id === equipeId ? modifiee : candidate)),
  });

  const lots = lireEtat();
  lots[projetId] = (lots[projetId] ?? []).map((lot) => ({
    ...lot,
    activites: lot.activites.map((activite) =>
      activite.equipe?.id === equipeId ? { ...activite, equipe: resume(modifiee) } : activite,
    ),
  }));
  ecrireEtat(lots);
  return modifiee;
}

/** Le membre d'une équipe, ou le refus que renverrait le serveur. */
function exigerMembre(equipe: Equipe, membreId: string): void {
  const present = equipe.chef?.id === membreId || equipe.membres.some((m) => m.id === membreId);
  if (!present) refuser("introuvable", "Cette personne ne fait plus partie de l'équipe.", 404);
}

/** Le lot d'un chantier, ou le refus que renverrait le serveur. */
function trouverLot(lots: Lot[], lotId: string): Lot {
  const lot = lots.find((candidat) => candidat.id === lotId);
  if (!lot) refuser("introuvable", "Ce lot n'existe pas ou a été retiré.", 404);
  return lot;
}

/* ------------------------------------------------------------------ *
 * Ce que l'adaptateur appelle.
 * ------------------------------------------------------------------ */

export const simulationLots = {
  async lister(projetId: string): Promise<Lot[]> {
    return attendre(lireEtat()[projetId] ?? [], LATENCE_LECTURE);
  },

  async listerEquipes(projetId: string): Promise<Equipe[]> {
    return attendre(lireEquipes()[projetId] ?? [], LATENCE_LECTURE);
  },

  async creerEquipe(projetId: string, creation: CreationEquipe): Promise<Equipe> {
    const etat = lireEquipes();
    const equipes = etat[projetId] ?? [];
    const nomPris = equipes.some(
      (existante) => existante.nom.trim().toLowerCase() === creation.nom.trim().toLowerCase(),
    );
    if (nomPris) refuser("nom_equipe_existant", "Une équipe porte déjà ce nom sur ce chantier.", 400);

    const id = identifiant();
    const detail = {
      id,
      projetId,
      nom: creation.nom,
      nature: creation.nature,
      specialite: creation.specialite,
      chef: { id: `${id}-chef`, ...creation.chef, role: "CHEF_EQUIPE" as const },
      membres: creation.membres.map((membre, rang) => ({ id: `${id}-m${rang + 1}`, ...membre })),
    };
    const nouvelle: Equipe = { ...detail, effectif: effectifEquipe(detail) };
    ecrireEquipes({ ...etat, [projetId]: [...equipes, nouvelle] });
    return attendre(nouvelle, LATENCE_ECRITURE);
  },

  async ajouterMembre(
    projetId: string,
    equipeId: string,
    membre: SaisieMembreEquipe,
  ): Promise<Equipe> {
    const modifiee = modifierEquipe(projetId, equipeId, (equipe) => {
      if (membre.collaborateurId && collaborateurDansEquipe(equipe, membre.collaborateurId)) {
        refuser("membre_deja_present", "Cette personne fait déjà partie de l'équipe.", 400);
      }
      // Arrivé comme chef, il passe par la même règle qu'une nomination :
      // l'ancien chef redescend, il n'y en a jamais deux.
      const nouveau = { id: identifiant(), ...membre, role: ROLE_MEMBRE_PAR_DEFAUT };
      const avecNouveau = { ...equipe, membres: [...equipe.membres, nouveau] };
      return changerRoleMembre(avecNouveau, nouveau.id, membre.role);
    });
    return attendre(modifiee, LATENCE_ECRITURE);
  },

  async changerRoleMembre(
    projetId: string,
    equipeId: string,
    membreId: string,
    role: RoleMembreEquipe,
  ): Promise<Equipe> {
    const modifiee = modifierEquipe(projetId, equipeId, (equipe) => {
      exigerMembre(equipe, membreId);
      return changerRoleMembre(equipe, membreId, role);
    });
    return attendre(modifiee, LATENCE_ECRITURE);
  },

  async retirerMembre(projetId: string, equipeId: string, membreId: string): Promise<Equipe> {
    const modifiee = modifierEquipe(projetId, equipeId, (equipe) => {
      exigerMembre(equipe, membreId);
      return retirerMembre(equipe, membreId);
    });
    return attendre(modifiee, LATENCE_ECRITURE);
  },

  /** L'équipe d'une activité, changée seule : le reste de l'activité ne bouge pas. */
  async affecterEquipe(
    projetId: string,
    activiteId: string,
    equipeId: string | null,
  ): Promise<Activite> {
    const etat = lireEtat();
    const lots = etat[projetId] ?? [];
    const ancienne = lots.flatMap((lot) => lot.activites).find((act) => act.id === activiteId);
    if (!ancienne) refuser("introuvable", "Cette activité n'existe pas ou a été retirée.", 404);
    const affectee: Activite = { ...ancienne, equipe: resoudreEquipe(projetId, equipeId) };
    etat[projetId] = lots.map((lot) => ({
      ...lot,
      activites: lot.activites.map((act) => (act.id === activiteId ? affectee : act)),
    }));
    ecrireEtat(etat);
    return attendre(affectee, LATENCE_ECRITURE);
  },

  async creerLot(projetId: string, creation: CreationLotProjet): Promise<Lot> {
    const etat = lireEtat();
    const lots = etat[projetId] ?? [];
    const lot: Lot = {
      id: identifiant(),
      projetId,
      code: codeLotSuivant(lots),
      nom: creation.nom,
      modeExecution: creation.modeExecution,
      typeBordereau: creation.typeBordereau,
      dateDebut: creation.dateDebut ?? null,
      dateFin: creation.dateFin ?? null,
      activites: [],
    };
    ecrireEtat({ ...etat, [projetId]: [...lots, lot] });
    return attendre(lot, LATENCE_ECRITURE);
  },

  /**
   * Les lots saisis à l'étape 2 de la création d'un projet : sans eux, un
   * chantier tout juste ouvert s'afficherait ici sans structure alors qu'on
   * vient de la lui donner.
   */
  enregistrerLotsCreation(projetId: string, lots: CreationLot[]): void {
    const etat = lireEtat();
    etat[projetId] = lots.map((creation, rang) => ({
      id: identifiant(),
      projetId,
      code: codeLot(rang),
      nom: creation.nom,
      modeExecution: creation.modeExecution,
      typeBordereau: creation.typeBordereau,
      dateDebut: creation.dateDebut ?? null,
      dateFin: creation.dateFin ?? null,
      activites: [],
    }));
    ecrireEtat(etat);
  },

  async creerActivite(projetId: string, saisie: SaisieActiviteDomaine): Promise<Activite> {
    const etat = lireEtat();
    const lots = etat[projetId] ?? [];
    const lot = trouverLot(lots, saisie.lotId);
    const nouvelle: Activite = {
      id: identifiant(),
      lotId: lot.id,
      code: codeActiviteSuivant(lot),
      libelle: saisie.libelle,
      quantitePrevue: saisie.quantitePrevue,
      unite: saisie.unite,
      dateDebutPrevue: saisie.dateDebutPrevue,
      dateFinPrevue: saisie.dateFinPrevue,
      budget: saisie.budget,
      avancement: 0,
      surCheminCritique: false,
      dependanceId: saisie.dependanceId,
      equipe: resoudreEquipe(projetId, saisie.equipeId),
    };
    etat[projetId] = lots.map((candidat) =>
      candidat.id === lot.id ? { ...candidat, activites: [...candidat.activites, nouvelle] } : candidat,
    );
    ecrireEtat(etat);
    return attendre(nouvelle, LATENCE_ECRITURE);
  },

  /**
   * La modification garde l'avancement, qui vient du journal de chantier. Un
   * changement de lot déplace l'activité, qui prend alors un code du lot
   * d'arrivée — le code dit où elle est, il ne peut pas mentir sur son lot.
   */
  async modifierActivite(
    projetId: string,
    activiteId: string,
    saisie: SaisieActiviteDomaine,
  ): Promise<Activite> {
    const etat = lireEtat();
    const lots = etat[projetId] ?? [];
    const origine = lots.find((lot) => lot.activites.some((act) => act.id === activiteId));
    const ancienne = origine?.activites.find((act) => act.id === activiteId);
    if (!origine || !ancienne) {
      refuser("introuvable", "Cette activité n'existe pas ou a été retirée.", 404);
    }
    const arrivee = trouverLot(lots, saisie.lotId);
    const modifiee: Activite = {
      ...ancienne,
      lotId: arrivee.id,
      code: arrivee.id === origine.id ? ancienne.code : codeActiviteSuivant(arrivee),
      libelle: saisie.libelle,
      quantitePrevue: saisie.quantitePrevue,
      unite: saisie.unite,
      dateDebutPrevue: saisie.dateDebutPrevue,
      dateFinPrevue: saisie.dateFinPrevue,
      budget: saisie.budget,
      dependanceId: saisie.dependanceId,
      equipe: resoudreEquipe(projetId, saisie.equipeId),
    };
    etat[projetId] = lots.map((lot) => {
      const sans = lot.activites.filter((act) => act.id !== activiteId);
      if (lot.id !== arrivee.id) return { ...lot, activites: sans };
      if (lot.id === origine.id) {
        return { ...lot, activites: lot.activites.map((act) => (act.id === activiteId ? modifiee : act)) };
      }
      return { ...lot, activites: [...sans, modifiee] };
    });
    ecrireEtat(etat);
    return attendre(modifiee, LATENCE_ECRITURE);
  },
};
