/**
 * Les règles métier du domaine Administration — couche 2, zéro React.
 *
 * Ce fichier ne sait ni ce qu'est un écran, ni ce qu'est une requête. Il dit
 * ce qu'on a le droit de faire et ce qui mérite d'être signalé, et rien
 * d'autre. C'est ce qui permet de le relire sans ouvrir un composant — et
 * c'est la leçon du seuil de retard, qui existait en deux exemplaires avec
 * deux valeurs différentes parce qu'il vivait dans des écrans.
 */

import type {
  AlerteClient,
  CleIndicateur,
  ClientPlateforme,
  EtatCommercial,
  IndicateursPlateforme,
  PartParcClient,
  PointEvolutionAbonnements,
  ProfilAdministrateur,
  TendanceIndicateur,
  TonVariation,
} from "./types";

/**
 * À partir de quand un essai est « bientôt fini ».
 *
 * Trois jours : le délai qu'il faut à un commercial pour rappeler avant que
 * l'accès ne se ferme. Une valeur, un endroit.
 */
export const SEUIL_ESSAI_BIENTOT_EXPIRE_JOURS = 3;

/**
 * Au bout de combien de jours une inscription jamais activée devient un
 * problème plutôt qu'une inscription récente.
 */
export const SEUIL_INSCRIPTION_SANS_SUITE_JOURS = 7;

/**
 * Qui peut écrire dans le back-office.
 *
 * **Ce test ne protège rien** : il décide de l'affichage d'un bouton. La
 * vraie barrière est côté Django, qui refuse la requête. Le dire ici évite
 * qu'on prenne un jour cette fonction pour un contrôle d'accès.
 */
export function peutAgirSurClients(profil: ProfilAdministrateur | null): boolean {
  return profil?.role === "SUPERVISEUR";
}

/** Nombre de jours entiers entre aujourd'hui et une échéance. */
export function joursAvant(echeance: Date, maintenant: Date = new Date()): number {
  const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
  const depart = Date.UTC(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate(),
  );
  const cible = Date.UTC(
    echeance.getFullYear(),
    echeance.getMonth(),
    echeance.getDate(),
  );
  return Math.round((cible - depart) / MS_PAR_JOUR);
}

/**
 * Ce qui, sur ce client, demande une action de la plateforme.
 *
 * L'ordre des tests **est** l'ordre de gravité : un client suspendu dont
 * l'essai finit demain est un client suspendu, et lui afficher « essai
 * bientôt fini » ferait passer l'accessoire pour le principal.
 */
export function alerteClient(
  client: ClientPlateforme,
  maintenant: Date = new Date(),
): AlerteClient {
  if (client.abonnement.statut === "IMPAYE") return "IMPAYE";
  if (client.statut === "SUSPENDU") return "SUSPENDU";

  if (
    client.statut === "EN_ATTENTE" &&
    joursAvant(client.creeLe, maintenant) <= -SEUIL_INSCRIPTION_SANS_SUITE_JOURS
  ) {
    return "INSCRIPTION_SANS_SUITE";
  }

  if (client.abonnement.statut === "ESSAI" && client.abonnement.finEssai) {
    const restants = joursAvant(client.abonnement.finEssai, maintenant);
    if (restants <= SEUIL_ESSAI_BIENTOT_EXPIRE_JOURS) return "ESSAI_BIENTOT_EXPIRE";
  }

  return null;
}

/** Poids d'une alerte pour le tri — le plus grave d'abord. */
const GRAVITE: Record<NonNullable<AlerteClient>, number> = {
  IMPAYE: 4,
  SUSPENDU: 3,
  ESSAI_BIENTOT_EXPIRE: 2,
  INSCRIPTION_SANS_SUITE: 1,
};

/**
 * Les clients qui demandent une action, les plus graves en tête.
 *
 * Trier plutôt que filtrer : le back-office sert aussi à voir que tout va
 * bien, et une liste vide ne le dit pas.
 */
export function trierParUrgence(
  clients: ClientPlateforme[],
  maintenant: Date = new Date(),
): ClientPlateforme[] {
  return [...clients].sort((a, b) => {
    const alerteA = alerteClient(a, maintenant);
    const alerteB = alerteClient(b, maintenant);
    const poidsA = alerteA ? GRAVITE[alerteA] : 0;
    const poidsB = alerteB ? GRAVITE[alerteB] : 0;
    if (poidsA !== poidsB) return poidsB - poidsA;
    return a.raisonSociale.localeCompare(b.raisonSociale);
  });
}

/**
 * Un client peut-il être suspendu ?
 *
 * Un client déjà suspendu ou résilié ne le peut pas : le serveur répondra
 * `409` ou `422`, et proposer l'action ferait porter à l'utilisateur une
 * erreur qu'on pouvait lui éviter.
 */
export function suspensionPossible(client: ClientPlateforme): boolean {
  return client.statut === "ACTIF" || client.statut === "EN_ATTENTE";
}

/** Symétrique : seul un client suspendu se réactive. */
export function reactivationPossible(client: ClientPlateforme): boolean {
  return client.statut === "SUSPENDU";
}

/**
 * Le revenu mensuel récurrent.
 *
 * **Un essai ne compte pas** : il ne rapporte rien tant qu'il n'est pas
 * converti, et l'inclure gonflerait le chiffre de tout ce qui n'a pas encore
 * été signé. Un impayé ne compte pas non plus — il est facturé, pas encaissé.
 */
export function revenuMensuelCentimes(clients: ClientPlateforme[]): number {
  return clients
    .filter((client) => client.abonnement.statut === "ACTIF")
    .reduce((total, client) => total + client.abonnement.montantMensuelCentimes, 0);
}

/** Le résumé chiffré du tableau de bord, calculé depuis la liste des clients. */
export function indicateurs(clients: ClientPlateforme[]): IndicateursPlateforme {
  return {
    nbClients: clients.length,
    nbClientsActifs: clients.filter((c) => c.statut === "ACTIF").length,
    nbClientsEnEssai: clients.filter((c) => c.abonnement.statut === "ESSAI").length,
    nbClientsImpayes: clients.filter((c) => c.abonnement.statut === "IMPAYE").length,
    revenuMensuelCentimes: revenuMensuelCentimes(clients),
  };
}

/**
 * Le montant que la plateforme facture sans l'encaisser.
 *
 * C'est le pendant de `revenuMensuelCentimes`, qui exclut les impayés : le
 * revenu dit ce qui rentre, celui-ci ce qui manque. Le second chiffre donne
 * au premier sa mesure — « 12 M FCFA » ne se lit pas pareil selon qu'il
 * laisse 200 000 ou 4 M de côté.
 */
export function montantImpayeCentimes(clients: ClientPlateforme[]): number {
  return clients
    .filter((client) => client.abonnement.statut === "IMPAYE")
    .reduce((total, client) => total + client.abonnement.montantMensuelCentimes, 0);
}

/** L'état commercial d'une entreprise — la lecture « parc » de son dossier. */
export function etatCommercial(client: ClientPlateforme): EtatCommercial {
  if (client.abonnement.statut === "ESSAI") return "ESSAI";
  if (client.abonnement.statut === "ACTIF") return "ABONNEMENT_ACTIF";
  return "SANS_ABONNEMENT";
}

/**
 * La répartition du parc, dans un ordre fixe.
 *
 * **Fixe, et non trié par effectif** : un camembert dont les parts changent de
 * place d'un rafraîchissement à l'autre ne se compare plus à celui d'hier.
 * Les états vides sont conservés pour la même raison — une part à zéro se lit,
 * une part disparue se confond avec une part oubliée.
 */
export function repartitionParc(clients: ClientPlateforme[]): PartParcClient[] {
  const ordre: EtatCommercial[] = ["ABONNEMENT_ACTIF", "ESSAI", "SANS_ABONNEMENT"];
  return ordre.map((etat) => ({
    etat,
    nombre: clients.filter((client) => etatCommercial(client) === etat).length,
  }));
}

/** Combien d'essais se terminent dans les jours qui viennent. */
export function nbEssaisBientotExpires(
  clients: ClientPlateforme[],
  maintenant: Date = new Date(),
): number {
  return clients.filter(
    (client) => alerteClient(client, maintenant) === "ESSAI_BIENTOT_EXPIRE",
  ).length;
}

/** Combien de clients se sont inscrits sans jamais activer leur compte. */
export function nbInscriptionsEnAttente(clients: ClientPlateforme[]): number {
  return clients.filter((client) => client.statut === "EN_ATTENTE").length;
}

/** Part d'un effectif dans le parc, en pourcentage entier. `0` sur un parc vide. */
export function partDuParc(nombre: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((nombre / total) * 100);
}

/** Combien de mois un abonnement actif compte au revenu récurrent. */
export function nbAbonnementsFactures(clients: ClientPlateforme[]): number {
  return clients.filter((client) => client.abonnement.statut === "ACTIF").length;
}

/**
 * Les abonnements les plus récemment souscrits.
 *
 * Le tri porte sur `dateDebut`, **pas** sur `creeLe` : une entreprise inscrite
 * il y a deux ans qui souscrit aujourd'hui est un abonnement d'aujourd'hui, et
 * c'est bien ce que cette liste doit montrer.
 */
export function derniersAbonnements(
  clients: ClientPlateforme[],
  limite = 5,
): ClientPlateforme[] {
  return [...clients]
    .sort((a, b) => b.abonnement.dateDebut.getTime() - a.abonnement.dateDebut.getTime())
    .slice(0, limite);
}

/**
 * Une hausse est-elle une bonne nouvelle, pour cet indicateur ?
 *
 * **C'est une règle métier, pas une couleur.** « +40 % » se lit vert sur les
 * clients et rouge sur les impayés ; écrire ce choix dans le composant
 * reviendrait à décider dans une feuille de style qu'un impayé de plus est un
 * progrès. Les essais sont favorables : ce sont les conversions de demain,
 * même s'ils ne rapportent rien aujourd'hui.
 */
const HAUSSE_FAVORABLE: Record<CleIndicateur, boolean> = {
  nbClients: true,
  clientsActifs: true,
  enEssai: true,
  impayes: false,
  revenuMensuel: true,
};

/** Ce que vaut une variation pour cet indicateur. */
export function tonVariation(cle: CleIndicateur, variationPourcent: number): TonVariation {
  if (variationPourcent === 0) return "NEUTRE";
  const hausse = variationPourcent > 0;
  return hausse === HAUSSE_FAVORABLE[cle] ? "FAVORABLE" : "DEFAVORABLE";
}

/** La tendance d'un indicateur dans une liste, ou `null` si le serveur l'ignore. */
export function tendanceDe(
  tendances: TendanceIndicateur[],
  cle: CleIndicateur,
): TendanceIndicateur | null {
  return tendances.find((tendance) => tendance.cle === cle) ?? null;
}

/** Les fenêtres proposées sur l'historique des renouvellements, en jours. */
export const FENETRES_EVOLUTION = [90, 30, 7] as const;

export type FenetreEvolution = (typeof FENETRES_EVOLUTION)[number];

/**
 * Les `jours` derniers points d'un historique.
 *
 * Le filtre se fait sur la date et non sur les `n` derniers éléments : une
 * série à trous — ce qu'un serveur renvoie dès qu'un jour n'a rien à dire —
 * donnerait sinon une fenêtre plus longue que celle demandée.
 */
export function fenetreEvolution(
  points: PointEvolutionAbonnements[],
  jours: number,
  maintenant: Date = new Date(),
): PointEvolutionAbonnements[] {
  const debut = new Date(maintenant);
  debut.setDate(debut.getDate() - (jours - 1));
  debut.setHours(0, 0, 0, 0);
  return points.filter((point) => point.date >= debut);
}

/** Le total d'une série sur la fenêtre affichée — la légende du graphique. */
export function cumulEvolution(points: PointEvolutionAbonnements[]): {
  renouveles: number;
  nonRenouveles: number;
} {
  return points.reduce(
    (total, point) => ({
      renouveles: total.renouveles + point.renouveles,
      nonRenouveles: total.nonRenouveles + point.nonRenouveles,
    }),
    { renouveles: 0, nonRenouveles: 0 },
  );
}
