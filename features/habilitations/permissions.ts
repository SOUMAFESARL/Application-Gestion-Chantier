/**
 * Les codes de permission que les écrans du découpage en arbre consultent (registre du serveur,
 * `apps/core/registre_permissions.py`). Écrits une fois ici : un code mal orthographié dans un
 * écran n'accorderait rien, sans erreur.
 *
 * **Une permission sur un projet s'exerce dans un périmètre** (décisions v1.2, §13bis) : une ou
 * plusieurs cases de l'arbre, ou tout le projet. Le frontend ne connaît pas ce périmètre case par
 * case ; il grise un geste quand le rôle n'a pas la permission sur le projet, et c'est le serveur
 * qui refuse une case hors du périmètre (403, message affiché tel quel).
 */
export const PERMISSIONS = {
  LIRE: "projets.lire",
  VOIR_TOUT: "projets.voir_tout",
  VOIR_MONTANTS: "projets.voir_montants",
  DECOUPER: "projets.decouper",
  CHIFFRER: "projets.chiffrer",
  PLANIFIER: "projets.planifier",
  PROLONGER: "projets.prolonger",
  MESURER: "projets.mesurer",
  AFFECTER_MEMBRES: "projets.affecter_membres",
  RETIRER_MEMBRES: "projets.retirer_membres",
  GERER_EQUIPES: "projets.gerer_equipes",
  MAIN_OEUVRE_GERER: "projets.main_oeuvre_gerer",
  MODELES_GERER: "projets.modeles_gerer",
  AVENANTS_GERER: "projets.avenants_gerer",
  CHANTIER_LIRE: "chantier.lire",
  CHANTIER_REDIGER: "chantier.rediger",
  CHANTIER_VALIDER: "chantier.valider",
  CHANTIER_APPROUVER: "chantier.approuver",
  SYNTHESE_REDIGER: "chantier.synthese_rediger",
  SYNTHESE_APPROUVER: "chantier.synthese_approuver",
} as const;

export type CodePermission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** La clé du libellé d'une permission dans `habilitations.permissions` (sans point). */
export function cleLibellePermission(code: CodePermission): string {
  return code.replace(".", "_");
}
