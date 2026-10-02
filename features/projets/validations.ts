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
import { saisieEnCentimes } from "@/lib/format";
import { chaineNonVide } from "@/lib/validations/champs";

import {
  FONCTIONS_AUTRE_MEMBRE,
  MODES_EXECUTION_LOT,
  NATURES_EQUIPE,
  ORDRE_FONCTIONS,
  ROLE_MEMBRE_PAR_DEFAUT,
  ROLES_MEMBRE_EQUIPE,
  TYPES_BORDEREAU,
  NOMBRE_MAX_CONTRATS,
  TYPES_PROJET,
  UNITES_ACTIVITE,
  budgetRecevable,
  datesChantierCoherentes,
  refusContrat,
} from "./regles";
import type {
  Activite,
  AjoutEncadrement,
  CreationEquipe,
  CreationLotProjet,
  CreationProjet,
  FonctionAutreMembre,
  Intervenant,
  ModeExecutionLot,
  ModificationProjet,
  NatureEquipe,
  PlanningProjet,
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
 * Le projet — informations générales.
 * ------------------------------------------------------------------ */

export const schemaProjet = z
  .object({
    nom: chaineNonVide(texte("projets.tiroirCreation.erreurNomRequis")).max(LONGUEUR_MAX_NOM, {
      message: texte("projets.tiroirCreation.erreurNomTropLong"),
    }),
    reference: z.string().trim(),
    typeProjet: choixParmi(TYPES_PROJET, texte("projets.tiroirCreation.erreurTypeRequis")),
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
    // `choixParmi` a déjà vérifié l'appartenance à la liste.
    typeProjet: valeurs.typeProjet as TypeProjet,
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
    // Le planning et le budget ne se modifient pas ici : `versModificationProjet`
    // les ignore, le chef de projet les fixe depuis le projet.
    dateDebut: "",
    dateFin: "",
    budget: "",
    description: "",
    contrats: [],
  };
}

/** La saisie validée d'une modification, traduite en objet du domaine. */
export function versModificationProjet(valeurs: ValeursProjet): ModificationProjet {
  return {
    nom: valeurs.nom,
    typeProjet: valeurs.typeProjet as TypeProjet,
    ville: valeurs.ville,
    maitreOuvrage: valeurs.maitreOuvrage,
    maitreOeuvre: valeurs.maitreOeuvre || undefined,
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
    modeExecution: choixParmi(MODES_EXECUTION_LOT, texte("projets.tiroirCreation.erreurLotModeRequis")),
    typeBordereau: choixParmi(TYPES_BORDEREAU, texte("projets.tiroirCreation.erreurLotBordereauRequis")),
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
    if (!datesChantierCoherentes(lot.dateDebut, lot.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }
  });

/* ------------------------------------------------------------------ *
 * L'ajout d'un lot sur un chantier ouvert.
 * ------------------------------------------------------------------ */

export type SaisieLotProjet = z.input<typeof schemaLot>;

/** Un lot vierge. */
export function lotVide(): SaisieLotProjet {
  return { nom: "", modeExecution: "", typeBordereau: "", budget: "", dateDebut: "", dateFin: "" };
}

export function versCreationLotProjet(saisie: z.output<typeof schemaLot>): CreationLotProjet {
  return {
    nom: saisie.nom,
    modeExecution: saisie.modeExecution as ModeExecutionLot,
    typeBordereau: saisie.typeBordereau as TypeBordereau,
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
    // Facultatives : une activité se déclare souvent avant d'être planifiée.
    dateDebut: z.string(),
    dateFin: z.string(),
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
    dateDebut: activite.dateDebutPrevue ?? "",
    dateFin: activite.dateFinPrevue ?? "",
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
    dateDebutPrevue: valeurs.dateDebut || null,
    dateFinPrevue: valeurs.dateFin || null,
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

/* ------------------------------------------------------------------ *
 * L'équipe d'encadrement et de gestion du projet.
 * ------------------------------------------------------------------ */

/** « Lot 02 — Gros œuvre », « Bâtiment B » : une précision, pas une description. */
export const LONGUEUR_MAX_ZONE = 80;

/**
 * L'arrivée d'une personne dans l'encadrement. La zone ne vaut que pour un
 * chef de chantier, la fonction précise que pour un autre membre — où elle
 * est exigée : « autre » ne dit pas ce que la personne vient faire.
 */
export const schemaAjoutEncadrement = z
  .object({
    fonction: choixParmi(ORDRE_FONCTIONS, texte("projets.encadrement.ajout.erreurFonctionRequise")),
    utilisateurId: chaineNonVide(texte("projets.encadrement.ajout.erreurUtilisateurRequis")),
    zone: z.string().trim().max(LONGUEUR_MAX_ZONE, {
      message: texte("projets.encadrement.ajout.erreurZoneTropLongue"),
    }),
    fonctionMembre: z.string(),
  })
  .superRefine((saisie, ctx) => {
    if (
      saisie.fonction === "AUTRE_MEMBRE" &&
      !FONCTIONS_AUTRE_MEMBRE.includes(saisie.fonctionMembre as FonctionAutreMembre)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["fonctionMembre"],
        message: texte("projets.encadrement.ajout.erreurFonctionMembreRequise"),
      });
    }
  });

export type SaisieAjoutEncadrement = z.input<typeof schemaAjoutEncadrement>;
export type ValeursAjoutEncadrement = z.output<typeof schemaAjoutEncadrement>;

export function saisieEncadrementVide(fonction: string): SaisieAjoutEncadrement {
  return { fonction, utilisateurId: "", zone: "", fonctionMembre: "" };
}

/** La saisie validée, avec la personne choisie dans la liste des utilisateurs du compte. */
export function versAjoutEncadrement(
  valeurs: ValeursAjoutEncadrement,
  intervenant: Intervenant,
): AjoutEncadrement {
  switch (valeurs.fonction) {
    case "CHEF_CHANTIER":
      return { fonction: "CHEF_CHANTIER", intervenant, zone: valeurs.zone || null };
    case "AUTRE_MEMBRE":
      return {
        fonction: "AUTRE_MEMBRE",
        intervenant,
        fonctionMembre: valeurs.fonctionMembre as FonctionAutreMembre,
      };
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

export const schemaBudget = z.object({
  montant: chaineNonVide(texte("projets.cadrage.erreurBudgetRequis")).refine(
    (valeur) => MOTIF_MONTANT.test(valeur) && budgetRecevable(saisieEnCentimes(valeur)),
    { message: texte("projets.cadrage.erreurBudgetInvalide") },
  ),
});

export type SaisieBudget = z.input<typeof schemaBudget>;

/** Le montant validé, en centimes — le schéma garantit qu'il est recevable, donc non nul. */
export function versBudgetCentimes(valeurs: z.output<typeof schemaBudget>): number {
  return saisieEnCentimes(valeurs.montant) ?? 0;
}
