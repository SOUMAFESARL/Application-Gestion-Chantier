/**
 * Les schémas zod du domaine Administration — couche 3.
 *
 * Ni React, ni `fetch` : ces schémas disent ce qu'est une saisie acceptable,
 * et le jour où le back-office passera par des server actions (arbitrage A4),
 * ils s'y déplaceront tels quels.
 */

import { z } from "zod";

import { ACCES_MODULE } from "@/features/roles/types";
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

/**
 * La nouvelle échéance d'un abonnement, au format ISO court (`2026-11-05`).
 *
 * Elle ne précède pas le début de l'abonnement : une période qui finit avant
 * d'avoir commencé n'a pas de sens, et le serveur la refuserait. Une date
 * passée reste permise — c'est ainsi qu'on clôt un abonnement à la main.
 */
export function schemaFinAbonnement(dateDebut: string) {
  return z.object({
    dateFin: chaineNonVide(texte("administration.finAbonnement.erreurDateRequise")).refine(
      (valeur) => valeur >= dateDebut,
      texte("administration.finAbonnement.erreurAvantDebut"),
    ),
  });
}

export type SaisieFinAbonnement = z.input<ReturnType<typeof schemaFinAbonnement>>;
export type ValeursFinAbonnement = z.output<ReturnType<typeof schemaFinAbonnement>>;

/**
 * Un numéro de téléphone facultatif : vide, ou des chiffres avec un `+` de
 * tête et des espaces de lecture.
 *
 * Pas de `ChampTelephone` ici : il suit le pays **d'une entreprise**, et un
 * agent de la plateforme n'en a pas. La forme suffit — personne n'envoie de
 * lien WhatsApp à ce numéro.
 */
const telephoneFacultatif = (message: string) =>
  z
    .string()
    .trim()
    .refine((valeur) => valeur === "" || /^\+?[0-9 ]{8,20}$/.test(valeur), { message });

/** Le profil de l'agent connecté — le rôle n'en fait pas partie. */
export const schemaProfilAdministrateur = z.object({
  prenom: chaineNonVide(texte("administration.profil.erreurPrenomRequis")),
  nom: chaineNonVide(texte("administration.profil.erreurNomRequis")),
  email: email(
    texte("administration.profil.erreurEmailRequis"),
    texte("administration.profil.erreurEmailInvalide"),
  ),
  telephone: telephoneFacultatif(texte("administration.profil.erreurTelephoneInvalide")),
});

export type SaisieProfilAdministrateur = z.input<typeof schemaProfilAdministrateur>;
export type ValeursProfilAdministrateur = z.output<typeof schemaProfilAdministrateur>;

/**
 * La création d'un compte d'agent.
 *
 * **Pas de mot de passe** : le serveur envoie une invitation, et c'est l'agent
 * qui choisit le sien. Un mot de passe fixé par un tiers est un mot de passe
 * que deux personnes connaissent.
 */
export const schemaCreationAdministrateur = z.object({
  prenom: chaineNonVide(texte("administration.parametres.comptes.erreurPrenomRequis")),
  nom: chaineNonVide(texte("administration.parametres.comptes.erreurNomRequis")),
  email: email(
    texte("administration.parametres.comptes.erreurEmailRequis"),
    texte("administration.parametres.comptes.erreurEmailInvalide"),
  ),
  role: z.enum(["SUPERVISEUR", "SUPPORT"], {
    message: texte("administration.parametres.comptes.erreurRoleRequis"),
  }),
});

export type SaisieCreationAdministrateur = z.input<typeof schemaCreationAdministrateur>;
export type ValeursCreationAdministrateur = z.output<typeof schemaCreationAdministrateur>;

/** Au-delà, ce n'est plus un nom de module mais une phrase : il ne tiendrait pas dans la nav. */
const LIBELLE_MODULE_MAX = 60;
/** Une ligne de tableau, pas une notice : la description se lit dans une cellule. */
const DESCRIPTION_MODULE_MAX = 240;

/**
 * La création ou la modification d'un module du catalogue.
 *
 * Libellé et description sont requis : un module sans description est un
 * module dont personne, côté entreprise, ne comprend ce qu'il couvre au
 * moment d'y attribuer des droits. L'accès par défaut, lui, peut être vide.
 */
export const schemaModule = z.object({
  libelle: chaineNonVide(texte("administration.parametres.modules.erreurLibelleRequis")).max(
    LIBELLE_MODULE_MAX,
    texte("administration.parametres.modules.erreurLibelleLong", { max: LIBELLE_MODULE_MAX }),
  ),
  description: chaineNonVide(
    texte("administration.parametres.modules.erreurDescriptionRequise"),
  ).max(
    DESCRIPTION_MODULE_MAX,
    texte("administration.parametres.modules.erreurDescriptionLongue", {
      max: DESCRIPTION_MODULE_MAX,
    }),
  ),
  /** Une liste vide est une réponse valide : « Aucun ». */
  accesParDefaut: z.array(z.enum(ACCES_MODULE)),
});

export type SaisieModule = z.input<typeof schemaModule>;
export type ValeursModule = z.output<typeof schemaModule>;

/**
 * Un prix saisi **en francs**, entier et strictement positif.
 *
 * La saisie se fait en francs parce que c'est l'unité qu'on lit sur la page de
 * tarifs ; la conversion en centimes est celle de l'adaptateur. Un prix nul
 * n'est pas une offre gratuite, c'est un champ oublié : l'essai gratuit existe
 * déjà, ailleurs.
 */
const prixFrancs = () =>
  z
    .number({ message: texte("administration.parametres.tarifs.erreurPrixRequis") })
    .int({ message: texte("administration.parametres.tarifs.erreurPrixEntier") })
    .positive({ message: texte("administration.parametres.tarifs.erreurPrixPositif") });

/** Au-delà, la carte de tarif devient une notice : la page de vente ne se lit plus. */
export const LONGUEUR_MAX_AVANTAGE = 90;
/** Un nom de forfait tient sur une ligne de carte, et dans une colonne de tableau. */
export const LONGUEUR_MAX_NOM_PLAN = 40;
export const NOMBRE_MAX_AVANTAGES = 12;

/**
 * Une ligne d'avantage. Une ligne vide n'est pas refusée en silence : c'est un
 * ajout oublié, que l'agent doit remplir ou retirer lui-même.
 */
const avantage = () =>
  z.object({
    libelle: z
      .string()
      .trim()
      .min(1, { message: texte("administration.parametres.tarifs.erreurAvantageRequis") })
      .max(LONGUEUR_MAX_AVANTAGE, {
        message: texte("administration.parametres.tarifs.erreurAvantageTropLong", {
          max: LONGUEUR_MAX_AVANTAGE,
        }),
      }),
    inclus: z.boolean(),
  });

/** Au-delà, l'annuel ne rapporte plus rien : c'est une faute de frappe, pas une offre. */
export const REMISE_MAX_POURCENT = 90;

/**
 * Un quota saisi : un entier strictement positif, sauf quand le plan est
 * illimité — la valeur restée dans le champ grisé est alors ignorée, même
 * vide (d'où `z.nan()` : un champ numérique vidé vaut `NaN`).
 */
const quota = () => z.union([z.number(), z.nan()]);

function verifierQuota(
  valeur: number,
  illimite: boolean,
  chemin: string,
  contexte: z.RefinementCtx,
): void {
  if (illimite) return;
  if (!Number.isInteger(valeur) || valeur < 1) {
    contexte.addIssue({
      code: "custom",
      path: [chemin],
      message: texte("administration.parametres.tarifs.erreurQuota"),
    });
  }
}

export const schemaTarifs = z.object({
  tarifs: z.array(
    z
      .object({
        code: z.enum(["BATISSEUR", "MAITRE_OEUVRE", "PROMOTEUR"]),
        libelle: z
          .string()
          .trim()
          .min(1, { message: texte("administration.parametres.tarifs.erreurNomRequis") })
          .max(LONGUEUR_MAX_NOM_PLAN, {
            message: texte("administration.parametres.tarifs.erreurNomTropLong", {
              max: LONGUEUR_MAX_NOM_PLAN,
            }),
          }),
        prixMensuel: prixFrancs(),
        remiseAnnuelle: z
          .number({ message: texte("administration.parametres.tarifs.erreurRemise") })
          .int({ message: texte("administration.parametres.tarifs.erreurRemise") })
          .min(0, { message: texte("administration.parametres.tarifs.erreurRemise") })
          .max(REMISE_MAX_POURCENT, {
            message: texte("administration.parametres.tarifs.erreurRemise"),
          }),
        chantiersIllimites: z.boolean(),
        limiteChantiers: quota(),
        utilisateursIllimites: z.boolean(),
        limiteUtilisateurs: quota(),
        limiteStockageGo: quota(),
        avantages: z.array(avantage()).max(NOMBRE_MAX_AVANTAGES),
      })
      .superRefine((tarif, contexte) => {
        verifierQuota(tarif.limiteChantiers, tarif.chantiersIllimites, "limiteChantiers", contexte);
        verifierQuota(
          tarif.limiteUtilisateurs,
          tarif.utilisateursIllimites,
          "limiteUtilisateurs",
          contexte,
        );
        verifierQuota(tarif.limiteStockageGo, false, "limiteStockageGo", contexte);
      }),
  ),
});

export type SaisieTarifs = z.input<typeof schemaTarifs>;
export type ValeursTarifs = z.output<typeof schemaTarifs>;

/**
 * Le changement de mot de passe.
 *
 * Seuls deux refus vivent ici : un champ vide, et un nouveau mot de passe
 * identique à l'ancien. La **robustesse** n'y est pas — ses règles viennent du
 * référentiel du serveur (`useReglesMotDePasse`), et les recopier ici en ferait
 * deux versions qui divergeraient au premier changement de politique.
 */
export const schemaChangementMotDePasse = z
  .object({
    actuel: z.string().min(1, { message: texte("administration.profil.motDePasse.erreurActuelRequis") }),
    nouveau: z.string().min(1, { message: texte("administration.profil.motDePasse.erreurNouveauRequis") }),
  })
  .refine((valeurs) => valeurs.nouveau !== valeurs.actuel, {
    path: ["nouveau"],
    message: texte("administration.profil.motDePasse.erreurIdentique"),
  });

export type ValeursChangementMotDePasse = z.output<typeof schemaChangementMotDePasse>;

/** Au-delà, le nom ne tient plus dans la barre latérale repliée à moitié. */
const NOM_PLATEFORME_MAX = 40;

export const schemaIdentitePlateforme = z.object({
  nom: chaineNonVide(texte("administration.parametres.identite.erreurNomRequis")).max(
    NOM_PLATEFORME_MAX,
    texte("administration.parametres.identite.erreurNomLong"),
  ),
});

export type SaisieIdentitePlateforme = z.input<typeof schemaIdentitePlateforme>;
export type ValeursIdentitePlateforme = z.output<typeof schemaIdentitePlateforme>;
