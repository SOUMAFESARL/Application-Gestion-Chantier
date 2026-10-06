/**
 * L'accès aux données du stock de chantier (F9) — couche 4.
 *
 * Même contrat que les autres adaptateurs : les charges utiles sont privées,
 * rien au-dessus ne connaît la forme HTTP.
 *
 * **Les routes ne sont pas encore fournies.** Celles-ci sont proposées au
 * backend (`backend/apps/stocks/`), d'après le modèle de données du cahier
 * F9 v1.2 §8 :
 *
 * - `GET   /stocks/etat/` — référentiel, lots, DA, BC, livraisons,
 *   mouvements, transferts, inventaires et seuils des chantiers du compte ;
 * - `POST  /stocks/demandes/`, `PATCH /stocks/demandes/{id}/` (422 hors
 *   EN_ATTENTE), `POST /stocks/demandes/{id}/annuler/` ;
 * - `POST  /stocks/commandes/` (403 hors DO/DG), `…/{id}/transmettre/`,
 *   `…/{id}/annuler/`, `…/{id}/cloturer/` (DA résiduelle) ;
 * - `POST  /stocks/livraisons/` (multipart : photos, BL), `…/{id}/justificatif/`
 *   (multipart, hash SHA-256 serveur), `…/{id}/valider/`, `…/{id}/rejeter/` ;
 * - `POST  /stocks/mouvements/` (jamais de PATCH ni de DELETE), `POST
 *   /stocks/transferts/` (multipart) ;
 * - `POST  /stocks/inventaires/`, `PATCH /stocks/inventaires/{id}/`,
 *   `POST …/{id}/valider/` ;
 * - `PUT   /stocks/seuils/`, `POST /stocks/materiaux/`, `PATCH /stocks/materiaux/{id}/`.
 *
 * Tant que Django ne les sert pas, `STOCK_SIMULE` aiguille vers
 * `simulationStock`. Les noms de champs sont **à confirmer** : c'est ici, et
 * seulement ici, qu'il faudra les corriger.
 */

import { api } from "@/lib/api";
import { routesSimulees } from "@/lib/api/simulation";

import { simulationStock } from "./simulationStock";
import type {
  BonCommande,
  CategorieArticle,
  DecisionValidation,
  DemandeAppro,
  DonneesStock,
  Justificatif,
  Livraison,
  Materiau,
  MouvementStock,
  NatureArticle,
  Personne,
  SaisieCommande,
  SaisieDemande,
  SaisieMateriau,
  SaisieMouvement,
  SaisieReception,
  SaisieTransfert,
  SessionInventaire,
  SeuilLot,
  SourceMouvement,
  StatutCommande,
  StatutDemande,
  StatutInventaire,
  StatutLivraison,
  Transfert,
  TypeMouvement,
} from "./types";

export const STOCK_SIMULE = routesSimulees(false);

/* ------------------------------------------------------------------ *
 * Les charges utiles du serveur.
 * ------------------------------------------------------------------ */

interface ChargePersonne {
  id: string;
  nom_complet: string;
}

interface ChargeMotive {
  motif: string;
  par: ChargePersonne;
  le: string;
}

interface ChargeMateriau {
  id: string;
  code: string;
  designation: string;
  categorie: CategorieArticle;
  nature: NatureArticle;
  unite: string;
  seuil_defaut: number;
  actif: boolean;
}

interface ChargeDemande {
  id: string;
  reference: string;
  projet_id: string;
  lot_id: string;
  emetteur: ChargePersonne;
  emise_le: string;
  date_souhaitee: string;
  observation: string;
  statut: StatutDemande;
  lignes: { materiau_id: string; quantite_demandee: number; quantite_commandee: number }[];
  modifications: { le: string; par: ChargePersonne; champs: DemandeAppro["modifications"][number]["champs"] }[];
  annulation: ChargeMotive | null;
  residuelle_de: string | null;
}

interface ChargeCommande {
  id: string;
  reference: string;
  origine: BonCommande["origine"];
  demande_id: string | null;
  demande_reference: string | null;
  projet_id: string;
  lot_id: string;
  fournisseur: string;
  emetteur: ChargePersonne;
  emis_le: string;
  date_livraison_prevue: string;
  statut: StatutCommande;
  lignes: { materiau_id: string; quantite_commandee: number; quantite_livree: number }[];
  transmis_le: string | null;
  annulation: ChargeMotive | null;
  cloture: (ChargeMotive & { demande_residuelle: string }) | null;
}

interface ChargeJustificatif {
  nom: string;
  taille: number;
  type: string;
  hash_sha256: string;
  depose_le: string;
  depose_par: ChargePersonne;
  url: string | null;
}

interface ChargeValidation {
  par: ChargePersonne;
  le: string;
  commentaire: string;
}

interface ChargeLivraison {
  id: string;
  reference: string;
  bon_commande_id: string;
  bon_commande_reference: string;
  projet_id: string;
  lot_id: string;
  nature: NatureArticle;
  magasinier: ChargePersonne;
  recue_le: string;
  observation: string;
  photos: { nom: string; url: string }[];
  validation_ct: ChargeValidation | null;
  validation_cp: ChargeValidation | null;
  flag_workflow_valide: boolean;
  justificatif: ChargeJustificatif | null;
  numero_brv: string | null;
  statut: StatutLivraison;
  lignes: {
    materiau_id: string;
    qte_attendue: number;
    qte_recue: number;
    qte_validee: number | null;
    conforme: boolean;
    motif: string;
  }[];
  rejet: (ChargeMotive & { bon_retour: string }) | null;
  saisie_hors_ligne: boolean;
}

interface ChargeMouvement {
  id: string;
  projet_id: string;
  lot_id: string;
  materiau_id: string;
  type: TypeMouvement;
  source: SourceMouvement;
  quantite: number;
  reference: string;
  auteur: ChargePersonne;
  horodatage: string;
  motif: string | null;
  corrige: string | null;
}

interface ChargeTransfert {
  id: string;
  reference: string;
  portee: Transfert["portee"];
  materiau_id: string;
  quantite: number;
  source: { projet_id: string; lot_id: string };
  destination: { projet_id: string; lot_id: string };
  auteur: ChargePersonne;
  le: string;
  motif: string;
  justificatif: ChargeJustificatif;
}

interface ChargeInventaire {
  id: string;
  reference: string;
  projet_id: string;
  lot_id: string;
  magasinier: ChargePersonne;
  ouverte_le: string;
  soumise_le: string | null;
  statut: StatutInventaire;
  valideur_cp: ChargeValidation | null;
  lignes: { materiau_id: string; stock_theorique: number; stock_compte: number | null }[];
}

interface ChargeSeuil {
  projet_id: string;
  lot_id: string;
  materiau_id: string;
  seuil: number;
  regle_par: ChargePersonne;
  regle_le: string;
}

interface ChargeEtat {
  lu_le: string;
  materiaux: ChargeMateriau[];
  lots: { id: string; code: string; nom: string; projet_id: string; projet_nom: string }[];
  demandes: ChargeDemande[];
  commandes: ChargeCommande[];
  livraisons: ChargeLivraison[];
  mouvements: ChargeMouvement[];
  transferts: ChargeTransfert[];
  inventaires: ChargeInventaire[];
  seuils: ChargeSeuil[];
}

/* ------------------------------------------------------------------ *
 * Serveur → domaine.
 * ------------------------------------------------------------------ */

function versPersonne(charge: ChargePersonne): Personne {
  return { id: charge.id, nom: charge.nom_complet };
}

function versMotive(charge: ChargeMotive | null) {
  return charge ? { motif: charge.motif, par: versPersonne(charge.par), le: charge.le } : null;
}

function versValidation(charge: ChargeValidation | null) {
  return charge ? { par: versPersonne(charge.par), le: charge.le, commentaire: charge.commentaire } : null;
}

function versJustificatif(charge: ChargeJustificatif): Justificatif {
  return {
    nom: charge.nom,
    taille: charge.taille,
    type: charge.type,
    hash: charge.hash_sha256,
    deposeLe: charge.depose_le,
    deposePar: versPersonne(charge.depose_par),
    url: charge.url,
  };
}

function versMateriau(charge: ChargeMateriau): Materiau {
  return {
    id: charge.id,
    code: charge.code,
    designation: charge.designation,
    categorie: charge.categorie,
    nature: charge.nature,
    unite: charge.unite,
    seuilDefaut: charge.seuil_defaut,
    actif: charge.actif,
  };
}

function versDemande(charge: ChargeDemande): DemandeAppro {
  return {
    id: charge.id,
    reference: charge.reference,
    projetId: charge.projet_id,
    lotId: charge.lot_id,
    emetteur: versPersonne(charge.emetteur),
    emiseLe: charge.emise_le,
    dateSouhaitee: charge.date_souhaitee,
    observation: charge.observation,
    statut: charge.statut,
    lignes: charge.lignes.map((l) => ({
      materiauId: l.materiau_id,
      quantiteDemandee: l.quantite_demandee,
      quantiteCommandee: l.quantite_commandee,
    })),
    modifications: charge.modifications.map((m) => ({ le: m.le, par: versPersonne(m.par), champs: m.champs })),
    annulation: versMotive(charge.annulation),
    residuelleDe: charge.residuelle_de,
  };
}

function versCommande(charge: ChargeCommande): BonCommande {
  return {
    id: charge.id,
    reference: charge.reference,
    origine: charge.origine,
    demandeId: charge.demande_id,
    demandeReference: charge.demande_reference,
    projetId: charge.projet_id,
    lotId: charge.lot_id,
    fournisseur: charge.fournisseur,
    emetteur: versPersonne(charge.emetteur),
    emisLe: charge.emis_le,
    dateLivraisonPrevue: charge.date_livraison_prevue,
    statut: charge.statut,
    lignes: charge.lignes.map((l) => ({
      materiauId: l.materiau_id,
      quantiteCommandee: l.quantite_commandee,
      quantiteLivree: l.quantite_livree,
    })),
    transmisLe: charge.transmis_le,
    annulation: versMotive(charge.annulation),
    cloture: charge.cloture
      ? { ...(versMotive(charge.cloture) as NonNullable<ReturnType<typeof versMotive>>), demandeResiduelle: charge.cloture.demande_residuelle }
      : null,
  };
}

function versLivraison(charge: ChargeLivraison): Livraison {
  return {
    id: charge.id,
    reference: charge.reference,
    bonCommandeId: charge.bon_commande_id,
    bonCommandeReference: charge.bon_commande_reference,
    projetId: charge.projet_id,
    lotId: charge.lot_id,
    nature: charge.nature,
    magasinier: versPersonne(charge.magasinier),
    recueLe: charge.recue_le,
    observation: charge.observation,
    photos: charge.photos,
    validationCT: versValidation(charge.validation_ct),
    validationCP: versValidation(charge.validation_cp),
    workflowValide: charge.flag_workflow_valide,
    justificatif: charge.justificatif ? versJustificatif(charge.justificatif) : null,
    numeroBrv: charge.numero_brv,
    statut: charge.statut,
    lignes: charge.lignes.map((l) => ({
      materiauId: l.materiau_id,
      quantiteAttendue: l.qte_attendue,
      quantiteRecue: l.qte_recue,
      quantiteValidee: l.qte_validee,
      conforme: l.conforme,
      motif: l.motif,
    })),
    rejet: charge.rejet
      ? { ...(versMotive(charge.rejet) as NonNullable<ReturnType<typeof versMotive>>), bonRetour: charge.rejet.bon_retour }
      : null,
    saisieHorsLigne: charge.saisie_hors_ligne,
  };
}

function versMouvement(charge: ChargeMouvement): MouvementStock {
  return {
    id: charge.id,
    projetId: charge.projet_id,
    lotId: charge.lot_id,
    materiauId: charge.materiau_id,
    type: charge.type,
    source: charge.source,
    quantite: charge.quantite,
    reference: charge.reference,
    auteur: versPersonne(charge.auteur),
    horodatage: charge.horodatage,
    motif: charge.motif,
    corrige: charge.corrige,
  };
}

function versTransfert(charge: ChargeTransfert): Transfert {
  return {
    id: charge.id,
    reference: charge.reference,
    portee: charge.portee,
    materiauId: charge.materiau_id,
    quantite: charge.quantite,
    source: { projetId: charge.source.projet_id, lotId: charge.source.lot_id },
    destination: { projetId: charge.destination.projet_id, lotId: charge.destination.lot_id },
    auteur: versPersonne(charge.auteur),
    le: charge.le,
    motif: charge.motif,
    justificatif: versJustificatif(charge.justificatif),
  };
}

function versInventaire(charge: ChargeInventaire): SessionInventaire {
  return {
    id: charge.id,
    reference: charge.reference,
    projetId: charge.projet_id,
    lotId: charge.lot_id,
    magasinier: versPersonne(charge.magasinier),
    ouverteLe: charge.ouverte_le,
    soumiseLe: charge.soumise_le,
    statut: charge.statut,
    validation: versValidation(charge.valideur_cp),
    lignes: charge.lignes.map((l) => ({
      materiauId: l.materiau_id,
      stockTheorique: l.stock_theorique,
      stockCompte: l.stock_compte,
    })),
  };
}

function versSeuil(charge: ChargeSeuil): SeuilLot {
  return {
    projetId: charge.projet_id,
    lotId: charge.lot_id,
    materiauId: charge.materiau_id,
    seuil: charge.seuil,
    reglePar: versPersonne(charge.regle_par),
    regleLe: charge.regle_le,
  };
}

/* ------------------------------------------------------------------ *
 * Domaine → serveur.
 * ------------------------------------------------------------------ */

function corpsLignes(lignes: { materiauId: string; quantite: number }[]) {
  return lignes.map((l) => ({ materiau_id: l.materiauId, quantite: l.quantite }));
}

function corpsDemande(saisie: SaisieDemande) {
  return {
    projet_id: saisie.projetId,
    lot_id: saisie.lotId,
    date_souhaitee: saisie.dateSouhaitee,
    observation: saisie.observation,
    lignes: corpsLignes(saisie.lignes),
  };
}

function corpsMateriau(saisie: SaisieMateriau) {
  return {
    code: saisie.code,
    designation: saisie.designation,
    categorie: saisie.categorie,
    nature: saisie.nature,
    unite: saisie.unite,
    seuil_defaut: saisie.seuilDefaut,
  };
}

/* ------------------------------------------------------------------ *
 * Les routes.
 * ------------------------------------------------------------------ */

export async function lireStock(signal?: AbortSignal): Promise<DonneesStock> {
  if (STOCK_SIMULE) return simulationStock.lire();
  const charge = await api.lire<ChargeEtat>("/stocks/etat/", undefined, signal);
  return {
    luLe: charge.lu_le,
    materiaux: charge.materiaux.map(versMateriau),
    lots: charge.lots.map((l) => ({ id: l.id, code: l.code, nom: l.nom, projetId: l.projet_id, projetNom: l.projet_nom })),
    demandes: charge.demandes.map(versDemande),
    commandes: charge.commandes.map(versCommande),
    livraisons: charge.livraisons.map(versLivraison),
    mouvements: charge.mouvements.map(versMouvement),
    transferts: charge.transferts.map(versTransfert),
    inventaires: charge.inventaires.map(versInventaire),
    seuils: charge.seuils.map(versSeuil),
  };
}

export async function emettreDemande(saisie: SaisieDemande): Promise<DemandeAppro> {
  if (STOCK_SIMULE) return simulationStock.emettreDemande(saisie);
  return versDemande(await api.creer<ChargeDemande>("/stocks/demandes/", corpsDemande(saisie)));
}

export async function modifierDemande(id: string, saisie: SaisieDemande): Promise<DemandeAppro> {
  if (STOCK_SIMULE) return simulationStock.modifierDemande(id, saisie);
  return versDemande(await api.modifier<ChargeDemande>(`/stocks/demandes/${id}/`, corpsDemande(saisie)));
}

export async function annulerDemande(id: string, motif: string): Promise<void> {
  if (STOCK_SIMULE) return simulationStock.annulerDemande(id, motif);
  await api.creer(`/stocks/demandes/${id}/annuler/`, { motif });
}

export async function emettreCommande(saisie: SaisieCommande): Promise<BonCommande> {
  if (STOCK_SIMULE) return simulationStock.emettreCommande(saisie);
  return versCommande(
    await api.creer<ChargeCommande>("/stocks/commandes/", {
      demande_appro_id: saisie.demandeId,
      projet_id: saisie.projetId,
      lot_id: saisie.lotId,
      fournisseur: saisie.fournisseur,
      date_livraison_prevue: saisie.dateLivraisonPrevue,
      transmettre: saisie.transmettre,
      lignes: corpsLignes(saisie.lignes),
    }),
  );
}

export async function transmettreCommande(id: string): Promise<void> {
  if (STOCK_SIMULE) return simulationStock.transmettreCommande(id);
  await api.creer(`/stocks/commandes/${id}/transmettre/`, {});
}

export async function annulerCommande(id: string, motif: string): Promise<void> {
  if (STOCK_SIMULE) return simulationStock.annulerCommande(id, motif);
  await api.creer(`/stocks/commandes/${id}/annuler/`, { motif });
}

/** Clôture d'un BC partiel — la réponse est la DA résiduelle engendrée. */
export async function cloturerCommande(id: string, motif: string): Promise<DemandeAppro> {
  if (STOCK_SIMULE) return simulationStock.cloturerCommande(id, motif);
  return versDemande(await api.creer<ChargeDemande>(`/stocks/commandes/${id}/cloturer/`, { motif }));
}

export async function receptionner(saisie: SaisieReception, photos: File[]): Promise<Livraison> {
  if (STOCK_SIMULE) return simulationStock.receptionner(saisie);
  const formulaire = new FormData();
  formulaire.append("bon_commande_id", saisie.bonCommandeId);
  formulaire.append("observation", saisie.observation);
  formulaire.append(
    "lignes",
    JSON.stringify(
      saisie.lignes.map((l) => ({ materiau_id: l.materiauId, qte_recue: l.quantiteRecue, conforme: l.conforme, motif: l.motif })),
    ),
  );
  for (const photo of photos) formulaire.append("photos", photo);
  if (saisie.justificatif) formulaire.append("fichier_justificatif", saisie.justificatif);
  return versLivraison(await api.creer<ChargeLivraison>("/stocks/livraisons/", formulaire));
}

export async function deposerJustificatif(livraisonId: string, fichier: File): Promise<Livraison> {
  if (STOCK_SIMULE) return simulationStock.deposerJustificatif(livraisonId, fichier);
  const formulaire = new FormData();
  formulaire.append("fichier_justificatif", fichier);
  return versLivraison(await api.creer<ChargeLivraison>(`/stocks/livraisons/${livraisonId}/justificatif/`, formulaire));
}

export async function validerLivraison(decision: DecisionValidation): Promise<Livraison> {
  if (STOCK_SIMULE) return simulationStock.valider(decision);
  return versLivraison(
    await api.creer<ChargeLivraison>(`/stocks/livraisons/${decision.livraisonId}/valider/`, {
      etape: decision.etape,
      commentaire: decision.commentaire,
      quantites_validees: decision.quantitesValidees ?? null,
    }),
  );
}

export async function rejeterLivraison(livraisonId: string, etape: "CT" | "CP", motif: string): Promise<Livraison> {
  if (STOCK_SIMULE) return simulationStock.rejeter(livraisonId, etape, motif);
  return versLivraison(await api.creer<ChargeLivraison>(`/stocks/livraisons/${livraisonId}/rejeter/`, { etape, motif }));
}

export async function saisirMouvement(saisie: SaisieMouvement): Promise<MouvementStock> {
  if (STOCK_SIMULE) return simulationStock.saisirMouvement(saisie);
  return versMouvement(
    await api.creer<ChargeMouvement>("/stocks/mouvements/", {
      projet_id: saisie.projetId,
      lot_id: saisie.lotId,
      materiau_id: saisie.materiauId,
      sens: saisie.sens,
      quantite: saisie.quantite,
      motif: saisie.motif,
      corrige: saisie.corrige,
    }),
  );
}

export async function transferer(saisie: SaisieTransfert): Promise<Transfert> {
  if (STOCK_SIMULE) return simulationStock.transferer(saisie);
  const formulaire = new FormData();
  formulaire.append("materiau_id", saisie.materiauId);
  formulaire.append("quantite", String(saisie.quantite));
  formulaire.append("source_lot_id", saisie.source.lotId);
  formulaire.append("destination_lot_id", saisie.destination.lotId);
  formulaire.append("motif", saisie.motif);
  formulaire.append("fichier_justificatif", saisie.justificatif);
  return versTransfert(await api.creer<ChargeTransfert>("/stocks/transferts/", formulaire));
}

export async function ouvrirInventaire(projetId: string, lotId: string): Promise<SessionInventaire> {
  if (STOCK_SIMULE) return simulationStock.ouvrirInventaire(projetId, lotId);
  return versInventaire(await api.creer<ChargeInventaire>("/stocks/inventaires/", { projet_id: projetId, lot_id: lotId }));
}

export async function enregistrerComptage(
  id: string,
  comptes: Record<string, number | null>,
  soumettre: boolean,
): Promise<SessionInventaire> {
  if (STOCK_SIMULE) return simulationStock.enregistrerComptage(id, comptes, soumettre);
  return versInventaire(
    await api.modifier<ChargeInventaire>(`/stocks/inventaires/${id}/`, {
      lignes: Object.entries(comptes).map(([materiau, compte]) => ({ materiau_id: materiau, stock_compte: compte })),
      soumettre,
    }),
  );
}

export async function validerInventaire(id: string): Promise<SessionInventaire> {
  if (STOCK_SIMULE) return simulationStock.validerInventaire(id);
  return versInventaire(await api.creer<ChargeInventaire>(`/stocks/inventaires/${id}/valider/`, {}));
}

export async function reglerSeuil(projetId: string, lotId: string, materiauId: string, seuil: number): Promise<SeuilLot> {
  if (STOCK_SIMULE) return simulationStock.reglerSeuil(projetId, lotId, materiauId, seuil);
  return versSeuil(
    await api.modifier<ChargeSeuil>("/stocks/seuils/", { projet_id: projetId, lot_id: lotId, materiau_id: materiauId, seuil }),
  );
}

export async function creerMateriau(saisie: SaisieMateriau): Promise<Materiau> {
  if (STOCK_SIMULE) return simulationStock.creerMateriau(saisie);
  return versMateriau(await api.creer<ChargeMateriau>("/stocks/materiaux/", corpsMateriau(saisie)));
}

export async function modifierMateriau(id: string, saisie: SaisieMateriau): Promise<Materiau> {
  if (STOCK_SIMULE) return simulationStock.modifierMateriau(id, saisie);
  return versMateriau(await api.modifier<ChargeMateriau>(`/stocks/materiaux/${id}/`, corpsMateriau(saisie)));
}

export async function basculerMateriau(materiau: Materiau): Promise<Materiau> {
  if (STOCK_SIMULE) return simulationStock.basculerMateriau(materiau.id);
  return versMateriau(await api.modifier<ChargeMateriau>(`/stocks/materiaux/${materiau.id}/`, { actif: !materiau.actif }));
}
