/**
 * L'accès aux données du domaine Calendrier — `/calendrier/`.
 *
 * **C'est le seul fichier du domaine qui sait que le serveur existe.** Même méthode que
 * `features/projets/adaptateur.ts` : charges `snake_case` privées, traductions `vers*`,
 * fonctions exportées au verbe à l'infinitif.
 *
 * Le contrat vient de `apps/projets/views/calendrier.py` et de
 * `apps/projets/serializers/calendrier.py`.
 */

import { api } from "@/lib/api";

import {
  HEURE_DEBUT_CALENDRIER_DEFAUT,
  HEURE_FIN_CALENDRIER_DEFAUT,
  horairesParDefaut,
} from "./regles";
import { JOURS_SEMAINE } from "./types";
import type {
  Calendrier,
  CreationException,
  ExceptionCalendrier,
  HorairesSemaine,
  JourFerie,
  PlageHoraire,
  SemaineType,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur — la seule zone en `snake_case`.
 * ------------------------------------------------------------------ */

/** Les sept jours en clair et leurs horaires de travail, comme le serveur les nomme. */
type ChargeSemaineType = SemaineType & {
  horaires_travail?: Partial<Record<keyof SemaineType, Partial<PlageHoraire>>> | null;
};

interface ChargeJourFerie {
  date: string;
  libelle: string;
}

interface ChargeException {
  id: string;
  date: string;
  ouvre: boolean;
  motif: string;
}

interface ChargeCalendrier {
  semaine_type: ChargeSemaineType;
  feries_nationaux?: ChargeJourFerie[] | null;
  exceptions?: ChargeException[] | null;
}

/* ------------------------------------------------------------------ *
 * Traductions — serveur vers domaine.
 * ------------------------------------------------------------------ */

function versSemaineType(charge: ChargeSemaineType): SemaineType {
  return {
    lundi: charge.lundi,
    mardi: charge.mardi,
    mercredi: charge.mercredi,
    jeudi: charge.jeudi,
    vendredi: charge.vendredi,
    samedi: charge.samedi,
    dimanche: charge.dimanche,
  };
}

function versHorairesTravail(charge: ChargeSemaineType): HorairesSemaine {
  const base = horairesParDefaut();
  const brut = charge.horaires_travail;
  if (!brut) return base;
  for (const jour of JOURS_SEMAINE) {
    const plage = brut[jour];
    if (plage) {
      base[jour] = {
        debut: plage.debut || HEURE_DEBUT_CALENDRIER_DEFAUT,
        fin: plage.fin || HEURE_FIN_CALENDRIER_DEFAUT,
      };
    }
  }
  return base;
}

function versJourFerie(charge: ChargeJourFerie): JourFerie {
  return { date: charge.date, libelle: charge.libelle };
}

function versException(charge: ChargeException): ExceptionCalendrier {
  return { id: charge.id, date: charge.date, ouvre: charge.ouvre, motif: charge.motif };
}

function versCalendrier(charge: ChargeCalendrier): Calendrier {
  return {
    semaineType: versSemaineType(charge.semaine_type),
    horairesTravail: versHorairesTravail(charge.semaine_type),
    feriesNationaux: (charge.feries_nationaux ?? []).map(versJourFerie),
    exceptions: (charge.exceptions ?? []).map(versException),
  };
}

/* ------------------------------------------------------------------ *
 * Lectures et écritures.
 * ------------------------------------------------------------------ */

/**
 * Le calendrier sur une période (366 jours au plus : le serveur refuse davantage).
 * Les dates sont `AAAA-MM-JJ`.
 */
export async function lireCalendrier(
  debut: string,
  fin: string,
  signal?: AbortSignal,
): Promise<Calendrier> {
  return versCalendrier(await api.lire<ChargeCalendrier>("/calendrier/", { debut, fin }, signal));
}

/** `PATCH /calendrier/semaine-type/` — DG et AD ; une semaine sans jour est refusée (422). */
export async function modifierSemaineType(
  semaine: SemaineType,
  horairesTravail?: HorairesSemaine,
): Promise<{ semaineType: SemaineType; horairesTravail: HorairesSemaine }> {
  const charge = await api.modifier<ChargeSemaineType>("/calendrier/semaine-type/", {
    ...semaine,
    ...(horairesTravail ? { horaires_travail: horairesTravail } : {}),
  });
  return {
    semaineType: versSemaineType(charge),
    horairesTravail: versHorairesTravail(charge),
  };
}

/** `POST /calendrier/exceptions/` — une seule exception active par date (409 sinon). */
export async function creerException(creation: CreationException): Promise<ExceptionCalendrier> {
  return versException(
    await api.creer<ChargeException>("/calendrier/exceptions/", {
      date: creation.date,
      ouvre: creation.ouvre,
      motif: creation.motif,
    }),
  );
}

/** `DELETE /calendrier/exceptions/{id}/` — suppression logique côté serveur. */
export async function supprimerException(id: string): Promise<void> {
  await api.supprimer(`/calendrier/exceptions/${id}/`);
}
