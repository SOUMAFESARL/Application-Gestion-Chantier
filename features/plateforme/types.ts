/**
 * Les types du domaine Plateforme — ce que l'éditeur du SaaS publie pour
 * toutes les entreprises à la fois : ses tarifs, son nom, son logo.
 *
 * **Ni le back-office ni l'espace entreprise n'en sont propriétaires.** Le
 * premier l'écrit, le second le lit ; le loger chez l'un aurait fait importer
 * `features/administration` par la page de tarifs d'un client.
 */

import type { CodePlan } from "@/features/abonnement/types";

/**
 * Une ligne de la liste d'avantages d'un plan, sur la page de tarifs.
 *
 * `inclus: false` affiche la ligne **barrée** : c'est ce qui fait lire la
 * comparaison d'une carte à l'autre (« ceci, vous l'aurez au plan du dessus »).
 */
export interface AvantagePlan {
  libelle: string;
  inclus: boolean;
}

/**
 * Tout ce que la page de tarifs de l'espace entreprise affiche d'un plan :
 * prix, remise annuelle, quotas et avantages — paramétrés au back-office.
 *
 * **Les quotas publiés ici sont ceux que le serveur doit appliquer.** Les
 * rendre éditables n'a de sens que si Django lit la même valeur pour bloquer
 * le sixième chantier d'un client « 5 chantiers » : sans quoi la page
 * promettrait ce que le schéma du client ne tient pas. C'est un engagement du
 * contrat `PUT /admins/parametres/tarifs/`, pas un texte d'affichage.
 */
export interface TarifPlan {
  code: CodePlan;
  /** Le nom commercial du plan (« Maître d'Œuvre ») — le code, lui, ne change jamais. */
  libelle: string;
  /** En centimes, TTC. */
  prixMensuelCentimes: number;
  /** Remise consentie sur douze mensualités, en pourcentage entier. */
  remiseAnnuellePourcent: number;
  /**
   * En centimes, TTC — **calculé** depuis le mensuel et la remise
   * (`prixAnnuelAvecRemise`), mais publié tel quel : c'est ce montant que la
   * souscription débite, et le client doit lire le même.
   */
  prixAnnuelCentimes: number;
  /** `null` : illimité. */
  limiteChantiers: number | null;
  /** `null` : illimité. */
  limiteUtilisateurs: number | null;
  limiteStockageGo: number;
  /** Dans l'ordre d'affichage, les inclus d'abord par convention. */
  avantages: AvantagePlan[];
}

/** Le nom et le logo sous lesquels la plateforme se présente. */
export interface IdentitePlateforme {
  nom: string;
  /** Une URL d'image, ou `null` pour le signe CCD par défaut. */
  logo: string | null;
}
