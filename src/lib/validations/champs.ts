/**
 * Les briques de validation partagées — plan de refonte, lot 3.
 *
 * Elles existent pour qu'une même nature de donnée soit refusée de la même
 * façon dans tout le produit : deux formulaires qui réécrivent chacun leur
 * règle d'adresse email finissent par en accepter deux ensembles différents,
 * et c'est le serveur qui tranche — trop tard, après un aller-retour.
 *
 * Le message est **toujours passé par l'appelant**, jamais écrit ici : il
 * appartient au catalogue `messages/fr.json`, et chaque écran formule le
 * refus dans ses propres termes (Socle Commun §1.1).
 */

import { z } from "zod";

/**
 * Une chaîne non vide, débarrassée de ses espaces de bord.
 *
 * Le `trim()` est appliqué **avant** le test : une saisie d'un seul espace
 * est vide, quelle que soit la façon dont le clavier l'a produite.
 */
export function chaineNonVide(message: string) {
  return z.string().trim().min(1, { message });
}

/**
 * Une adresse email.
 *
 * Deux messages distincts, parce que ce sont deux erreurs différentes : le
 * champ n'a pas été rempli, ou il l'a été de travers. Un message unique
 * obligerait la personne à deviner laquelle des deux on lui reproche.
 *
 * L'adresse est ramenée en minuscules : le serveur compare les comptes sans
 * tenir compte de la casse, et une majuscule laissée par un clavier mobile ne
 * doit pas produire un « identifiants invalides » inexplicable.
 */
export function email(messageRequis: string, messageInvalide: string) {
  return chaineNonVide(messageRequis)
    .pipe(z.email({ message: messageInvalide }))
    .transform((valeur) => valeur.toLowerCase());
}
