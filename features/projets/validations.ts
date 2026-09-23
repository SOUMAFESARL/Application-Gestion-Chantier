/**
 * Le schéma zod de la création d'un chantier — plan de refonte, lot 4,
 * couche 3.
 *
 * Même séparation qu'`auth/validations.ts` : ni React, ni réseau. Le schéma
 * dit ce qu'est une saisie acceptable ; `versCreationProjet` la traduit en
 * objet du domaine. Le tiroir ne fait que relier les deux.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import { PAYS_TELEPHONE_DEFAUT, telephoneValide } from "@/features/referentiels/telephone";
import { saisieEnCentimes } from "@/lib/format";
import { chaineNonVide } from "@/lib/validations/champs";

import { budgetRecevable, datesChantierCoherentes } from "./regles";
import type { CreationProjet, InvitationIntervenant } from "./types";

/** Au-delà, un nom de chantier ne tient plus sur une ligne de tableau. */
export const LONGUEUR_MAX_NOM = 150;

/** Une description « sommaire » : le détail va dans les documents du chantier. */
export const LONGUEUR_MAX_DESCRIPTION = 1000;

/** Des chiffres, éventuellement groupés par des espaces (« 850 000 000 »). */
const MOTIF_MONTANT = /^[\d\s]+$/;

/**
 * Le responsable du chantier est **soit** un collaborateur existant, **soit**
 * une personne à inviter — jamais les deux, jamais aucun. Les champs des deux
 * modes coexistent dans le formulaire (basculer de l'un à l'autre ne doit
 * pas effacer ce qui a été tapé) ; seuls ceux du mode choisi sont vérifiés,
 * dans le `superRefine` plus bas.
 */
export const schemaCreationProjet = z
  .object({
    nom: chaineNonVide(texte("projets.tiroirCreation.erreurNomRequis")).max(LONGUEUR_MAX_NOM, {
      message: texte("projets.tiroirCreation.erreurNomTropLong"),
    }),
    clientId: chaineNonVide(texte("projets.tiroirCreation.erreurClientRequis")),
    ville: chaineNonVide(texte("projets.tiroirCreation.erreurVilleRequise")),
    quartier: z.string().trim(),
    dateDebut: chaineNonVide(texte("projets.tiroirCreation.erreurDateDebutRequise")),
    dateFin: chaineNonVide(texte("projets.tiroirCreation.erreurDateFinRequise")),
    budget: z
      .string()
      .trim()
      .refine(
        (valeur) =>
          valeur === "" ||
          (MOTIF_MONTANT.test(valeur) && budgetRecevable(saisieEnCentimes(valeur))),
        { message: texte("projets.tiroirCreation.erreurBudgetInvalide") },
      ),
    description: z.string().trim().max(LONGUEUR_MAX_DESCRIPTION, {
      message: texte("projets.tiroirCreation.erreurDescriptionTropLongue"),
    }),
    modeCp: z.enum(["inviter", "existant"]),
    cpId: z.string(),
    cpNom: z.string().trim(),
    cpPrenom: z.string().trim(),
    cpEmail: z.string().trim().toLowerCase(),
    cpTelephone: z.string().trim(),
  })
  .superRefine((saisie, ctx) => {
    if (!datesChantierCoherentes(saisie.dateDebut, saisie.dateFin)) {
      ctx.addIssue({ code: "custom", path: ["dateFin"], message: texte("projets.tiroirCreation.erreurDatesIncoherentes") });
    }

    if (saisie.modeCp === "existant") {
      if (!saisie.cpId) {
        ctx.addIssue({ code: "custom", path: ["cpId"], message: texte("projets.tiroirCreation.erreurCpRequis") });
      }
      return;
    }

    if (!saisie.cpNom) {
      ctx.addIssue({ code: "custom", path: ["cpNom"], message: texte("projets.tiroirCreation.erreurCpNomRequis") });
    }
    if (!saisie.cpPrenom) {
      ctx.addIssue({ code: "custom", path: ["cpPrenom"], message: texte("projets.tiroirCreation.erreurCpPrenomRequis") });
    }
    if (!saisie.cpEmail) {
      ctx.addIssue({ code: "custom", path: ["cpEmail"], message: texte("projets.tiroirCreation.erreurCpEmailRequis") });
    } else if (!z.email().safeParse(saisie.cpEmail).success) {
      ctx.addIssue({ code: "custom", path: ["cpEmail"], message: texte("projets.tiroirCreation.erreurCpEmailInvalide") });
    }
    // Le champ stocke du E.164 : l'indicatif porte déjà le pays, le pays
    // par défaut ne sert qu'à lire une valeur qui n'en aurait pas.
    if (!saisie.cpTelephone) {
      ctx.addIssue({ code: "custom", path: ["cpTelephone"], message: texte("projets.tiroirCreation.erreurCpTelephoneRequis") });
    } else if (!telephoneValide(saisie.cpTelephone, PAYS_TELEPHONE_DEFAUT)) {
      ctx.addIssue({ code: "custom", path: ["cpTelephone"], message: texte("projets.tiroirCreation.erreurCpTelephoneInvalide") });
    }
  });

export type SaisieCreationProjet = z.input<typeof schemaCreationProjet>;
export type ValeursCreationProjet = z.output<typeof schemaCreationProjet>;

/** Le formulaire vierge. */
export function saisieCreationVide(clientId = "", cpId = ""): SaisieCreationProjet {
  return {
    nom: "",
    clientId,
    ville: "",
    quartier: "",
    dateDebut: "",
    dateFin: "",
    budget: "",
    description: "",
    modeCp: "inviter",
    cpId,
    cpNom: "",
    cpPrenom: "",
    cpEmail: "",
    cpTelephone: "",
  };
}

/**
 * La saisie validée, traduite en objet du domaine.
 *
 * Le responsable désigné l'est deux fois — chef de projet **et** conducteur
 * de travaux : à la création, c'est la même personne, et le serveur attend
 * les deux champs.
 */
export function versCreationProjet(valeurs: ValeursCreationProjet): CreationProjet {
  const creation: CreationProjet = {
    nom: valeurs.nom,
    clientId: valeurs.clientId,
    ville: valeurs.ville,
    quartier: valeurs.quartier || undefined,
    dateDebutPrevue: valeurs.dateDebut,
    dateFinPrevue: valeurs.dateFin,
    // Même conversion que partout ailleurs dans le produit (`lib/format`).
    budgetInitial: saisieEnCentimes(valeurs.budget),
    description: valeurs.description || undefined,
  };

  if (valeurs.modeCp === "existant") {
    creation.conducteurTravauxId = valeurs.cpId;
    creation.chefProjetId = valeurs.cpId;
  } else {
    const invitation: InvitationIntervenant = {
      nom: valeurs.cpNom,
      prenom: valeurs.cpPrenom,
      email: valeurs.cpEmail,
      telephone: valeurs.cpTelephone,
    };
    creation.conducteurTravauxInvite = invitation;
    creation.chefProjetInvite = invitation;
  }

  return creation;
}
