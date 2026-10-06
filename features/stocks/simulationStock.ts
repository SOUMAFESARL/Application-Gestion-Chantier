/**
 * Le stock de chantier rejoué — en attendant les routes `/stocks/…`.
 *
 * Même contrat que les autres simulations : il parle le domaine, les vrais
 * appels restent dans `adaptateur.ts`. Ce module joue **le serveur** : il
 * applique les règles que le cahier F9 déclare bloquantes côté API — double
 * condition d'entrée en stock (RG-STK-01), circuit CT → CP (RG-STK-04),
 * mouvements sans modification ni suppression (RG-STK-05), DA verrouillée
 * hors EN_ATTENTE (RG-STK-08, 422) —, numérote les pièces, calcule le hash
 * SHA-256 des justificatifs (RG-STK-13).
 *
 * Les chantiers et leurs lots sont **les vrais** (`/projets/`, `/lots/`) ;
 * un chantier sans lot reçoit les deux lots fictifs du journal. Chaque
 * chantier est amorcé, une fois, d'un historique de démonstration — DA, BC,
 * livraisons à tous les stades, sorties F2, un inventaire — pour que chaque
 * profil trouve de quoi travailler. Tout vit dans le `localStorage` du poste.
 *
 * Ce qu'il ne fait pas : savoir **qui** appelle. Les appels partent au nom
 * de la personne connectée ; « Voir en tant que… » ne change que l'écran.
 * Le refus 403 d'un BC émis hors DO/DG (RG-STK-03) est donc celui de Django.
 */

import { lireProfilLocal } from "@/features/auth/api";
import { listerLots, listerProjets } from "@/features/projets/adaptateur";
import type { Intervenant, Lot, Projet, StatutProjet } from "@/features/projets/types";
import { attendre, refuser } from "@/lib/api/simulation";

import {
  arrondir,
  commandeAnnulable,
  commandeCloturable,
  commandeReceptionnable,
  commandeTransmissible,
  consommablesDuChantier,
  demandeAnnulable,
  demandeModifiable,
  entreeAutorisee,
  etapeAttendue,
  indexer,
  inventaireComplet,
  natureDesLignes,
  reliquat,
  resteACommander,
  resteALivrer,
  statutCommande,
  statutDemande,
  statutLivraison,
  stockDuLot,
  workflowComplet,
} from "./regles";
import type {
  BonCommande,
  ChampDemande,
  DecisionValidation,
  DemandeAppro,
  DonneesStock,
  Justificatif,
  Livraison,
  LotStock,
  Materiau,
  MouvementStock,
  Personne,
  SaisieCommande,
  SaisieDemande,
  SaisieMateriau,
  SaisieMouvement,
  SaisieReception,
  SaisieTransfert,
  SeuilLot,
  SessionInventaire,
  Transfert,
} from "./types";

const CLE_ETAT = "ccd.simulation.stocks.v1";
const LATENCE_LECTURE = 350;
const LATENCE_ECRITURE = 450;
/** Au-delà, l'aperçu du justificatif n'est pas gardé : le `localStorage` tient 5 Mo. */
const TAILLE_MAX_APERCU = 600 * 1024;

/** Les chantiers qui ont un stock : ni terminés, ni archivés. */
const STATUTS_AVEC_STOCK: readonly StatutProjet[] = ["EN_ATTENTE", "EN_COURS", "EN_RETARD", "CRITIQUE", "SUSPENDU"];

interface EtatSimule {
  materiaux: Materiau[];
  demandes: DemandeAppro[];
  commandes: BonCommande[];
  livraisons: Livraison[];
  mouvements: MouvementStock[];
  transferts: Transfert[];
  inventaires: SessionInventaire[];
  seuils: SeuilLot[];
  /** Les numéros séquentiels, par type de pièce. */
  compteurs: Record<string, number>;
  /** Les chantiers déjà amorcés de leur historique de démonstration. */
  amorces: string[];
}

/* ------------------------------------------------------------------ *
 * Le référentiel de l'entreprise (F9-1) — semé une fois.
 * ------------------------------------------------------------------ */

/**
 * Les six premiers reprennent mot pour mot le catalogue que la saisie du
 * journal (F2) proposait : les rapports déjà saisis s'y rattachent.
 */
const REFERENTIEL: Materiau[] = [
  article("mat-ciment", "MAT-001", "Ciment CPJ 42,5 (sac 50 kg)", "LIANTS", "sac", 40),
  article("mat-sable", "MAT-002", "Sable lagunaire", "GRANULATS", "m³", 6),
  article("mat-gravier", "MAT-003", "Gravier concassé 5/15", "GRANULATS", "m³", 6),
  article("mat-ha10", "MAT-004", "Acier HA 10", "ACIERS", "barre", 50),
  article("mat-ha12", "MAT-005", "Acier HA 12", "ACIERS", "barre", 50),
  article("mat-agglos", "MAT-006", "Agglos creux 15×20×40", "MACONNERIE", "u", 300),
  article("mat-planche", "MAT-007", "Planche de coffrage 4 m", "BOIS_COFFRAGE", "u", 40),
  article("mat-fil", "MAT-008", "Fil de fer recuit", "ACIERS", "kg", 10),
  article("mat-colle", "MAT-009", "Ciment colle (sac 25 kg)", "FINITIONS", "sac", 20),
  article("mat-carreaux", "MAT-010", "Carreaux grès cérame 60×60", "FINITIONS", "m²", 30),
  article("mat-pvc", "MAT-011", "Tube PVC Ø110 (barre 4 m)", "PLOMBERIE", "barre", 10),
  article("mat-cable", "MAT-012", "Câble électrique 2,5 mm²", "ELECTRICITE", "m", 100),
  article("eqp-groupe", "EQP-001", "Groupe électrogène 20 kVA", "EQUIPEMENT", "u", 0),
  article("eqp-betonniere", "EQP-002", "Bétonnière 350 L", "EQUIPEMENT", "u", 0),
  article("eqp-vibreur", "EQP-003", "Aiguille vibrante Ø50", "EQUIPEMENT", "u", 1),
];

function article(
  id: string,
  code: string,
  designation: string,
  categorie: Materiau["categorie"],
  unite: string,
  seuilDefaut: number,
): Materiau {
  return {
    id,
    code,
    designation,
    categorie,
    nature: categorie === "EQUIPEMENT" ? "EQUIPEMENT" : "MATERIAU",
    unite,
    seuilDefaut,
    actif: true,
  };
}

/* ------------------------------------------------------------------ *
 * Le stockage du poste.
 * ------------------------------------------------------------------ */

function etatVierge(): EtatSimule {
  return {
    materiaux: REFERENTIEL.map((m) => ({ ...m })),
    demandes: [],
    commandes: [],
    livraisons: [],
    mouvements: [],
    transferts: [],
    inventaires: [],
    seuils: [],
    compteurs: {},
    amorces: [],
  };
}

function lireEtat(): EtatSimule {
  try {
    const brut = localStorage.getItem(CLE_ETAT);
    return brut ? { ...etatVierge(), ...(JSON.parse(brut) as EtatSimule) } : etatVierge();
  } catch {
    return etatVierge();
  }
}

/** Les photos et aperçus cèdent la place les premiers : jamais une pièce du stock. */
function ecrireEtat(etat: EtatSimule): void {
  try {
    localStorage.setItem(CLE_ETAT, JSON.stringify(etat));
  } catch {
    const allege: EtatSimule = {
      ...etat,
      livraisons: etat.livraisons.map((l) => ({
        ...l,
        photos: l.photos.map((p) => ({ ...p, url: "" })),
        justificatif: l.justificatif ? { ...l.justificatif, url: null } : null,
      })),
      transferts: etat.transferts.map((t) => ({ ...t, justificatif: { ...t.justificatif, url: null } })),
    };
    try {
      localStorage.setItem(CLE_ETAT, JSON.stringify(allege));
    } catch {
      // Rien de plus à sacrifier : l'écriture est perdue, la lecture reste juste.
    }
  }
}

/** Une écriture : lire, transformer, recalculer les statuts, enregistrer. */
function ecrire<T>(transformer: (etat: EtatSimule) => T): T {
  const etat = lireEtat();
  const resultat = transformer(etat);
  recalculer(etat);
  ecrireEtat(etat);
  return resultat;
}

/* ------------------------------------------------------------------ *
 * Numérotation, identités, horloge.
 * ------------------------------------------------------------------ */

function numero(etat: EtatSimule, prefixe: string, le: string): string {
  const annee = le.slice(0, 4);
  const cleCompteur = `${prefixe}-${annee}`;
  const suivant = (etat.compteurs[cleCompteur] ?? 0) + 1;
  etat.compteurs[cleCompteur] = suivant;
  return `${prefixe}-${annee}-${String(suivant).padStart(4, "0")}`;
}

function identifiant(prefixe: string): string {
  return `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** La personne connectée — le serveur la tire du jeton. Sans profil, pas d'écriture. */
function appelant(): Personne {
  const profil = lireProfilLocal();
  if (!profil) refuser("non_authentifie", "Session expirée : reconnectez-vous.", 401);
  const nom = profil.nom_complet || `${profil.prenom} ${profil.nom}`.trim() || profil.email;
  return { id: profil.id, nom };
}

function maintenant(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ *
 * Les statuts, recalculés après chaque écriture.
 * ------------------------------------------------------------------ */

function recalculer(etat: EtatSimule): void {
  for (const commande of etat.commandes) commande.statut = statutCommande(commande);
  for (const demande of etat.demandes) demande.statut = statutDemande(demande, etat.commandes);
  for (const livraison of etat.livraisons) livraison.statut = statutLivraison(livraison);
}

/* ------------------------------------------------------------------ *
 * Les gestes du serveur — partagés par les routes et par l'amorce.
 * ------------------------------------------------------------------ */

function verifierArticles(etat: EtatSimule, lignes: { materiauId: string; quantite: number }[]): void {
  const materiaux = indexer(etat.materiaux);
  for (const ligne of lignes) {
    if (!materiaux.get(ligne.materiauId)?.actif) {
      refuser("article_inconnu", "Un article demandé n’existe plus dans le référentiel.", 400);
    }
    if (!(ligne.quantite > 0)) refuser("quantite_invalide", "Chaque quantité doit être positive.", 400);
  }
}

function creerDemande(etat: EtatSimule, saisie: SaisieDemande, par: Personne, le: string): DemandeAppro {
  verifierArticles(etat, saisie.lignes);
  const demande: DemandeAppro = {
    id: identifiant("da"),
    reference: numero(etat, "DA", le),
    projetId: saisie.projetId,
    lotId: saisie.lotId,
    emetteur: par,
    emiseLe: le,
    dateSouhaitee: saisie.dateSouhaitee,
    observation: saisie.observation,
    statut: "EN_ATTENTE",
    lignes: saisie.lignes.map((l) => ({ materiauId: l.materiauId, quantiteDemandee: l.quantite, quantiteCommandee: 0 })),
    modifications: [],
    annulation: null,
    residuelleDe: null,
  };
  etat.demandes.unshift(demande);
  return demande;
}

function creerCommande(etat: EtatSimule, saisie: SaisieCommande, par: Personne, le: string): BonCommande {
  verifierArticles(etat, saisie.lignes);
  const demande = saisie.demandeId ? etat.demandes.find((d) => d.id === saisie.demandeId) : null;
  if (saisie.demandeId && !demande) refuser("introuvable", "Cette demande n’existe plus.", 404);
  if (demande) {
    if (demande.statut !== "EN_ATTENTE" && demande.statut !== "COMMANDEE_PARTIELLEMENT") {
      refuser("demande_close", "Cette demande ne peut plus être commandée.", 409);
    }
    const reste = new Map(resteACommander(demande).map((l) => [l.materiauId, l.quantite]));
    for (const ligne of saisie.lignes) {
      const disponible = reste.get(ligne.materiauId);
      if (disponible === undefined) refuser("hors_demande", "Un article ne figure pas dans le reste de la demande.", 422);
      if (ligne.quantite > disponible + 1e-9) {
        refuser("au_dela_demande", "Une quantité dépasse le reste à commander de la demande.", 422);
      }
    }
    for (const ligne of saisie.lignes) {
      const cible = demande.lignes.find((l) => l.materiauId === ligne.materiauId);
      if (cible) cible.quantiteCommandee = arrondir(cible.quantiteCommandee + ligne.quantite);
    }
  }
  const commande: BonCommande = {
    id: identifiant("bc"),
    reference: numero(etat, "BC", le),
    origine: demande ? "DEMANDE" : "COMMANDE_DIRECTE",
    demandeId: demande?.id ?? null,
    demandeReference: demande?.reference ?? null,
    projetId: demande?.projetId ?? saisie.projetId,
    lotId: demande?.lotId ?? saisie.lotId,
    fournisseur: saisie.fournisseur,
    emetteur: par,
    emisLe: le,
    dateLivraisonPrevue: saisie.dateLivraisonPrevue,
    statut: "EMIS",
    lignes: saisie.lignes.map((l) => ({ materiauId: l.materiauId, quantiteCommandee: l.quantite, quantiteLivree: 0 })),
    transmisLe: saisie.transmettre ? le : null,
    annulation: null,
    cloture: null,
  };
  etat.commandes.unshift(commande);
  return commande;
}

function creerLivraison(
  etat: EtatSimule,
  saisie: Omit<SaisieReception, "justificatif">,
  justificatif: Justificatif | null,
  par: Personne,
  le: string,
): Livraison {
  const commande = etat.commandes.find((c) => c.id === saisie.bonCommandeId);
  if (!commande) refuser("introuvable", "Ce bon de commande n’existe plus.", 404);
  recalculer(etat);
  if (!commandeReceptionnable(commande, etat.livraisons)) {
    refuser("commande_non_receptionnable", "Ce bon de commande n’attend plus de livraison.", 409);
  }
  const reste = new Map(resteALivrer(commande, etat.livraisons).map((l) => [l.materiauId, l.quantite]));
  for (const ligne of saisie.lignes) {
    if (ligne.quantiteRecue > (reste.get(ligne.materiauId) ?? 0) + 1e-9) {
      refuser("au_dela_commande", "Une quantité reçue dépasse le reste à livrer du bon de commande.", 422);
    }
  }
  const recues = saisie.lignes.filter((l) => l.quantiteRecue > 0);
  if (recues.length === 0) refuser("livraison_vide", "Aucune quantité reçue.", 400);
  if (saisie.photos.length > 5) refuser("trop_de_photos", "Cinq photos au plus par livraison.", 400);
  const livraison: Livraison = {
    id: identifiant("liv"),
    reference: numero(etat, "LIV", le),
    bonCommandeId: commande.id,
    bonCommandeReference: commande.reference,
    projetId: commande.projetId,
    lotId: commande.lotId,
    nature: natureDesLignes(
      recues.map((l) => l.materiauId),
      indexer(etat.materiaux),
    ),
    magasinier: par,
    recueLe: le,
    observation: saisie.observation,
    photos: saisie.photos,
    validationCT: null,
    validationCP: null,
    workflowValide: false,
    justificatif,
    numeroBrv: null,
    statut: "EN_ATTENTE_VALIDATION_CT",
    lignes: recues.map((l) => ({
      materiauId: l.materiauId,
      quantiteAttendue: reste.get(l.materiauId) ?? 0,
      quantiteRecue: l.quantiteRecue,
      quantiteValidee: null,
      conforme: l.conforme,
      motif: l.motif,
    })),
    rejet: null,
    saisieHorsLigne: false,
  };
  etat.livraisons.unshift(livraison);
  return livraison;
}

/**
 * RG-STK-01 : l'entrée n'a lieu que si les **deux** drapeaux sont levés. Elle
 * est retentée après chaque validation et chaque dépôt de justificatif ; le
 * premier qui complète la paire déclenche le BRV et les mouvements ENTREE.
 */
function tenterEntree(etat: EtatSimule, livraison: Livraison, le: string): void {
  livraison.workflowValide = workflowComplet(livraison);
  if (!entreeAutorisee(livraison) || livraison.numeroBrv) return;
  livraison.numeroBrv = numero(etat, "BRV", le);
  const commande = etat.commandes.find((c) => c.id === livraison.bonCommandeId);
  for (const ligne of livraison.lignes) {
    const quantite = ligne.quantiteValidee ?? 0;
    if (quantite <= 0) continue;
    etat.mouvements.push({
      id: identifiant("mvt"),
      projetId: livraison.projetId,
      lotId: livraison.lotId,
      materiauId: ligne.materiauId,
      type: "ENTREE",
      source: "BRV",
      quantite,
      reference: livraison.numeroBrv,
      auteur: livraison.validationCP?.par ?? livraison.validationCT?.par ?? livraison.magasinier,
      horodatage: le,
      motif: null,
      corrige: null,
    });
    const cible = commande?.lignes.find((l) => l.materiauId === ligne.materiauId);
    if (cible) cible.quantiteLivree = arrondir(cible.quantiteLivree + quantite);
  }
}

function validerEtape(
  etat: EtatSimule,
  livraison: Livraison,
  decision: Omit<DecisionValidation, "livraisonId">,
  par: Personne,
  le: string,
): void {
  livraison.statut = statutLivraison(livraison);
  const attendue = etapeAttendue(livraison);
  if (attendue === null) refuser("circuit_clos", "Cette livraison n’attend plus de validation.", 409);
  if (decision.etape === "CP" && attendue === "CT") {
    // RG-STK-04 : jamais le CP avant le CT.
    refuser("validation_ct_requise", "Le conducteur de travaux doit valider avant le chef de projet.", 422);
  }
  if (decision.etape !== attendue) refuser("etape_invalide", "Cette étape de validation n’est pas attendue.", 409);
  if (decision.etape === "CT") {
    for (const ligne of livraison.lignes) {
      const retenue = decision.quantitesValidees?.[ligne.materiauId];
      const valeur = retenue ?? (ligne.conforme ? ligne.quantiteRecue : 0);
      if (valeur < 0 || valeur > ligne.quantiteRecue + 1e-9) {
        refuser("quantite_validee_invalide", "Une quantité validée dépasse la quantité reçue.", 422);
      }
      ligne.quantiteValidee = valeur;
    }
    livraison.validationCT = { par, le, commentaire: decision.commentaire };
  } else {
    livraison.validationCP = { par, le, commentaire: decision.commentaire };
  }
  tenterEntree(etat, livraison, le);
}

function rejeterLivraison(
  etat: EtatSimule,
  livraison: Livraison,
  etape: "CT" | "CP",
  motif: string,
  par: Personne,
  le: string,
): void {
  livraison.statut = statutLivraison(livraison);
  if (etapeAttendue(livraison) !== etape) refuser("etape_invalide", "Cette livraison n’attend pas votre décision.", 409);
  livraison.rejet = { motif, par, le, bonRetour: numero(etat, "BR", le) };
}

function mouvement(
  etat: EtatSimule,
  m: Omit<MouvementStock, "id">,
): MouvementStock {
  const ecrit = { ...m, id: identifiant("mvt") };
  etat.mouvements.push(ecrit);
  return ecrit;
}

function ouvrirInventaireSur(etat: EtatSimule, projetId: string, lotId: string, par: Personne, le: string): SessionInventaire {
  if (etat.inventaires.some((s) => s.lotId === lotId && s.statut !== "VALIDE")) {
    refuser("inventaire_ouvert", "Un inventaire est déjà en cours sur ce lot.", 409);
  }
  const suivis = new Set(etat.mouvements.filter((m) => m.lotId === lotId).map((m) => m.materiauId));
  const session: SessionInventaire = {
    id: identifiant("inv"),
    reference: numero(etat, "INV", le),
    projetId,
    lotId,
    magasinier: par,
    ouverteLe: le,
    soumiseLe: null,
    statut: "EN_COURS",
    validation: null,
    lignes: [...suivis].map((materiauId) => ({
      materiauId,
      stockTheorique: stockDuLot(etat.mouvements, lotId, materiauId),
      stockCompte: null,
    })),
  };
  if (session.lignes.length === 0) refuser("lot_sans_stock", "Ce lot n’a encore aucun article en stock.", 422);
  etat.inventaires.unshift(session);
  return session;
}

/** La validation CP : chaque écart devient un mouvement INVENTAIRE (F9-6). */
function validerInventaireSur(etat: EtatSimule, session: SessionInventaire, par: Personne, le: string): void {
  if (session.statut !== "SOUMIS") refuser("inventaire_non_soumis", "Cet inventaire n’est pas soumis.", 409);
  for (const ligne of session.lignes) {
    const ecart = arrondir((ligne.stockCompte ?? ligne.stockTheorique) - ligne.stockTheorique);
    if (ecart === 0) continue;
    mouvement(etat, {
      projetId: session.projetId,
      lotId: session.lotId,
      materiauId: ligne.materiauId,
      type: "INVENTAIRE",
      source: "INVENTAIRE",
      quantite: ecart,
      reference: session.reference,
      auteur: par,
      horodatage: le,
      motif: null,
      corrige: null,
    });
  }
  session.statut = "VALIDE";
  session.validation = { par, le, commentaire: "" };
}

/* ------------------------------------------------------------------ *
 * Les justificatifs — le hash est celui du serveur (RG-STK-13).
 * ------------------------------------------------------------------ */

async function versJustificatif(fichier: File, par: Personne): Promise<Justificatif> {
  const contenu = await fichier.arrayBuffer();
  const empreinte = await crypto.subtle.digest("SHA-256", contenu);
  const hash = [...new Uint8Array(empreinte)].map((octet) => octet.toString(16).padStart(2, "0")).join("");
  return {
    nom: fichier.name,
    taille: fichier.size,
    type: fichier.type,
    hash,
    deposeLe: maintenant(),
    deposePar: par,
    url: fichier.size <= TAILLE_MAX_APERCU ? await enDataUrl(fichier) : null,
  };
}

function enDataUrl(fichier: File): Promise<string | null> {
  return new Promise((resoudre) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(typeof lecteur.result === "string" ? lecteur.result : null);
    lecteur.onerror = () => resoudre(null);
    lecteur.readAsDataURL(fichier);
  });
}

/** Une empreinte de démonstration, stable : 64 caractères hexadécimaux. */
function empreinteDemo(graine: string): string {
  let resultat = "";
  let h = 2166136261;
  for (let tour = 0; resultat.length < 64; tour += 1) {
    for (const caractere of `${graine}:${tour}`) h = Math.imul(h ^ caractere.charCodeAt(0), 16777619);
    resultat += (h >>> 0).toString(16).padStart(8, "0");
  }
  return resultat.slice(0, 64);
}

function justificatifDemo(nom: string, par: Personne, le: string): Justificatif {
  return { nom, taille: 412_000, type: "image/jpeg", hash: empreinteDemo(nom), deposeLe: le, deposePar: par, url: null };
}

/* ------------------------------------------------------------------ *
 * Les chantiers et leurs lots.
 * ------------------------------------------------------------------ */

const lotsEnMemoire = new Map<string, { lus: number; lots: Promise<Lot[]> }>();

/** Une minute de mémoire : un lot ajouté apparaît vite, sans relire chaque lot à chaque écran. */
function lotsMemorises(projetId: string): Promise<Lot[]> {
  const memoire = lotsEnMemoire.get(projetId);
  if (memoire && Date.now() - memoire.lus < 60_000) return memoire.lots;
  const lots = listerLots(projetId).catch((): Lot[] => []);
  lotsEnMemoire.set(projetId, { lus: Date.now(), lots });
  return lots;
}

/** Les lots fictifs du journal, mêmes identifiants : un chantier sans lot a quand même un stock. */
function lotsFictifs(projet: Projet): LotStock[] {
  return [
    { code: "01", nom: "Terrassements et fondations" },
    { code: "02", nom: "Gros œuvre" },
  ].map((lot) => ({
    id: `demo-lot-${projet.id}-${lot.code}`,
    code: lot.code,
    nom: lot.nom,
    projetId: projet.id,
    projetNom: projet.nom,
  }));
}

async function chantiers(): Promise<{ projet: Projet; lots: LotStock[] }[]> {
  const projets = (await listerProjets().catch((): Projet[] => [])).filter((p) => STATUTS_AVEC_STOCK.includes(p.statut));
  return Promise.all(
    projets.map(async (projet) => {
      const lots = await lotsMemorises(projet.id);
      return {
        projet,
        lots:
          lots.length > 0
            ? lots.map((lot) => ({ id: lot.id, code: lot.code, nom: lot.nom, projetId: projet.id, projetNom: projet.nom }))
            : lotsFictifs(projet),
      };
    }),
  );
}

/* ------------------------------------------------------------------ *
 * L'amorce — l'historique de démonstration d'un chantier.
 * ------------------------------------------------------------------ */

function personne(intervenant: Intervenant | null | undefined, repli: Personne): Personne {
  return intervenant ? { id: intervenant.id, nom: intervenant.nomComplet } : repli;
}

/** Un instant passé : `jours` jours ouvrés plus tôt, à `heure` h. */
function ilYA(jours: number, heure = 10): string {
  const date = new Date();
  let restants = jours;
  while (restants > 0) {
    date.setDate(date.getDate() - 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) restants -= 1;
  }
  date.setHours(heure, 0, 0, 0);
  return date.toISOString();
}

function jourDans(jours: number): string {
  const date = new Date();
  date.setDate(date.getDate() + jours);
  return date.toISOString().slice(0, 10);
}

/**
 * Un chantier amorcé raconte le cycle entier, avec une pièce à chaque stade —
 * pour que chaque profil de test trouve son travail :
 *
 * - lot 1 : une DA soldée et son BRV, une DA commandée en partie, un BC reçu
 *   en partie, une livraison rejetée, une livraison qui attend le CT depuis
 *   deux jours (alerte), une commande directe à réceptionner, des sorties F2,
 *   un inventaire validé il y a plus de 14 jours (alerte), du ciment sous le
 *   seuil (alerte) ;
 * - lot 2 : une DA en attente de commande, un équipement qui attend le CP
 *   depuis plus de 24 h (alerte), une livraison validée sans BL (en attente
 *   de justificatif), un inventaire soumis avec un écart de plus de 5 %.
 */
function amorcer(etat: EtatSimule, projet: Projet, lots: LotStock[]): void {
  const [lot1, lot2 = lots[0]] = lots;
  if (!lot1) return;
  const magasinier: Personne = { id: `demo-magasinier-${projet.id}`, nom: "Mamadou Koné" };
  const ct = personne(projet.conducteursTravaux[0], { id: "demo-ct", nom: "Issa Bamba" });
  const cp = personne(projet.chefProjet, { id: "demo-cp", nom: "Aya Koffi" });
  const direction: Personne = { id: "demo-do", nom: "Serge Yao" };
  const chefChantier = personne(projet.chefsChantier[0]?.intervenant, { id: "demo-cc", nom: "Jean Kouassi" });
  const p = projet.id;
  const valider = (livraison: Livraison, etape: "CT" | "CP", le: string) =>
    validerEtape(etat, livraison, { etape, commentaire: "" }, etape === "CT" ? ct : cp, le);
  const deposer = (livraison: Livraison, le: string) => {
    livraison.justificatif = justificatifDemo(`BL-${livraison.reference}.jpg`, magasinier, le);
    tenterEntree(etat, livraison, le);
  };
  const reception = (commande: BonCommande, lignes: [string, number][], le: string, observation = "") =>
    creerLivraison(
      etat,
      {
        bonCommandeId: commande.id,
        observation,
        photos: [],
        lignes: lignes.map(([materiauId, quantiteRecue]) => ({ materiauId, quantiteRecue, conforme: true, motif: "" })),
      },
      null,
      magasinier,
      le,
    );
  const sortieF2 = (lotId: string, materiauId: string, quantite: number, jours: number, rang: number) =>
    mouvement(etat, {
      projetId: p,
      lotId,
      materiauId,
      type: "SORTIE",
      source: "F2",
      quantite: -quantite,
      reference: `RAP-${ilYA(jours).slice(0, 10).replaceAll("-", "")}-${String(rang).padStart(2, "0")}`,
      auteur: chefChantier,
      horodatage: ilYA(jours, 17),
      motif: null,
      corrige: null,
    });
  const seuil = (lotId: string, materiauId: string, valeur: number, le: string) =>
    etat.seuils.push({ projetId: p, lotId, materiauId, seuil: valeur, reglePar: magasinier, regleLe: le });

  // Lot 1 — DA soldée : ciment, sable, gravier.
  const da1 = creerDemande(
    etat,
    { projetId: p, lotId: lot1.id, dateSouhaitee: ilYA(17).slice(0, 10), observation: "Démarrage des fondations.", lignes: [
      { materiauId: "mat-ciment", quantite: 400 },
      { materiauId: "mat-sable", quantite: 30 },
      { materiauId: "mat-gravier", quantite: 30 },
    ] },
    magasinier,
    ilYA(20),
  );
  const bc1 = creerCommande(
    etat,
    { demandeId: da1.id, projetId: p, lotId: lot1.id, fournisseur: "CIMAF Côte d’Ivoire", dateLivraisonPrevue: ilYA(17).slice(0, 10), transmettre: true, lignes: [
      { materiauId: "mat-ciment", quantite: 400 },
      { materiauId: "mat-sable", quantite: 30 },
      { materiauId: "mat-gravier", quantite: 30 },
    ] },
    direction,
    ilYA(19),
  );
  recalculer(etat);
  const liv1 = reception(bc1, [["mat-ciment", 400], ["mat-sable", 30], ["mat-gravier", 30]], ilYA(17, 9));
  valider(liv1, "CT", ilYA(17, 11));
  deposer(liv1, ilYA(17, 11));
  seuil(lot1.id, "mat-ciment", 40, ilYA(17, 12));
  seuil(lot1.id, "mat-sable", 6, ilYA(17, 12));
  seuil(lot1.id, "mat-gravier", 6, ilYA(17, 12));

  // Inventaire validé au début : plus de 14 jours ouvrés sans recomptage.
  const inv1 = ouvrirInventaireSur(etat, p, lot1.id, magasinier, ilYA(16, 8));
  for (const ligne of inv1.lignes) ligne.stockCompte = ligne.materiauId === "mat-ciment" ? ligne.stockTheorique - 2 : ligne.stockTheorique;
  inv1.statut = "SOUMIS";
  inv1.soumiseLe = ilYA(16, 9);
  validerInventaireSur(etat, inv1, cp, ilYA(16, 15));

  // Sorties F2 : les rapports validés par le CT consomment le stock.
  [
    [16, 40, 4, 3], [14, 55, 5, 4], [12, 60, 4, 3], [10, 70, 3, 2], [8, 60, 2, 2], [6, 50, 2, 1], [4, 30, 1, 1], [2, 5, 0.5, 0.5],
  ].forEach(([jours, ciment, sable, gravier], rang) => {
    sortieF2(lot1.id, "mat-ciment", ciment, jours, rang + 1);
    sortieF2(lot1.id, "mat-sable", sable, jours, rang + 1);
    sortieF2(lot1.id, "mat-gravier", gravier, jours, rang + 1);
  });
  mouvement(etat, {
    projetId: p, lotId: lot1.id, materiauId: "mat-ciment", type: "SORTIE", source: "MANUEL", quantite: -6,
    reference: "MANUEL", auteur: ct, horodatage: ilYA(5, 16), motif: "Six sacs éventrés par la pluie, inutilisables.", corrige: null,
  });

  // Lot 1 — DA commandée en partie : les aciers commandés, les agglos pas encore.
  const da2 = creerDemande(
    etat,
    { projetId: p, lotId: lot1.id, dateSouhaitee: ilYA(9).slice(0, 10), observation: "Ferraillage des semelles et élévation.", lignes: [
      { materiauId: "mat-ha10", quantite: 300 },
      { materiauId: "mat-ha12", quantite: 250 },
      { materiauId: "mat-agglos", quantite: 3000 },
    ] },
    cp,
    ilYA(12),
  );
  const bc2 = creerCommande(
    etat,
    { demandeId: da2.id, projetId: p, lotId: lot1.id, fournisseur: "Sotaci", dateLivraisonPrevue: ilYA(9).slice(0, 10), transmettre: true, lignes: [
      { materiauId: "mat-ha10", quantite: 300 },
      { materiauId: "mat-ha12", quantite: 250 },
    ] },
    direction,
    ilYA(11),
  );
  recalculer(etat);
  const rejetee = reception(bc2, [["mat-ha12", 250]], ilYA(10, 9), "Barres rouillées sur la moitié du lot.");
  rejeterLivraison(etat, rejetee, "CT", "Acier corrodé, non conforme à la commande : retour fournisseur.", ct, ilYA(10, 11));
  recalculer(etat);
  const liv2 = reception(bc2, [["mat-ha10", 300], ["mat-ha12", 150]], ilYA(9, 9));
  deposer(liv2, ilYA(9, 9));
  valider(liv2, "CT", ilYA(9, 14));
  seuil(lot1.id, "mat-ha10", 50, ilYA(9, 15));
  sortieF2(lot1.id, "mat-ha10", 90, 6, 20);
  sortieF2(lot1.id, "mat-ha12", 60, 4, 21);
  recalculer(etat);
  // Le reste des HA 12 arrive : il attend le CT depuis deux jours ouvrés.
  const liv3 = reception(bc2, [["mat-ha12", 100]], ilYA(2, 10));
  deposer(liv3, ilYA(2, 10));

  // Lot 1 — commande directe d'urgence, transmise, attendue aujourd'hui.
  creerCommande(
    etat,
    { demandeId: null, projetId: p, lotId: lot1.id, fournisseur: "Lafarge Holcim CI", dateLivraisonPrevue: jourDans(0), transmettre: true, lignes: [
      { materiauId: "mat-ciment", quantite: 200 },
    ] },
    direction,
    ilYA(1, 9),
  );

  // Lot 2 — l'historique propre au second lot.
  if (lot2.id !== lot1.id) {
    const da3 = creerDemande(
      etat,
      { projetId: p, lotId: lot2.id, dateSouhaitee: ilYA(12).slice(0, 10), observation: "", lignes: [
        { materiauId: "mat-ciment", quantite: 150 },
        { materiauId: "mat-colle", quantite: 80 },
        { materiauId: "mat-carreaux", quantite: 300 },
      ] },
      magasinier,
      ilYA(14),
    );
    const bc3 = creerCommande(
      etat,
      { demandeId: da3.id, projetId: p, lotId: lot2.id, fournisseur: "Batimat Abidjan", dateLivraisonPrevue: ilYA(12).slice(0, 10), transmettre: true, lignes: [
        { materiauId: "mat-ciment", quantite: 150 },
      ] },
      direction,
      ilYA(13),
    );
    recalculer(etat);
    const liv4 = reception(bc3, [["mat-ciment", 150]], ilYA(12, 9));
    valider(liv4, "CT", ilYA(12, 10));
    deposer(liv4, ilYA(12, 10));
    seuil(lot2.id, "mat-ciment", 30, ilYA(12, 11));
    sortieF2(lot2.id, "mat-ciment", 35, 8, 30);
    sortieF2(lot2.id, "mat-ciment", 25, 3, 31);

    // Carrelage : validé par le CT, mais le BL n'est pas encore déposé.
    const bc4 = creerCommande(
      etat,
      { demandeId: da3.id, projetId: p, lotId: lot2.id, fournisseur: "Batimat Abidjan", dateLivraisonPrevue: ilYA(5).slice(0, 10), transmettre: true, lignes: [
        { materiauId: "mat-colle", quantite: 80 },
        { materiauId: "mat-carreaux", quantite: 300 },
      ] },
      direction,
      ilYA(7),
    );
    recalculer(etat);
    const liv5 = reception(bc4, [["mat-colle", 80], ["mat-carreaux", 300]], ilYA(4, 9));
    valider(liv5, "CT", ilYA(4, 11));

    // Un équipement : validé par le CT, il attend le CP depuis plus de 24 h.
    const da4 = creerDemande(
      etat,
      { projetId: p, lotId: lot2.id, dateSouhaitee: ilYA(6).slice(0, 10), observation: "Bétonnage des poteaux.", lignes: [
        { materiauId: "eqp-vibreur", quantite: 2 },
      ] },
      cp,
      ilYA(9),
    );
    const bc5 = creerCommande(
      etat,
      { demandeId: da4.id, projetId: p, lotId: lot2.id, fournisseur: "Loxam CI", dateLivraisonPrevue: ilYA(6).slice(0, 10), transmettre: true, lignes: [
        { materiauId: "eqp-vibreur", quantite: 2 },
      ] },
      direction,
      ilYA(8),
    );
    recalculer(etat);
    const liv6 = reception(bc5, [["eqp-vibreur", 2]], ilYA(3, 9));
    deposer(liv6, ilYA(3, 9));
    valider(liv6, "CT", ilYA(3, 11));

    // Inventaire soumis : le ciment compté accuse plus de 5 % d'écart.
    const inv2 = ouvrirInventaireSur(etat, p, lot2.id, magasinier, ilYA(1, 8));
    for (const ligne of inv2.lignes) {
      ligne.stockCompte = ligne.materiauId === "mat-ciment" ? Math.round(ligne.stockTheorique * 0.9) : ligne.stockTheorique;
    }
    inv2.statut = "SOUMIS";
    inv2.soumiseLe = ilYA(1, 11);

    // Une DA en attente de la direction : groupe électrogène et bétonnière.
    creerDemande(
      etat,
      { projetId: p, lotId: lot2.id, dateSouhaitee: jourDans(3), observation: "Le groupe actuel est en panne, la dalle est prévue lundi.", lignes: [
        { materiauId: "eqp-groupe", quantite: 1 },
        { materiauId: "eqp-betonniere", quantite: 1 },
      ] },
      magasinier,
      ilYA(1, 15),
    );
  }

  // Une DA à laquelle la direction n'a pas donné suite.
  const annulee = creerDemande(
    etat,
    { projetId: p, lotId: lot1.id, dateSouhaitee: ilYA(8).slice(0, 10), observation: "", lignes: [{ materiauId: "mat-planche", quantite: 120 }] },
    magasinier,
    ilYA(11),
  );
  annulee.annulation = { motif: "Coffrage métallique loué : les planches ne sont plus nécessaires.", par: direction, le: ilYA(10, 16) };
  recalculer(etat);
}

/* ------------------------------------------------------------------ *
 * Les routes rejouées.
 * ------------------------------------------------------------------ */

function trouver<T extends { id: string }>(elements: T[], id: string, message: string): T {
  const element = elements.find((e) => e.id === id);
  if (!element) refuser("introuvable", message, 404);
  return element;
}

async function lire(): Promise<DonneesStock> {
  const lus = await chantiers();
  const etat = lireEtat();
  let amorce = false;
  for (const { projet, lots } of lus) {
    if (etat.amorces.includes(projet.id)) continue;
    amorcer(etat, projet, lots);
    etat.amorces.push(projet.id);
    amorce = true;
  }
  if (amorce) ecrireEtat(etat);
  return attendre(
    {
      luLe: maintenant(),
      materiaux: etat.materiaux,
      lots: lus.flatMap((c) => c.lots),
      demandes: etat.demandes,
      commandes: etat.commandes,
      livraisons: etat.livraisons,
      mouvements: [...etat.mouvements].sort((a, b) => b.horodatage.localeCompare(a.horodatage)),
      transferts: etat.transferts,
      inventaires: etat.inventaires,
      seuils: etat.seuils,
    },
    LATENCE_LECTURE,
  );
}

export const simulationStock = {
  lire,

  emettreDemande(saisie: SaisieDemande): Promise<DemandeAppro> {
    const par = appelant();
    return attendre(ecrire((etat) => creerDemande(etat, saisie, par, maintenant())), LATENCE_ECRITURE);
  },

  /** RG-STK-08 : 422 hors EN_ATTENTE ; chaque modification est journalisée. */
  modifierDemande(id: string, saisie: SaisieDemande): Promise<DemandeAppro> {
    const par = appelant();
    return attendre(
      ecrire((etat) => {
        const demande = trouver(etat.demandes, id, "Cette demande n’existe plus.");
        if (!demandeModifiable(demande)) {
          refuser("demande_verrouillee", "Un bon de commande a été émis : la demande n’est plus modifiable.", 422);
        }
        verifierArticles(etat, saisie.lignes);
        const champs: ChampDemande[] = [];
        if (demande.lotId !== saisie.lotId) champs.push("lot");
        if (demande.dateSouhaitee !== saisie.dateSouhaitee) champs.push("dateSouhaitee");
        if (demande.observation !== saisie.observation) champs.push("observation");
        const avant = JSON.stringify(demande.lignes.map((l) => [l.materiauId, l.quantiteDemandee]));
        const apres = JSON.stringify(saisie.lignes.map((l) => [l.materiauId, l.quantite]));
        if (avant !== apres) champs.push("lignes");
        if (champs.length === 0) return demande;
        demande.lotId = saisie.lotId;
        demande.dateSouhaitee = saisie.dateSouhaitee;
        demande.observation = saisie.observation;
        demande.lignes = saisie.lignes.map((l) => ({ materiauId: l.materiauId, quantiteDemandee: l.quantite, quantiteCommandee: 0 }));
        demande.modifications.push({ le: maintenant(), par, champs });
        return demande;
      }),
      LATENCE_ECRITURE,
    );
  },

  annulerDemande(id: string, motif: string): Promise<void> {
    const par = appelant();
    return attendre(
      ecrire((etat) => {
        const demande = trouver(etat.demandes, id, "Cette demande n’existe plus.");
        if (!demandeAnnulable(demande)) refuser("demande_commandee", "Un bon de commande a déjà été émis.", 409);
        demande.annulation = { motif, par, le: maintenant() };
      }),
      LATENCE_ECRITURE,
    );
  },

  emettreCommande(saisie: SaisieCommande): Promise<BonCommande> {
    const par = appelant();
    return attendre(ecrire((etat) => creerCommande(etat, saisie, par, maintenant())), LATENCE_ECRITURE);
  },

  transmettreCommande(id: string): Promise<void> {
    return attendre(
      ecrire((etat) => {
        const commande = trouver(etat.commandes, id, "Ce bon de commande n’existe plus.");
        if (!commandeTransmissible(commande)) refuser("deja_transmis", "Ce bon de commande est déjà transmis.", 409);
        commande.transmisLe = maintenant();
      }),
      LATENCE_ECRITURE,
    );
  },

  annulerCommande(id: string, motif: string): Promise<void> {
    const par = appelant();
    return attendre(
      ecrire((etat) => {
        const commande = trouver(etat.commandes, id, "Ce bon de commande n’existe plus.");
        if (!commandeAnnulable(commande, etat.livraisons)) {
          refuser("commande_receptionnee", "Une réception a déjà eu lieu : le bon ne s’annule plus.", 409);
        }
        commande.annulation = { motif, par, le: maintenant() };
        // Ce qui était commandé redevient à commander sur la DA.
        const demande = commande.demandeId ? etat.demandes.find((d) => d.id === commande.demandeId) : null;
        for (const ligne of commande.lignes) {
          const cible = demande?.lignes.find((l) => l.materiauId === ligne.materiauId);
          if (cible) cible.quantiteCommandee = Math.max(0, arrondir(cible.quantiteCommandee - ligne.quantiteCommandee));
        }
      }),
      LATENCE_ECRITURE,
    );
  },

  /** RG-STK-07 : motif obligatoire ; la DA résiduelle reprend le reliquat. */
  cloturerCommande(id: string, motif: string): Promise<DemandeAppro> {
    const par = appelant();
    return attendre(
      ecrire((etat) => {
        const commande = trouver(etat.commandes, id, "Ce bon de commande n’existe plus.");
        recalculer(etat);
        if (!commandeCloturable(commande, etat.livraisons)) {
          refuser("commande_non_cloturable", "Seul un bon partiellement livré, sans livraison en attente, se clôture.", 409);
        }
        const le = maintenant();
        const residuelle = creerDemande(
          etat,
          {
            projetId: commande.projetId,
            lotId: commande.lotId,
            dateSouhaitee: le.slice(0, 10),
            observation: motif,
            lignes: reliquat(commande),
          },
          par,
          le,
        );
        residuelle.residuelleDe = commande.reference;
        commande.cloture = { motif, par, le, demandeResiduelle: residuelle.reference };
        return residuelle;
      }),
      LATENCE_ECRITURE,
    );
  },

  async receptionner(saisie: SaisieReception): Promise<Livraison> {
    const par = appelant();
    const justificatif = saisie.justificatif ? await versJustificatif(saisie.justificatif, par) : null;
    return attendre(
      ecrire((etat) => creerLivraison(etat, saisie, justificatif, par, maintenant())),
      LATENCE_ECRITURE,
    );
  },

  async deposerJustificatif(livraisonId: string, fichier: File): Promise<Livraison> {
    const par = appelant();
    const justificatif = await versJustificatif(fichier, par);
    return attendre(
      ecrire((etat) => {
        const livraison = trouver(etat.livraisons, livraisonId, "Cette livraison n’existe plus.");
        if (livraison.rejet) refuser("livraison_rejetee", "Cette livraison a été rejetée.", 409);
        if (livraison.justificatif) refuser("justificatif_depose", "Le justificatif est déjà archivé : il ne se remplace pas.", 409);
        livraison.justificatif = justificatif;
        tenterEntree(etat, livraison, justificatif.deposeLe);
        return livraison;
      }),
      LATENCE_ECRITURE,
    );
  },

  valider(decision: DecisionValidation): Promise<Livraison> {
    const par = appelant();
    return attendre(
      ecrire((etat) => {
        const livraison = trouver(etat.livraisons, decision.livraisonId, "Cette livraison n’existe plus.");
        validerEtape(etat, livraison, decision, par, maintenant());
        return livraison;
      }),
      LATENCE_ECRITURE,
    );
  },

  rejeter(livraisonId: string, etape: "CT" | "CP", motif: string): Promise<Livraison> {
    const par = appelant();
    return attendre(
      ecrire((etat) => {
        const livraison = trouver(etat.livraisons, livraisonId, "Cette livraison n’existe plus.");
        rejeterLivraison(etat, livraison, etape, motif, par, maintenant());
        return livraison;
      }),
      LATENCE_ECRITURE,
    );
  },

  /** RG-STK-05 : on n'efface rien, on écrit un mouvement de plus. */
  saisirMouvement(saisie: SaisieMouvement): Promise<MouvementStock> {
    const par = appelant();
    return attendre(
      ecrire((etat) => {
        const sortie = saisie.sens !== "CORRECTION_ENTREE";
        if (sortie && stockDuLot(etat.mouvements, saisie.lotId, saisie.materiauId) < saisie.quantite - 1e-9) {
          refuser("stock_insuffisant", "La quantité dépasse le stock du lot.", 422);
        }
        if (saisie.corrige && !etat.mouvements.some((m) => m.id === saisie.corrige)) {
          refuser("introuvable", "Le mouvement à corriger n’existe pas.", 404);
        }
        return mouvement(etat, {
          projetId: saisie.projetId,
          lotId: saisie.lotId,
          materiauId: saisie.materiauId,
          type: sortie ? "SORTIE" : "ENTREE",
          source: "MANUEL",
          quantite: sortie ? -saisie.quantite : saisie.quantite,
          reference: "MANUEL",
          auteur: par,
          horodatage: maintenant(),
          motif: saisie.motif,
          corrige: saisie.corrige,
        });
      }),
      LATENCE_ECRITURE,
    );
  },

  /** RG-STK-10 : une sortie et une entrée simultanées, justificatif exigé. */
  async transferer(saisie: SaisieTransfert): Promise<Transfert> {
    const par = appelant();
    const justificatif = await versJustificatif(saisie.justificatif, par);
    return attendre(
      ecrire((etat) => {
        if (stockDuLot(etat.mouvements, saisie.source.lotId, saisie.materiauId) < saisie.quantite - 1e-9) {
          refuser("stock_insuffisant", "La quantité dépasse le stock du lot source.", 422);
        }
        const le = maintenant();
        const transfert: Transfert = {
          id: identifiant("trf"),
          reference: numero(etat, "TRF", le),
          portee: saisie.source.projetId === saisie.destination.projetId ? "INTER_LOTS" : "INTER_CHANTIERS",
          materiauId: saisie.materiauId,
          quantite: saisie.quantite,
          source: saisie.source,
          destination: saisie.destination,
          auteur: par,
          le,
          motif: saisie.motif,
          justificatif,
        };
        for (const [extremite, signe] of [[saisie.source, -1], [saisie.destination, 1]] as const) {
          mouvement(etat, {
            projetId: extremite.projetId,
            lotId: extremite.lotId,
            materiauId: saisie.materiauId,
            type: "TRANSFERT",
            source: "TRANSFERT",
            quantite: signe * saisie.quantite,
            reference: transfert.reference,
            auteur: par,
            horodatage: le,
            motif: saisie.motif,
            corrige: null,
          });
        }
        etat.transferts.unshift(transfert);
        return transfert;
      }),
      LATENCE_ECRITURE,
    );
  },

  ouvrirInventaire(projetId: string, lotId: string): Promise<SessionInventaire> {
    const par = appelant();
    return attendre(ecrire((etat) => ouvrirInventaireSur(etat, projetId, lotId, par, maintenant())), LATENCE_ECRITURE);
  },

  enregistrerComptage(id: string, comptes: Record<string, number | null>, soumettre: boolean): Promise<SessionInventaire> {
    return attendre(
      ecrire((etat) => {
        const session = trouver(etat.inventaires, id, "Cet inventaire n’existe plus.");
        if (session.statut !== "EN_COURS") refuser("inventaire_soumis", "Cet inventaire est déjà soumis.", 409);
        for (const ligne of session.lignes) {
          if (ligne.materiauId in comptes) ligne.stockCompte = comptes[ligne.materiauId];
        }
        if (soumettre) {
          if (!inventaireComplet(session)) refuser("comptage_incomplet", "Chaque article doit être compté.", 422);
          session.statut = "SOUMIS";
          session.soumiseLe = maintenant();
        }
        return session;
      }),
      LATENCE_ECRITURE,
    );
  },

  validerInventaire(id: string): Promise<SessionInventaire> {
    const par = appelant();
    return attendre(
      ecrire((etat) => {
        const session = trouver(etat.inventaires, id, "Cet inventaire n’existe plus.");
        validerInventaireSur(etat, session, par, maintenant());
        return session;
      }),
      LATENCE_ECRITURE,
    );
  },

  reglerSeuil(projetId: string, lotId: string, materiauId: string, seuil: number): Promise<SeuilLot> {
    const par = appelant();
    return attendre(
      ecrire((etat) => {
        const regle: SeuilLot = { projetId, lotId, materiauId, seuil, reglePar: par, regleLe: maintenant() };
        etat.seuils = [...etat.seuils.filter((s) => !(s.lotId === lotId && s.materiauId === materiauId)), regle];
        return regle;
      }),
      LATENCE_ECRITURE,
    );
  },

  creerMateriau(saisie: SaisieMateriau): Promise<Materiau> {
    return attendre(
      ecrire((etat) => {
        if (etat.materiaux.some((m) => m.code === saisie.code)) refuser("code_existant", "Ce code est déjà utilisé.", 409, { code: ["Ce code est déjà utilisé."] });
        const materiau: Materiau = { ...saisie, id: identifiant("mat"), actif: true };
        etat.materiaux.push(materiau);
        return materiau;
      }),
      LATENCE_ECRITURE,
    );
  },

  modifierMateriau(id: string, saisie: SaisieMateriau): Promise<Materiau> {
    return attendre(
      ecrire((etat) => {
        const materiau = trouver(etat.materiaux, id, "Cet article n’existe plus.");
        if (etat.materiaux.some((m) => m.code === saisie.code && m.id !== id)) {
          refuser("code_existant", "Ce code est déjà utilisé.", 409, { code: ["Ce code est déjà utilisé."] });
        }
        Object.assign(materiau, saisie);
        return materiau;
      }),
      LATENCE_ECRITURE,
    );
  },

  basculerMateriau(id: string): Promise<Materiau> {
    return attendre(
      ecrire((etat) => {
        const materiau = trouver(etat.materiaux, id, "Cet article n’existe plus.");
        materiau.actif = !materiau.actif;
        return materiau;
      }),
      LATENCE_ECRITURE,
    );
  },

  /**
   * F9 → F2 : ce que le chef de chantier peut consommer (RG-STK-02) —
   * lu sans latence, la saisie du journal ayant déjà la sienne.
   */
  async consommables(projetId: string): Promise<{ materiau: Materiau; stock: number; seuil: number }[]> {
    const donnees = await lire();
    return consommablesDuChantier(donnees, projetId);
  },
};
