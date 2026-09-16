/**
 * Client d'API pour le Journal de Chantier (Rapports journaliers).
 */

import { RapportJournalierData } from "./types";
import { PROJETS_CHANTIER, ProjetOption, RAPPORTS_INITIAL } from "./mockData";

const STORAGE_KEY = "ccd_journal_chantier_rapports";

export async function obtenirProjetsChantier(): Promise<ProjetOption[]> {
  return PROJETS_CHANTIER;
}

export async function obtenirRapportsJournaliers(): Promise<RapportJournalierData[]> {
  if (typeof window !== "undefined") {
    const sauv = localStorage.getItem(STORAGE_KEY);
    if (sauv) {
      try {
        return JSON.parse(sauv) as RapportJournalierData[];
      } catch {
        // Fallback
      }
    }
  }
  return RAPPORTS_INITIAL;
}

export async function enregistrerRapportJournalier(rapport: RapportJournalierData): Promise<RapportJournalierData> {
  const liste = await obtenirRapportsJournaliers();
  const index = liste.findIndex((r) => r.id === rapport.id);
  let nouvelleListe: RapportJournalierData[];

  if (index >= 0) {
    nouvelleListe = [...liste];
    nouvelleListe[index] = rapport;
  } else {
    nouvelleListe = [rapport, ...liste];
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nouvelleListe));
  }

  return rapport;
}
