/**
 * L'accès aux données du domaine Équipes — le seul fichier du domaine qui sait que le serveur
 * existe (style de `features/projets/adaptateur.ts`).
 *
 *   GET/POST       /main-oeuvre/                 le registre (lecture `projets.lire`)
 *   GET/PATCH/DEL  /main-oeuvre/{id}/            une personne (écriture `projets.main_oeuvre_gerer`)
 */

import { api } from "@/lib/api";

import type { EntrepriseRattachement, FiltresRegistre, Personne, SaisiePersonne } from "./types";

interface ChargeListePaginee<T> {
  results?: T[];
}

interface ChargeEntreprise {
  id: string | null;
  nom: string;
  interne: boolean;
}

interface ChargePersonne {
  id: string;
  nom: string;
  prenom: string;
  nom_complet?: string;
  telephone?: string;
  metier?: string;
  entreprise?: ChargeEntreprise;
  a_un_compte?: boolean;
  est_actif?: boolean;
}

function aPlat<T>(charge: T[] | ChargeListePaginee<T> | null | undefined): T[] {
  return Array.isArray(charge) ? charge : (charge?.results ?? []);
}

export function versEntreprise(charge: ChargeEntreprise | null | undefined): EntrepriseRattachement {
  return charge
    ? { id: charge.id ? String(charge.id) : null, nom: charge.nom ?? "", interne: charge.interne }
    : { id: null, nom: "", interne: true };
}

export function versPersonne(charge: ChargePersonne): Personne {
  return {
    id: charge.id,
    nom: charge.nom,
    prenom: charge.prenom,
    nomComplet: charge.nom_complet || `${charge.prenom} ${charge.nom}`.trim(),
    telephone: charge.telephone ?? "",
    metier: charge.metier ?? "",
    entreprise: versEntreprise(charge.entreprise),
    aUnCompte: charge.a_un_compte ?? false,
    estActive: charge.est_actif ?? true,
  };
}

function versChargePersonne(saisie: Partial<SaisiePersonne>) {
  const charge: Record<string, unknown> = {};
  if (saisie.nom !== undefined) charge.nom = saisie.nom.trim();
  if (saisie.prenom !== undefined) charge.prenom = saisie.prenom.trim();
  if (saisie.telephone !== undefined) charge.telephone = saisie.telephone;
  if (saisie.metier !== undefined) charge.metier = saisie.metier.trim();
  if (saisie.entreprisePartenaireId !== undefined) charge.entreprise_partenaire_id = saisie.entreprisePartenaireId;
  return charge;
}

export async function listerPersonnes(filtres: FiltresRegistre = {}, signal?: AbortSignal): Promise<Personne[]> {
  const charge = await api.lire<ChargePersonne[] | ChargeListePaginee<ChargePersonne>>(
    "/main-oeuvre/",
    {
      recherche: filtres.recherche || undefined,
      entreprise: filtres.entreprise || undefined,
      inactives: filtres.inactives || undefined,
    },
    signal,
  );
  return aPlat(charge).map(versPersonne);
}

export async function creerPersonne(saisie: SaisiePersonne): Promise<Personne> {
  return versPersonne(await api.creer<ChargePersonne>("/main-oeuvre/", versChargePersonne(saisie)));
}

export async function modifierPersonne(
  personneId: string,
  modification: Partial<SaisiePersonne> & { estActive?: boolean },
): Promise<Personne> {
  const charge = versChargePersonne(modification);
  if (modification.estActive !== undefined) charge.est_actif = modification.estActive;
  return versPersonne(await api.modifier<ChargePersonne>(`/main-oeuvre/${personneId}/`, charge));
}

/** Désactivée si elle a déjà fait partie d'une équipe, supprimée sinon (règle du serveur). */
export async function retirerPersonne(personneId: string): Promise<void> {
  await api.supprimer(`/main-oeuvre/${personneId}/`);
}
