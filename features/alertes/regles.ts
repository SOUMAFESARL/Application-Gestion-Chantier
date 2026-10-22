/**
 * Les règles du domaine Alertes de retard — pures, sans React.
 *
 * Tout ce que l'écran décide sur une alerte vit ici : sa teinte, ce qui la
 * compte pour « ouverte », ce que cherche la recherche, qui peut la clôturer.
 * Le composant ne garde que l'état de ses contrôles.
 */

import type { ProfilUtilisateur } from "@/features/auth/api";
import { personneQuiSigne } from "@/features/habilitations/regles";
import type { Droits } from "@/features/habilitations/types";
import { fonctionsDansProjet } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";

import type {
  AlerteRetard,
  FiltreEtatAlerte,
  NiveauAlerte,
  ProjetAlerte,
  StatutAlerte,
  TonAlerte,
  TonStatutAlerte,
} from "./types";

/** Du plus grave au moins grave : l'ordre du filtre de niveau. */
export const ORDRE_NIVEAUX: readonly NiveauAlerte[] = ["CRITIQUE", "ELEVE", "MODERE"];

/** Les états du filtre, « ouvertes » en tête : c'est le choix par défaut de l'écran. */
export const ORDRE_ETATS: readonly FiltreEtatAlerte[] = [
  "OUVERTES",
  "OUVERTE",
  "EN_COURS",
  "RESOLUE",
  "IGNOREE",
];

/** Les deux états où l'alerte attend encore une réponse. */
const STATUTS_OUVERTS: readonly StatutAlerte[] = ["OUVERTE", "EN_COURS"];

/** Une alerte ouverte est une alerte qu'on peut encore clôturer. */
export function alerteOuverte(alerte: AlerteRetard): boolean {
  return STATUTS_OUVERTS.includes(alerte.statut);
}

/**
 * La teinte du niveau : le modéré avertit, l'élevé et le critique alertent.
 * Les deux derniers partagent le rouge — c'est le libellé, écrit en toutes
 * lettres à côté, qui les distingue (charte §8.4).
 */
export function tonNiveau(niveau: NiveauAlerte): TonAlerte {
  return niveau === "MODERE" ? "avertissement" : "erreur";
}

/**
 * La teinte de l'état, distincte de celle du niveau : une alerte critique déjà
 * résolue doit se lire résolue, pas rouge. Ouverte, elle attend ; en cours,
 * quelqu'un s'en occupe ; résolue, elle est close ; ignorée, elle n'a pas lieu d'être.
 */
export function tonStatut(statut: StatutAlerte): TonStatutAlerte {
  switch (statut) {
    case "OUVERTE":
      return "information";
    case "EN_COURS":
      return "primaire";
    case "RESOLUE":
      return "succes";
    case "IGNOREE":
      return "neutre";
  }
}

/** Les critères de la barre d'outils de l'écran. */
export interface CriteresAlertes {
  recherche: string;
  /** `""` : tous les niveaux. */
  niveau: NiveauAlerte | "";
  /** `""` : tous les projets. */
  projetId: string;
  /** `""` : tous les états. */
  etat: FiltreEtatAlerte | "";
}

/** L'écran s'ouvre sur les alertes à traiter, pas sur l'historique. */
export const CRITERES_PAR_DEFAUT: CriteresAlertes = {
  recherche: "",
  niveau: "",
  projetId: "",
  etat: "OUVERTES",
};

/**
 * Un critère s'écarte-t-il de l'état d'ouverture de l'écran ? C'est ce qui
 * allume « Tout afficher » : le filtre « ouvertes » posé d'office n'est pas
 * une surprise, mais le retirer à la main en est une qu'on doit pouvoir défaire.
 */
export function criteresActifs(criteres: CriteresAlertes): boolean {
  return (
    criteres.recherche.trim() !== CRITERES_PAR_DEFAUT.recherche ||
    criteres.niveau !== CRITERES_PAR_DEFAUT.niveau ||
    criteres.projetId !== CRITERES_PAR_DEFAUT.projetId ||
    criteres.etat !== CRITERES_PAR_DEFAUT.etat
  );
}

/**
 * Minuscules, sans accents : sur un clavier de chantier l'accent n'est pas
 * toujours à portée, et une recherche qui l'exige ne trouve rien.
 */
function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function correspondALEtat(alerte: AlerteRetard, etat: FiltreEtatAlerte | ""): boolean {
  if (etat === "") return true;
  if (etat === "OUVERTES") return alerteOuverte(alerte);
  return alerte.statut === etat;
}

/**
 * Les alertes restreintes aux critères de l'écran. La recherche porte sur ce
 * qu'on a en tête en ouvrant la liste : la référence ou le nom du chantier, le
 * code ou le libellé du lot.
 */
export function filtrerAlertes(alertes: AlerteRetard[], criteres: CriteresAlertes): AlerteRetard[] {
  const recherche = normaliser(criteres.recherche);

  return alertes.filter((alerte) => {
    if (criteres.niveau && alerte.niveau !== criteres.niveau) return false;
    if (criteres.projetId && alerte.projet.id !== criteres.projetId) return false;
    if (!correspondALEtat(alerte, criteres.etat)) return false;
    if (!recherche) return true;

    return [alerte.projet.reference, alerte.projet.nom, alerte.lot?.code, alerte.lot?.libelle].some(
      (champ) => normaliser(champ ?? "").includes(recherche),
    );
  });
}

/**
 * Les chantiers qui portent au moins une alerte, par référence. Niveaux et
 * états, eux, se proposent toujours en entier : l'état d'ouverture de l'écran
 * (« ouvertes ») doit rester lisible dans son filtre même quand rien n'est ouvert.
 */
export function projetsPresents(alertes: AlerteRetard[]): ProjetAlerte[] {
  const parId = new Map<string, ProjetAlerte>();
  for (const alerte of alertes) parId.set(alerte.projet.id, alerte.projet);
  return [...parId.values()].sort((a, b) => a.reference.localeCompare(b.reference, "fr"));
}

/**
 * Qui peut clôturer : le chef de projet du chantier concerné et le Directeur
 * des Opérations. **Le Directeur Général ne le peut pas** (SFD F3 §3) : il
 * est averti, il ne tranche pas.
 *
 * Recopie `AlerteRetardResoudreView` (`apps/projets/views/alertes_retard.py`).
 * Le chef de projet se reconnaît à sa fonction sur le chantier, comme pour la
 * signature d'un rapport ; le DO à son rôle global, le seul code de rôle que
 * cette règle lise — le serveur le lit de la même façon. Ce n'est pas une
 * barrière : Django répond 403 à qui n'y a pas droit.
 */
export function peutCloturerAlerte(
  alerte: AlerteRetard,
  projet: Projet | undefined,
  droits: Droits | null,
  profil: Pick<ProfilUtilisateur, "id" | "role_global" | "is_dg" | "is_owner"> | null,
): boolean {
  if (!alerteOuverte(alerte) || !droits || !profil) return false;
  if (droits.estDirection || profil.is_dg || profil.role_global === "DG") return false;
  if (profil.role_global === "DO") return true;

  const moi = personneQuiSigne(droits, profil);
  return Boolean(projet && moi && fonctionsDansProjet(projet, moi).includes("CHEF_PROJET"));
}

/**
 * Les colonnes du fichier exporté, dans l'ordre. Le fichier garde la référence
 * du chantier et l'indice de santé, que l'écran range dans le détail : un
 * export se relit sans l'application.
 */
export const COLONNES_EXPORT_ALERTES = [
  "projetReference",
  "projetNom",
  "lotCode",
  "lotLibelle",
  "niveau",
  "retard",
  "dateDetection",
  "indiceSante",
  "statut",
] as const;

/** Ce que l'export ne sait pas nommer seul : les libellés viennent de l'écran. */
export interface LibellesExportAlerte {
  niveau: (niveau: NiveauAlerte) => string;
  statut: (statut: StatutAlerte) => string;
  formaterDate: (date: string) => string;
}

/** Une ligne d'export, dans l'ordre de `COLONNES_EXPORT_ALERTES`, en valeurs brutes. */
export function valeursExportAlerte(
  alerte: AlerteRetard,
  libelles: LibellesExportAlerte,
): (string | number)[] {
  return [
    alerte.projet.reference,
    alerte.projet.nom,
    alerte.lot?.code ?? "",
    alerte.lot?.libelle ?? "",
    libelles.niveau(alerte.niveau),
    alerte.deltaPts ?? "",
    libelles.formaterDate(alerte.dateDetection),
    alerte.indiceSante ?? "",
    libelles.statut(alerte.statut),
  ];
}
