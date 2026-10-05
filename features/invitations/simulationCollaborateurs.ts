/**
 * Les gestes sur un collaborateur — en attendant leurs routes.
 *
 * **Pourquoi ce module existe.** `GET /parametres/collaborateurs/` répond,
 * mais ni la fiche (`GET …/{id}/`), ni la suspension, la réactivation ou la
 * suppression n'existent encore côté Django. Les vrais appels sont à leur
 * place définitive dans `adaptateur.ts` : le jour où les routes arrivent,
 * `NEXT_PUBLIC_API_SIMULE` passe à `0` et **aucun écran ne change**.
 *
 * **Ce n'est pas un jeu de démonstration.** La liste reste celle du serveur ;
 * ce module ne tient qu'une surcouche — les statuts changés et les comptes
 * supprimés — qu'il rejoue par-dessus. Il ne fabrique aucun collaborateur.
 *
 * **Il se souvient le temps de l'onglet** (`sessionStorage`), comme
 * `simulationEquipes.ts` : un geste survit à un rechargement, sans s'installer
 * sur la machine au point d'être pris pour une donnée réelle.
 */

import { attendre, refuser } from "@/lib/api/simulation";

import type { Collaborateur, StatutCollaborateur } from "./types";

const CLE_ETAT = "ccd.simulation.collaborateurs";

const LATENCE_LECTURE = 300;
const LATENCE_ECRITURE = 600;

interface EtatSimule {
  statuts: Record<string, StatutCollaborateur>;
  supprimes: string[];
}

function etatVide(): EtatSimule {
  return { statuts: {}, supprimes: [] };
}

function lireEtat(): EtatSimule {
  if (typeof window === "undefined") return etatVide();
  try {
    const brut = window.sessionStorage.getItem(CLE_ETAT);
    return brut ? (JSON.parse(brut) as EtatSimule) : etatVide();
  } catch {
    return etatVide();
  }
}

function ecrireEtat(etat: EtatSimule): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_ETAT, JSON.stringify(etat));
  } catch {
    // Navigation privée saturée : la simulation perd sa mémoire, sans plus.
  }
}

/** Trouve le compte, ou refuse comme le serveur s'il n'existe pas. */
function trouver(liste: Collaborateur[], id: string): Collaborateur {
  const collaborateur = liste.find((candidat) => candidat.id === id);
  if (!collaborateur) {
    refuser("introuvable", "Ce collaborateur n'existe pas ou a été supprimé.", 404);
  }
  return collaborateur;
}

/** Le propriétaire est intouchable, côté serveur comme ici. */
function refuserProprietaire(collaborateur: Collaborateur): void {
  if (collaborateur.estProprietaire) {
    refuser(
      "proprietaire_protege",
      "Le compte propriétaire de l'entreprise ne peut être ni suspendu ni supprimé.",
      403,
    );
  }
}

function changerStatut(collaborateur: Collaborateur, statut: StatutCollaborateur): Collaborateur {
  const etat = lireEtat();
  ecrireEtat({ ...etat, statuts: { ...etat.statuts, [collaborateur.id]: statut } });
  return { ...collaborateur, statut };
}

export const simulationCollaborateurs = {
  /** Rejoue les gestes passés par-dessus la liste du serveur. */
  appliquer(liste: Collaborateur[]): Collaborateur[] {
    const { statuts, supprimes } = lireEtat();
    return liste
      .filter((collaborateur) => !supprimes.includes(collaborateur.id))
      .map((collaborateur) =>
        statuts[collaborateur.id] ? { ...collaborateur, statut: statuts[collaborateur.id] } : collaborateur,
      );
  },

  lire(liste: Collaborateur[], id: string): Promise<Collaborateur> {
    return attendre(trouver(liste, id), LATENCE_LECTURE);
  },

  suspendre(liste: Collaborateur[], id: string): Promise<Collaborateur> {
    const collaborateur = trouver(liste, id);
    refuserProprietaire(collaborateur);
    if (collaborateur.statut !== "ACTIF") {
      refuser("statut_invalide", "Seul un compte actif peut être suspendu.", 400);
    }
    return attendre(changerStatut(collaborateur, "DESACTIVE"), LATENCE_ECRITURE);
  },

  reactiver(liste: Collaborateur[], id: string): Promise<Collaborateur> {
    const collaborateur = trouver(liste, id);
    if (collaborateur.statut !== "DESACTIVE") {
      refuser("statut_invalide", "Ce compte n'est pas suspendu.", 400);
    }
    return attendre(changerStatut(collaborateur, "ACTIF"), LATENCE_ECRITURE);
  },

  supprimer(liste: Collaborateur[], id: string): Promise<void> {
    const collaborateur = trouver(liste, id);
    refuserProprietaire(collaborateur);
    const etat = lireEtat();
    ecrireEtat({ ...etat, supprimes: [...etat.supprimes, id] });
    return attendre(undefined, LATENCE_ECRITURE);
  },
};
