/**
 * Les types du domaine Calendrier de l'entreprise — SFD F3 §6, erratum E-4.
 *
 * Un seul calendrier par entreprise, lu en trois couches : la semaine type,
 * les jours fériés nationaux, les exceptions. Les dates sont des jours
 * `AAAA-MM-JJ`, jamais des `Date` : un jour n'a pas de fuseau.
 */

/** Les sept jours de la semaine, dans l'ordre où le serveur les nomme. */
export const JOURS_SEMAINE = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

export type JourSemaine = (typeof JOURS_SEMAINE)[number];

/** Les jours de la semaine qui sont travaillés. */
export type SemaineType = Record<JourSemaine, boolean>;

/** Un jour férié national, posé par la plateforme : l'entreprise ne le modifie pas. */
export interface JourFerie {
  /** `AAAA-MM-JJ` */
  date: string;
  libelle: string;
}

/** Une dérogation de l'entreprise : un jour, un sens, un motif. */
export interface ExceptionCalendrier {
  id: string;
  /** `AAAA-MM-JJ` */
  date: string;
  /** `true` : le jour est travaillé malgré la semaine type ou le férié. */
  ouvre: boolean;
  motif: string;
}

/** Ce que le serveur rend pour une période. */
export interface Calendrier {
  semaineType: SemaineType;
  feriesNationaux: JourFerie[];
  exceptions: ExceptionCalendrier[];
}

export interface CreationException {
  date: string;
  ouvre: boolean;
  motif: string;
}

/** La couche qui décide du statut d'un jour — de la plus forte à la plus faible. */
export type RaisonJour = "EXCEPTION" | "FERIE" | "SEMAINE_TYPE";

/** Un jour du calendrier, avec la réponse à « est-il ouvré, et pourquoi ? ». */
export interface StatutJour {
  date: string;
  ouvre: boolean;
  raison: RaisonJour;
  /** Le motif de l'exception ou le libellé du férié ; `null` pour la semaine type. */
  libelle: string | null;
  /** L'exception qui décide du jour, s'il y en a une. */
  exception: ExceptionCalendrier | null;
}
