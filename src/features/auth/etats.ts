/**
 * Les issues du parcours de connexion, traduites en états d'écran.
 *
 * **Le serveur ne distingue plus les causes d'échec.** Adresse inconnue, mot de
 * passe faux, compte bloqué, désactivé ou jamais activé : les cinq répondent
 * `401 identifiants_invalides`, `details` vide, identiques octet pour octet
 * (contrat d'API §6.1). Distinguer les causes revenait à apprendre à un
 * attaquant quelles adresses sont enregistrées.
 *
 * Ce que l'écran affiche en plus — « Tentative 2 sur 5 », puis l'écran de
 * blocage — vient donc d'un **compteur tenu par le client** : le nombre de fois
 * qu'il a soumis ce formulaire, avec cette adresse, depuis le chargement de la
 * page. L'information n'a pas changé de valeur, elle a changé de propriétaire.
 *
 * > Le compteur qui **bloque** reste celui du serveur, en base. Celui-ci ne
 * > change que ce qui est écrit à l'écran : le remettre à zéro ne débloque rien.
 */

import { ErreurApi } from "@/lib/api";

/** Socle Commun §2.1 — blocage au cinquième échec. */
export const TENTATIVES_MAX = 5;

/**
 * `message` vaut celui de l'API quand elle en a rédigé un — guide frontend §9 :
 * « le message vient de l'API, qui l'a rédigé pour un humain ». Il vaut `null`
 * quand c'est au client de parler, et l'écran prend alors sa propre traduction.
 * Aucune phrase n'est écrite ici : ce module classe des issues, il ne rédige pas.
 */
export type EtatConnexion =
  | { nom: "saisie" }
  | { nom: "chargement" }
  | { nom: "succes" }
  | { nom: "session_expiree" }
  | { nom: "identifiants_invalides"; message: string; tentatives: number }
  | { nom: "compte_bloque" }
  | { nom: "erreur_reseau"; message: string }
  | { nom: "trop_de_requetes" }
  | { nom: "erreur_inattendue"; message: string | null; reference: string | null };


/**
 * Cet échec compte-t-il comme une tentative ?
 *
 * Une panne réseau et un `429` ne sont pas des mots de passe ratés : les faire
 * avancer le compteur afficherait un blocage que le serveur ne prononcera pas.
 */
export function compteCommeTentative(cause: unknown): boolean {
  return cause instanceof ErreurApi && cause.code === "identifiants_invalides";
}

/**
 * Traduit une erreur d'API en état d'écran.
 *
 * `tentatives` est le compteur **client** après cet échec. C'est lui, et non le
 * serveur, qui fait basculer l'écran sur l'état bloqué.
 */
export function etatDepuisErreur(cause: unknown, tentatives: number): EtatConnexion {
  if (!(cause instanceof ErreurApi)) {
    return { nom: "erreur_inattendue", message: null, reference: null };
  }

  switch (cause.code) {
    case "identifiants_invalides":
      return tentatives >= TENTATIVES_MAX
        ? { nom: "compte_bloque" }
        : { nom: "identifiants_invalides", message: cause.message, tentatives };

    case "reseau_indisponible":
      return { nom: "erreur_reseau", message: cause.message };

    // 429 : la plateforme protège l'ensemble des comptes, pas celui-ci. Le
    // message de l'écran le dit sans parler de « tentatives », qui prêterait
    // à confusion avec le compteur des cinq essais — et l'état est distinct
    // de la panne réseau, dont l'action de reprise n'est pas la même.
    case "trop_de_requetes":
      return { nom: "trop_de_requetes" };

    default:
      return {
        nom: "erreur_inattendue",
        message: cause.message,
        reference: cause.traceId,
      };
  }
}

/** Le formulaire est-il utilisable dans cet état ? */
export function saisiePossible(etat: EtatConnexion): boolean {
  return !["chargement", "succes", "compte_bloque"].includes(etat.nom);
}
