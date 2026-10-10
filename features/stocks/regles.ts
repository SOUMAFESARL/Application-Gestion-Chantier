/**
 * Les règles du stock de chantier — pures, sans React (F9 v1.2).
 *
 * Le serveur les applique et refuse ce qu'elles interdisent (§6.1 : « vérifié
 * côté API, jamais côté UI uniquement ») ; l'écran les lit pour ne pas
 * proposer un geste voué au refus, et pour dire **pourquoi** une livraison
 * n'est pas encore en stock.
 */

import { fonctionsSurProjet, peut } from "@/features/habilitations/regles";
import type { Droits } from "@/features/habilitations/types";
import type { Projet } from "@/features/projets/types";

import type {
  AlerteStock,
  BonCommande,
  DemandeAppro,
  DonneesStock,
  EtatStock,
  LigneInventaire,
  LigneStock,
  Livraison,
  Materiau,
  MouvementStock,
  NatureArticle,
  SessionInventaire,
  StatutCommande,
  StatutDemande,
  StatutInventaire,
  StatutLivraison,
  TypeMouvement,
} from "./types";

/* ------------------------------------------------------------------ *
 * Les constantes du cahier.
 * ------------------------------------------------------------------ */

/** Écart d'inventaire au-delà duquel CT et CP sont alertés (§5, F9-6). */
export const SEUIL_ECART_INVENTAIRE = 5;
/** Aucun inventaire depuis plus de 14 jours sur un lot actif : alerte CP (RG-STK-11). */
export const DELAI_INVENTAIRE_JOURS = 14;
/** Livraison non validée par le CT au-delà de 4 heures ouvrées (RG-STK-11). */
export const DELAI_VALIDATION_CT_HEURES = 4;
/** Équipement non validé par le CP au-delà de 24 heures (RG-STK-11). */
export const DELAI_VALIDATION_CP_HEURES = 24;
/** Photos d'une livraison (modèle de données §8). */
export const PHOTOS_MAX = 5;
/** La journée ouvrée, pour compter les « heures ouvrées ». */
const HEURE_OUVERTURE = 8;
const HEURE_FERMETURE = 17;

const HEURE = 3_600_000;
const JOUR = 24 * HEURE;

export const STATUTS_DEMANDE: readonly StatutDemande[] = [
  "EN_ATTENTE",
  "COMMANDEE_PARTIELLEMENT",
  "COMMANDEE",
  "SOLDEE",
  "ANNULEE",
];
export const STATUTS_COMMANDE: readonly StatutCommande[] = [
  "EMIS",
  "EN_ATTENTE_LIVRAISON",
  "RECU_PARTIELLEMENT",
  "LIVRE",
  "ANNULE",
];
export const STATUTS_LIVRAISON: readonly StatutLivraison[] = [
  "EN_ATTENTE_VALIDATION_CT",
  "EN_ATTENTE_VALIDATION_CP",
  "VALIDE_WORKFLOW",
  "VALIDE_AVEC_JUSTIFICATIF",
  "REJETE",
];

/* ------------------------------------------------------------------ *
 * Lectures simples.
 * ------------------------------------------------------------------ */

export function indexer<T extends { id: string }>(elements: readonly T[]): Map<string, T> {
  return new Map(elements.map((element) => [element.id, element]));
}

function cle(lotId: string, materiauId: string): string {
  return `${lotId}|${materiauId}`;
}

/** Une recherche insensible à la casse et aux accents. */
export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").trim();
}

export function correspond(recherche: string, ...champs: (string | null | undefined)[]): boolean {
  const cible = normaliser(recherche);
  if (!cible) return true;
  return champs.some((champ) => champ && normaliser(champ).includes(cible));
}

/* ------------------------------------------------------------------ *
 * Le stock — le cumul des mouvements, rien d'autre (F9-5).
 * ------------------------------------------------------------------ */

/** Le solde de chaque matériau sur chaque lot, et la date de son dernier mouvement. */
export function soldes(mouvements: readonly MouvementStock[]): Map<string, { stock: number; dernier: string }> {
  const resultat = new Map<string, { stock: number; dernier: string }>();
  for (const mouvement of mouvements) {
    const k = cle(mouvement.lotId, mouvement.materiauId);
    const courant = resultat.get(k);
    resultat.set(k, {
      stock: arrondir((courant?.stock ?? 0) + mouvement.quantite),
      dernier: !courant || mouvement.horodatage > courant.dernier ? mouvement.horodatage : courant.dernier,
    });
  }
  return resultat;
}

export function stockDuLot(mouvements: readonly MouvementStock[], lotId: string, materiauId: string): number {
  return arrondir(
    mouvements
      .filter((m) => m.lotId === lotId && m.materiauId === materiauId)
      .reduce((total, m) => total + m.quantite, 0),
  );
}

/** Trois décimales au plus : un m³ de sable se compte au litre près, pas mieux. */
export function arrondir(valeur: number): number {
  return Math.round(valeur * 1000) / 1000;
}

export function etatStock(stock: number, seuil: number): EtatStock {
  if (stock <= 0) return "RUPTURE";
  if (stock < seuil) return "ALERTE";
  return "OK";
}

/**
 * Le seuil d'un matériau sur un lot (RG-STK-09) : celui réglé pour le lot,
 * sinon celui du référentiel — **proposé**, en attendant qu'on l'accepte.
 */
export function seuilDe(donnees: DonneesStock, lotId: string, materiau: Materiau): { seuil: number; propose: boolean } {
  const regle = donnees.seuils.find((s) => s.lotId === lotId && s.materiauId === materiau.id);
  return regle ? { seuil: regle.seuil, propose: false } : { seuil: materiau.seuilDefaut, propose: true };
}

/** Une ligne par matériau suivi sur un lot : approvisionné, ou dont le seuil est réglé. */
export function lignesStock(donnees: DonneesStock): LigneStock[] {
  const materiaux = indexer(donnees.materiaux);
  const lots = indexer(donnees.lots);
  const parCle = soldes(donnees.mouvements);
  const suivis = new Set([
    ...parCle.keys(),
    ...donnees.seuils.map((s) => cle(s.lotId, s.materiauId)),
  ]);
  const lignes: LigneStock[] = [];
  for (const k of suivis) {
    const [lotId, materiauId] = k.split("|");
    const materiau = materiaux.get(materiauId);
    const lot = lots.get(lotId);
    if (!materiau || !lot) continue;
    const solde = parCle.get(k);
    const stock = solde?.stock ?? 0;
    const { seuil, propose } = seuilDe(donnees, lotId, materiau);
    lignes.push({
      projetId: lot.projetId,
      lotId,
      materiau,
      stock,
      seuil,
      seuilPropose: propose,
      etat: etatStock(stock, seuil),
      dernierMouvement: solde?.dernier ?? null,
    });
  }
  const rang: Record<EtatStock, number> = { RUPTURE: 0, ALERTE: 1, OK: 2 };
  return lignes.sort(
    (a, b) =>
      rang[a.etat] - rang[b.etat] ||
      a.projetId.localeCompare(b.projetId) ||
      a.lotId.localeCompare(b.lotId) ||
      a.materiau.designation.localeCompare(b.materiau.designation, "fr"),
  );
}

/**
 * Ce que le chef de chantier peut déclarer consommé dans son rapport (F9 → F2,
 * RG-STK-02) : les matériaux entrés en stock par un BRV complet — validé ET
 * justifié — sur un lot du chantier, avec le stock qui en reste.
 */
export function consommablesDuChantier(
  donnees: DonneesStock,
  projetId: string,
): { materiau: Materiau; stock: number; seuil: number }[] {
  const brvComplets = new Set(
    donnees.livraisons
      .filter((l) => l.projetId === projetId && l.statut === "VALIDE_AVEC_JUSTIFICATIF" && l.numeroBrv)
      .map((l) => l.numeroBrv as string),
  );
  const entres = new Set(
    donnees.mouvements
      .filter((m) => m.projetId === projetId && m.source === "BRV" && brvComplets.has(m.reference))
      .map((m) => m.materiauId),
  );
  const lignes = lignesStock(donnees).filter((l) => l.projetId === projetId && entres.has(l.materiau.id));
  const parMateriau = new Map<string, { materiau: Materiau; stock: number; seuil: number }>();
  for (const ligne of lignes) {
    const courant = parMateriau.get(ligne.materiau.id);
    parMateriau.set(ligne.materiau.id, {
      materiau: ligne.materiau,
      stock: arrondir((courant?.stock ?? 0) + ligne.stock),
      seuil: (courant?.seuil ?? 0) + ligne.seuil,
    });
  }
  return [...parMateriau.values()].filter((l) => l.materiau.nature === "MATERIAU");
}

/* ------------------------------------------------------------------ *
 * La demande d'approvisionnement (F9-2).
 * ------------------------------------------------------------------ */

/** RG-STK-08 : modifiable au statut EN_ATTENTE seulement — le premier BC la verrouille. */
export function demandeModifiable(demande: DemandeAppro): boolean {
  return demande.statut === "EN_ATTENTE";
}

/** La direction « ne donne pas suite » — tant qu'aucun BC n'en est issu. */
export function demandeAnnulable(demande: DemandeAppro): boolean {
  return demande.statut === "EN_ATTENTE";
}

/** Une DA dont il reste à commander : la file de la direction (F9-US-05). */
export function demandeACommander(demande: DemandeAppro): boolean {
  return demande.statut === "EN_ATTENTE" || demande.statut === "COMMANDEE_PARTIELLEMENT";
}

/** Le reste à commander de chaque ligne. */
export function resteACommander(demande: DemandeAppro): { materiauId: string; quantite: number }[] {
  return demande.lignes
    .map((l) => ({ materiauId: l.materiauId, quantite: arrondir(l.quantiteDemandee - l.quantiteCommandee) }))
    .filter((l) => l.quantite > 0);
}

/**
 * Le statut d'une DA, recalculé après chaque BC (§4.1). Soldée quand tout est
 * commandé et que chaque BC qui en est issu est livré ou clôturé.
 */
export function statutDemande(demande: DemandeAppro, commandes: readonly BonCommande[]): StatutDemande {
  if (demande.annulation) return "ANNULEE";
  const commandees = demande.lignes.filter((l) => l.quantiteCommandee > 0).length;
  if (commandees === 0) return "EN_ATTENTE";
  if (resteACommander(demande).length > 0) return "COMMANDEE_PARTIELLEMENT";
  const issus = commandes.filter((c) => c.demandeId === demande.id && c.statut !== "ANNULE");
  const termines = issus.every((c) => c.statut === "LIVRE" || c.cloture !== null);
  return issus.length > 0 && termines ? "SOLDEE" : "COMMANDEE";
}

/* ------------------------------------------------------------------ *
 * Le bon de commande (F9-3).
 * ------------------------------------------------------------------ */

export function statutCommande(commande: BonCommande): StatutCommande {
  if (commande.annulation) return "ANNULE";
  const livre = commande.lignes.some((l) => l.quantiteLivree > 0);
  const complet = commande.lignes.every((l) => l.quantiteLivree >= l.quantiteCommandee);
  if (livre && complet) return "LIVRE";
  if (livre) return "RECU_PARTIELLEMENT";
  return commande.transmisLe ? "EN_ATTENTE_LIVRAISON" : "EMIS";
}

/** Livraisons qui comptent encore : ni rejetées, ni annulées. */
function livraisonsActives(commande: BonCommande, livraisons: readonly Livraison[]): Livraison[] {
  return livraisons.filter((l) => l.bonCommandeId === commande.id && l.statut !== "REJETE");
}

/**
 * Ce qu'il reste à recevoir de chaque ligne : commandé, moins ce qui est entré
 * en stock, moins ce qui attend sa validation — sans quoi deux réceptions du
 * même camion passeraient.
 */
export function resteALivrer(
  commande: BonCommande,
  livraisons: readonly Livraison[],
): { materiauId: string; quantite: number }[] {
  const enCours = new Map<string, number>();
  for (const livraison of livraisonsActives(commande, livraisons)) {
    if (livraison.numeroBrv) continue; // déjà compté dans `quantiteLivree`
    for (const ligne of livraison.lignes) {
      const retenue = ligne.quantiteValidee ?? ligne.quantiteRecue;
      enCours.set(ligne.materiauId, (enCours.get(ligne.materiauId) ?? 0) + retenue);
    }
  }
  return commande.lignes.map((l) => ({
    materiauId: l.materiauId,
    quantite: Math.max(0, arrondir(l.quantiteCommandee - l.quantiteLivree - (enCours.get(l.materiauId) ?? 0))),
  }));
}

/** Le camion peut être reçu : BC transmis, ni annulé, ni clôturé, avec un reste. */
export function commandeReceptionnable(commande: BonCommande, livraisons: readonly Livraison[]): boolean {
  return (
    (commande.statut === "EN_ATTENTE_LIVRAISON" || commande.statut === "RECU_PARTIELLEMENT") &&
    commande.cloture === null &&
    resteALivrer(commande, livraisons).some((l) => l.quantite > 0)
  );
}

/** Annulable par DO/DG « avant toute réception » (§4.2). */
export function commandeAnnulable(commande: BonCommande, livraisons: readonly Livraison[]): boolean {
  return (
    (commande.statut === "EMIS" || commande.statut === "EN_ATTENTE_LIVRAISON") &&
    livraisonsActives(commande, livraisons).length === 0
  );
}

export function commandeTransmissible(commande: BonCommande): boolean {
  return commande.statut === "EMIS";
}

/**
 * Clôture manuelle d'un BC partiellement livré (RG-STK-07) — rien ne doit
 * attendre de validation, sinon le reliquat serait faux.
 */
export function commandeCloturable(commande: BonCommande, livraisons: readonly Livraison[]): boolean {
  return (
    commande.statut === "RECU_PARTIELLEMENT" &&
    commande.cloture === null &&
    livraisonsActives(commande, livraisons).every((l) => l.numeroBrv !== null)
  );
}

/** Le reliquat d'un BC : ce que la DA résiduelle redemandera. */
export function reliquat(commande: BonCommande): { materiauId: string; quantite: number }[] {
  return commande.lignes
    .map((l) => ({ materiauId: l.materiauId, quantite: arrondir(l.quantiteCommandee - l.quantiteLivree) }))
    .filter((l) => l.quantite > 0);
}

/* ------------------------------------------------------------------ *
 * La réception et le BRV (F9-4).
 * ------------------------------------------------------------------ */

/** Un seul équipement suffit : la livraison passe par le circuit à deux niveaux. */
export function natureDesLignes(materiauIds: readonly string[], materiaux: Map<string, Materiau>): NatureArticle {
  return materiauIds.some((id) => materiaux.get(id)?.nature === "EQUIPEMENT") ? "EQUIPEMENT" : "MATERIAU";
}

/**
 * RG-STK-01 — l'entrée en stock exige **deux** conditions indépendantes et
 * cumulatives : le circuit de validation est allé au bout, et le BL signé est
 * déposé. L'une sans l'autre ne fait rien entrer.
 */
export function entreeAutorisee(livraison: Pick<Livraison, "workflowValide" | "justificatif" | "rejet">): boolean {
  return livraison.rejet === null && livraison.workflowValide && livraison.justificatif !== null;
}

/** Le circuit est-il allé au bout ? CT pour un matériau ; CT puis CP pour un équipement (RG-STK-04). */
export function workflowComplet(livraison: Pick<Livraison, "nature" | "validationCT" | "validationCP">): boolean {
  if (!livraison.validationCT) return false;
  return livraison.nature === "MATERIAU" || livraison.validationCP !== null;
}

/** Le statut d'une livraison, déduit de ses deux drapeaux (§4.3). */
export function statutLivraison(
  livraison: Pick<Livraison, "nature" | "validationCT" | "validationCP" | "justificatif" | "rejet">,
): StatutLivraison {
  if (livraison.rejet) return "REJETE";
  if (!livraison.validationCT) return "EN_ATTENTE_VALIDATION_CT";
  if (livraison.nature === "EQUIPEMENT" && !livraison.validationCP) return "EN_ATTENTE_VALIDATION_CP";
  return livraison.justificatif ? "VALIDE_AVEC_JUSTIFICATIF" : "VALIDE_WORKFLOW";
}

/** L'étape de validation attendue, ou `null` si le circuit est clos. */
export function etapeAttendue(livraison: Livraison): "CT" | "CP" | null {
  if (livraison.statut === "EN_ATTENTE_VALIDATION_CT") return "CT";
  if (livraison.statut === "EN_ATTENTE_VALIDATION_CP") return "CP";
  return null;
}

/** Le BL signé manque encore — la livraison ne peut pas entrer en stock. */
export function justificatifManquant(livraison: Livraison): boolean {
  return livraison.statut !== "REJETE" && livraison.justificatif === null;
}

/**
 * Les heures ouvrées écoulées entre deux instants — du lundi au vendredi, de
 * 8 h à 17 h, à l'heure du poste.
 */
export function heuresOuvrees(debut: Date, fin: Date): number {
  if (fin <= debut) return 0;
  let total = 0;
  const jour = new Date(debut);
  jour.setHours(0, 0, 0, 0);
  // Deux mois suffisent : au-delà, l'alerte est levée depuis longtemps.
  for (let i = 0; i < 62 && jour < fin; i += 1) {
    const semaine = jour.getDay();
    if (semaine !== 0 && semaine !== 6) {
      const ouverture = new Date(jour);
      ouverture.setHours(HEURE_OUVERTURE, 0, 0, 0);
      const fermeture = new Date(jour);
      fermeture.setHours(HEURE_FERMETURE, 0, 0, 0);
      const de = Math.max(ouverture.getTime(), debut.getTime());
      const a = Math.min(fermeture.getTime(), fin.getTime());
      if (a > de) total += (a - de) / HEURE;
    }
    jour.setDate(jour.getDate() + 1);
  }
  return Math.round(total * 10) / 10;
}

/* ------------------------------------------------------------------ *
 * L'inventaire (F9-6).
 * ------------------------------------------------------------------ */

/** L'écart compté − théorique, et sa part du théorique. `null` tant que rien n'est compté. */
export function ecartLigne(ligne: LigneInventaire): { ecart: number; pourcent: number } | null {
  if (ligne.stockCompte === null) return null;
  const ecart = arrondir(ligne.stockCompte - ligne.stockTheorique);
  const base = Math.abs(ligne.stockTheorique);
  const pourcent = base === 0 ? (ecart === 0 ? 0 : 100) : Math.round((Math.abs(ecart) / base) * 1000) / 10;
  return { ecart, pourcent };
}

export function ecartHorsSeuil(ligne: LigneInventaire): boolean {
  const e = ecartLigne(ligne);
  return e !== null && e.pourcent > SEUIL_ECART_INVENTAIRE;
}

export function inventaireComplet(session: SessionInventaire): boolean {
  return session.lignes.length > 0 && session.lignes.every((l) => l.stockCompte !== null);
}

/** Le dernier inventaire validé d'un lot. */
export function dernierInventaire(inventaires: readonly SessionInventaire[], lotId: string): SessionInventaire | null {
  return (
    inventaires
      .filter((s) => s.lotId === lotId && s.statut === "VALIDE")
      .sort((a, b) => (b.validation?.le ?? "").localeCompare(a.validation?.le ?? ""))[0] ?? null
  );
}

/* ------------------------------------------------------------------ *
 * Les alertes (RG-STK-11).
 * ------------------------------------------------------------------ */

/**
 * Les alertes que Celery Beat poussera, calculées ici à la lecture. Le
 * serveur les enverra (push CT + CP) ; l'écran les montre à qui ouvre le stock.
 */
export function alertesStock(donnees: DonneesStock): AlerteStock[] {
  const maintenant = new Date(donnees.luLe);
  const materiaux = indexer(donnees.materiaux);
  const alertes: AlerteStock[] = [];

  for (const ligne of lignesStock(donnees)) {
    if (ligne.etat === "OK") continue;
    alertes.push({
      type: "STOCK_SOUS_SEUIL",
      critique: ligne.etat === "RUPTURE",
      projetId: ligne.projetId,
      lotId: ligne.lotId,
      objet: ligne.materiau.designation,
      valeur: ligne.stock,
    });
  }

  for (const livraison of donnees.livraisons) {
    if (livraison.statut === "EN_ATTENTE_VALIDATION_CT") {
      const heures = heuresOuvrees(new Date(livraison.recueLe), maintenant);
      if (heures > DELAI_VALIDATION_CT_HEURES) {
        alertes.push({
          type: "VALIDATION_CT_EN_RETARD",
          critique: heures > 2 * DELAI_VALIDATION_CT_HEURES,
          projetId: livraison.projetId,
          lotId: livraison.lotId,
          objet: livraison.reference,
          valeur: Math.floor(heures),
        });
      }
    }
    if (livraison.statut === "EN_ATTENTE_VALIDATION_CP" && livraison.validationCT) {
      const heures = (maintenant.getTime() - Date.parse(livraison.validationCT.le)) / HEURE;
      if (heures > DELAI_VALIDATION_CP_HEURES) {
        alertes.push({
          type: "VALIDATION_CP_EN_RETARD",
          critique: heures > 2 * DELAI_VALIDATION_CP_HEURES,
          projetId: livraison.projetId,
          lotId: livraison.lotId,
          objet: livraison.reference,
          valeur: Math.floor(heures),
        });
      }
    }
  }

  for (const session of donnees.inventaires) {
    if (session.statut !== "SOUMIS") continue;
    for (const ligne of session.lignes.filter(ecartHorsSeuil)) {
      alertes.push({
        type: "ECART_INVENTAIRE",
        critique: (ecartLigne(ligne)?.pourcent ?? 0) > 2 * SEUIL_ECART_INVENTAIRE,
        projetId: session.projetId,
        lotId: session.lotId,
        objet: materiaux.get(ligne.materiauId)?.designation ?? session.reference,
        valeur: ecartLigne(ligne)?.pourcent ?? 0,
      });
    }
  }

  // Un lot « actif » : il a du stock, ou un mouvement dans la période.
  const actifs = new Set(donnees.mouvements.map((m) => m.lotId));
  for (const lot of donnees.lots.filter((l) => actifs.has(l.id))) {
    const dernier = dernierInventaire(donnees.inventaires, lot.id);
    const depuis = dernier?.validation?.le ?? premierMouvement(donnees.mouvements, lot.id);
    if (!depuis) continue;
    const jours = Math.floor((maintenant.getTime() - Date.parse(depuis)) / JOUR);
    if (jours > DELAI_INVENTAIRE_JOURS) {
      alertes.push({
        type: "INVENTAIRE_EN_RETARD",
        critique: false,
        projetId: lot.projetId,
        lotId: lot.id,
        objet: lot.nom,
        valeur: jours,
      });
    }
  }

  return alertes.sort((a, b) => Number(b.critique) - Number(a.critique));
}

function premierMouvement(mouvements: readonly MouvementStock[], lotId: string): string | null {
  return mouvements.filter((m) => m.lotId === lotId).map((m) => m.horodatage).sort()[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Qui fait quoi (§3.2).
 * ------------------------------------------------------------------ */

/**
 * Les gestes du stock. La matrice du cahier nomme des rôles (CP, CT,
 * magasinier, DO, DG) ; le produit, lui, ne connaît que des **accès de
 * module** paramétrables et la **fonction** tenue sur le chantier. La
 * traduction (docs/PLAN_F9_STOCK.md §2) :
 *
 * - `achats` porte la DA (saisie) et le BC (validation) ;
 * - `stocks` porte le terrain (saisie) et sa validation ;
 * - la **fonction** sur le chantier départage les deux niveaux de
 *   validation : le conducteur de travaux valide d'abord, le chef de projet
 *   ensuite ;
 * - le magasinier **saisit**, l'encadrement **valide** : la réception et
 *   l'inventaire ne sont pas proposés à qui les validera ;
 * - la direction commande, elle ne saisit pas le terrain.
 */
export interface GestesStock {
  voirDemandes: boolean;
  emettreDemande: boolean;
  emettreCommande: boolean;
  cloturerCommande: boolean;
  saisirReception: boolean;
  deposerJustificatif: boolean;
  validerCT: boolean;
  validerCP: boolean;
  mouvementManuel: boolean;
  transfertInterLots: boolean;
  transfertInterChantiers: boolean;
  realiserInventaire: boolean;
  validerInventaire: boolean;
  reglerSeuil: boolean;
  gererReferentiel: boolean;
}

export const AUCUN_GESTE: GestesStock = {
  voirDemandes: false,
  emettreDemande: false,
  emettreCommande: false,
  cloturerCommande: false,
  saisirReception: false,
  deposerJustificatif: false,
  validerCT: false,
  validerCP: false,
  mouvementManuel: false,
  transfertInterLots: false,
  transfertInterChantiers: false,
  realiserInventaire: false,
  validerInventaire: false,
  reglerSeuil: false,
  gererReferentiel: false,
};

/** Les gestes du compte sur un chantier. */
export function gestesStock(droits: Droits | null, projet: Projet): GestesStock {
  if (!droits) return AUCUN_GESTE;
  const direction = droits.estDirection;
  const fonctions = fonctionsSurProjet(projet, droits);
  const conducteur = fonctions.includes("CONDUCTEUR_TRAVAUX");
  const chefProjet = fonctions.includes("CHEF_PROJET");
  const saisieAchats = !direction && peut(droits, "achats", "saisie");
  const saisieStock = !direction && peut(droits, "stocks", "saisie");
  const validationStock = peut(droits, "stocks", "validation");
  const magasinier = saisieStock && !conducteur && !chefProjet;

  return {
    voirDemandes: peut(droits, "achats", "saisie") || peut(droits, "achats", "validation"),
    emettreDemande: saisieAchats,
    emettreCommande: peut(droits, "achats", "validation"),
    cloturerCommande: saisieAchats,
    saisirReception: magasinier,
    deposerJustificatif: saisieStock,
    validerCT: validationStock && conducteur,
    validerCP: validationStock && chefProjet,
    mouvementManuel: saisieStock,
    transfertInterLots: validationStock && conducteur,
    transfertInterChantiers: validationStock && chefProjet,
    realiserInventaire: magasinier,
    validerInventaire: validationStock && chefProjet,
    reglerSeuil: magasinier || (validationStock && chefProjet),
    gererReferentiel: direction || validationStock,
  };
}

/** Les gestes cumulés sur plusieurs chantiers : ce que l'écran peut proposer quelque part. */
export function gestesCumules(droits: Droits | null, projets: readonly Projet[]): GestesStock {
  const cumul = { ...AUCUN_GESTE, ...base(droits) };
  for (const projet of projets) {
    const gestes = gestesStock(droits, projet);
    for (const cleGeste of Object.keys(cumul) as (keyof GestesStock)[]) {
      cumul[cleGeste] ||= gestes[cleGeste];
    }
  }
  return cumul;
}

/** Ce qui ne dépend d'aucun chantier : lire les DA, commander, tenir le référentiel. */
function base(droits: Droits | null): Partial<GestesStock> {
  if (!droits) return {};
  return {
    voirDemandes: peut(droits, "achats", "saisie") || peut(droits, "achats", "validation"),
    emettreCommande: peut(droits, "achats", "validation"),
    gererReferentiel: droits.estDirection || peut(droits, "stocks", "validation"),
  };
}

/* ------------------------------------------------------------------ *
 * Ce qui attend le compte — l'onglet « À faire ».
 * ------------------------------------------------------------------ */

export type TypeTache =
  | "COMMANDER"
  | "TRANSMETTRE"
  | "RECEPTIONNER"
  | "VALIDER_CT"
  | "VALIDER_CP"
  | "DEPOSER_BL"
  | "CLOTURER"
  | "TERMINER_INVENTAIRE"
  | "VALIDER_INVENTAIRE"
  | "LANCER_INVENTAIRE"
  | "REGLER_SEUIL"
  | "REAPPROVISIONNER";

export type OngletStock =
  | "afaire"
  | "stock"
  | "demandes"
  | "commandes"
  | "receptions"
  | "mouvements"
  | "inventaires"
  | "referentiel";

export interface Tache {
  type: TypeTache;
  projetId: string;
  lotId: string;
  /** La pièce en cause : référence, ou désignation. */
  objet: string;
  /** L'identifiant de la pièce, pour l'ouvrir. */
  cible: string;
  onglet: OngletStock;
  urgente: boolean;
}

/**
 * Les tâches du compte, chantier par chantier, selon ses gestes. C'est ce que
 * « chaque espace » doit faire du stock : la direction commande, le
 * magasinier réceptionne et compte, le conducteur et le chef de projet valident.
 */
export function tachesStock(donnees: DonneesStock, droits: Droits | null, projets: readonly Projet[]): Tache[] {
  const taches: Tache[] = [];
  const parProjet = new Map(projets.map((p) => [p.id, gestesStock(droits, p)]));
  const alertes = alertesStock(donnees);
  const enRetard = new Set(
    alertes
      .filter((a) => a.type === "VALIDATION_CT_EN_RETARD" || a.type === "VALIDATION_CP_EN_RETARD")
      .map((a) => a.objet),
  );

  for (const demande of donnees.demandes) {
    const g = parProjet.get(demande.projetId);
    if (g?.emettreCommande && demandeACommander(demande)) {
      taches.push(tache("COMMANDER", demande.projetId, demande.lotId, demande.reference, demande.id, "demandes", demande.dateSouhaitee <= donnees.luLe.slice(0, 10)));
    }
  }
  for (const commande of donnees.commandes) {
    const g = parProjet.get(commande.projetId);
    if (!g) continue;
    if (g.emettreCommande && commandeTransmissible(commande)) {
      taches.push(tache("TRANSMETTRE", commande.projetId, commande.lotId, commande.reference, commande.id, "commandes", false));
    }
    if (g.saisirReception && commandeReceptionnable(commande, donnees.livraisons)) {
      taches.push(tache("RECEPTIONNER", commande.projetId, commande.lotId, commande.reference, commande.id, "commandes", commande.dateLivraisonPrevue <= donnees.luLe.slice(0, 10)));
    }
    if (g.cloturerCommande && commandeCloturable(commande, donnees.livraisons)) {
      taches.push(tache("CLOTURER", commande.projetId, commande.lotId, commande.reference, commande.id, "commandes", false));
    }
  }
  for (const livraison of donnees.livraisons) {
    const g = parProjet.get(livraison.projetId);
    if (!g) continue;
    const etape = etapeAttendue(livraison);
    if (etape === "CT" && g.validerCT) {
      taches.push(tache("VALIDER_CT", livraison.projetId, livraison.lotId, livraison.reference, livraison.id, "receptions", enRetard.has(livraison.reference)));
    }
    if (etape === "CP" && g.validerCP) {
      taches.push(tache("VALIDER_CP", livraison.projetId, livraison.lotId, livraison.reference, livraison.id, "receptions", enRetard.has(livraison.reference)));
    }
    if (g.deposerJustificatif && justificatifManquant(livraison)) {
      taches.push(tache("DEPOSER_BL", livraison.projetId, livraison.lotId, livraison.reference, livraison.id, "receptions", livraison.statut === "VALIDE_WORKFLOW"));
    }
  }
  for (const session of donnees.inventaires) {
    const g = parProjet.get(session.projetId);
    if (session.statut === "EN_COURS" && g?.realiserInventaire) {
      taches.push(tache("TERMINER_INVENTAIRE", session.projetId, session.lotId, session.reference, session.id, "inventaires", false));
    }
    if (session.statut === "SOUMIS" && g?.validerInventaire) {
      taches.push(tache("VALIDER_INVENTAIRE", session.projetId, session.lotId, session.reference, session.id, "inventaires", session.lignes.some(ecartHorsSeuil)));
    }
  }
  const lots = indexer(donnees.lots);
  for (const alerte of alertes) {
    const g = parProjet.get(alerte.projetId);
    if (alerte.type === "INVENTAIRE_EN_RETARD" && g?.realiserInventaire) {
      const enCours = donnees.inventaires.some((s) => s.lotId === alerte.lotId && s.statut !== "VALIDE");
      if (!enCours) {
        taches.push(tache("LANCER_INVENTAIRE", alerte.projetId, alerte.lotId, lots.get(alerte.lotId)?.nom ?? alerte.objet, alerte.lotId, "inventaires", false));
      }
    }
  }
  for (const ligne of lignesStock(donnees)) {
    const g = parProjet.get(ligne.projetId);
    if (ligne.etat !== "OK" && g?.emettreDemande && !reapprovisionnementEnCours(donnees, ligne.lotId, ligne.materiau.id)) {
      taches.push(tache("REAPPROVISIONNER", ligne.projetId, ligne.lotId, ligne.materiau.designation, `${ligne.lotId}|${ligne.materiau.id}`, "stock", ligne.etat === "RUPTURE"));
    }
    if (ligne.seuilPropose && g?.reglerSeuil) {
      taches.push(tache("REGLER_SEUIL", ligne.projetId, ligne.lotId, ligne.materiau.designation, `${ligne.lotId}|${ligne.materiau.id}`, "stock", false));
    }
  }
  return taches.sort((a, b) => Number(b.urgente) - Number(a.urgente));
}

/** Une DA ou un BC en cours couvre déjà ce matériau sur ce lot : inutile d'en redemander. */
export function reapprovisionnementEnCours(donnees: DonneesStock, lotId: string, materiauId: string): boolean {
  const demande = donnees.demandes.some(
    (d) => d.lotId === lotId && demandeACommander(d) && d.lignes.some((l) => l.materiauId === materiauId),
  );
  const commande = donnees.commandes.some(
    (c) =>
      c.lotId === lotId &&
      (c.statut === "EMIS" || c.statut === "EN_ATTENTE_LIVRAISON" || (c.statut === "RECU_PARTIELLEMENT" && !c.cloture)) &&
      c.lignes.some((l) => l.materiauId === materiauId && l.quantiteLivree < l.quantiteCommandee),
  );
  return demande || commande;
}

/**
 * Un article du référentiel est « utilisé » dès qu'une pièce le cite —
 * demande, commande, livraison, mouvement, transfert, inventaire ou seuil.
 * Il ne se supprime plus alors : il se désactive, pour que la traçabilité
 * de ces pièces reste lisible.
 */
export function materiauUtilise(
  donnees: Pick<DonneesStock, "demandes" | "commandes" | "livraisons" | "mouvements" | "transferts" | "inventaires" | "seuils">,
  materiauId: string,
): boolean {
  const cite = (lignes: readonly { materiauId: string }[]) => lignes.some((l) => l.materiauId === materiauId);
  return (
    donnees.demandes.some((d) => cite(d.lignes)) ||
    donnees.commandes.some((c) => cite(c.lignes)) ||
    donnees.livraisons.some((l) => cite(l.lignes)) ||
    donnees.inventaires.some((i) => cite(i.lignes)) ||
    cite(donnees.mouvements) ||
    cite(donnees.transferts) ||
    cite(donnees.seuils)
  );
}

function tache(
  type: TypeTache,
  projetId: string,
  lotId: string,
  objet: string,
  cible: string,
  onglet: OngletStock,
  urgente: boolean,
): Tache {
  return { type, projetId, lotId, objet, cible, onglet, urgente };
}

/* ------------------------------------------------------------------ *
 * Le périmètre lu par un compte.
 * ------------------------------------------------------------------ */

/** Les données réduites aux chantiers visibles — le cache garde tout, chaque lecteur filtre. */
export function restreindreStock(donnees: DonneesStock, projetsVisibles: ReadonlySet<string>): DonneesStock {
  const garde = <T extends { projetId: string }>(elements: readonly T[]) =>
    elements.filter((e) => projetsVisibles.has(e.projetId));
  return {
    ...donnees,
    lots: garde(donnees.lots),
    demandes: garde(donnees.demandes),
    commandes: garde(donnees.commandes),
    livraisons: garde(donnees.livraisons),
    mouvements: garde(donnees.mouvements),
    inventaires: garde(donnees.inventaires),
    seuils: garde(donnees.seuils),
    transferts: donnees.transferts.filter(
      (t) => projetsVisibles.has(t.source.projetId) || projetsVisibles.has(t.destination.projetId),
    ),
  };
}

/** Ne garder qu'un chantier (le sélecteur de l'écran) ; `""` les garde tous. */
export function filtrerParProjet(donnees: DonneesStock, projetId: string): DonneesStock {
  return projetId ? restreindreStock(donnees, new Set([projetId])) : donnees;
}

/** Les statuts présents dans une liste — un filtre ne propose que ce qui existe. */
export function statutsPresents<S extends string>(ordre: readonly S[], elements: readonly { statut: S }[]): S[] {
  const presents = new Set(elements.map((e) => e.statut));
  return ordre.filter((s) => presents.has(s));
}

/** Les chiffres d'en-tête de l'écran et du tableau de bord. */
export function chiffresStock(donnees: DonneesStock) {
  const lignes = lignesStock(donnees);
  return {
    articles: lignes.length,
    enAlerte: lignes.filter((l) => l.etat === "ALERTE").length,
    enRupture: lignes.filter((l) => l.etat === "RUPTURE").length,
    demandesACommander: donnees.demandes.filter(demandeACommander).length,
    livraisonsAttendues: donnees.commandes.filter((c) => commandeReceptionnable(c, donnees.livraisons)).length,
    enValidation: donnees.livraisons.filter((l) => etapeAttendue(l) !== null).length,
    sansJustificatif: donnees.livraisons.filter((l) => l.statut === "VALIDE_WORKFLOW").length,
    inventairesAValider: donnees.inventaires.filter((s) => s.statut === "SOUMIS").length,
  };
}

/* ------------------------------------------------------------------ *
 * Les filtres des listes — la recherche est une question du domaine.
 * ------------------------------------------------------------------ */

/** Les noms qu'une recherche doit trouver derrière les identifiants. */
export interface Libelles {
  materiau: (id: string) => string;
  lot: (id: string) => string;
  projet: (id: string) => string;
}

export interface CriteresListe<S extends string = string> {
  recherche: string;
  statut: S | "";
}

export function filtrerLignesStock(
  lignes: readonly LigneStock[],
  criteres: CriteresListe<EtatStock> & { categorie: string },
  libelles: Libelles,
): LigneStock[] {
  return lignes.filter(
    (l) =>
      (!criteres.statut || l.etat === criteres.statut) &&
      (!criteres.categorie || l.materiau.categorie === criteres.categorie) &&
      correspond(criteres.recherche, l.materiau.designation, l.materiau.code, libelles.lot(l.lotId), libelles.projet(l.projetId)),
  );
}

export function filtrerDemandes(
  demandes: readonly DemandeAppro[],
  criteres: CriteresListe<StatutDemande>,
  libelles: Libelles,
): DemandeAppro[] {
  return demandes.filter(
    (d) =>
      (!criteres.statut || d.statut === criteres.statut) &&
      correspond(
        criteres.recherche,
        d.reference,
        d.emetteur.nom,
        libelles.lot(d.lotId),
        libelles.projet(d.projetId),
        ...d.lignes.map((l) => libelles.materiau(l.materiauId)),
      ),
  );
}

export function filtrerCommandes(
  commandes: readonly BonCommande[],
  criteres: CriteresListe<StatutCommande> & { origine: string },
  libelles: Libelles,
): BonCommande[] {
  return commandes.filter(
    (c) =>
      (!criteres.statut || c.statut === criteres.statut) &&
      (!criteres.origine || c.origine === criteres.origine) &&
      correspond(
        criteres.recherche,
        c.reference,
        c.demandeReference,
        c.fournisseur,
        libelles.lot(c.lotId),
        libelles.projet(c.projetId),
        ...c.lignes.map((l) => libelles.materiau(l.materiauId)),
      ),
  );
}

export function filtrerLivraisons(
  livraisons: readonly Livraison[],
  criteres: CriteresListe<StatutLivraison>,
  libelles: Libelles,
): Livraison[] {
  return livraisons.filter(
    (l) =>
      (!criteres.statut || l.statut === criteres.statut) &&
      correspond(
        criteres.recherche,
        l.reference,
        l.bonCommandeReference,
        l.numeroBrv,
        l.magasinier.nom,
        libelles.lot(l.lotId),
        libelles.projet(l.projetId),
        ...l.lignes.map((ligne) => libelles.materiau(ligne.materiauId)),
      ),
  );
}

export function filtrerMouvements(
  mouvements: readonly MouvementStock[],
  criteres: CriteresListe<TypeMouvement> & { source: string },
  libelles: Libelles,
): MouvementStock[] {
  return mouvements.filter(
    (m) =>
      (!criteres.statut || m.type === criteres.statut) &&
      (!criteres.source || m.source === criteres.source) &&
      correspond(
        criteres.recherche,
        m.reference,
        m.auteur.nom,
        m.motif,
        libelles.materiau(m.materiauId),
        libelles.lot(m.lotId),
        libelles.projet(m.projetId),
      ),
  );
}

export function filtrerInventaires(
  sessions: readonly SessionInventaire[],
  criteres: CriteresListe<StatutInventaire>,
  libelles: Libelles,
): SessionInventaire[] {
  return sessions.filter(
    (s) =>
      (!criteres.statut || s.statut === criteres.statut) &&
      correspond(criteres.recherche, s.reference, s.magasinier.nom, libelles.lot(s.lotId), libelles.projet(s.projetId)),
  );
}

export function filtrerMateriaux(
  materiaux: readonly Materiau[],
  criteres: CriteresListe,
): Materiau[] {
  return materiaux.filter(
    (m) =>
      (!criteres.statut || m.categorie === criteres.statut) &&
      correspond(criteres.recherche, m.code, m.designation, m.unite),
  );
}

/** Les valeurs présentes d'un champ, dans l'ordre donné : un filtre ne propose que ce qui existe. */
export function valeursPresentes<V extends string>(ordre: readonly V[], valeurs: readonly V[]): V[] {
  const presentes = new Set(valeurs);
  return ordre.filter((v) => presentes.has(v));
}

/**
 * Les valeurs d'une liste **ouverte** (catégorie, nature, unité d'un article) :
 * les valeurs prévues d'abord, dans leur ordre, puis celles que l'entreprise
 * a ajoutées, par ordre alphabétique et sans doublon. `seulementPresentes` :
 * un filtre ne propose que ce qui existe ; un formulaire propose tout.
 */
export function valeursOuvertes(
  prevues: readonly string[],
  valeurs: readonly string[],
  seulementPresentes = false,
): string[] {
  const presentes = new Set(valeurs.map((v) => v.trim()).filter(Boolean));
  const connues = new Set(prevues);
  const ajoutees = [...presentes].filter((v) => !connues.has(v)).sort((a, b) => a.localeCompare(b, "fr"));
  return [...(seulementPresentes ? prevues.filter((v) => presentes.has(v)) : prevues), ...ajoutees];
}

/** Le préfixe du code d'un article : `EQP` pour un équipement, `MAT` sinon. */
export function prefixeCodeMateriau(nature: string): string {
  return nature === "EQUIPEMENT" ? "EQP" : "MAT";
}

/**
 * Le code d'un nouvel article : son préfixe, suivi du numéro qui suit le
 * plus grand déjà attribué sous ce préfixe (`MAT-012` → `MAT-013`). Le plus
 * grand, pas le nombre d'articles : après une suppression, compter
 * redonnerait un code déjà porté.
 */
export function prochainCodeMateriau(materiaux: readonly Pick<Materiau, "code">[], nature: string): string {
  const prefixe = prefixeCodeMateriau(nature);
  const motif = new RegExp(`^${prefixe}-(\\d+)$`);
  const dernier = materiaux.reduce((max, m) => {
    const numero = motif.exec(m.code)?.[1];
    return numero ? Math.max(max, Number(numero)) : max;
  }, 0);
  return `${prefixe}-${String(dernier + 1).padStart(3, "0")}`;
}
