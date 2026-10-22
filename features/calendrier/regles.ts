/**
 * Les règles du calendrier de l'entreprise — pures, sans React.
 *
 * **Les trois couches de l'erratum E-4**, de la plus forte à la plus faible :
 *
 * 1. l'**exception** de l'entreprise (ouvré ou non ouvré, avec son motif) ;
 * 2. le **férié national** (non ouvré) ;
 * 3. la **semaine type** (les jours de la semaine travaillés).
 *
 * Une couche supérieure l'emporte sur les inférieures : un 1er mai travaillé
 * est une exception « ouvré » qui l'emporte sur le férié, un samedi travaillé
 * l'emporte sur une semaine type du lundi au vendredi.
 *
 * Les dates sont des chaînes `AAAA-MM-JJ`, calculées en UTC : un jour n'a pas
 * de fuseau, et une `Date` locale reculerait d'un jour à l'ouest de Greenwich.
 */

import { JOURS_SEMAINE } from "./types";
import type { Calendrier, JourSemaine, SemaineType, StatutJour } from "./types";

/** Longueur maximale du motif d'une exception (`ExceptionCalendrier.motif`). */
export const MOTIF_EXCEPTION_MAX = 150;

/** Le droit qui ouvre l'écriture : DG et AD (erratum E-4, point 5). */
export const PERMISSION_GERER_CALENDRIER = "administration.calendrier_gerer";

/** Le jour de la semaine d'une date ; `getUTCDay` compte depuis le dimanche. */
export function jourDeSemaine(date: string): JourSemaine {
  const [annee, mois, jour] = date.split("-").map(Number);
  const rang = new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay();
  return JOURS_SEMAINE[(rang + 6) % 7];
}

/**
 * Le statut d'un jour **sans** l'exception : ce qu'il serait si l'entreprise n'avait rien
 * dérogé. Sert à savoir dans quel sens une exception aurait un effet.
 */
export function statutDeBase(date: string, calendrier: Calendrier): StatutJour {
  const ferie = calendrier.feriesNationaux.find((f) => f.date === date);
  if (ferie) {
    return { date, ouvre: false, raison: "FERIE", libelle: ferie.libelle, exception: null };
  }
  return {
    date,
    ouvre: calendrier.semaineType[jourDeSemaine(date)],
    raison: "SEMAINE_TYPE",
    libelle: null,
    exception: null,
  };
}

/** Ce jour est-il ouvré, et pourquoi ? Exception, puis férié national, puis semaine type. */
export function statutDuJour(date: string, calendrier: Calendrier): StatutJour {
  const exception = calendrier.exceptions.find((e) => e.date === date);
  if (exception) {
    return {
      date,
      ouvre: exception.ouvre,
      raison: "EXCEPTION",
      libelle: exception.motif,
      exception,
    };
  }
  return statutDeBase(date, calendrier);
}

/**
 * Le sens que prendrait une nouvelle exception sur ce jour : l'inverse de ce qu'il est sans elle.
 * Une exception qui répéterait le statut de base ne changerait rien — on ne la propose pas.
 */
export function sensNouvelleException(date: string, calendrier: Calendrier): boolean {
  return !statutDeBase(date, calendrier).ouvre;
}

/** Une semaine sans aucun jour travaillé est refusée (le serveur répond 422). */
export function semaineValide(semaine: SemaineType): boolean {
  return JOURS_SEMAINE.some((jour) => semaine[jour]);
}

export function semainesIdentiques(a: SemaineType, b: SemaineType): boolean {
  return JOURS_SEMAINE.every((jour) => a[jour] === b[jour]);
}

/** Le mois affiché : `mois` va de 1 à 12. */
export interface MoisAffiche {
  annee: number;
  mois: number;
}

function deuxChiffres(valeur: number): string {
  return String(valeur).padStart(2, "0");
}

export function dateIso(annee: number, mois: number, jour: number): string {
  return `${annee}-${deuxChiffres(mois)}-${deuxChiffres(jour)}`;
}

function joursDansLeMois({ annee, mois }: MoisAffiche): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/** Le jour d'aujourd'hui sur le poste, en `AAAA-MM-JJ`. */
export function aujourdhuiIso(): string {
  const maintenant = new Date();
  return dateIso(maintenant.getFullYear(), maintenant.getMonth() + 1, maintenant.getDate());
}

/** Le mois qui contient cette date. */
export function moisDeLaDate(date: string): MoisAffiche {
  const [annee, mois] = date.split("-").map(Number);
  return { annee, mois };
}

/** La période demandée au serveur : du premier au dernier jour du mois affiché. */
export function periodeDuMois(affiche: MoisAffiche): { debut: string; fin: string } {
  return {
    debut: dateIso(affiche.annee, affiche.mois, 1),
    fin: dateIso(affiche.annee, affiche.mois, joursDansLeMois(affiche)),
  };
}

export function moisDecale({ annee, mois }: MoisAffiche, decalage: number): MoisAffiche {
  const rang = annee * 12 + (mois - 1) + decalage;
  return { annee: Math.floor(rang / 12), mois: (rang % 12) + 1 };
}

export function memeMois(a: MoisAffiche, b: MoisAffiche): boolean {
  return a.annee === b.annee && a.mois === b.mois;
}

const FORMAT_MOIS = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** `{ annee: 2026, mois: 10 }` → « octobre 2026 » */
export function libelleDuMois({ annee, mois }: MoisAffiche): string {
  return FORMAT_MOIS.format(new Date(Date.UTC(annee, mois - 1, 1)));
}

const FORMAT_JOUR_LONG = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** `2026-11-07` → « samedi 7 novembre 2026 » */
export function libelleDuJour(date: string): string {
  const [annee, mois, jour] = date.split("-").map(Number);
  return FORMAT_JOUR_LONG.format(new Date(Date.UTC(annee, mois - 1, jour)));
}

/**
 * Les jours du mois, chacun avec son statut, et le nombre de cases vides à poser avant le
 * premier pour que la grille commence au lundi.
 */
export function joursDuMois(
  affiche: MoisAffiche,
  calendrier: Calendrier,
): { decalage: number; jours: StatutJour[] } {
  const total = joursDansLeMois(affiche);
  const premier = dateIso(affiche.annee, affiche.mois, 1);
  const decalage = JOURS_SEMAINE.indexOf(jourDeSemaine(premier));
  const jours = Array.from({ length: total }, (_, rang) =>
    statutDuJour(dateIso(affiche.annee, affiche.mois, rang + 1), calendrier),
  );
  return { decalage, jours };
}

/** Le nombre de jours ouvrés d'une liste de jours — le chiffre que le mois résume. */
export function compterOuvres(jours: StatutJour[]): number {
  return jours.filter((jour) => jour.ouvre).length;
}
