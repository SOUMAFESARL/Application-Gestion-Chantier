/**
 * Règles pures du domaine Rôles — zéro React.
 */

import { ACCES_MODULE, MODULES_CCD } from "./types";
import type { AccesModule, NiveauAcces, PermissionsModules } from "./types";

/**
 * Les accès équivalents à un niveau cumulatif de l'ancien format : le niveau
 * 2 (Saisie) comprend la lecture, le niveau 3 comprend tout.
 */
export function accesDepuisNiveau(niveau: NiveauAcces): AccesModule[] {
  return ACCES_MODULE.slice(0, niveau);
}

/**
 * Les accès d'un module, quel que soit le format reçu : un niveau (format
 * actuel du serveur) ou une liste (format cible). Toute autre valeur vaut
 * « Aucun » — un droit illisible ne s'accorde pas par défaut.
 */
export function accesNormalises(valeur: unknown): AccesModule[] {
  if (typeof valeur === "number") {
    return valeur >= 0 && valeur <= 3 ? accesDepuisNiveau(valeur as NiveauAcces) : [];
  }
  if (Array.isArray(valeur)) {
    return ACCES_MODULE.filter((acces) => valeur.includes(acces));
  }
  return [];
}

/** Les douze modules, chacun avec ses accès normalisés. */
export function permissionsNormalisees(brutes: Record<string, unknown> | null | undefined): PermissionsModules {
  const permissions: PermissionsModules = {};
  for (const code of MODULES_CCD) {
    permissions[code] = accesNormalises(brutes?.[code]);
  }
  return permissions;
}

/**
 * Coche ou décoche un accès. « Aucun » exclut tout le reste : le cocher vide
 * la liste, cocher un autre accès le décoche. Décocher « Aucun » seul ne fait
 * rien — il resterait un module sans accès et sans « Aucun » coché.
 *
 * L'ordre de `ACCES_MODULE` est conservé, pour une charge utile stable.
 */
export function basculerAcces(
  acces: AccesModule[],
  cible: AccesModule | "aucun",
  coche: boolean,
): AccesModule[] {
  if (cible === "aucun") return coche ? [] : acces;
  const suivants = coche ? [...acces, cible] : acces.filter((a) => a !== cible);
  return ACCES_MODULE.filter((a) => suivants.includes(a));
}

/**
 * Le rang de l'accès le plus élevé (0 à 3). Ne décide d'aucun droit : il ne
 * sert qu'à choisir le ton d'affichage d'une cellule.
 */
export function rangAccesMax(acces: AccesModule[]): 0 | 1 | 2 | 3 {
  return ACCES_MODULE.reduce<0 | 1 | 2 | 3>(
    (rang, a, i) => (acces.includes(a) ? ((i + 1) as 1 | 2 | 3) : rang),
    0,
  );
}
