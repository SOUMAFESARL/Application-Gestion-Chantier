/**
 * API pour le tableau de bord Super Admin.
 */

import { apiPlateforme, ErreurApi } from "@/lib/api";
import { EntrepriseCliente, StatsSuperAdmin } from "./types";
import { ENTREPRISES_CLIENTES_MOCK, STATS_SUPER_ADMIN_MOCK } from "./mockData";

const STORAGE_KEY_ADMIN = "ccd_super_admin_entreprises";

export interface ResultatVerificationAcces {
  autorise: boolean;
  ip?: string;
  message?: string;
}

export async function verifierAccesSuperAdmin(): Promise<ResultatVerificationAcces> {
  try {
    const rep = await apiPlateforme.lire<{ statut: string; ip?: string; message?: string }>(
      "/super-admin/verifier-acces/"
    );
    return {
      autorise: rep.statut === "autorise",
      ip: rep.ip,
      message: rep.message,
    };
  } catch (err) {
    if (err instanceof ErreurApi) {
      if (err.code === "acces_refuse" || err.statut === 403) {
        return {
          autorise: false,
          message: err.message,
        };
      }
    }
    // En environnement de dev local ou test si l'API n'est pas joignable
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      return { autorise: true, ip: "127.0.0.1" };
    }
    return {
      autorise: false,
    };
  }
}

export async function obtenirStatsSuperAdmin(): Promise<StatsSuperAdmin> {
  return STATS_SUPER_ADMIN_MOCK;
}

export async function obtenirEntreprisesClientes(): Promise<EntrepriseCliente[]> {
  if (typeof window !== "undefined") {
    const sauv = localStorage.getItem(STORAGE_KEY_ADMIN);
    if (sauv) {
      try {
        return JSON.parse(sauv) as EntrepriseCliente[];
      } catch {
        // repli
      }
    }
  }
  return ENTREPRISES_CLIENTES_MOCK;
}

export async function modifierEntrepriseCliente(
  id: string,
  modifications: Partial<EntrepriseCliente>
): Promise<EntrepriseCliente[]> {
  const liste = await obtenirEntreprisesClientes();
  const index = liste.findIndex((e) => e.id === id);
  if (index >= 0) {
    liste[index] = { ...liste[index], ...modifications };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_ADMIN, JSON.stringify(liste));
    }
  }
  return [...liste];
}

export async function obtenirUtilisateursEntreprise(
  entrepriseId: string
): Promise<import("./types").UtilisateurCibleAssistance[]> {
  try {
    return await apiPlateforme.lire<import("./types").UtilisateurCibleAssistance[]>(
      `/super-admin/entreprises/${entrepriseId}/utilisateurs/`
    );
  } catch {
    // Repli en développement local si l'API est absente
    return [
      {
        id: "u-dg-001",
        nom: "Kouamé",
        prenom: "Patrice",
        email: "dg@soumafe.ci",
        role_global: "DG",
        role_libelle: "Directeur Général",
        is_owner: true,
        is_dg: true,
        statut: "ACTIF",
      },
      {
        id: "u-ct-002",
        nom: "Traoré",
        prenom: "Moussa",
        email: "conducteur@soumafe.ci",
        role_global: "CT",
        role_libelle: "Conducteur de Travaux",
        is_owner: false,
        is_dg: false,
        statut: "ACTIF",
      },
      {
        id: "u-rf-003",
        nom: "Bamba",
        prenom: "Aïcha",
        email: "compta@soumafe.ci",
        role_global: "RF",
        role_libelle: "Responsable Financier",
        is_owner: false,
        is_dg: false,
        statut: "ACTIF",
      },
    ];
  }
}

export async function demarrerAssistance(
  entrepriseId: string,
  motif: string,
  utilisateurId?: string
): Promise<import("./types").ReponseSessionAssistance> {
  try {
    return await apiPlateforme.creer<import("./types").ReponseSessionAssistance>(
      `/super-admin/entreprises/${entrepriseId}/assistance/`,
      {
        motif,
        utilisateur_id: utilisateurId,
      }
    );
  } catch (err) {
    // En simulation dev si l'API n'est pas connectée
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      const mockToken = "mock-assistance-jwt-token";
      return {
        access: mockToken,
        expire_dans: 3600,
        impersonation: {
          actif: true,
          mode: "LECTURE_SEULE",
          super_admin: {
            id: "sa-001",
            email: "support@ccd-digital.ci",
            nom: "Support CCD",
          },
          entreprise: {
            id: entrepriseId,
            raison_sociale: "Entreprise Cliente Test",
            nom_commercial: "Client Démo",
            schema_name: "demo",
          },
          utilisateur: {
            id: utilisateurId || "u-dg-001",
            nom: "Kouamé",
            prenom: "Patrice",
            email: "dg@soumafe.ci",
            role_global: "DG",
            role_libelle: "Directeur Général",
          },
          motif,
        },
        utilisateur: {
          id: utilisateurId || "u-dg-001",
          email: "dg@soumafe.ci",
          nom: "Kouamé",
          prenom: "Patrice",
          role_global: "DG",
          role_libelle: "Directeur Général",
          is_dg: true,
          is_owner: true,
          langue: "fr",
        },
        url_redirection: "/tableau-de-bord",
      };
    }
    throw err;
  }
}

export async function quitterAssistance(entrepriseId?: string): Promise<void> {
  try {
    await apiPlateforme.creer("/super-admin/assistance/deconnexion/", {
      entreprise_id: entrepriseId,
    });
  } catch {
    // Tolérance réseau
  }
}

export async function obtenirJournalPlateforme(filtres?: {
  entrepriseId?: string;
  action?: string;
}): Promise<import("./types").EntreeJournalPlateforme[]> {
  try {
    return await apiPlateforme.lire<import("./types").EntreeJournalPlateforme[]>(
      "/super-admin/journal-plateforme/",
      filtres
    );
  } catch {
    // Repli de développement
    return [
      {
        id: 1,
        utilisateur_id: "sa-001",
        utilisateur_nom: "Support CCD (support@ccd-digital.ci)",
        entreprise_id: "ent-001",
        entreprise_nom: "SOTRA Construction",
        action: "CONNEXION_ASSISTANCE",
        detail: {
          motif: "Assistance sur devis #42 (Ticket #102)",
          cible_email: "dg@soumafe.ci",
          cible_nom: "Patrice Kouamé",
          mode: "LECTURE_SEULE",
          expire_dans_secondes: 3600,
        },
        adresse_ip: "127.0.0.1",
        appareil: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        horodatage: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 2,
        utilisateur_id: "sa-001",
        utilisateur_nom: "Support CCD (support@ccd-digital.ci)",
        entreprise_id: "ent-001",
        entreprise_nom: "SOTRA Construction",
        action: "DECONNEXION_ASSISTANCE",
        detail: {
          statut: "TERMINE",
        },
        adresse_ip: "127.0.0.1",
        appareil: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        horodatage: new Date(Date.now() - 1800000).toISOString(),
      },
    ];
  }
}

