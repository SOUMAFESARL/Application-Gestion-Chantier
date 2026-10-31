/**
 * L'accès aux données du domaine Équipes — le seul fichier du domaine qui sait que le serveur
 * existe (style de `features/projets/adaptateur.ts`).
 *
 *   GET/POST       /main-oeuvre/                 le registre (lecture `projets.lire`)
 *   GET/PATCH/DEL  /main-oeuvre/{id}/            une personne (écriture `projets.main_oeuvre_gerer`)
 *   GET/POST       /projets/{id}/equipes/                             équipes du projet
 *   GET/PATCH/DEL  /projets/{id}/equipes/{equipe_id}/                 une équipe
 *   POST           /projets/{id}/equipes/{equipe_id}/membres/         ajouter un membre daté
 *   PATCH/DEL      /projets/{id}/equipes/{equipe_id}/membres/{id}/    le modifier, le faire partir
 *   POST           /projets/{id}/equipes/affectations/                poser une équipe sur une case
 *   DEL            /projets/{id}/equipes/affectations/{id}/           l'en retirer
 *
 * Lecture `projets.lire`, écriture `projets.gerer_equipes`. Les écritures rendent aussi des
 * `avertissements` (deux équipes le même jour…), qui n'empêchent rien.
 */

import { api } from "@/lib/api";

import type {
  Avertissement,
  EntrepriseRattachement,
  EquipeProjet,
  FiltresRegistre,
  FonctionMembre,
  MembreEquipe,
  Personne,
  SaisieEquipe,
  SaisieMembre,
  SaisiePersonne,
} from "./types";

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

function versEntreprise(charge: ChargeEntreprise | null | undefined): EntrepriseRattachement {
  return charge
    ? { id: charge.id ? String(charge.id) : null, nom: charge.nom ?? "", interne: charge.interne }
    : { id: null, nom: "", interne: true };
}

function versPersonne(charge: ChargePersonne): Personne {
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

/* ------------------------------------------------------------------ *
 * Équipes d'un projet.
 * ------------------------------------------------------------------ */

interface ChargeMembre {
  id: string;
  personne: ChargePersonne;
  fonction: string;
  est_chef?: boolean;
  date_arrivee?: string | null;
  date_depart?: string | null;
  en_cours?: boolean;
}

interface ChargeEquipe {
  id: string;
  projet_id: string;
  nom: string;
  corps_etat?: string;
  entreprise?: ChargeEntreprise;
  nature?: string;
  chef?: ChargeMembre | null;
  effectif?: number;
  membres?: ChargeMembre[];
  affectations?: { id: string; equipe_id: string; element: { id: string; libelle: string; niveau: string } }[];
  est_actif?: boolean;
  avertissements?: Avertissement[];
}

function versMembre(charge: ChargeMembre): MembreEquipe {
  return {
    id: charge.id,
    personne: versPersonne(charge.personne),
    fonction: charge.fonction as FonctionMembre,
    estChef: charge.est_chef ?? false,
    dateArrivee: charge.date_arrivee ?? null,
    dateDepart: charge.date_depart ?? null,
    enCours: charge.en_cours ?? charge.date_depart === null,
  };
}

function versEquipe(charge: ChargeEquipe): EquipeProjet {
  return {
    id: charge.id,
    projetId: charge.projet_id,
    nom: charge.nom,
    corpsEtat: charge.corps_etat ?? "",
    entreprise: versEntreprise(charge.entreprise),
    nature: charge.nature ?? "",
    chef: charge.chef ? versMembre(charge.chef) : null,
    effectif: charge.effectif ?? 0,
    membres: (charge.membres ?? []).map(versMembre),
    cases: (charge.affectations ?? []).map((a) => ({
      affectationId: a.id,
      caseId: String(a.element.id),
      libelle: a.element.libelle,
      niveau: a.element.niveau,
    })),
    estActive: charge.est_actif ?? true,
  };
}

/** Une écriture et ce que le serveur en signale. */
export interface AvecAvertissements<T> {
  resultat: T;
  avertissements: Avertissement[];
}

function avecAvertissements<C extends { avertissements?: Avertissement[] }, T>(
  charge: C,
  traduire: (charge: C) => T,
): AvecAvertissements<T> {
  return { resultat: traduire(charge), avertissements: charge.avertissements ?? [] };
}

/** Les équipes du projet ; `historique` garde les membres partis. */
export async function listerEquipesProjet(
  projetId: string,
  signal?: AbortSignal,
  historique = false,
): Promise<EquipeProjet[]> {
  const charge = await api.lire<ChargeEquipe[] | ChargeListePaginee<ChargeEquipe>>(
    `/projets/${projetId}/equipes/`,
    historique ? { historique: true } : undefined,
    signal,
  );
  return aPlat(charge).map(versEquipe);
}

/** Une équipe, membres partis compris. */
export async function lireEquipe(projetId: string, equipeId: string, signal?: AbortSignal): Promise<EquipeProjet> {
  return versEquipe(await api.lire<ChargeEquipe>(`/projets/${projetId}/equipes/${equipeId}/`, undefined, signal));
}

function versChargeEquipe(saisie: Partial<SaisieEquipe>) {
  const charge: Record<string, unknown> = {};
  if (saisie.nom !== undefined) charge.nom = saisie.nom.trim();
  if (saisie.corpsEtat !== undefined) charge.corps_etat = saisie.corpsEtat.trim();
  if (saisie.entreprisePartenaireId !== undefined) charge.entreprise_partenaire_id = saisie.entreprisePartenaireId;
  return charge;
}

export async function creerEquipeProjet(
  projetId: string,
  saisie: SaisieEquipe,
): Promise<AvecAvertissements<EquipeProjet>> {
  return avecAvertissements(
    await api.creer<ChargeEquipe>(`/projets/${projetId}/equipes/`, versChargeEquipe(saisie)),
    versEquipe,
  );
}

export async function modifierEquipeProjet(
  projetId: string,
  equipeId: string,
  modification: Partial<SaisieEquipe> & { estActive?: boolean },
): Promise<AvecAvertissements<EquipeProjet>> {
  const charge = versChargeEquipe(modification);
  if (modification.estActive !== undefined) charge.est_actif = modification.estActive;
  return avecAvertissements(
    await api.modifier<ChargeEquipe>(`/projets/${projetId}/equipes/${equipeId}/`, charge),
    versEquipe,
  );
}

export async function supprimerEquipeProjet(projetId: string, equipeId: string): Promise<void> {
  await api.supprimer(`/projets/${projetId}/equipes/${equipeId}/`);
}

export async function ajouterMembre(
  projetId: string,
  equipeId: string,
  saisie: SaisieMembre,
): Promise<AvecAvertissements<MembreEquipe>> {
  return avecAvertissements(
    await api.creer<ChargeMembre & { avertissements?: Avertissement[] }>(
      `/projets/${projetId}/equipes/${equipeId}/membres/`,
      {
        personne_id: saisie.personneId,
        fonction: saisie.fonction,
        est_chef: saisie.estChef,
        date_arrivee: saisie.dateArrivee,
        date_depart: saisie.dateDepart ?? null,
      },
    ),
    versMembre,
  );
}

export async function modifierMembre(
  projetId: string,
  equipeId: string,
  membreId: string,
  modification: Partial<Omit<SaisieMembre, "personneId">>,
): Promise<AvecAvertissements<MembreEquipe>> {
  const charge: Record<string, unknown> = {};
  if (modification.fonction !== undefined) charge.fonction = modification.fonction;
  if (modification.estChef !== undefined) charge.est_chef = modification.estChef;
  if (modification.dateArrivee !== undefined) charge.date_arrivee = modification.dateArrivee;
  if (modification.dateDepart !== undefined) charge.date_depart = modification.dateDepart;
  return avecAvertissements(
    await api.modifier<ChargeMembre & { avertissements?: Avertissement[] }>(
      `/projets/${projetId}/equipes/${equipeId}/membres/${membreId}/`,
      charge,
    ),
    versMembre,
  );
}

/**
 * Faire partir un membre à une date (il reste dans l'historique), ou le supprimer s'il a été
 * ajouté par erreur (`supprimer`).
 */
export async function retirerMembre(
  projetId: string,
  equipeId: string,
  membreId: string,
  options: { dateDepart?: string | null; supprimer?: boolean },
): Promise<void> {
  const parametres = new URLSearchParams();
  if (options.dateDepart) parametres.set("date_depart", options.dateDepart);
  if (options.supprimer) parametres.set("supprimer", "true");
  const suffixe = parametres.toString();
  await api.supprimer(
    `/projets/${projetId}/equipes/${equipeId}/membres/${membreId}/${suffixe ? `?${suffixe}` : ""}`,
  );
}

/** Poser une équipe sur une case : ses descendants en héritent, sauf affectation plus précise. */
export async function affecterEquipeCase(
  projetId: string,
  equipeId: string,
  caseId: string,
): Promise<Avertissement[]> {
  const charge = await api.creer<{ avertissements?: Avertissement[] }>(`/projets/${projetId}/equipes/affectations/`, {
    equipe_id: equipeId,
    element_id: caseId,
  });
  return charge.avertissements ?? [];
}

export async function retirerAffectationEquipe(projetId: string, affectationId: string): Promise<void> {
  await api.supprimer(`/projets/${projetId}/equipes/affectations/${affectationId}/`);
}
