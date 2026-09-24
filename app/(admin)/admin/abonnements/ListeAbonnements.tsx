"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { aideColonnes } from "@/components/ui/data-table";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import {
  CRITERES_CLIENTS_VIDES,
  criteresClientsActifs,
  filtrerClients,
  joursAvant,
  plansPresents,
  revenuMensuelCentimes,
  statutsAbonnementPresents,
} from "@/features/administration";
import type { ClientPlateforme, CriteresClients } from "@/features/administration";
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

const colonne = aideColonnes<ClientPlateforme>();

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
 *
 * Les tuiles portent sur le parc entier, pas sur le resultat du filtre : un
 * revenu mensuel qui fondrait a chaque frappe dans la recherche ne dirait plus
 * rien de la plateforme.
 */
export function ListeAbonnements() {
  const t = useTranslations("administration");
  const [criteres, setCriteres] = useState<CriteresClients>(CRITERES_CLIENTS_VIDES);

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.clients(),
    queryFn: ({ signal }) => listerClients(signal),
  });

  const tous = useMemo(() => requete.data ?? [], [requete.data]);
  const lignes = useMemo(
    () =>
      filtrerClients(tous, criteres).sort(
        (a, b) => a.abonnement.dateFin.getTime() - b.abonnement.dateFin.getTime(),
      ),
    [tous, criteres],
  );
  const statuts = useMemo(() => statutsAbonnementPresents(tous), [tous]);
  const plans = useMemo(() => plansPresents(tous), [tous]);

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("nomCommercial", {
          id: "client",
          header: t("clients.colonneClient"),
          cell: ({ row }) => (
            <Link
              href={`/admin/clients/${row.original.id}`}
              className="flex flex-col no-underline"
            >
              <span className="font-semibold text-neutral-900 hover:text-primary-600 hover:underline">
                {row.original.nomCommercial}
              </span>
              <span className="text-xs text-neutral-600">{row.original.slug}</span>
            </Link>
          ),
        }),
        colonne.accessor((client) => client.abonnement.plan, {
          id: "plan",
          header: t("clients.colonnePlan"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => t(`plan.${getValue()}`),
        }),
        colonne.accessor((client) => client.abonnement.statut, {
          id: "statut",
          header: t("clients.colonneStatut"),
          cell: ({ getValue }) => (
            <span className={`${BADGE} ${TON_STATUT_ABONNEMENT[getValue()]}`}>
              {t(`statutAbonnement.${getValue()}`)}
            </span>
          ),
        }),
        colonne.accessor((client) => client.abonnement.montantMensuelCentimes, {
          id: "montant",
          header: t("fiche.montantMensuel"),
          meta: { classe: "text-right font-medium tabular-nums text-neutral-900" },
          cell: ({ getValue }) => formaterMontant(getValue()),
        }),
        colonne.accessor((client) => client.abonnement.renouvellementAuto, {
          id: "renouvellement",
          header: t("fiche.renouvellementAuto"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => (getValue() ? t("fiche.oui") : t("fiche.non")),
        }),
        colonne.accessor((client) => client.abonnement.dateFin, {
          id: "echeance",
          header: t("fiche.dateFin"),
          meta: { classe: `${BORD_DROIT_TABLEAU} tabular-nums text-neutral-600` },
          cell: ({ getValue }) => {
            const depassee = joursAvant(getValue()) < 0;
            return (
              <span className={depassee ? "font-semibold text-erreur" : undefined}>
                {formaterDate(getValue())}
              </span>
            );
          },
        }),
      ]),
    [t],
  );

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre={t("navigation.abonnements")} />

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
                {formaterMontantCourt(revenuMensuelCentimes(tous))}
              </span>
            </div>
            <div className={`${TUILE} ${TUILE_TEINTE.enEssai}`}>
              <span className={TUILE_LIBELLE}>{t("tableauDeBord.enEssai")}</span>
              <span className={TUILE_VALEUR}>
                {tous.filter((c) => c.abonnement.statut === "ESSAI").length}
              </span>
            </div>
          </div>

          {tous.length === 0 ? (
            <EtatVide titre={t("clients.aucunTitre")} description={t("clients.aucunDescription")} />
          ) : (
            <TableauListe
              colonnes={colonnes}
              donnees={lignes}
              cleLigne={(client) => client.id}
              messageVide={t("clients.aucun")}
              filtresActifs={criteresClientsActifs(criteres)}
              onReinitialiser={() => setCriteres(CRITERES_CLIENTS_VIDES)}
              cleCriteres={`${criteres.recherche}|${criteres.statutAbonnement}|${criteres.plan}`}
              outils={
                <>
                  <RechercheTableau
                    valeur={criteres.recherche}
                    onChangement={(recherche) => setCriteres({ ...criteres, recherche })}
                    libelle={t("clients.recherche")}
                    placeholder={t("clients.rechercheePlaceholder")}
                  />
                  <FiltreTableau
                    valeur={criteres.statutAbonnement}
                    onChangement={(statutAbonnement) =>
                      setCriteres({ ...criteres, statutAbonnement })
                    }
                    libelle={t("clients.filtreStatutAbonnement")}
                    libelleTous={t("clients.filtreStatutAbonnementTous")}
                    options={statuts.map((statut) => ({
                      valeur: statut,
                      libelle: t(`statutAbonnement.${statut}`),
                    }))}
                  />
                  <FiltreTableau
                    valeur={criteres.plan}
                    onChangement={(plan) => setCriteres({ ...criteres, plan })}
                    libelle={t("clients.filtrePlan")}
                    libelleTous={t("clients.filtrePlanTous")}
                    options={plans.map((plan) => ({ valeur: plan, libelle: t(`plan.${plan}`) }))}
                  />
                </>
              }
            />
          )}
        </>
      )}
    </div>
  );
}
