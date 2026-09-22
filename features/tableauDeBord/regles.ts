/**
 * Les règles métier du tableau de bord — plan de refonte, lot 4, couche 2.
 *
 * Pur, sans React. Ce fichier contient les **transitions d'état** du tableau
 * de bord : ce que devient l'écran quand un bon est signé, quand un chantier
 * est créé, quand un budget est défini.
 *
 * Elles vivaient dans les `setData(...)` du composant, où elles étaient
 * illisibles pour deux raisons : noyées dans la mécanique de React, et
 * mélangées à la forme HTTP. Une fois sorties, ce sont des fonctions qu'on
 * peut lire — et vérifier — sans monter un écran.
 */

import { estEnRetard, INDICE_SANTE_INITIAL } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";

import type { BonAPayer, LigneChantier, TableauDeBord } from "./types";

/**
 * Un bon peut-il encore être signé.
 *
 * Trois façons de ne pas l'être : il l'a déjà été dans cette session, le
 * serveur le donnait déjà signé, ou la signature est en cours. Les trois
 * étaient testées en ligne dans le gestionnaire de clic.
 */
export function bonSignable(
  bon: BonAPayer,
  dejaSignes: Record<string, boolean>,
  enCours: Record<string, boolean>,
): boolean {
  return !dejaSignes[bon.id] && bon.statut !== "SIGNE" && !enCours[bon.id];
}

/** La signature a-t-elle abouti, quelle que soit la façon dont le serveur le dit. */
export function signatureAboutie(resultat: { succes: boolean; statut: string }): boolean {
  return resultat.succes || resultat.statut === "SIGNE";
}

/**
 * Le tableau de bord après la signature d'un bon.
 *
 * Le compteur et le montant restant à signer sont décrémentés sans jamais
 * passer sous zéro : l'écran garde une copie locale, et deux signatures
 * concurrentes depuis deux onglets afficheraient sinon un montant négatif.
 */
export function apresSignatureBon(tdb: TableauDeBord, bon: BonAPayer): TableauDeBord {
  return {
    ...tdb,
    metriques: {
      ...tdb.metriques,
      bonsASignerNombre: Math.max(0, tdb.metriques.bonsASignerNombre - 1),
      bonsASignerMontant: Math.max(0, tdb.metriques.bonsASignerMontant - bon.montant),
    },
    bonsAPayer: tdb.bonsAPayer.map((item) =>
      item.id === bon.id ? { ...item, statut: "SIGNE" } : item,
    ),
  };
}

/**
 * La ligne de pilotage d'un chantier qui vient d'être créé.
 *
 * Un chantier neuf n'a ni avancement, ni consommation, ni rapport : son écart
 * est nul et sa santé est au maximum. C'est une règle métier, pas un défaut
 * d'affichage — d'où sa place ici plutôt que dans le `setData` de l'écran, où
 * elle était recopiée champ par champ.
 */
export function ligneChantierNeuf(projet: Projet): LigneChantier {
  return {
    id: projet.id,
    reference: projet.reference,
    nom: projet.nom,
    description: projet.description,
    clientNom: projet.client.raisonSociale,
    ville: projet.ville,
    quartier: projet.quartier,
    statut: projet.statut,
    avancementReel: projet.avancementReel,
    avancementTheorique: projet.avancementTheorique,
    ecart: 0,
    budgetInitial: projet.budgetInitial,
    budgetConsomme: 0,
    rapportJourStatut: "EN_ATTENTE",
    indiceSante: INDICE_SANTE_INITIAL,
    chefProjetNom: projet.chefProjet?.nomComplet ?? "",
    conducteurTravauxNom: projet.conducteurTravaux?.nomComplet ?? "",
  };
}

/**
 * Le tableau de bord après l'ouverture d'un chantier.
 *
 * Le nouveau chantier compte parmi les actifs **et** parmi les conformes :
 * sans avancement, il n'a pas encore d'écart, donc pas de retard.
 */
export function apresCreationChantier(tdb: TableauDeBord, projet: Projet): TableauDeBord {
  return {
    ...tdb,
    aucunChantier: false,
    metriques: {
      ...tdb.metriques,
      chantiersActifs: tdb.metriques.chantiersActifs + 1,
      chantiersConformes: tdb.metriques.chantiersConformes + 1,
    },
    chantiers: [ligneChantierNeuf(projet), ...tdb.chantiers],
  };
}

/**
 * Le nombre de points d'écart qu'il faut accumuler pour compter un jour de
 * retard. Deux points par jour : le chiffre vient de la maquette M10.
 */
const POINTS_ECART_PAR_JOUR = 2;

/** L'écart retenu quand aucun chantier n'est en retard mais que le compteur en annonce. */
const ECART_DEFAUT_POINTS = 10;

/**
 * Le retard estimé du portefeuille, en jours.
 *
 * Le calcul était écrit en une expression de cinq lignes au milieu d'une
 * tuile de KPI, ce qui le rendait à la fois illisible et impossible à
 * réutiliser. Il prend le chantier le plus en retard et convertit son écart
 * en jours ; jamais moins d'un jour, parce que la tuile ne s'affiche que
 * lorsqu'il y a effectivement du retard, et que « 0 jour de retard » se
 * lirait comme une absence de retard.
 */
export function joursDeRetardEstimes(chantiers: LigneChantier[]): number {
  const enRetard = chantiers.find((chantier) => estEnRetard(chantier.ecart));
  const ecart = Math.abs(enRetard?.ecart ?? ECART_DEFAUT_POINTS);
  return Math.max(1, Math.round(ecart / POINTS_ECART_PAR_JOUR));
}

/** Le tableau de bord après la définition du budget d'un chantier. */
export function apresDefinitionBudget(
  tdb: TableauDeBord,
  chantierId: string,
  budgetInitial: number,
): TableauDeBord {
  return {
    ...tdb,
    chantiers: tdb.chantiers.map((chantier) =>
      chantier.id === chantierId ? { ...chantier, budgetInitial } : chantier,
    ),
  };
}
