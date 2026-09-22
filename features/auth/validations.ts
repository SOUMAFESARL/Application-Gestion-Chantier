/**
 * Les schémas zod du domaine `auth` — plan de refonte, lot 3.
 *
 * Ce fichier ne connaît ni React, ni `fetch` : il dit ce qu'est une saisie
 * acceptable, et rien d'autre. C'est ce qui permet de le réutiliser tel quel
 * le jour où la connexion passera par une server action (arbitrage A4) — la
 * règle ne changera pas de forme en changeant de côté.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import { chaineNonVide, email } from "@/lib/validations/champs";

/**
 * Le formulaire de connexion.
 *
 * Aucune règle de **force** sur le mot de passe : ici on ouvre une session
 * avec un mot de passe existant, on n'en crée pas un. Exiger douze caractères
 * à la connexion refuserait localement un mot de passe que le serveur accepte,
 * et ferait croire à une politique qui n'existe pas. La politique de création
 * vit dans `reglesMotDePasse.ts`, et elle est utilisée là où l'on définit un
 * mot de passe.
 */
export const schemaConnexion = z.object({
  email: email(
    texte("connexion.erreurEmailRequis"),
    texte("connexion.erreurEmailInvalide"),
  ),
  motDePasse: chaineNonVide(texte("connexion.erreurMotDePasseRequis")),
});

/**
 * Deux types, parce que le schéma **transforme** : ce qui entre dans le
 * formulaire n'est pas tout à fait ce qui en sort (l'adresse est mise en
 * minuscules). `react-hook-form` tient les champs dans la forme d'entrée et
 * ne remet la forme de sortie qu'à la soumission ; les confondre ferait
 * mentir le typage sur l'un des deux bords.
 */
export type SaisieConnexion = z.input<typeof schemaConnexion>;
export type ValeursConnexion = z.output<typeof schemaConnexion>;

/**
 * Le formulaire « mot de passe oublié » : une seule adresse. Aucune règle de
 * force ici non plus — la politique de création vit dans
 * `reglesMotDePasse.ts`, appliquée là où le mot de passe est effectivement
 * choisi, pas là où on demande de le changer.
 */
export const schemaOubli = z.object({
  email: email(
    texte("motDePasseOublie.erreurEmailRequis"),
    texte("motDePasseOublie.erreurEmailInvalide"),
  ),
});

export type SaisieOubli = z.input<typeof schemaOubli>;
export type ValeursOubli = z.output<typeof schemaOubli>;
