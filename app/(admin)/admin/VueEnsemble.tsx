"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { EtatChargement, EtatErreur } from "@/components/ui";
import { listerClients } from "@/features/administration/adaptateur";

import { CLES_ADMINISTRATION } from "./cles";
import { DerniersAbonnements } from "./DerniersAbonnements";
import { GraphiqueParcClients } from "./GraphiqueParcClients";
import { GraphiqueRenouvellements } from "./GraphiqueRenouvellements";
import { IndicateursCles } from "./IndicateursCles";

/**
 * La vue d'ensemble du parc client.
 *
 * Elle se lit de haut en bas comme une réponse qui se précise :
 *
 * 1. **les cinq chiffres** — la taille et la santé du parc, d'un coup d'œil ;
 * 2. **les deux graphiques** — la tendance (ce qui se renouvelle, ce qui
 *    tombe) et la composition (qui paie, qui essaie, qui est parti). Trois
 *    quarts / un quart, parce qu'une série de 90 jours a besoin de largeur
 *    là où trois parts n'en ont pas ;
 * 3. **les cinq dernières souscriptions** — ce qui vient de se passer.
 *
 * Une liste de tous les clients n'aurait rien dit de plus que l'écran
 * « Clients », qui existe déjà pour ça.
 *
 * **Une seule requête alimente tout le haut de l'écran** : les tuiles, le
 * camembert et le tableau dérivent de la liste des clients, par des règles du
 * domaine. Seul le graphique des renouvellements a sa propre source — un
 * historique ne se déduit pas de l'état courant.
 */
export function VueEnsemble() {
  const t = useTranslations("administration");

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.clients(),
    queryFn: ({ signal }) => listerClients(signal),
  });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) {
    return (
      <EtatErreur
        message={t("erreurs.chargement")}
        onReessayer={() => void requete.refetch()}
      />
    );
  }

  const clients = requete.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-bold text-neutral-900">{t("tableauDeBord.titre")}</h1>

      <IndicateursCles clients={clients} />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <GraphiqueRenouvellements />
        </div>
        <GraphiqueParcClients clients={clients} />
      </div>

      <DerniersAbonnements clients={clients} />
    </div>
  );
}
