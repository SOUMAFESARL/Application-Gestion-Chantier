"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { EtatChargement, EtatErreur, EtatVide, Tableau } from "@/components/ui";
import type { Colonne } from "@/components/ui";
import { joursAvant, revenuMensuelCentimes } from "@/features/administration";
import type { ClientPlateforme } from "@/features/administration";
import { listerClients } from "@/features/administration/adaptateur";
import { formaterDate, formaterMontant, formaterMontantCourt } from "@/lib/format";

import { CLES_ADMINISTRATION } from "../cles";
import {
  BADGE,
  TON_STATUT_ABONNEMENT,
  TUILE,
  TUILE_LIBELLE,
  TUILE_TEINTE,
  TUILE_VALEUR,
} from "../tons";

/**
 * Les abonnements, par echeance.
 *
 * **Le meme jeu de donnees que l'ecran « Clients », lu autrement.** Ce n'est
 * pas une duplication : la liste des clients repond a « qui sont-ils »,
 * celle-ci a « qu'est-ce qui arrive a echeance ». Les deux partagent la cle de
 * cache, donc la seconde ne declenche aucune requete supplementaire.
 *
 * Le tri est **croissant sur l'echeance** : ce qui est deja depasse remonte
 * en tete, ce qui est le seul ordre utile pour un suivi de facturation.
 */
export function ListeAbonnements() {
  const t = useTranslations("administration");
  const router = useRouter();

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.clients(),
    queryFn: ({ signal }) => listerClients(signal),
  });

  const lignes = useMemo(
    () =>
      [...(requete.data ?? [])].sort(
        (a, b) => a.abonnement.dateFin.getTime() - b.abonnement.dateFin.getTime(),
      ),
    [requete.data],
  );

  const colonnes: Colonne<ClientPlateforme>[] = [
    {
      cle: "client",
      entete: t("clients.colonneClient"),
      figee: true,
      largeurMinimale: "200px",
      rendu: (client) => (
        <span className="font-medium text-neutral-900">{client.nomCommercial}</span>
      ),
    },
    {
      cle: "plan",
      entete: t("clients.colonnePlan"),
      rendu: (client) => t(`plan.${client.abonnement.plan}`),
    },
    {
      cle: "statut",
      entete: t("clients.colonneStatut"),
      rendu: (client) => (
        <span className={`${BADGE} ${TON_STATUT_ABONNEMENT[client.abonnement.statut]}`}>
          {t(`statutAbonnement.${client.abonnement.statut}`)}
        </span>
      ),
    },
    {
      cle: "montant",
      entete: t("fiche.montantMensuel"),
      aligneADroite: true,
      rendu: (client) => formaterMontant(client.abonnement.montantMensuelCentimes),
    },
    {
      cle: "echeance",
      entete: t("fiche.dateFin"),
      secondaire: true,
      rendu: (client) => {
        const depassee = joursAvant(client.abonnement.dateFin) < 0;
        return (
          <span className={depassee ? "font-semibold text-erreur" : undefined}>
            {formaterDate(client.abonnement.dateFin)}
          </span>
        );
      },
    },
    {
      cle: "renouvellement",
      entete: t("fiche.renouvellementAuto"),
      secondaire: true,
      rendu: (client) =>
        client.abonnement.renouvellementAuto ? t("fiche.oui") : t("fiche.non"),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-h2 font-bold text-neutral-900">
          {t("navigation.abonnements")}
        </h1>
      </div>

      {requete.isPending && <EtatChargement />}

      {requete.isError && (
        <EtatErreur
          message={t("erreurs.chargement")}
          onReessayer={() => void requete.refetch()}
        />
      )}

      {requete.isSuccess && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div
              className={`${TUILE} ${TUILE_TEINTE.revenuMensuel}`}
              title={t("tableauDeBord.revenuAide")}
            >
              <span className={TUILE_LIBELLE}>{t("tableauDeBord.revenuMensuel")}</span>
              <span className={TUILE_VALEUR}>
                {formaterMontantCourt(revenuMensuelCentimes(lignes))}
              </span>
            </div>
            <div className={`${TUILE} ${TUILE_TEINTE.enEssai}`}>
              <span className={TUILE_LIBELLE}>{t("tableauDeBord.enEssai")}</span>
              <span className={TUILE_VALEUR}>
                {lignes.filter((c) => c.abonnement.statut === "ESSAI").length}
              </span>
            </div>
          </div>

          {lignes.length === 0 ? (
            <EtatVide titre={t("clients.aucunTitre")} description={t("clients.aucun")} />
          ) : (
            <Tableau
              colonnes={colonnes}
              lignes={lignes}
              cleLigne={(client) => client.id}
              onLigneCliquee={(client) => router.push(`/admin/clients/${client.id}`)}
              legende={t("navigation.abonnements")}
              tailleDePage={10}
            />
          )}
        </>
      )}
    </div>
  );
}
