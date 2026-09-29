/**
 * L'accès aux paramètres publics de la plateforme — couche 4.
 *
 * `apiPlateforme`, **sans jeton** : ces deux lectures servent la page de
 * tarifs et la barre latérale de n'importe quelle entreprise, et le
 * back-office qui les a écrites. Ni l'un ni l'autre ne doit présenter son
 * jeton à une route qui n'en demande pas.
 *
 * Aucun des deux endpoints n'existe encore côté Django : sous
 * `NEXT_PUBLIC_API_SIMULE`, la réponse vient de la simulation du back-office,
 * qui garde ce que l'écran de paramétrage y a écrit.
 */

import { apiPlateforme } from "@/lib/api";
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";
import { simulationParametresPublics } from "@/lib/api/simulationAdministration";

import type { CodePlan } from "@/features/abonnement/types";

import type { IdentitePlateforme, TarifPlan } from "./types";

interface ChargeTarifPlan {
  plan_code: CodePlan;
  libelle: string;
  prix_mensuel_centimes: number;
  prix_annuel_centimes: number;
  remise_annuelle_pourcent: number;
  limite_chantiers: number | null;
  limite_utilisateurs: number | null;
  limite_stockage_go: number;
  avantages: { libelle: string; inclus: boolean }[];
}

interface ChargeIdentitePlateforme {
  nom: string;
  logo_url: string | null;
}

/** `GET /plateforme/tarifs/` — prix, remise, quotas et avantages de chaque plan, dans l'ordre du catalogue. */
export async function lireTarifs(signal?: AbortSignal): Promise<TarifPlan[]> {
  const charges: ChargeTarifPlan[] = SIMULATION_ACTIVE
    ? await simulationParametresPublics.lireTarifs()
    : await apiPlateforme.lire<ChargeTarifPlan[]>("/plateforme/tarifs/", undefined, signal);

  return charges.map((charge) => ({
    code: charge.plan_code,
    libelle: charge.libelle,
    prixMensuelCentimes: charge.prix_mensuel_centimes,
    prixAnnuelCentimes: charge.prix_annuel_centimes,
    remiseAnnuellePourcent: charge.remise_annuelle_pourcent,
    limiteChantiers: charge.limite_chantiers,
    limiteUtilisateurs: charge.limite_utilisateurs,
    limiteStockageGo: charge.limite_stockage_go,
    avantages: (charge.avantages ?? []).map((avantage) => ({
      libelle: avantage.libelle,
      inclus: avantage.inclus,
    })),
  }));
}

/** `GET /plateforme/identite/` — le nom et le logo de la plateforme. */
export async function lireIdentite(signal?: AbortSignal): Promise<IdentitePlateforme> {
  const charge: ChargeIdentitePlateforme = SIMULATION_ACTIVE
    ? await simulationParametresPublics.lireIdentite()
    : await apiPlateforme.lire<ChargeIdentitePlateforme>(
        "/plateforme/identite/",
        undefined,
        signal,
      );

  return { nom: charge.nom, logo: charge.logo_url };
}
