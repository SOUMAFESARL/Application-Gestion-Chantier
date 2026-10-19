/**
 * Le schéma zod de l'ajout d'un collaborateur.
 *
 * Même séparation que `projets/validations.ts` : ni React, ni réseau. Le
 * schéma dit ce qu'est une saisie acceptable ; `versCreationCollaborateur`
 * la traduit en objet du domaine. L'écran ne fait que relier les deux.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import {
  PAYS_TELEPHONE_DEFAUT,
  telephoneInternationalValide,
} from "@/features/referentiels/telephone";
import { chaineNonVide, email } from "@/lib/validations/champs";

import type { CreationCollaborateur } from "./types";

/** La longueur des colonnes `nom` et `prenom` côté Django. */
export const LONGUEUR_MAX_NOM = 100;

/**
 * Les rôles proposés à l'ajout, **par leur code seul** — les libellés sont
 * dans `messages/fr.json`, sous `gestionCollaborateurs.roleOptions.<code>`.
 *
 * Ce sont les choix de `RoleGlobal` côté Django, moins `DG` : le serveur
 * refuse tout autre code, et le rôle de DG n'est jamais attribuable.
 */
export const CODES_ROLES = ["AD", "CP", "CT", "CC", "MOA", "MOE", "VI"] as const;

export function schemaAjoutCollaborateur(paysDefaut: string = PAYS_TELEPHONE_DEFAUT) {
  const pays = paysDefaut || PAYS_TELEPHONE_DEFAUT;
  return z.object({
    prenom: z
      .string()
      .trim()
      .max(LONGUEUR_MAX_NOM, { message: texte("gestionCollaborateurs.erreurPrenomTropLong") }),
    nom: chaineNonVide(texte("gestionCollaborateurs.erreurNomRequis")).max(LONGUEUR_MAX_NOM, {
      message: texte("gestionCollaborateurs.erreurNomTropLong"),
    }),
    email: email(
      texte("gestionCollaborateurs.erreurEmailRequis"),
      texte("gestionCollaborateurs.erreurEmailInvalide"),
    ),
    // Le champ stocke du E.164 : l'indicatif porte déjà le pays, le pays par
    // défaut ne sert qu'à lire une valeur qui n'en aurait pas.
    telephone: chaineNonVide(texte("gestionCollaborateurs.erreurTelephoneRequis")).refine(
      (valeur) => telephoneInternationalValide(valeur, pays),
      { message: texte("gestionCollaborateurs.erreurTelephoneInvalide") },
    ),
    role: z
      .string()
      .refine((valeur) => (CODES_ROLES as readonly string[]).includes(valeur), {
        message: texte("gestionCollaborateurs.erreurRoleRequis"),
      }),
  });
}

export type SaisieAjoutCollaborateur = z.input<ReturnType<typeof schemaAjoutCollaborateur>>;
export type ValeursAjoutCollaborateur = z.output<ReturnType<typeof schemaAjoutCollaborateur>>;

/**
 * Le formulaire vierge. **Aucun rôle n'est présélectionné** : un rôle choisi
 * à la place de l'utilisateur finit attribué sans qu'il l'ait décidé.
 */
export function saisieAjoutVide(): SaisieAjoutCollaborateur {
  return { prenom: "", nom: "", email: "", telephone: "", role: "" };
}

export function versCreationCollaborateur(
  valeurs: ValeursAjoutCollaborateur,
): CreationCollaborateur {
  return {
    prenom: valeurs.prenom,
    nom: valeurs.nom,
    email: valeurs.email,
    telephone: valeurs.telephone,
    role: valeurs.role,
  };
}
