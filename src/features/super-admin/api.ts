/**
 * API pour le tableau de bord Super Admin.
 */

import { EntrepriseCliente, StatsSuperAdmin } from "./types";
import { ENTREPRISES_CLIENTES_MOCK, STATS_SUPER_ADMIN_MOCK } from "./mockData";

const STORAGE_KEY_ADMIN = "ccd_super_admin_entreprises";

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
