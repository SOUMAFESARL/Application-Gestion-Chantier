/**
 * Les règles du profil de l'utilisateur connecté — espace entreprise.
 *
 * Pures, sans React ni `fetch`. Distinctes de celles du back-office
 * (`features/administration/regles.ts`) : les deux espaces ne partagent pas
 * leurs comptes, et une contrainte changée d'un côté n'a pas à bouger l'autre.
 */

/** Les formats acceptés : pas de SVG, qui n'est pas une photo et peut porter du script. */
export const FORMATS_AVATAR = ["image/png", "image/jpeg", "image/webp"];

/** Le plafond d'une photo de profil, en octets — elle s'affiche à 96 px au plus. */
export const TAILLE_MAX_AVATAR = 2 * 1024 * 1024;

export type RefusAvatar = "FORMAT" | "TAILLE";

/** Pourquoi un fichier ne peut pas servir d'avatar — `null` s'il convient. */
export function refusAvatar(fichier: { type: string; size: number }): RefusAvatar | null {
  if (!FORMATS_AVATAR.includes(fichier.type)) return "FORMAT";
  if (fichier.size > TAILLE_MAX_AVATAR) return "TAILLE";
  return null;
}

/**
 * Les initiales de l'avatar : celles du serveur d'abord, reconstruites sinon
 * (un profil venu de la réponse de connexion ne les porte pas).
 */
export function initialesProfil(profil: {
  initiales?: string;
  prenom?: string;
  nom?: string;
  email?: string;
} | null): string {
  if (!profil) return "?";
  return (
    profil.initiales?.trim() ||
    `${profil.prenom?.[0] ?? ""}${profil.nom?.[0] ?? ""}`.toUpperCase() ||
    profil.email?.[0]?.toUpperCase() ||
    "?"
  );
}

/** Le nom affiché : complet s'il est connu, l'adresse à défaut. */
export function nomAffiche(profil: {
  nom_complet?: string;
  prenom?: string;
  nom?: string;
  email?: string;
} | null): string {
  if (!profil) return "";
  return (
    profil.nom_complet?.trim() ||
    `${profil.prenom ?? ""} ${profil.nom ?? ""}`.trim() ||
    profil.email ||
    ""
  );
}
