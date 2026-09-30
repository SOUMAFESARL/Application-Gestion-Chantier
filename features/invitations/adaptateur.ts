/**
 * L'accès aux données des collaborateurs — même rôle que
 * `projets/adaptateur.ts` : le seul fichier du domaine qui connaisse la
 * forme de ce que le serveur envoie pour `/parametres/collaborateurs/`.
 *
 * Les charges utiles (`Charge*`) sont privées : rien ne doit les importer.
 */

import { api, ErreurApi } from "@/lib/api";

import type {
  Collaborateur,
  CollaborateurAjoute,
  CreationCollaborateur,
  StatutCollaborateur,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur — la seule zone en `snake_case`.
 * ------------------------------------------------------------------ */

interface ChargeCollaborateur {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  nom_complet: string;
  telephone: string;
  role_global: string;
  role_global_libelle: string;
  statut: string;
  is_owner: boolean;
  cree_le: string;
  lien_activation: string | null;
}

interface ChargeCreationCollaborateur {
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  role_global: string;
}

const STATUTS: readonly StatutCollaborateur[] = ["ACTIF", "INVITE", "DESACTIVE"];

/** Un statut inconnu n'est pas promu « actif » : il reste en attente. */
function versStatut(statut: string): StatutCollaborateur {
  return (STATUTS as readonly string[]).includes(statut)
    ? (statut as StatutCollaborateur)
    : "INVITE";
}

function versCollaborateur(charge: ChargeCollaborateur): Collaborateur {
  return {
    id: charge.id,
    prenom: charge.prenom ?? "",
    nom: charge.nom ?? "",
    nomComplet: charge.nom_complet || charge.email,
    email: charge.email,
    telephone: charge.telephone ?? "",
    role: charge.role_global,
    roleLibelle: charge.role_global_libelle || charge.role_global,
    statut: versStatut(charge.statut),
    estProprietaire: Boolean(charge.is_owner),
    creeLe: charge.cree_le,
  };
}

function versChargeCreation(creation: CreationCollaborateur): ChargeCreationCollaborateur {
  return {
    email: creation.email,
    nom: creation.nom,
    prenom: creation.prenom,
    telephone: creation.telephone,
    role_global: creation.role,
  };
}

/** Le nom de chaque champ de la création côté serveur. */
const CHAMPS_CREATION: Record<keyof ChargeCreationCollaborateur, keyof CreationCollaborateur> = {
  email: "email",
  nom: "nom",
  prenom: "prenom",
  telephone: "telephone",
  role_global: "role",
};

/**
 * Les erreurs de validation d'un ajout refusé, sous le nom des champs du
 * domaine — vide quand le refus ne vise aucun champ (quota, droits…).
 */
export function erreursCreationParChamp(
  cause: unknown,
): Partial<Record<keyof CreationCollaborateur, string>> {
  if (!(cause instanceof ErreurApi)) return {};
  const parChamp = cause.erreursParChamp;
  const resultat: Partial<Record<keyof CreationCollaborateur, string>> = {};
  for (const [champServeur, champ] of Object.entries(CHAMPS_CREATION)) {
    if (parChamp[champServeur]) resultat[champ] = parChamp[champServeur];
  }
  return resultat;
}

/* ------------------------------------------------------------------ *
 * Les appels.
 * ------------------------------------------------------------------ */

const RESSOURCE = "/parametres/collaborateurs/";

/** La clé de cache de la liste des collaborateurs. */
export const CLE_COLLABORATEURS = ["collaborateurs"] as const;

/** Tous les collaborateurs du tenant : comptes et invitations en cours. */
export async function listerCollaborateurs(): Promise<Collaborateur[]> {
  const charges = await api.lire<ChargeCollaborateur[]>(RESSOURCE);
  return charges.map(versCollaborateur);
}

/** Crée le compte au statut « invité » et envoie l'email d'activation. */
export async function ajouterCollaborateur(
  creation: CreationCollaborateur,
): Promise<CollaborateurAjoute> {
  const charge = await api.creer<ChargeCollaborateur>(RESSOURCE, versChargeCreation(creation));
  return {
    collaborateur: versCollaborateur(charge),
    lienActivation: charge.lien_activation ?? null,
  };
}
