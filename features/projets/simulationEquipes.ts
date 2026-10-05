/**
 * Les équipes de chantier et leurs affectations — en attendant les routes.
 *
 * Les lots et les activités sont servis par Django ; les équipes, pas encore.
 * Ce fichier garde donc **les équipes seules**, et l'affectation d'une équipe
 * à une activité réelle : un identifiant d'équipe simulée n'a aucun sens pour
 * le serveur, il ne lui est jamais envoyé.
 *
 * Aucun jeu de démonstration : les équipes de l'ancien jeu étaient rattachées
 * à des chantiers qui n'existent pas côté serveur. On part de rien, et ce qui
 * est constitué se souvient le temps de l'onglet (`sessionStorage`).
 *
 * Il vit dans son propre fichier parce qu'il imite les messages du serveur,
 * et que l'exemption i18n d'`eslint.config.mjs` se donne fichier par fichier.
 */

import { attendre, refuser } from "@/lib/api/simulation";

import {
  changerRoleMembre,
  collaborateurDansEquipe,
  effectifEquipe,
  retirerMembre,
  ROLE_MEMBRE_PAR_DEFAUT,
} from "./regles";
import type {
  CreationEquipe,
  Equipe,
  EquipeChantier,
  RoleMembreEquipe,
  SaisieMembreEquipe,
} from "./types";

const CLE_EQUIPES = "ccd.simulation.equipes.v3";
/** Activité → équipe, chantier par chantier. */
const CLE_AFFECTATIONS = "ccd.simulation.affectations.v1";

const LATENCE_LECTURE = 350;
const LATENCE_ECRITURE = 500;

type EtatEquipes = Record<string, Equipe[]>;
type EtatAffectations = Record<string, Record<string, string>>;

function lire<T>(cle: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const brut = window.sessionStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function ecrire(cle: string, etat: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(cle, JSON.stringify(etat));
  } catch {
    // Navigation privée saturée : la simulation perd sa mémoire, sans plus.
  }
}

const lireEquipes = () => lire<Equipe[]>(CLE_EQUIPES) as EtatEquipes;
const lireAffectations = () => lire<Record<string, string>>(CLE_AFFECTATIONS) as EtatAffectations;

function identifiant(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sim-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** La forme courte qu'une activité porte : sans la liste des membres. */
function resume(detail: Equipe): EquipeChantier {
  return { id: detail.id, nom: detail.nom, effectif: detail.effectif };
}

/**
 * L'équipe désignée, parmi celles **du chantier** : une équipe d'un autre
 * chantier est refusée, comme le ferait le serveur.
 */
function resoudreEquipe(projetId: string, id: string): Equipe {
  const trouvee = (lireEquipes()[projetId] ?? []).find((candidate) => candidate.id === id);
  if (!trouvee) refuser("introuvable", "Cette équipe n'existe pas sur ce chantier.", 404);
  return trouvee;
}

/** Réécrit une équipe du chantier, effectif recompté. */
function modifierEquipe(
  projetId: string,
  equipeId: string,
  transformation: (equipe: Equipe) => Equipe,
): Equipe {
  const etat = lireEquipes();
  const equipes = etat[projetId] ?? [];
  const transformee = transformation(resoudreEquipe(projetId, equipeId));
  const modifiee: Equipe = { ...transformee, effectif: effectifEquipe(transformee) };
  ecrire(CLE_EQUIPES, {
    ...etat,
    [projetId]: equipes.map((candidate) => (candidate.id === equipeId ? modifiee : candidate)),
  });
  return modifiee;
}

/** Le membre d'une équipe, ou le refus que renverrait le serveur. */
function exigerMembre(equipe: Equipe, membreId: string): void {
  const present = equipe.chef?.id === membreId || equipe.membres.some((m) => m.id === membreId);
  if (!present) refuser("introuvable", "Cette personne ne fait plus partie de l'équipe.", 404);
}

/* ------------------------------------------------------------------ *
 * Ce que l'adaptateur appelle.
 * ------------------------------------------------------------------ */

export const simulationEquipes = {
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
    ecrire(CLE_EQUIPES, { ...etat, [projetId]: [...equipes, nouvelle] });
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

  /**
   * L'équipe affectée à chaque activité du chantier, en forme courte. Relue
   * à chaque fois depuis les équipes : l'effectif affiché suit les membres.
   */
  affectations(projetId: string): Map<string, EquipeChantier> {
    const equipes = new Map((lireEquipes()[projetId] ?? []).map((equipe) => [equipe.id, equipe]));
    const resultat = new Map<string, EquipeChantier>();
    for (const [activiteId, equipeId] of Object.entries(lireAffectations()[projetId] ?? {})) {
      const equipe = equipes.get(equipeId);
      if (equipe) resultat.set(activiteId, resume(equipe));
    }
    return resultat;
  },

  /** L'équipe d'une activité — `null` la retire. Renvoie l'équipe retenue. */
  affecter(projetId: string, activiteId: string, equipeId: string | null): EquipeChantier | null {
    const equipe = equipeId ? resume(resoudreEquipe(projetId, equipeId)) : null;
    const etat = lireAffectations();
    const duChantier = { ...(etat[projetId] ?? {}) };
    if (equipe) duChantier[activiteId] = equipe.id;
    else delete duChantier[activiteId];
    ecrire(CLE_AFFECTATIONS, { ...etat, [projetId]: duChantier });
    return equipe;
  },
};
