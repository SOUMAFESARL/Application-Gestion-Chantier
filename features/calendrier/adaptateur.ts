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

import type {
  Calendrier,
  CreationException,
  ExceptionCalendrier,
  JourFerie,
  SemaineType,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur — la seule zone en `snake_case`.
 * ------------------------------------------------------------------ */

/** Les sept jours en clair, comme le serveur les nomme. */
type ChargeSemaineType = SemaineType;

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

function versJourFerie(charge: ChargeJourFerie): JourFerie {
  return { date: charge.date, libelle: charge.libelle };
}

function versException(charge: ChargeException): ExceptionCalendrier {
  return { id: charge.id, date: charge.date, ouvre: charge.ouvre, motif: charge.motif };
}

function versCalendrier(charge: ChargeCalendrier): Calendrier {
  return {
    semaineType: versSemaineType(charge.semaine_type),
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
export async function modifierSemaineType(semaine: SemaineType): Promise<SemaineType> {
  return versSemaineType(
    await api.modifier<ChargeSemaineType>("/calendrier/semaine-type/", semaine),
  );
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
