/**
 * D'où viennent les droits — le seul fichier du domaine qui connaisse la forme
 * du profil serveur et celle d'un rôle.
 *
 * Deux sources, un seul résultat (`Droits`) :
 * - le **profil** de la personne connectée (`GET /auth/profil/`) ;
 * - un **rôle** de l'entreprise (`GET /parametres/roles/`), quand un poste de
 *   développement l'incarne pour tester l'interface (voir `ContexteDroits`).
 *
 * Un droit est un **code de permission** (`projets.creer`), rien d'autre.
 */

import type { ProfilUtilisateur } from "@/features/auth/api";
import { codesDuRole } from "@/features/roles/regles";
import type { RoleItem } from "@/features/roles/types";

import { droitsDirection } from "./regles";
import type { Droits, PorteeProjets } from "./types";

/**
 * Les droits de la personne connectée.
 *
 * `role_global === "DG"` est le seul code de rôle lu dans tout le domaine :
 * c'est la direction, que le serveur signale aussi par `is_dg`. Tout autre
 * rôle est une donnée — ses codes, rien de plus.
 *
 * Un profil sans `permissions` (celui que pose la connexion, avant
 * `GET /auth/profil/`) ne dit pas encore les droits : `null`, « pas encore
 * connus ». Le menu attend donc le vrai profil au lieu de s'afficher vide — un
 * droit ne se devine pas, ni dans un sens ni dans l'autre.
 */
export function versDroits(profil: ProfilUtilisateur): Droits | null {
  if (!profil.permissions) return null;
  const codes = profil.permissions.map((c) => c.toLowerCase());
  if (profil.is_dg || profil.role_global === "DG") return droitsDirection(codes);

  const portee: PorteeProjets =
    profil.portee === "ENTREPRISE"
      ? { type: "TOUS" }
      : { type: "PERSONNE", collaborateurId: profil.id };

  return {
    estDirection: false,
    codes,
    portee,
  };
}

/** Les droits d'un rôle, portés par une personne donnée (ses chantiers). */
export function droitsDuRole(role: RoleItem, collaborateurId: string | null): Droits {
  const portee: PorteeProjets =
    role.portee === "ENTREPRISE"
      ? { type: "TOUS" }
      : // Sans personne, aucun chantier : la portée ne s'accorde pas par défaut.
        { type: "PERSONNE", collaborateurId: collaborateurId ?? "" };

  return { estDirection: false, codes: codesDuRole(role), portee };
}
