"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
  indicateurs,
  nbAbonnementsFactures,
  nbEssaisBientotExpires,
  nbInscriptionsEnAttente,
  partDuParc,
  tendanceDe,
  tonVariation,
} from "@/features/administration";
import type { CleIndicateur, ClientPlateforme } from "@/features/administration";
import { lireTendancesIndicateurs } from "@/features/administration/adaptateur";
import { formaterMontantCourt } from "@/lib/format";

import { CLES_ADMINISTRATION } from "./cles";
import { Etincelle } from "./Etincelle";
import {
  TON_FILET_VARIATION,
  TON_VARIATION,
  TUILE,
  TUILE_DETAIL,
  TUILE_FILET,
  TUILE_LIBELLE,
  TUILE_TEINTE,
  TUILE_VALEUR,
} from "./tons";

/**
 * Les quatre chiffres de tête du back-office.
 *
 * Chaque tuile dit trois choses, dans cet ordre de lecture : **combien**
 * (le chiffre), **de quoi il est fait** (la ligne de détail), **où il va**
 * (la variation du mois et sa courbe). « 18 clients » ne dit pas s'il faut
 * relancer quelqu'un ; « 18 clients · 3 inscriptions en attente · +12 % » le
 * dit.
 *
 * **Les impayés n'y figurent pas.** Ils restent un signal, mais un signal
 * d'action : leur place est sur la fiche du client concerné et dans ses
 * alertes, pas dans une ligne de chiffres qu'on lit pour prendre la
 * température du parc. Le domaine continue de les compter
 * (`montantImpayeCentimes`), c'est la tuile qui disparaît.
 *
 * **Le sens d'une hausse n'est pas décidé ici** mais par `tonVariation` : une
 * hausse d'impayés est une mauvaise nouvelle, une hausse de clients une bonne,
 * et ce jugement est une règle métier (règle 6 du plan de refonte).
 *
 * Les courbes ont leur propre requête. Les chiffres s'affichent donc sans les
 * attendre : une courbe qui arrive une seconde plus tard ne gêne personne, un
 * chiffre qui attend sa courbe, si.
 */
export function IndicateursCles({ clients }: { clients: ClientPlateforme[] }) {
  const t = useTranslations("administration.tableauDeBord");

  const requeteTendances = useQuery({
    queryKey: CLES_ADMINISTRATION.tendances(),
    queryFn: ({ signal }) => lireTendancesIndicateurs(signal),
  });

  const tendances = requeteTendances.data ?? [];

  const chiffres = indicateurs(clients);

  const tuiles: {
    cle: CleIndicateur;
    valeur: string;
    detail: string;
    aide?: string;
  }[] = [
    {
      cle: "nbClients",
      valeur: String(chiffres.nbClients),
      detail: t("detailClients", { nombre: nbInscriptionsEnAttente(clients) }),
    },
    {
      cle: "clientsActifs",
      valeur: String(chiffres.nbClientsActifs),
      detail: t("detailActifs", {
        part: partDuParc(chiffres.nbClientsActifs, chiffres.nbClients),
      }),
    },
    {
      cle: "enEssai",
      valeur: String(chiffres.nbClientsEnEssai),
      detail: t("detailEssai", { nombre: nbEssaisBientotExpires(clients) }),
    },
    {
      cle: "revenuMensuel",
      valeur: formaterMontantCourt(chiffres.revenuMensuelCentimes),
      detail: t("detailRevenu", { nombre: nbAbonnementsFactures(clients) }),
      aide: t("revenuAide"),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tuiles.map(({ cle, valeur, detail, aide }) => {
        const tendance = tendanceDe(tendances, cle);
        const variation = tendance?.variationPourcent ?? 0;
        const ton = tonVariation(cle, variation);

        const libelleVariation =
          variation === 0
            ? t("variationStable")
            : variation > 0
              ? t("variationHausse", { valeur: variation })
              : t("variationBaisse", { valeur: Math.abs(variation) });

        return (
          <article key={cle} className={`${TUILE} ${TUILE_TEINTE[cle]}`} title={aide}>
            <div className="flex items-start justify-between gap-2">
              <span className={TUILE_LIBELLE}>{t(cle)}</span>
              {tendance && (
                <span
                  className={`shrink-0 text-xs font-semibold tabular-nums ${TON_VARIATION[ton]}`}
                  title={t("comparaisonMois")}
                >
                  {libelleVariation}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className={`${TUILE_VALEUR} truncate`}>{valeur}</span>
              {tendance && (
                <span className="shrink-0">
                  <Etincelle points={tendance.points} ton={ton} />
                </span>
              )}
            </div>

            <span className={TUILE_DETAIL}>{detail}</span>

            <span
              aria-hidden="true"
              className={`${TUILE_FILET} ${TON_FILET_VARIATION[ton]}`}
            />
          </article>
        );
      })}
    </div>
  );
}
