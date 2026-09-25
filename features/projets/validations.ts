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
import { saisieEnCentimes } from "@/lib/format";
import { chaineNonVide } from "@/lib/validations/champs";

import {
  MODES_EXECUTION_LOT,
  TYPES_BORDEREAU,
  TYPES_PROJET,
  budgetRecevable,
  datesChantierCoherentes,
  numeroLot,
} from "./regles";
import type { CreationProjet, ModeExecutionLot, TypeBordereau, TypeProjet } from "./types";

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

const schemaLot = z
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
