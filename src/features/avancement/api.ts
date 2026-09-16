/**
 * Client d'API pour le suivi d'avancement des travaux et photos de preuve
 */

import { PhotoPreuve, ProjetAvancement } from "./types";
import { PROJETS_AVANCEMENT_MOCK } from "./mockData";

const STORAGE_KEY_AVANCEMENT = "ccd_avancement_projets";

export async function obtenirProjetsAvancement(): Promise<ProjetAvancement[]> {
  if (typeof window !== "undefined") {
    const sauv = localStorage.getItem(STORAGE_KEY_AVANCEMENT);
    if (sauv) {
      try {
        return JSON.parse(sauv) as ProjetAvancement[];
      } catch {
        // repli
      }
    }
  }
  return PROJETS_AVANCEMENT_MOCK;
}

export async function obtenirProjetAvancementParId(id: string): Promise<ProjetAvancement | null> {
  const liste = await obtenirProjetsAvancement();
  return liste.find((p) => p.id === id) || liste[0] || null;
}

export async function enregistrerMiseAJourProjet(projetMaj: ProjetAvancement): Promise<ProjetAvancement> {
  const liste = await obtenirProjetsAvancement();
  const index = liste.findIndex((p) => p.id === projetMaj.id);
  let nouvelleListe: ProjetAvancement[];

  if (index >= 0) {
    nouvelleListe = [...liste];
    nouvelleListe[index] = projetMaj;
  } else {
    nouvelleListe = [projetMaj, ...liste];
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_AVANCEMENT, JSON.stringify(nouvelleListe));
  }

  return projetMaj;
}

export async function ajouterPhotoPreuve(
  projetId: string,
  photo: Omit<PhotoPreuve, "id">
): Promise<PhotoPreuve> {
  const liste = await obtenirProjetsAvancement();
  const projet = liste.find((p) => p.id === projetId);

  const nouvellePhoto: PhotoPreuve = {
    ...photo,
    id: `photo-${Date.now()}`,
  };

  if (projet) {
    projet.photos = [nouvellePhoto, ...projet.photos];
    const lot = projet.lots.find((l) => l.id === photo.lotId);
    if (lot) {
      lot.photosPreuvesIds = [nouvellePhoto.id, ...lot.photosPreuvesIds];
    }
    await enregistrerMiseAJourProjet(projet);
  }

  return nouvellePhoto;
}
