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
  NATURES_EQUIPE,
  ROLE_MEMBRE_PAR_DEFAUT,
  ROLE_PROJET_PAR_FONCTION,
  ROLES_MEMBRE_EQUIPE,
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
  AjoutEncadrement,
  CreationEquipe,
  CreationLotProjet,
  CreationProjet,
  FonctionProjet,
  Intervenant,
  Lot,
  MiseAJourAvancement,
  ModificationProjet,
  NatureEquipe,
  PlanningProjet,
  Projet,
  Reprogrammation,
  RoleMembreEquipe,
  SaisieActiviteDomaine,
  SaisieMembreEquipe,
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

/** Une valeur prise dans une liste fermée — vide tant que rien n'est choisi. */
function choixParmi(valeurs: readonly string[], message: string) {
  return z.string().refine((valeur) => valeurs.includes(valeur), { message });
}

/* ------------------------------------------------------------------ *
 * Le projet — informations générales.
 * ------------------------------------------------------------------ */

export const schemaProjet = z
  .object({
    nom: chaineNonVide(texte("projets.tiroirCreation.erreurNomRequis")).max(LONGUEUR_MAX_NOM, {
      message: texte("projets.tiroirCreation.erreurNomTropLong"),
    }),
    reference: z.string().trim(),
    // Un type prédéfini (son code) ou un libellé saisi librement.
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
      .refine((valeur) => valeur === "" || (MOTIF_MONTANT.test(valeur) && budgetRecevable(saisieEnCentimes(valeur))), {
        message: texte("projets.tiroirCreation.erreurBudgetInvalide"),
      }),
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
  })
  .superRefine((saisie, ctx) => {
    if (!datesChantierCoherentes(saisie.dateDebut, saisie.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }
  });

export type SaisieProjet = z.input<typeof schemaProjet>;
export type ValeursProjet = z.output<typeof schemaProjet>;

/** Le formulaire vierge. `reference` est la proposition du serveur, modifiable. */
export function saisieProjetVide(reference = ""): SaisieProjet {
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
    contrats: [],
  };
}

/** La saisie validée, traduite en objet du domaine. */
export function versCreationProjet(valeurs: ValeursProjet): CreationProjet {
  return {
    nom: valeurs.nom,
    reference: valeurs.reference || undefined,
    typeProjet: valeurs.typeProjet,
    ville: valeurs.ville,
    maitreOuvrage: valeurs.maitreOuvrage,
    maitreOeuvre: valeurs.maitreOeuvre || undefined,
    dateDebutPrevue: valeurs.dateDebut || undefined,
    dateFinPrevue: valeurs.dateFin || undefined,
    // Même conversion que partout ailleurs dans le produit (`lib/format`).
    budgetInitial: valeurs.budget ? (saisieEnCentimes(valeurs.budget) ?? undefined) : undefined,
    description: valeurs.description || undefined,
    contrats: valeurs.contrats.length > 0 ? valeurs.contrats : undefined,
  };
}

/** Un projet existant, remis en saisie pour sa modification. */
export function saisieDepuisProjet(projet: Projet): SaisieProjet {
  return {
    nom: projet.nom,
    reference: projet.reference,
    typeProjet: projet.typeProjet ?? "",
    ville: projet.ville,
    maitreOuvrage: projet.client.raisonSociale,
    maitreOeuvre: projet.maitreOeuvre ?? "",
    dateDebut: projet.dateDebutPrevue ?? "",
    dateFin: projet.dateFinPrevue ?? "",
    // Le budget ne se modifie pas ici : `versModificationProjet` l'ignore, le
    // chef de projet le fixe depuis le projet.
    budget: "",
    description: "",
    contrats: [],
  };
}

/** La saisie validée d'une modification, traduite en objet du domaine. */
export function versModificationProjet(
  valeurs: ValeursProjet,
  peutRenommer = true,
): ModificationProjet {
  return {
    ...(peutRenommer ? { nom: valeurs.nom } : {}),
    typeProjet: valeurs.typeProjet,
    ville: valeurs.ville,
    maitreOuvrage: valeurs.maitreOuvrage,
    maitreOeuvre: valeurs.maitreOeuvre || undefined,
    // Vides, elles ne sont pas envoyées : le planning enregistré reste.
    dateDebutPrevue: valeurs.dateDebut || undefined,
    dateFinPrevue: valeurs.dateFin || undefined,
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

/* ------------------------------------------------------------------ *
 * L'équipe d'encadrement et de gestion du projet.
 * ------------------------------------------------------------------ */

/**
 * L'arrivée d'une personne dans l'encadrement. Le lot ne vaut que pour un
 * chef de chantier, et il est facultatif : vide, la personne a tout le chantier.
 */
export const schemaAjoutEncadrement = z.object({
  // Le code du rôle de portée Projet choisi (CP, CT, CC, QSE…) : la liste est dynamique.
  role: chaineNonVide(texte("projets.encadrement.ajout.erreurFonctionRequise")),
  utilisateurId: chaineNonVide(texte("projets.encadrement.ajout.erreurUtilisateurRequis")),
  // L'identifiant d'un lot du projet ; vide : tout le chantier.
  lotId: z.string(),
});

export type SaisieAjoutEncadrement = z.input<typeof schemaAjoutEncadrement>;
export type ValeursAjoutEncadrement = z.output<typeof schemaAjoutEncadrement>;

/** La place d'un rôle : CP, CT et CC ont la leur, tout autre rôle va aux « autres membres ». */
export function fonctionDuRole(role: string): FonctionProjet {
  const place = (Object.keys(ROLE_PROJET_PAR_FONCTION) as FonctionProjet[]).find(
    (fonction) => fonction !== "AUTRE_MEMBRE" && ROLE_PROJET_PAR_FONCTION[fonction] === role,
  );
  return place ?? "AUTRE_MEMBRE";
}

export function saisieEncadrementVide(fonction: FonctionProjet): SaisieAjoutEncadrement {
  const role = fonction === "AUTRE_MEMBRE" ? "" : ROLE_PROJET_PAR_FONCTION[fonction];
  return { role, utilisateurId: "", lotId: "" };
}

/** La saisie validée, avec la personne choisie dans la liste des utilisateurs du compte. */
export function versAjoutEncadrement(
  valeurs: ValeursAjoutEncadrement,
  intervenant: Intervenant,
): AjoutEncadrement {
  switch (fonctionDuRole(valeurs.role)) {
    case "CHEF_CHANTIER":
      return { fonction: "CHEF_CHANTIER", intervenant, lotId: valeurs.lotId || null };
    case "AUTRE_MEMBRE":
      return { fonction: "AUTRE_MEMBRE", intervenant, roleCode: valeurs.role };
    case "CONDUCTEUR_TRAVAUX":
      return { fonction: "CONDUCTEUR_TRAVAUX", intervenant };
    default:
      return { fonction: "CHEF_PROJET", intervenant };
  }
}

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

