/**
 * Le schéma zod de l'ajout d'un collaborateur.
 *
 * Même séparation que `projets/validations.ts` : ni React, ni réseau. Le
 * schéma dit ce qu'est une saisie acceptable ; `versCreationInvitation` la
 * traduit en charge utile. L'écran ne fait que relier les deux.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import { PAYS_TELEPHONE_DEFAUT, telephoneValide } from "@/features/referentiels/telephone";
import { chaineNonVide, email } from "@/lib/validations/champs";

import type { CreerInvitationPayload } from "./api";

/** Au-delà, un nom ne tient plus sur une ligne du tableau des collaborateurs. */
export const LONGUEUR_MAX_NOM_COMPLET = 150;

/**
 * Les rôles proposés à l'ajout, **par leur code seul** — les libellés sont
 * dans `messages/fr.json`, sous `gestionCollaborateurs.roleOptions.<code>`.
 */
export const CODES_ROLES = [
  "AD",
  "DP",
  "CT",
  "CC",
  "IT",
  "RF",
  "RA",
  "MAG",
  "RH",
  "ST",
  "FRN",
  "MOA",
  "VI",
] as const;

export const schemaAjoutCollaborateur = z.object({
  nomComplet: chaineNonVide(texte("gestionCollaborateurs.erreurNomRequis")).max(
    LONGUEUR_MAX_NOM_COMPLET,
    { message: texte("gestionCollaborateurs.erreurNomTropLong") },
  ),
  email: email(
    texte("gestionCollaborateurs.erreurEmailRequis"),
    texte("gestionCollaborateurs.erreurEmailInvalide"),
  ),
  // Le champ stocke du E.164 : l'indicatif porte déjà le pays, le pays par
  // défaut ne sert qu'à lire une valeur qui n'en aurait pas.
  telephone: chaineNonVide(texte("gestionCollaborateurs.erreurTelephoneRequis")).refine(
    (valeur) => telephoneValide(valeur, PAYS_TELEPHONE_DEFAUT),
    { message: texte("gestionCollaborateurs.erreurTelephoneInvalide") },
  ),
  role: z
    .string()
    .refine((valeur) => (CODES_ROLES as readonly string[]).includes(valeur), {
      message: texte("gestionCollaborateurs.erreurRoleRequis"),
    }),
});

export type SaisieAjoutCollaborateur = z.input<typeof schemaAjoutCollaborateur>;
export type ValeursAjoutCollaborateur = z.output<typeof schemaAjoutCollaborateur>;

/**
 * Le formulaire vierge. **Aucun rôle n'est présélectionné** : un rôle choisi
 * à la place de l'utilisateur finit attribué sans qu'il l'ait décidé.
 */
export function saisieAjoutVide(): SaisieAjoutCollaborateur {
  return { nomComplet: "", email: "", telephone: "", role: "" };
}

export function versCreationInvitation(
  valeurs: ValeursAjoutCollaborateur,
): CreerInvitationPayload {
  return {
    nom: valeurs.nomComplet,
    email: valeurs.email,
    telephone: valeurs.telephone,
    role_propose: valeurs.role,
  };
}
