/**
 * Les règles du domaine Plateforme — couche 2, zéro React.
 */

import type { CodePlan, DefinitionPlan } from "@/features/abonnement/types";

import type { TarifPlan } from "./types";

const CENTIMES_PAR_FRANC = 100;

/**
 * Le prix annuel qu'une remise consent sur douze mensualités.
 *
 * Arrondi **au franc** : un prix en centimes n'existe pas sur une page de
 * vente en FCFA. C'est la seule façon de calculer l'annuel — le back-office
 * qui le publie passe par ici, pour que l'aperçu et le montant débité ne
 * divergent jamais d'un franc.
 */
export function prixAnnuelAvecRemise(prixMensuelCentimes: number, remisePourcent: number): number {
  const douzeMoisFrancs = (prixMensuelCentimes * 12) / CENTIMES_PAR_FRANC;
  return Math.round((douzeMoisFrancs * (100 - remisePourcent)) / 100) * CENTIMES_PAR_FRANC;
}

/** Le tarif publié d'un plan, s'il y en a un. */
export function tarifDuPlan(tarifs: TarifPlan[], code: CodePlan): TarifPlan | undefined {
  return tarifs.find((tarif) => tarif.code === code);
}

/**
 * Le catalogue de vente, aux prix et quotas paramétrés par la plateforme.
 *
 * Un plan sans tarif publié garde les valeurs du catalogue plutôt que de
 * disparaître de la page — un plan absent se remarque moins qu'un prix
 * manquant, et se vend encore moins. Ses avantages, eux, restent vides : ce
 * texte-là appartient à l'éditeur, pas au code.
 */
export function catalogueAuxTarifs(
  catalogue: DefinitionPlan[],
  tarifs: TarifPlan[],
): DefinitionPlan[] {
  return catalogue.map((plan) => {
    const tarif = tarifDuPlan(tarifs, plan.code);
    if (!tarif) return plan;
    return {
      ...plan,
      prix_mensuel_centimes: tarif.prixMensuelCentimes,
      prix_annuel_centimes: tarif.prixAnnuelCentimes,
      limite_chantiers: tarif.limiteChantiers,
      limite_utilisateurs: tarif.limiteUtilisateurs,
      limite_stockage_go: tarif.limiteStockageGo,
    };
  });
}
