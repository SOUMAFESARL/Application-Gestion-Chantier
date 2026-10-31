/**
 * L'accès aux données du domaine Avenants — le seul fichier du domaine qui sait que le serveur
 * existe (style de `features/projets/adaptateur.ts`).
 *
 *   GET/POST   /projets/{id}/avenants/        les avenants ; en enregistrer un (multipart)
 *   GET/DEL    /avenants/{id}/                un avenant ; le retirer
 *   GET        /avenants/{id}/document/       le document signé
 *
 * Écriture : `projets.avenants_gerer`.
 */

import { api } from "@/lib/api";

import type { Avenant, SaisieAvenant } from "./types";

interface ChargeAvenant {
  id: string;
  numero: string;
  date_signature: string;
  objet: string;
  jours_accordes: number;
  montant: number | null;
  porte_sur: "PROJET" | "CASES";
  cases?: { id: string; libelle: string }[];
  document: { nom: string; type: string } | null;
  cree_le: string;
}

function versAvenant(charge: ChargeAvenant): Avenant {
  return {
    id: charge.id,
    numero: charge.numero,
    dateSignature: charge.date_signature,
    objet: charge.objet,
    joursAccordes: charge.jours_accordes ?? 0,
    montant: charge.montant ?? null,
    porteSur: charge.porte_sur,
    cases: charge.cases ?? [],
    document: charge.document,
    creeLe: charge.cree_le,
  };
}

/** La charge d'un avenant : toujours en `multipart`, le document signé l'accompagne. */
function versChargeAvenant(saisie: SaisieAvenant): FormData {
  const corps = new FormData();
  corps.append("numero", saisie.numero.trim());
  corps.append("date_signature", saisie.dateSignature);
  corps.append("objet", saisie.objet.trim());
  corps.append("jours_accordes", String(saisie.joursAccordes));
  if (saisie.montant !== null) corps.append("montant", String(Math.round(saisie.montant)));
  for (const id of saisie.casesIds) corps.append("elements_ids", id);
  if (saisie.document) corps.append("document", saisie.document, saisie.document.name);
  return corps;
}

export async function listerAvenants(projetId: string, signal?: AbortSignal): Promise<Avenant[]> {
  const charge = await api.lire<ChargeAvenant[]>(`/projets/${projetId}/avenants/`, undefined, signal);
  return (Array.isArray(charge) ? charge : []).map(versAvenant);
}

export async function enregistrerAvenant(projetId: string, saisie: SaisieAvenant): Promise<Avenant> {
  return versAvenant(await api.creer<ChargeAvenant>(`/projets/${projetId}/avenants/`, versChargeAvenant(saisie)));
}

/** Retirer un avenant enregistré par erreur : ses jours et son montant sont rendus. */
export async function retirerAvenant(avenantId: string): Promise<void> {
  await api.supprimer(`/avenants/${avenantId}/`);
}

export async function telechargerDocumentAvenant(avenantId: string): Promise<Blob> {
  return api.telecharger(`/avenants/${avenantId}/document/`);
}
