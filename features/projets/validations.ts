/**
 * Les schémas zod de la création d'un projet — plan de refonte, lot 4,
 * couche 3.
 *
 * Même séparation qu'`auth/validations.ts` : ni React, ni réseau. Les schémas
 * disent ce qu'est une saisie acceptable ; `versCreationProjet` la traduit en
 * objet du domaine. Le tiroir ne fait que relier les deux.
 *
 * La création se fait en **trois étapes**, et chacune a son schéma : le
 * tiroir s'en sert pour n'activer « Suivant » que lorsque l'étape en cours
 * est complète. `schemaCreationProjet` les réunit pour la soumission finale.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import { centimesEnFrancs, saisieEnCentimes } from "@/lib/format";
import { chaineNonVide } from "@/lib/validations/champs";

import {
  MODES_EXECUTION_LOT,
  NATURES_EQUIPE,
  ROLE_MEMBRE_PAR_DEFAUT,
  ROLES_MEMBRE_EQUIPE,
  TYPES_BORDEREAU,
  TYPES_PROJET,
  UNITES_ACTIVITE,
  budgetRecevable,
  datesChantierCoherentes,
  numeroLot,
} from "./regles";
import type {
  Activite,
  CreationEquipe,
  CreationLotProjet,
  CreationProjet,
  ModeExecutionLot,
  ModificationProjet,
  NatureEquipe,
  Projet,
  RoleMembreEquipe,
  SaisieActiviteDomaine,
  SaisieMembreEquipe,
  TypeBordereau,
  TypeProjet,
  UniteActivite,
} from "./types";

/** Au-delà, un nom de projet ne tient plus sur une ligne de tableau. */
export const LONGUEUR_MAX_NOM = 150;

/** Une description « sommaire » : le détail va dans les documents du projet. */
export const LONGUEUR_MAX_DESCRIPTION = 1000;

/** Des chiffres, éventuellement groupés par des espaces (« 850 000 000 »). */
const MOTIF_MONTANT = /^[\d\s]+$/;


/** Une valeur prise dans une liste fermée — vide tant que rien n'est choisi. */
function choixParmi(valeurs: readonly string[], message: string) {
  return z.string().refine((valeur) => valeurs.includes(valeur), { message });
}

/* ------------------------------------------------------------------ *
 * Étape 1 — Informations générales.
 * ------------------------------------------------------------------ */

const champsInformations = {
  nom: chaineNonVide(texte("projets.tiroirCreation.erreurNomRequis")).max(LONGUEUR_MAX_NOM, {
    message: texte("projets.tiroirCreation.erreurNomTropLong"),
  }),
  reference: z.string().trim(),
  typeProjet: choixParmi(TYPES_PROJET, texte("projets.tiroirCreation.erreurTypeRequis")),
  ville: chaineNonVide(texte("projets.tiroirCreation.erreurVilleRequise")),
  maitreOuvrage: chaineNonVide(texte("projets.tiroirCreation.erreurMaitreOuvrageRequis")),
  maitreOeuvre: z.string().trim(),
  dateDebut: chaineNonVide(texte("projets.tiroirCreation.erreurDateDebutRequise")),
  dateFin: chaineNonVide(texte("projets.tiroirCreation.erreurDateFinRequise")),
  budget: chaineNonVide(texte("projets.tiroirCreation.erreurBudgetRequis")).refine(
    (valeur) => MOTIF_MONTANT.test(valeur) && budgetRecevable(saisieEnCentimes(valeur)),
    { message: texte("projets.tiroirCreation.erreurBudgetInvalide") },
  ),
  description: z.string().trim().max(LONGUEUR_MAX_DESCRIPTION, {
    message: texte("projets.tiroirCreation.erreurDescriptionTropLongue"),
  }),
};

export const schemaEtapeInformations = z
  .object(champsInformations)
  .superRefine((saisie, ctx) => {
    if (!datesChantierCoherentes(saisie.dateDebut, saisie.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }
  });

/* ------------------------------------------------------------------ *
 * Étape 2 — Lots & bordereau.
 * ------------------------------------------------------------------ */

/**
 * Un lot : la même saisie à la création du projet (étape 2) et à l'ajout
 * d'un lot sur un chantier ouvert — deux schémas finiraient par ne plus
 * exiger les mêmes champs.
 */
export const schemaLot = z
  .object({
    nom: chaineNonVide(texte("projets.tiroirCreation.erreurLotNomRequis")),
    modeExecution: choixParmi(MODES_EXECUTION_LOT, texte("projets.tiroirCreation.erreurLotModeRequis")),
    typeBordereau: choixParmi(TYPES_BORDEREAU, texte("projets.tiroirCreation.erreurLotBordereauRequis")),
    dateDebut: z.string(),
    dateFin: z.string(),
  })
  .superRefine((lot, ctx) => {
    if (!datesChantierCoherentes(lot.dateDebut, lot.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }
  });

const champsLots = {
  lots: z.array(schemaLot).min(1, { message: texte("projets.tiroirCreation.erreurLotsRequis") }),
};

export const schemaEtapeLots = z.object(champsLots);

/* ------------------------------------------------------------------ *
 * Étape 3 — Équipe projet.
 * ------------------------------------------------------------------ */

const champsEquipe = {
  chefProjetId: chaineNonVide(texte("projets.tiroirCreation.erreurChefProjetRequis")),
  conducteurTravauxId: chaineNonVide(texte("projets.tiroirCreation.erreurConducteurRequis")),
  chefsChantierIds: z.array(z.string()).min(1, { message: texte("projets.tiroirCreation.erreurChefsChantierRequis") }),
  directeurFinancierId: z.string(),
  visiteursIds: z.array(z.string()),
  bailleursIds: z.array(z.string()),
};

export const schemaEtapeEquipe = z.object(champsEquipe);

/* ------------------------------------------------------------------ *
 * Le tout.
 * ------------------------------------------------------------------ */

export const schemaCreationProjet = z
  .object({ ...champsInformations, ...champsLots, ...champsEquipe })
  .superRefine((saisie, ctx) => {
    if (!datesChantierCoherentes(saisie.dateDebut, saisie.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }
  });

/**
 * La modification d'un projet : les mêmes champs que la création, lots
 * exceptés — ils se gèrent dans « Lots & activités ». Le tableau `lots` reste
 * dans la forme, vide et sans minimum, pour que le même formulaire serve aux
 * deux usages sans changer de type.
 */
export const schemaModificationProjet = z
  .object({ ...champsInformations, lots: z.array(schemaLot), ...champsEquipe })
  .superRefine((saisie, ctx) => {
    if (!datesChantierCoherentes(saisie.dateDebut, saisie.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }
  });

export type SaisieCreationProjet = z.input<typeof schemaCreationProjet>;
export type ValeursCreationProjet = z.output<typeof schemaCreationProjet>;
export type SaisieLot = SaisieCreationProjet["lots"][number];

/** Les champs de chaque étape — de quoi ne revérifier que ceux-là. */
export const CHAMPS_ETAPES = [
  Object.keys(champsInformations),
  Object.keys(champsLots),
  Object.keys(champsEquipe),
] as (keyof SaisieCreationProjet)[][];

/** Un lot vierge. */
export function lotVide(): SaisieLot {
  return { nom: "", modeExecution: "", typeBordereau: "", dateDebut: "", dateFin: "" };
}

/** Le formulaire vierge. `reference` est la proposition du serveur, modifiable. */
export function saisieCreationVide(reference = ""): SaisieCreationProjet {
  return {
    nom: "",
    reference,
    typeProjet: "",
    ville: "",
    maitreOuvrage: "",
    maitreOeuvre: "",
    dateDebut: "",
    dateFin: "",
    budget: "",
    description: "",
    lots: [lotVide()],
    chefProjetId: "",
    conducteurTravauxId: "",
    chefsChantierIds: [],
    directeurFinancierId: "",
    visiteursIds: [],
    bailleursIds: [],
  };
}

/** La saisie validée, traduite en objet du domaine. */
export function versCreationProjet(valeurs: ValeursCreationProjet): CreationProjet {
  return {
    nom: valeurs.nom,
    reference: valeurs.reference || undefined,
    // `choixParmi` a déjà vérifié l'appartenance à la liste.
    typeProjet: valeurs.typeProjet as TypeProjet,
    ville: valeurs.ville,
    maitreOuvrage: valeurs.maitreOuvrage,
    maitreOeuvre: valeurs.maitreOeuvre || undefined,
    dateDebutPrevue: valeurs.dateDebut,
    dateFinPrevue: valeurs.dateFin,
    // Même conversion que partout ailleurs dans le produit (`lib/format`) ;
    // le schéma garantit un montant recevable, donc non nul.
    budgetInitial: saisieEnCentimes(valeurs.budget) ?? 0,
    description: valeurs.description || undefined,
    lots: valeurs.lots.map((lot, rang) => ({
      numero: numeroLot(rang),
      nom: lot.nom,
      modeExecution: lot.modeExecution as ModeExecutionLot,
      typeBordereau: lot.typeBordereau as TypeBordereau,
      dateDebut: lot.dateDebut || undefined,
      dateFin: lot.dateFin || undefined,
    })),
    equipe: {
      chefProjetId: valeurs.chefProjetId,
      conducteurTravauxId: valeurs.conducteurTravauxId,
      chefsChantierIds: valeurs.chefsChantierIds,
      directeurFinancierId: valeurs.directeurFinancierId || undefined,
      visiteursIds: valeurs.visiteursIds,
      bailleursIds: valeurs.bailleursIds,
    },
  };
}

/** Un projet existant, remis en saisie pour sa modification. */
export function saisieDepuisProjet(projet: Projet): SaisieCreationProjet {
  return {
    nom: projet.nom,
    reference: projet.reference,
    typeProjet: projet.typeProjet ?? "",
    ville: projet.ville,
    maitreOuvrage: projet.client.raisonSociale,
    maitreOeuvre: projet.maitreOeuvre ?? "",
    dateDebut: projet.dateDebutPrevue,
    dateFin: projet.dateFinPrevue,
    budget: projet.budgetInitial === null ? "" : String(centimesEnFrancs(projet.budgetInitial)),
    description: projet.description,
    lots: [],
    chefProjetId: projet.chefProjet?.id ?? "",
    conducteurTravauxId: projet.conducteurTravaux?.id ?? "",
    chefsChantierIds: projet.chefsChantier.map((chef) => chef.id),
    directeurFinancierId: projet.directeurFinancier?.id ?? "",
    visiteursIds: [],
    bailleursIds: [],
  };
}

/** La saisie validée d'une modification, traduite en objet du domaine. */
export function versModificationProjet(valeurs: ValeursCreationProjet): ModificationProjet {
  return {
    nom: valeurs.nom,
    typeProjet: valeurs.typeProjet as TypeProjet,
    ville: valeurs.ville,
    maitreOuvrage: valeurs.maitreOuvrage,
    maitreOeuvre: valeurs.maitreOeuvre || undefined,
    dateDebutPrevue: valeurs.dateDebut,
    dateFinPrevue: valeurs.dateFin,
    budgetInitial: saisieEnCentimes(valeurs.budget) ?? 0,
    description: valeurs.description || undefined,
    equipe: {
      chefProjetId: valeurs.chefProjetId,
      conducteurTravauxId: valeurs.conducteurTravauxId,
      chefsChantierIds: valeurs.chefsChantierIds,
      directeurFinancierId: valeurs.directeurFinancierId || undefined,
    },
  };
}

/* ------------------------------------------------------------------ *
 * L'ajout d'un lot sur un chantier ouvert.
 * ------------------------------------------------------------------ */

export type SaisieLotProjet = z.input<typeof schemaLot>;

export function versCreationLotProjet(saisie: z.output<typeof schemaLot>): CreationLotProjet {
  return {
    nom: saisie.nom,
    modeExecution: saisie.modeExecution as ModeExecutionLot,
    typeBordereau: saisie.typeBordereau as TypeBordereau,
    dateDebut: saisie.dateDebut || undefined,
    dateFin: saisie.dateFin || undefined,
  };
}

/* ------------------------------------------------------------------ *
 * Une activité.
 * ------------------------------------------------------------------ */

/** Au-delà, un libellé d'activité ne tient plus sur une ligne du tableau. */
export const LONGUEUR_MAX_LIBELLE_ACTIVITE = 150;

/** Un nombre positif, décimales à la virgule ou au point, milliers groupés par des espaces. */
const MOTIF_QUANTITE = /^\d[\d\s]*([.,]\d+)?$/;

/** « 14 500 » → 14500 · « 12,5 » → 12.5 · vide → `null`. */
export function saisieEnQuantite(saisie: string): number | null {
  const nettoyee = saisie.replace(/\s/g, "").replace(",", ".");
  if (nettoyee === "") return null;
  const nombre = Number(nettoyee);
  return Number.isFinite(nombre) ? nombre : null;
}

export const schemaActivite = z
  .object({
    lotId: chaineNonVide(texte("projets.lotsActivites.formActivite.erreurLotRequis")),
    libelle: chaineNonVide(texte("projets.lotsActivites.formActivite.erreurLibelleRequis")).max(
      LONGUEUR_MAX_LIBELLE_ACTIVITE,
      { message: texte("projets.lotsActivites.formActivite.erreurLibelleTropLong") },
    ),
    quantite: z
      .string()
      .trim()
      .refine((valeur) => valeur === "" || MOTIF_QUANTITE.test(valeur), {
        message: texte("projets.lotsActivites.formActivite.erreurQuantiteInvalide"),
      }),
    unite: z.string(),
    dateDebut: chaineNonVide(texte("projets.lotsActivites.formActivite.erreurDateDebutRequise")),
    dateFin: chaineNonVide(texte("projets.lotsActivites.formActivite.erreurDateFinRequise")),
    budget: z
      .string()
      .trim()
      .refine((valeur) => valeur === "" || (MOTIF_MONTANT.test(valeur) && budgetRecevable(saisieEnCentimes(valeur))), {
        message: texte("projets.lotsActivites.formActivite.erreurBudgetInvalide"),
      }),
    dependanceId: z.string(),
    equipeId: z.string(),
  })
  .superRefine((saisie, ctx) => {
    if (!datesChantierCoherentes(saisie.dateDebut, saisie.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }
    // Une quantité sans unité ne se cumule avec rien : « 100 » de quoi ?
    if (saisie.quantite !== "" && !UNITES_ACTIVITE.includes(saisie.unite as UniteActivite)) {
      ctx.addIssue({ code: "custom", path: ["unite"], message: texte("projets.lotsActivites.formActivite.erreurUniteRequise") });
    }
  });

export type SaisieActivite = z.input<typeof schemaActivite>;
export type ValeursActivite = z.output<typeof schemaActivite>;

/**
 * Le formulaire vierge. Le lot est prérempli quand l'utilisateur ajoute
 * depuis un lot précis ; l'unité par défaut est le mètre carré, la plus
 * fréquente sur un chantier de bâtiment.
 */
export function saisieActiviteVide(lotId = ""): SaisieActivite {
  return {
    lotId,
    libelle: "",
    quantite: "",
    unite: "M2",
    dateDebut: "",
    dateFin: "",
    budget: "",
    dependanceId: "",
    equipeId: "",
  };
}

/** Une activité existante, remise en saisie pour sa modification. */
export function saisieDepuisActivite(activite: Activite): SaisieActivite {
  return {
    lotId: activite.lotId,
    libelle: activite.libelle,
    quantite: activite.quantitePrevue === null ? "" : String(activite.quantitePrevue),
    unite: activite.unite ?? "M2",
    dateDebut: activite.dateDebutPrevue,
    dateFin: activite.dateFinPrevue,
    budget: activite.budget === null ? "" : String(Math.round(activite.budget / 100)),
    dependanceId: activite.dependanceId ?? "",
    equipeId: activite.equipe?.id ?? "",
  };
}

/** La saisie validée, traduite en objet du domaine. */
export function versSaisieActiviteDomaine(valeurs: ValeursActivite): SaisieActiviteDomaine {
  const quantitePrevue = saisieEnQuantite(valeurs.quantite);
  return {
    lotId: valeurs.lotId,
    libelle: valeurs.libelle,
    quantitePrevue,
    // Sans quantité, l'unité ne dit rien : elle n'est pas transmise.
    unite: quantitePrevue === null ? null : (valeurs.unite as UniteActivite),
    dateDebutPrevue: valeurs.dateDebut,
    dateFinPrevue: valeurs.dateFin,
    budget: valeurs.budget === "" ? null : saisieEnCentimes(valeurs.budget),
    dependanceId: valeurs.dependanceId || null,
    equipeId: valeurs.equipeId || null,
  };
}

/* ------------------------------------------------------------------ *
 * Une équipe, et son affectation à une activité.
 * ------------------------------------------------------------------ */

/** Au-delà, un nom d'équipe ne tient plus sur l'en-tête de sa carte. */
export const LONGUEUR_MAX_NOM_EQUIPE = 80;

/**
 * Une personne de l'équipe, telle que le formulaire la tient : soit un
 * collaborateur de l'entreprise (`collaborateurId`), soit une personne
 * saisie sur place (`nouveau`), dont on exige alors les deux moitiés du nom
 * — pour ses initiales. Un collaborateur apporte son nom avec lui.
 */
const schemaMembre = z
  .object({
    collaborateurId: z.string(),
    nouveau: z.boolean(),
    prenom: z.string().trim(),
    nom: z.string().trim(),
    role: choixParmi(ROLES_MEMBRE_EQUIPE, texte("projets.equipesAffectations.formEquipe.erreurRoleRequis")),
  })
  .superRefine((membre, contexte) => {
    if (!membre.collaborateurId && !membre.nouveau) {
      contexte.addIssue({
        code: "custom",
        path: ["collaborateurId"],
        message: texte("projets.equipesAffectations.formEquipe.erreurPersonneRequise"),
      });
      return;
    }
    if (membre.collaborateurId) return;
    if (!membre.prenom) {
      contexte.addIssue({
        code: "custom",
        path: ["prenom"],
        message: texte("projets.equipesAffectations.formEquipe.erreurPrenomRequis"),
      });
    }
    if (!membre.nom) {
      contexte.addIssue({
        code: "custom",
        path: ["nom"],
        message: texte("projets.equipesAffectations.formEquipe.erreurNomMembreRequis"),
      });
    }
  });

export type SaisieMembre = z.input<typeof schemaMembre>;
export type ValeursMembre = z.output<typeof schemaMembre>;

export const schemaEquipe = z
  .object({
    nom: chaineNonVide(texte("projets.equipesAffectations.formEquipe.erreurNomRequis")).max(
      LONGUEUR_MAX_NOM_EQUIPE,
      { message: texte("projets.equipesAffectations.formEquipe.erreurNomTropLong") },
    ),
    nature: choixParmi(NATURES_EQUIPE, texte("projets.equipesAffectations.formEquipe.erreurNatureRequise")),
    specialite: chaineNonVide(texte("projets.equipesAffectations.formEquipe.erreurSpecialiteRequise")),
    chef: schemaMembre,
    membres: z.array(schemaMembre),
  })
  .superRefine((equipe, contexte) => {
    // Une personne ne compte qu'une fois : le même collaborateur choisi sur
    // deux lignes gonflerait l'effectif d'une personne qui n'existe pas.
    const vus = new Set<string>();
    [equipe.chef, ...equipe.membres].forEach((membre, rang) => {
      if (!membre.collaborateurId) return;
      if (vus.has(membre.collaborateurId)) {
        contexte.addIssue({
          code: "custom",
          path: rang === 0 ? ["chef", "collaborateurId"] : ["membres", rang - 1, "collaborateurId"],
          message: texte("projets.equipesAffectations.formEquipe.erreurPersonneEnDouble"),
        });
      }
      vus.add(membre.collaborateurId);
    });
  });

export type SaisieEquipe = z.input<typeof schemaEquipe>;
export type ValeursEquipe = z.output<typeof schemaEquipe>;

/** Une personne vierge, le temps qu'on la choisisse ou qu'on la saisisse. */
export function membreVide(role: RoleMembreEquipe = ROLE_MEMBRE_PAR_DEFAUT): SaisieMembre {
  return { collaborateurId: "", nouveau: false, prenom: "", nom: "", role };
}

/** Le formulaire vierge : une équipe interne, un membre à saisir sous le chef. */
export function saisieEquipeVide(): SaisieEquipe {
  return {
    nom: "",
    nature: "INTERNE",
    specialite: "",
    chef: membreVide("CHEF_EQUIPE"),
    membres: [membreVide()],
  };
}

/** Du formulaire au domaine : le drapeau `nouveau` ne sert qu'à l'écran. */
export function versSaisieMembreEquipe(valeurs: ValeursMembre): SaisieMembreEquipe {
  return {
    prenom: valeurs.prenom,
    nom: valeurs.nom,
    role: valeurs.role as RoleMembreEquipe,
    collaborateurId: valeurs.collaborateurId || null,
  };
}

export function versCreationEquipe(valeurs: ValeursEquipe): CreationEquipe {
  return {
    nom: valeurs.nom,
    nature: valeurs.nature as NatureEquipe,
    specialite: valeurs.specialite,
    // Le chef l'est par sa place dans le formulaire, quoi que dise sa ligne.
    chef: { ...versSaisieMembreEquipe(valeurs.chef), role: "CHEF_EQUIPE" },
    membres: valeurs.membres.map(versSaisieMembreEquipe),
  };
}

/** L'ajout d'une personne à une équipe déjà constituée, depuis sa fiche. */
export const schemaAjoutMembre = z.object({ membre: schemaMembre });

export type SaisieAjoutMembre = z.input<typeof schemaAjoutMembre>;
export type ValeursAjoutMembre = z.output<typeof schemaAjoutMembre>;

/**
 * L'affectation d'une équipe à une activité. L'équipe est exigée : retirer
 * une affectation est un geste à part, qui a son propre bouton.
 */
export const schemaAffectation = z.object({
  activiteId: chaineNonVide(texte("projets.equipesAffectations.formAffectation.erreurActiviteRequise")),
  equipeId: chaineNonVide(texte("projets.equipesAffectations.formAffectation.erreurEquipeRequise")),
});

export type SaisieAffectation = z.input<typeof schemaAffectation>;
