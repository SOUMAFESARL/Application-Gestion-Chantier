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
