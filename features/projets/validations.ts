/**
 * Les schémas zod de la création d'un projet — plan de refonte, lot 4,
 * couche 3.
 *
 * Même séparation qu'`auth/validations.ts` : ni React, ni réseau. Les schémas
 * disent ce qu'est une saisie acceptable ; `versCreationProjet` la traduit en
 * objet du domaine. Le tiroir ne fait que relier les deux.
 *
 * La création et la modification d'un projet tiennent en **une seule étape**
 * et partagent `schemaProjet`. À la création, le planning contractuel et le
 * budget prévisionnel peuvent déjà être renseignés, **sans être exigés** : le
 * chef de projet les fixe sinon depuis le projet ouvert. Les lots et l'équipe
 * se fixent toujours ensuite.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import { formaterDate, formaterMontant, formaterSaisieMontant, saisieEnCentimes } from "@/lib/format";
import { chaineNonVide } from "@/lib/validations/champs";

import {
  NATURES_PROJET,
  TYPES_BORDEREAU,
  NOMBRE_MAX_CONTRATS,
  STATUT_DECLARE_PAR_DEFAUT,
  STATUTS_DECLARES,
  UNITES_ACTIVITE,
  activiteCreable,
  budgetDisponible,
  budgetRecevable,
  datesChantierCoherentes,
  periodeCoherente,
  plancherBudget,
  refusContrat,
} from "./regles";
import type {
  Activite,
  CreationLotProjet,
  CreationProjet,
  Lot,
  MiseAJourAvancement,
  ModificationProjet,
  NatureProjet,
  PlanningProjet,
  Projet,
  Reprogrammation,
  SaisieActiviteDomaine,
  StatutDeclare,
  TypeBordereau,
  UniteActivite,
} from "./types";

/** Au-delà, un nom de projet ne tient plus sur une ligne de tableau. */
export const LONGUEUR_MAX_NOM = 150;

/** Une description « sommaire » : le détail va dans les documents du projet. */
export const LONGUEUR_MAX_DESCRIPTION = 1000;

/** Des chiffres, éventuellement groupés par des espaces (« 850 000 000 »). */
const MOTIF_MONTANT = /^[\d\s]+$/;

/** Un entier positif ou nul (durée contractuelle en années, mois ou jours). */
const MOTIF_ENTIER_POSITIF = /^\d+$/;

function entierOptionnel(valeur: string): number | undefined {
  const propre = valeur.trim();
  if (propre === "") return undefined;
  return Number.parseInt(propre, 10);
}

/** Une valeur prise dans une liste fermée — vide tant que rien n'est choisi. */
function choixParmi(valeurs: readonly string[], message: string) {
  return z.string().refine((valeur) => valeurs.includes(valeur), { message });
}

/* ------------------------------------------------------------------ *
 * Le projet — informations générales et cadre contractuel.
 * ------------------------------------------------------------------ */

export interface ContexteValidationProjet {
  modification?: boolean;
  aContratExistant?: boolean;
  aOsExistant?: boolean;
  budgetContractuelVerrouille?: boolean;
  dureeContractuelleVerrouillee?: boolean;
  dateDebutContractuelleInitiale?: string | null;
}

const schemaProjetBase = z.object({
  nom: chaineNonVide(texte("projets.tiroirCreation.erreurNomRequis")).max(LONGUEUR_MAX_NOM, {
    message: texte("projets.tiroirCreation.erreurNomTropLong"),
  }),
  reference: z.string().trim(),
  natureProjet: choixParmi(NATURES_PROJET, texte("projets.tiroirCreation.erreurNatureRequise")),
  // Un type d'ouvrage prédéfini (son code) ou un libellé saisi librement.
  typeProjet: chaineNonVide(texte("projets.tiroirCreation.erreurTypeRequis")),
  ville: chaineNonVide(texte("projets.tiroirCreation.erreurVilleRequise")),
  maitreOuvrage: chaineNonVide(texte("projets.tiroirCreation.erreurMaitreOuvrageRequis")),
  maitreOeuvre: z.string().trim(),
  // Facultatifs : vides, ils restent à fixer par le chef de projet.
  dateDebut: z.string(),
  dateFin: z.string(),
  budget: z
    .string()
    .trim()
    .refine(
      (valeur) => valeur === "" || (MOTIF_MONTANT.test(valeur) && budgetRecevable(saisieEnCentimes(valeur))),
      { message: texte("projets.tiroirCreation.erreurBudgetInvalide") },
    ),
  // Cadre contractuel (exige un fichier contrat / OS selon la règle d'or).
  budgetContractuel: z
    .string()
    .trim()
    .refine(
      (valeur) => valeur === "" || (MOTIF_MONTANT.test(valeur) && budgetRecevable(saisieEnCentimes(valeur))),
      { message: texte("projets.tiroirCreation.erreurBudgetInvalide") },
    ),
  dureeAnnees: z
    .string()
    .trim()
    .refine((valeur) => valeur === "" || MOTIF_ENTIER_POSITIF.test(valeur), {
      message: texte("projets.tiroirCreation.erreurDureeContractuelleInvalide"),
    }),
  dureeMois: z
    .string()
    .trim()
    .refine((valeur) => valeur === "" || MOTIF_ENTIER_POSITIF.test(valeur), {
      message: texte("projets.tiroirCreation.erreurDureeContractuelleInvalide"),
    }),
  dureeJours: z
    .string()
    .trim()
    .refine((valeur) => valeur === "" || MOTIF_ENTIER_POSITIF.test(valeur), {
      message: texte("projets.tiroirCreation.erreurDureeContractuelleInvalide"),
    }),
  dateDebutContractuelle: z.string(),
  description: z.string().trim().max(LONGUEUR_MAX_DESCRIPTION, {
    message: texte("projets.tiroirCreation.erreurDescriptionTropLongue"),
  }),
  // Facultatifs : la zone de dépôt refuse déjà un fichier non conforme, le
  // schéma le revérifie pour ne pas dépendre d'elle.
  contrats: z
    .array(z.custom<File>())
    .max(NOMBRE_MAX_CONTRATS, {
      message: texte("projets.tiroirCreation.erreurContratsTropNombreux", { max: NOMBRE_MAX_CONTRATS }),
    })
    .refine((fichiers) => fichiers.every((fichier) => refusContrat(fichier) === null), {
      message: texte("projets.tiroirCreation.erreurContratFormat"),
    }),
  ordreService: z
    .array(z.custom<File>())
    .max(1)
    .refine((fichiers) => fichiers.every((fichier) => refusContrat(fichier) === null), {
      message: texte("projets.tiroirCreation.erreurContratFormat"),
    }),
});

export function schemaProjetPour(contexte: ContexteValidationProjet = {}) {
  const {
    modification = false,
    aContratExistant = false,
    aOsExistant = false,
    budgetContractuelVerrouille = false,
    dureeContractuelleVerrouillee = false,
    dateDebutContractuelleInitiale = null,
  } = contexte;

  return schemaProjetBase.superRefine((saisie, ctx) => {
    if (!datesChantierCoherentes(saisie.dateDebut, saisie.dateFin)) {
      ctx.addIssue({
        code: "custom",
        path: ["dateFin"],
        message: texte("projets.tiroirCreation.erreurDatesIncoherentes"),
      });
    }

    const aContrat = saisie.contrats.length > 0 || aContratExistant;

    // I1 : budget contractuel initial exige un contrat du marché.
    if (!budgetContractuelVerrouille && saisie.budgetContractuel !== "" && !aContrat) {
      ctx.addIssue({
        code: "custom",
        path: ["budgetContractuel"],
        message: texte("projets.tiroirCreation.erreurBudgetContractuelSansContrat"),
      });
    }

    // I1 & I2 : durée contractuelle (3 champs) > 0 et exige un contrat du marché.
    const saisieDuree =
      saisie.dureeAnnees !== "" || saisie.dureeMois !== "" || saisie.dureeJours !== "";
    if (!dureeContractuelleVerrouillee && saisieDuree) {
      const a = entierOptionnel(saisie.dureeAnnees) ?? 0;
      const m = entierOptionnel(saisie.dureeMois) ?? 0;
      const j = entierOptionnel(saisie.dureeJours) ?? 0;
      if (a + m + j === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["dureeJours"],
          message: texte("projets.tiroirCreation.erreurDureeContractuelleNulle"),
        });
      } else if (!aContrat) {
        ctx.addIssue({
          code: "custom",
          path: ["dureeAnnees"],
          message: texte("projets.tiroirCreation.erreurDureeContractuelleSansContrat"),
        });
      }
    }

    // I3 & I4 : date de début contractuelle ↔ ordre de service de démarrage.
    const nouvelOs = saisie.ordreService.length > 0;
    if (!modification) {
      if (saisie.dateDebutContractuelle !== "" && !nouvelOs) {
        ctx.addIssue({
          code: "custom",
          path: ["dateDebutContractuelle"],
          message: texte("projets.tiroirCreation.erreurDateDebutContractuelleSansOs"),
        });
      }
    } else {
      const initiale = dateDebutContractuelleInitiale ?? "";
      if (saisie.dateDebutContractuelle !== initiale) {
        if (saisie.dateDebutContractuelle === "" && initiale !== "") {
          ctx.addIssue({
            code: "custom",
            path: ["dateDebutContractuelle"],
            message: texte("projets.tiroirCreation.erreurDateDebutContractuelleEffacement"),
          });
        } else if (initiale === "") {
          if (!nouvelOs && !aOsExistant) {
            ctx.addIssue({
              code: "custom",
              path: ["dateDebutContractuelle"],
              message: texte("projets.tiroirCreation.erreurDateDebutContractuelleSansOs"),
            });
          }
        } else if (!nouvelOs) {
          ctx.addIssue({
            code: "custom",
            path: ["dateDebutContractuelle"],
            message: texte("projets.tiroirCreation.erreurDateDebutContractuelleNouvelOsRequis"),
          });
        }
      }
    }
  });
}

export const schemaProjet = schemaProjetPour();

export type SaisieProjet = z.input<typeof schemaProjetBase>;
export type ValeursProjet = z.output<typeof schemaProjetBase>;

/** Le formulaire vierge. `reference` est la proposition du serveur, modifiable. */
export function saisieProjetVide(reference = ""): SaisieProjet {
  return {
    nom: "",
    reference,
    natureProjet: "PRIVE",
    typeProjet: "",
    ville: "",
    maitreOuvrage: "",
    maitreOeuvre: "",
    dateDebut: "",
    dateFin: "",
    budget: "",
    budgetContractuel: "",
    dureeAnnees: "",
    dureeMois: "",
    dureeJours: "",
    dateDebutContractuelle: "",
    description: "",
    contrats: [],
    ordreService: [],
  };
}

/** La saisie validée, traduite en objet du domaine. */
export function versCreationProjet(valeurs: ValeursProjet): CreationProjet {
  const aDuree =
    valeurs.dureeAnnees !== "" || valeurs.dureeMois !== "" || valeurs.dureeJours !== "";
  return {
    nom: valeurs.nom,
    reference: valeurs.reference || undefined,
    natureProjet: valeurs.natureProjet as NatureProjet,
    typeProjet: valeurs.typeProjet,
    ville: valeurs.ville,
    maitreOuvrage: valeurs.maitreOuvrage,
    maitreOeuvre: valeurs.maitreOeuvre || undefined,
    dateDebutPrevue: valeurs.dateDebut || undefined,
    dateFinPrevue: valeurs.dateFin || undefined,
    // Même conversion que partout ailleurs dans le produit (`lib/format`).
    budgetInitial: valeurs.budget ? (saisieEnCentimes(valeurs.budget) ?? undefined) : undefined,
    budgetContractuelInitial: valeurs.budgetContractuel
      ? (saisieEnCentimes(valeurs.budgetContractuel) ?? undefined)
      : undefined,
    dureeContractuelleAnnees: aDuree ? (entierOptionnel(valeurs.dureeAnnees) ?? 0) : undefined,
    dureeContractuelleMois: aDuree ? (entierOptionnel(valeurs.dureeMois) ?? 0) : undefined,
    dureeContractuelleJours: aDuree ? (entierOptionnel(valeurs.dureeJours) ?? 0) : undefined,
    dateDebutContractuelle: valeurs.dateDebutContractuelle || undefined,
    description: valeurs.description || undefined,
    contrats: valeurs.contrats.length > 0 ? valeurs.contrats : undefined,
    ordreService: valeurs.ordreService[0] ?? undefined,
  };
}

/** Un projet existant, remis en saisie pour sa modification. */
export function saisieDepuisProjet(projet: Projet): SaisieProjet {
  return {
    nom: projet.nom,
    reference: projet.reference,
    natureProjet: projet.natureProjet ?? "PRIVE",
    typeProjet: projet.typeProjet ?? "",
    ville: projet.ville,
    maitreOuvrage: projet.client.raisonSociale,
    maitreOeuvre: projet.maitreOeuvre ?? "",
    dateDebut: projet.dateDebutPrevue ?? "",
    dateFin: projet.dateFinPrevue ?? "",
    // Le budget prévisionnel se fixe depuis la fiche projet.
    budget: "",
    budgetContractuel:
      projet.budgetContractuelInitial !== null
        ? formaterSaisieMontant(String(Math.round(projet.budgetContractuelInitial / 100)))
        : "",
    dureeAnnees:
      projet.dureeContractuelleAnnees !== null ? String(projet.dureeContractuelleAnnees) : "",
    dureeMois: projet.dureeContractuelleMois !== null ? String(projet.dureeContractuelleMois) : "",
    dureeJours:
      projet.dureeContractuelleJours !== null ? String(projet.dureeContractuelleJours) : "",
    dateDebutContractuelle: projet.dateDebutContractuelle ?? "",
    description: "",
    contrats: [],
    ordreService: [],
  };
}

/** La saisie validée d'une modification, traduite en objet du domaine. */
export function versModificationProjet(
  valeurs: ValeursProjet,
  peutRenommer = true,
  options: {
    budgetContractuelVerrouille?: boolean;
    dureeContractuelleVerrouillee?: boolean;
    dateDebutContractuelleInitiale?: string | null;
    voitMontants?: boolean;
  } = {},
): ModificationProjet {
  const {
    budgetContractuelVerrouille = false,
    dureeContractuelleVerrouillee = false,
    dateDebutContractuelleInitiale = null,
    voitMontants = true,
  } = options;
  const aDuree =
    valeurs.dureeAnnees !== "" || valeurs.dureeMois !== "" || valeurs.dureeJours !== "";
  const dateDebutChangee =
    valeurs.dateDebutContractuelle !== "" &&
    valeurs.dateDebutContractuelle !== (dateDebutContractuelleInitiale ?? "");

  return {
    ...(peutRenommer ? { nom: valeurs.nom } : {}),
    natureProjet: valeurs.natureProjet as NatureProjet,
    typeProjet: valeurs.typeProjet,
    ville: valeurs.ville,
    maitreOuvrage: valeurs.maitreOuvrage,
    maitreOeuvre: valeurs.maitreOeuvre || undefined,
    // Vides, elles ne sont pas envoyées : le planning enregistré reste.
    dateDebutPrevue: valeurs.dateDebut || undefined,
    dateFinPrevue: valeurs.dateFin || undefined,
    ...(!budgetContractuelVerrouille && voitMontants && valeurs.budgetContractuel
      ? { budgetContractuelInitial: saisieEnCentimes(valeurs.budgetContractuel) ?? undefined }
      : {}),
    ...(!dureeContractuelleVerrouillee && aDuree
      ? {
          dureeContractuelleAnnees: entierOptionnel(valeurs.dureeAnnees) ?? 0,
          dureeContractuelleMois: entierOptionnel(valeurs.dureeMois) ?? 0,
          dureeContractuelleJours: entierOptionnel(valeurs.dureeJours) ?? 0,
        }
      : {}),
    ...(dateDebutChangee ? { dateDebutContractuelle: valeurs.dateDebutContractuelle } : {}),
    contrats: valeurs.contrats.length > 0 ? valeurs.contrats : undefined,
    ordreService: valeurs.ordreService[0] ?? undefined,
  };
}

/* ------------------------------------------------------------------ *
 * Un lot.
 * ------------------------------------------------------------------ */

/**
 * Un lot, ajouté sur un chantier ouvert depuis « Lots & activités ».
 *
 * Le budget se fixe ici, au lot — c'est l'unité du marché —, et non sur
 * chaque activité. Budget et dates restent facultatifs : un lot se déclare
 * souvent avant d'être chiffré ou planifié.
 */
export const schemaLot = z
  .object({
    nom: chaineNonVide(texte("projets.tiroirCreation.erreurLotNomRequis")),
    // Un code du référentiel des modes : le serveur seul sait lesquels existent.
    modeExecution: chaineNonVide(texte("projets.tiroirCreation.erreurLotModeRequis")),
    typeBordereau: choixParmi(TYPES_BORDEREAU, texte("projets.tiroirCreation.erreurLotBordereauRequis")),
    statut: choixParmi(STATUTS_DECLARES, texte("projets.lotsActivites.erreurStatutRequis")),
    budget: z
      .string()
      .trim()
      .refine((valeur) => valeur === "" || (MOTIF_MONTANT.test(valeur) && budgetRecevable(saisieEnCentimes(valeur))), {
        message: texte("projets.lotsActivites.formLot.erreurBudgetInvalide"),
      }),
    dateDebut: z.string(),
    dateFin: z.string(),
  })
  .superRefine((lot, ctx) => {
    if (!periodeCoherente(lot.dateDebut, lot.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }
  });

/** Le budget saisi, en centimes ; `null` s'il est vide ou illisible. */
function budgetSaisi(saisie: string): number | null {
  const centimes = saisie.trim() === "" ? null : saisieEnCentimes(saisie);
  return budgetRecevable(centimes) ? centimes : null;
}

/**
 * `schemaLot`, borné par ce que l'écran seul connaît : le budget du projet,
 * les autres lots déjà engagés (disponible), et — pour un lot existant — la
 * somme de ses activités (plancher). Borne également les dates du lot dans
 * celles du projet (US 3.6).
 */
export function schemaLotBorne(
  budgetProjet: number | null,
  lot: Lot | null = null,
  autresLots: { budget: number | null }[] = [],
  datesProjet?: { dateDebutPrevue?: string | null; dateFinPrevue?: string | null } | null,
) {
  const plancher = lot ? plancherBudget(lot.activites) : null;
  const disponible = budgetDisponible(budgetProjet, autresLots);
  return schemaLot.superRefine((saisie, ctx) => {
    const budget = budgetSaisi(saisie.budget);
    if (budget !== null) {
      if (disponible !== null && budget > disponible) {
        ctx.addIssue({
          code: "custom",
          path: ["budget"],
          message: texte("projets.lotsActivites.formLot.erreurBudgetDisponible", {
            disponible: formaterMontant(disponible),
            plafond: formaterMontant(budgetProjet),
          }),
        });
      } else if (plancher !== null && budget < plancher) {
        ctx.addIssue({
          code: "custom",
          path: ["budget"],
          message: texte("projets.lotsActivites.formLot.erreurBudgetPlancher", {
            somme: formaterMontant(plancher),
          }),
        });
      }
    }
    if (datesProjet?.dateDebutPrevue && saisie.dateDebut && saisie.dateDebut < datesProjet.dateDebutPrevue) {
      ctx.addIssue({
        code: "custom",
        path: ["dateDebut"],
        message: texte("projets.lotsActivites.formLot.erreurDebutAvantProjet", {
          date: formaterDate(datesProjet.dateDebutPrevue),
        }),
      });
    }
    if (datesProjet?.dateFinPrevue && saisie.dateFin && saisie.dateFin > datesProjet.dateFinPrevue) {
      ctx.addIssue({
        code: "custom",
        path: ["dateFin"],
        message: texte("projets.lotsActivites.formLot.erreurFinApresProjet", {
          date: formaterDate(datesProjet.dateFinPrevue),
        }),
      });
    }
  });
}

/* ------------------------------------------------------------------ *
 * L'ajout d'un lot sur un chantier ouvert.
 * ------------------------------------------------------------------ */

export type SaisieLotProjet = z.input<typeof schemaLot>;

/** Un lot vierge. */
export function lotVide(): SaisieLotProjet {
  return {
    nom: "",
    modeExecution: "",
    typeBordereau: "",
    statut: STATUT_DECLARE_PAR_DEFAUT,
    budget: "",
    dateDebut: "",
    dateFin: "",
  };
}

/** Un lot existant, remis en saisie pour sa modification. Le budget repasse en francs groupés. */
export function lotEnSaisie(lot: Lot): SaisieLotProjet {
  return {
    nom: lot.nom,
    modeExecution: lot.modeExecution,
    typeBordereau: lot.typeBordereau,
    statut: lot.statut,
    budget: lot.budget === null ? "" : formaterSaisieMontant(String(Math.round(lot.budget / 100))),
    dateDebut: lot.dateDebut ?? "",
    dateFin: lot.dateFin ?? "",
  };
}

export function versCreationLotProjet(saisie: z.output<typeof schemaLot>): CreationLotProjet {
  return {
    nom: saisie.nom,
    modeExecution: saisie.modeExecution,
    typeBordereau: saisie.typeBordereau as TypeBordereau,
    statut: saisie.statut as StatutDeclare,
    budget: saisie.budget ? (saisieEnCentimes(saisie.budget) ?? undefined) : undefined,
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
    // Facultatif : le budget se tient d'abord au lot.
    budget: z
      .string()
      .trim()
      .refine((valeur) => valeur === "" || (MOTIF_MONTANT.test(valeur) && budgetRecevable(saisieEnCentimes(valeur))), {
        message: texte("projets.lotsActivites.formActivite.erreurBudgetInvalide"),
      }),
    // Facultatives : une activité se déclare souvent avant d'être planifiée.
    dateDebut: z.string(),
    dateFin: z.string(),
    responsableId: z.string(),
    equipeId: z.string(),
    statut: choixParmi(STATUTS_DECLARES, texte("projets.lotsActivites.erreurStatutRequis")),
  })
  .superRefine((saisie, ctx) => {
    if (!periodeCoherente(saisie.dateDebut, saisie.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }
    // Une quantité sans unité ne se cumule avec rien : « 100 » de quoi ?
    if (saisie.quantite !== "" && !UNITES_ACTIVITE.includes(saisie.unite as UniteActivite)) {
      ctx.addIssue({ code: "custom", path: ["unite"], message: texte("projets.lotsActivites.formActivite.erreurUniteRequise") });
    }
  });

/**
 * `schemaActivite`, borné par le budget du lot et les autres activités :
 * ce qui reste disponible sur le lot. Borne également les dates de l'activité
 * dans celles du lot (US 3.7).
 */
export function schemaActiviteBorne(
  budgetLot: number | null,
  autresActivites: { budget: number | null }[] = [],
  datesLot?: { dateDebut?: string | null; dateFin?: string | null } | null,
) {
  const disponible = budgetDisponible(budgetLot, autresActivites);
  return schemaActivite.superRefine((saisie, ctx) => {
    const budget = budgetSaisi(saisie.budget);
    if (budget !== null && disponible !== null && budget > disponible) {
      ctx.addIssue({
        code: "custom",
        path: ["budget"],
        message: texte("projets.lotsActivites.formActivite.erreurBudgetDisponible", {
          disponible: formaterMontant(disponible),
          plafond: formaterMontant(budgetLot),
        }),
      });
    }
    if (
      datesLot &&
      !activiteCreable({
        dateDebut: datesLot.dateDebut ?? null,
        dateFin: datesLot.dateFin ?? null,
      })
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["lotId"],
        message: texte("projets.lotsActivites.datesLotRequises"),
      });
    }
    if (datesLot?.dateDebut && saisie.dateDebut && saisie.dateDebut < datesLot.dateDebut) {
      ctx.addIssue({
        code: "custom",
        path: ["dateDebut"],
        message: texte("projets.lotsActivites.formActivite.erreurDebutAvantLot", {
          date: formaterDate(datesLot.dateDebut),
        }),
      });
    }
    if (datesLot?.dateFin && saisie.dateFin && saisie.dateFin > datesLot.dateFin) {
      ctx.addIssue({
        code: "custom",
        path: ["dateFin"],
        message: texte("projets.lotsActivites.formActivite.erreurFinApresLot", {
          date: formaterDate(datesLot.dateFin),
        }),
      });
    }
  });
}

/**
 * `schemaActivite`, borné par le budget du lot choisi et par celui du projet :
 * l'activité ne dépasse ni le disponible de son lot ni le disponible du projet.
 * Borne également les dates de l'activité dans celles du lot choisi (US 3.7).
 */
export function schemaActiviteBornee(
  budgetProjet: number | null,
  lots: Lot[],
  activiteId?: string,
) {
  return schemaActivite.superRefine((saisie, ctx) => {
    const lot = lots.find((candidat) => candidat.id === saisie.lotId);
    if (!lot) return;

    if (!activiteCreable(lot)) {
      ctx.addIssue({
        code: "custom",
        path: ["lotId"],
        message: texte("projets.lotsActivites.datesLotRequises"),
      });
    }
    if (lot.dateDebut && saisie.dateDebut && saisie.dateDebut < lot.dateDebut) {
      ctx.addIssue({
        code: "custom",
        path: ["dateDebut"],
        message: texte("projets.lotsActivites.formActivite.erreurDebutAvantLot", {
          date: formaterDate(lot.dateDebut),
        }),
      });
    }
    if (lot.dateFin && saisie.dateFin && saisie.dateFin > lot.dateFin) {
      ctx.addIssue({
        code: "custom",
        path: ["dateFin"],
        message: texte("projets.lotsActivites.formActivite.erreurFinApresLot", {
          date: formaterDate(lot.dateFin),
        }),
      });
    }

    const budget = budgetSaisi(saisie.budget);
    if (budget === null) return;

    const autresActivites = lot.activites.filter((a) => a.id !== activiteId);
    if (lot.budget !== null) {
      const disponibleLot = budgetDisponible(lot.budget, autresActivites);
      if (disponibleLot !== null && budget > disponibleLot) {
        ctx.addIssue({
          code: "custom",
          path: ["budget"],
          message: texte("projets.lotsActivites.formActivite.erreurBudgetDisponible", {
            disponible: formaterMontant(disponibleLot),
            plafond: formaterMontant(lot.budget),
          }),
        });
      }
    } else if (budgetProjet !== null) {
      const autresLots = lots.filter((l) => l.id !== lot.id);
      const disponibleProjet = budgetDisponible(budgetProjet, autresLots);
      if (disponibleProjet !== null && budget > disponibleProjet) {
        ctx.addIssue({
          code: "custom",
          path: ["budget"],
          message: texte("projets.lotsActivites.formActivite.erreurBudgetDisponibleProjet", {
            disponible: formaterMontant(disponibleProjet),
            plafond: formaterMontant(budgetProjet),
          }),
        });
      }
    }
  });
}

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
    budget: "",
    dateDebut: "",
    dateFin: "",
    responsableId: "",
    equipeId: "",
    statut: STATUT_DECLARE_PAR_DEFAUT,
  };
}

/** Une activité existante, remise en saisie pour sa modification. */
export function saisieDepuisActivite(activite: Activite): SaisieActivite {
  return {
    lotId: activite.lotId,
    libelle: activite.libelle,
    quantite: activite.quantitePrevue === null ? "" : String(activite.quantitePrevue),
    unite: activite.unite ?? "M2",
    budget: activite.budget === null ? "" : formaterSaisieMontant(String(Math.round(activite.budget / 100))),
    dateDebut: activite.dateDebutPrevue ?? "",
    dateFin: activite.dateFinPrevue ?? "",
    responsableId: activite.responsableId ?? "",
    equipeId: activite.equipe?.id ?? "",
    statut: activite.statut,
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
    budget: valeurs.budget ? saisieEnCentimes(valeurs.budget) : null,
    dateDebutPrevue: valeurs.dateDebut || null,
    dateFinPrevue: valeurs.dateFin || null,
    responsableId: valeurs.responsableId || null,
    equipeId: valeurs.equipeId || null,
    statut: valeurs.statut as StatutDeclare,
  };
}

/* ------------------------------------------------------------------ *
 * La mise à jour manuelle de l'avancement d'une activité (F3).
 * ------------------------------------------------------------------ */

/** Longueur minimale du commentaire exigée par le serveur (RG-F3-02). */
export const COMMENTAIRE_AVANCEMENT_MIN = 10;

/**
 * La nouvelle quantité cumulée réalisée et sa raison. `quantiteActuelle` est
 * le plancher : l'avancement d'une activité ne diminue pas (SFD F3, RG-F3-02).
 */
export function schemaAvancement(quantiteActuelle: number) {
  return z
    .object({
      quantite: z
        .string()
        .trim()
        .refine((valeur) => MOTIF_QUANTITE.test(valeur), {
          message: texte("projets.lotsActivites.avancement.erreurQuantiteInvalide"),
        }),
      commentaire: z
        .string()
        .trim()
        .min(COMMENTAIRE_AVANCEMENT_MIN, {
          message: texte("projets.lotsActivites.avancement.erreurCommentaireCourt", {
            min: COMMENTAIRE_AVANCEMENT_MIN,
          }),
        }),
    })
    .superRefine((saisie, ctx) => {
      const quantite = saisieEnQuantite(saisie.quantite);
      if (quantite !== null && quantite < quantiteActuelle) {
        ctx.addIssue({
          code: "custom",
          path: ["quantite"],
          message: texte("projets.lotsActivites.avancement.erreurDiminution"),
        });
      }
    });
}

export type SaisieAvancement = z.input<ReturnType<typeof schemaAvancement>>;
export type ValeursAvancement = z.output<ReturnType<typeof schemaAvancement>>;

/** Le formulaire de départ : la quantité actuelle, sans commentaire. */
export function saisieAvancementDepuis(quantiteActuelle: number): SaisieAvancement {
  return { quantite: String(quantiteActuelle).replace(".", ","), commentaire: "" };
}

/** La saisie validée, traduite en objet du domaine. */
export function versMiseAJourAvancement(valeurs: ValeursAvancement): MiseAJourAvancement {
  return {
    quantiteRealisee: saisieEnQuantite(valeurs.quantite) ?? 0,
    commentaire: valeurs.commentaire,
  };
}

/* ------------------------------------------------------------------ *
 * Une équipe, et son affectation à une activité.
 * ------------------------------------------------------------------ */

/** Au-delà, un nom d'équipe ne tient plus sur l'en-tête de sa carte. */
export const LONGUEUR_MAX_NOM_EQUIPE = 80;

/**
 * L'affectation d'une équipe à une activité. L'équipe est exigée : retirer
 * une affectation est un geste à part, qui a son propre bouton.
 */
export const schemaAffectation = z.object({
  activiteId: chaineNonVide(texte("projets.equipesAffectations.formAffectation.erreurActiviteRequise")),
  equipeId: chaineNonVide(texte("projets.equipesAffectations.formAffectation.erreurEquipeRequise")),
});

export type SaisieAffectation = z.input<typeof schemaAffectation>;

/* ------------------------------------------------------------------ *
 * Le cadrage du projet — planning et budget, fixés par le chef de projet.
 * ------------------------------------------------------------------ */

export const schemaPlanning = z
  .object({
    dateDebut: chaineNonVide(texte("projets.cadrage.erreurDateDebutRequise")),
    dateFin: chaineNonVide(texte("projets.cadrage.erreurDateFinRequise")),
  })
  .superRefine((saisie, ctx) => {
    if (!datesChantierCoherentes(saisie.dateDebut, saisie.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }
  });

export type SaisiePlanning = z.input<typeof schemaPlanning>;

export function saisieDepuisPlanning(projet: Projet): SaisiePlanning {
  return { dateDebut: projet.dateDebutPrevue ?? "", dateFin: projet.dateFinPrevue ?? "" };
}

export function versPlanningProjet(valeurs: z.output<typeof schemaPlanning>): PlanningProjet {
  return { dateDebutPrevue: valeurs.dateDebut, dateFinPrevue: valeurs.dateFin };
}

export function schemaBudgetProjet(plancher: number | null = null) {
  return z
    .object({
      montant: chaineNonVide(texte("projets.cadrage.erreurBudgetRequis")).refine(
        (valeur) => MOTIF_MONTANT.test(valeur) && budgetRecevable(saisieEnCentimes(valeur)),
        { message: texte("projets.cadrage.erreurBudgetInvalide") },
      ),
    })
    .superRefine((saisie, ctx) => {
      if (plancher === null) return;
      const centimes = saisieEnCentimes(saisie.montant);
      if (centimes !== null && centimes < plancher) {
        ctx.addIssue({
          code: "custom",
          path: ["montant"],
          message: texte("projets.cadrage.erreurBudgetPlancher", {
            somme: formaterMontant(plancher),
          }),
        });
      }
    });
}

export const schemaBudget = schemaBudgetProjet();

export type SaisieBudget = z.input<typeof schemaBudget>;

/** Le montant validé, en centimes — le schéma garantit qu'il est recevable, donc non nul. */
export function versBudgetCentimes(valeurs: z.output<typeof schemaBudget>): number {
  return saisieEnCentimes(valeurs.montant) ?? 0;
}

/* ------------------------------------------------------------------ *
 * Reprogrammation des dates (US 3.8, RG-11).
 * ------------------------------------------------------------------ */

/** Longueur minimale de la justification exigée par le serveur (RG-11). */
export const JUSTIFICATION_MIN = 30;

export interface BornesReprogrammation {
  debutMin?: string | null;
  finMax?: string | null;
  typeObjet?: "PROJET" | "LOT" | "ACTIVITE";
}

/**
 * Le schéma de validation de la reprogrammation des dates :
 * - Date de début facultative (saisie pour modifier début et fin ensemble)
 * - Date de fin obligatoire
 * - Motif obligatoire
 * - Justification obligatoire (≥ 30 caractères, RG-11)
 * - Cohérence des dates : fin > début (projet) ou fin >= début (lot, activité)
 * - Bornes imposées par le parent (lot borné par projet, activité par lot).
 */
export function schemaReprogrammation(bornes?: BornesReprogrammation) {
  return z
    .object({
      dateDebut: z.string(),
      dateFin: chaineNonVide(texte("projets.reprogrammation.erreurFinRequise")),
      motifId: chaineNonVide(texte("projets.reprogrammation.erreurMotifRequis")),
      justification: z
        .string()
        .trim()
        .min(JUSTIFICATION_MIN, {
          message: texte("projets.reprogrammation.erreurJustificationCourte"),
        }),
    })
    .superRefine((saisie, ctx) => {
      if (saisie.dateDebut && saisie.dateFin) {
        if (bornes?.typeObjet === "PROJET") {
          if (saisie.dateFin <= saisie.dateDebut) {
            ctx.addIssue({
              code: "custom",
              path: ["dateFin"],
              message: texte("projets.tiroirCreation.erreurDatesIncoherentes"),
            });
          }
        } else {
          if (saisie.dateFin < saisie.dateDebut) {
            ctx.addIssue({
              code: "custom",
              path: ["dateFin"],
              message: texte("projets.tiroirCreation.erreurDatesIncoherentes"),
            });
          }
        }
      }
      if (bornes?.debutMin && saisie.dateDebut && saisie.dateDebut < bornes.debutMin) {
        ctx.addIssue({
          code: "custom",
          path: ["dateDebut"],
          message: texte("projets.lotsActivites.formLot.erreurDebutAvantProjet", {
            date: formaterDate(bornes.debutMin),
          }),
        });
      }
      if (bornes?.finMax && saisie.dateFin && saisie.dateFin > bornes.finMax) {
        ctx.addIssue({
          code: "custom",
          path: ["dateFin"],
          message: texte("projets.lotsActivites.formLot.erreurFinApresProjet", {
            date: formaterDate(bornes.finMax),
          }),
        });
      }
    });
}

export type SaisieReprogrammation = z.infer<ReturnType<typeof schemaReprogrammation>>;

export function versReprogrammation(
  saisie: SaisieReprogrammation,
): Reprogrammation {
  return {
    dateDebutPrevue: saisie.dateDebut ? saisie.dateDebut : null,
    dateFinPrevue: saisie.dateFin,
    motifId: saisie.motifId,
    justification: saisie.justification,
  };
}

