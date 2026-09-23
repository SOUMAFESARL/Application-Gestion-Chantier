/**
 * Les schémas zod du domaine Administration — couche 3.
 *
 * Ni React, ni `fetch` : ces schémas disent ce qu'est une saisie acceptable,
 * et le jour où le back-office passera par des server actions (arbitrage A4),
 * ils s'y déplaceront tels quels.
 */

import { z } from "zod";

import { texte } from "@/i18n/horsReact";
import { chaineNonVide, email } from "@/lib/validations/champs";

/**
 * La connexion au back-office.
 *
 * **Aucune règle de force sur le mot de passe**, pour la même raison que côté
 * entreprise : on ouvre une session avec un mot de passe existant, on n'en
 * crée pas un. Exiger douze caractères ici refuserait localement ce que le
 * serveur accepte.
 */
export const schemaConnexionAdministrateur = z.object({
  email: email(
    texte("administration.connexion.erreurEmailRequis"),
    texte("administration.connexion.erreurEmailInvalide"),
  ),
  motDePasse: chaineNonVide(texte("administration.connexion.erreurMotDePasseRequis")),
});

export type SaisieConnexionAdministrateur = z.input<typeof schemaConnexionAdministrateur>;
export type ValeursConnexionAdministrateur = z.output<typeof schemaConnexionAdministrateur>;

/**
 * La demande de réinitialisation du mot de passe d'administration.
 *
 * Son jumeau côté entreprise (`schemaOubli`) ne peut pas servir ici : ses
 * messages d'erreur parlent d'une « adresse e-mail », quand ce formulaire
 * n'accepte qu'une adresse professionnelle de la plateforme. Deux espaces,
 * deux tables de comptes, deux libellés.
 */
export const schemaOubliAdministrateur = z.object({
  email: email(
    texte("administration.motDePasseOublie.erreurEmailRequis"),
    texte("administration.motDePasseOublie.erreurEmailInvalide"),
  ),
});

export type SaisieOubliAdministrateur = z.input<typeof schemaOubliAdministrateur>;
export type ValeursOubliAdministrateur = z.output<typeof schemaOubliAdministrateur>;

/** Un motif trop court n'apprend rien à celui qui relira le journal d'audit. */
const MOTIF_MIN = 10;

/**
 * La suspension d'un client — le motif est **obligatoire**.
 *
 * Couper l'accès d'une entreprise entière est l'action la plus lourde du
 * back-office, et la seule trace qu'il en restera est ce que l'agent aura
 * écrit. Un champ facultatif serait un champ vide.
 */
export const schemaSuspension = z.object({
  motif: chaineNonVide(texte("administration.suspension.erreurMotifRequis")).min(
    MOTIF_MIN,
    texte("administration.suspension.erreurMotifCourt"),
  ),
});

export type SaisieSuspension = z.input<typeof schemaSuspension>;
export type ValeursSuspension = z.output<typeof schemaSuspension>;

/** Le changement de plan d'un client. */
export const schemaChangementPlan = z.object({
  plan: z.enum(["BATISSEUR", "MAITRE_OEUVRE", "PROMOTEUR"], {
    message: texte("administration.abonnement.erreurPlanRequis"),
  }),
});

export type SaisieChangementPlan = z.input<typeof schemaChangementPlan>;
export type ValeursChangementPlan = z.output<typeof schemaChangementPlan>;
