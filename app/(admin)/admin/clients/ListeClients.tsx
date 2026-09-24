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
  alerteClient,
  CRITERES_CLIENTS_VIDES,
  criteresClientsActifs,
  filtrerClients,
  plansPresents,
  statutsClientPresents,
  trierParUrgence,
} from "@/features/administration";
import type { ClientPlateforme, CriteresClients } from "@/features/administration";
import { listerClients } from "@/features/administration/adaptateur";
import { nomDePays } from "@/lib/format";

import { CLES_ADMINISTRATION } from "../cles";
import { BADGE, TON_ALERTE, TON_STATUT_ABONNEMENT, TON_STATUT_CLIENT } from "../tons";

const colonne = aideColonnes<ClientPlateforme>();

/**
 * La liste des entreprises clientes.
 *
 * Elle est **triee par urgence**, et non par ordre alphabetique : l'ecran sert
 * d'abord a voir ce qui ne va pas. Le tri alphabetique n'intervient qu'entre
 * deux clients de meme gravite, pour que l'ordre reste stable d'un
 * rafraichissement a l'autre.
 *
 * Le tableau est le `TableauListe` commun — celui de la liste des chantiers :
 * recherche, filtres, case a cocher et pagination y sont les memes que dans
 * l'espace entreprise. Le filtrage vit dans `features/administration/regles`.
 */
export function ListeClients() {
  const t = useTranslations("administration");
  const [criteres, setCriteres] = useState<CriteresClients>(CRITERES_CLIENTS_VIDES);

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.clients(),
    queryFn: ({ signal }) => listerClients(signal),
  });

  const tous = useMemo(() => requete.data ?? [], [requete.data]);
  const clients = useMemo(
    () => trierParUrgence(filtrerClients(tous, criteres)),
    [tous, criteres],
  );
  const statuts = useMemo(() => statutsClientPresents(tous), [tous]);
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
        colonne.accessor("ville", {
          id: "pays",
          header: t("clients.colonnePays"),
          meta: { classe: "text-neutral-700" },
          cell: ({ row }) =>
            t("clients.villePays", {
              ville: row.original.ville,
              pays: nomDePays(row.original.pays),
            }),
        }),
        colonne.accessor("statut", {
          header: t("clients.colonneStatut"),
          cell: ({ getValue }) => (
            <span className={`${BADGE} ${TON_STATUT_CLIENT[getValue()]}`}>
              {t(`statutClient.${getValue()}`)}
            </span>
          ),
        }),
        colonne.accessor((client) => client.abonnement.plan, {
          id: "plan",
          header: t("clients.colonnePlan"),
          cell: ({ row }) => (
            <span className="flex flex-col gap-1">
              <span className="text-neutral-700">{t(`plan.${row.original.abonnement.plan}`)}</span>
              <span
                className={`${BADGE} ${TON_STATUT_ABONNEMENT[row.original.abonnement.statut]} self-start`}
              >
                {t(`statutAbonnement.${row.original.abonnement.statut}`)}
              </span>
            </span>
          ),
        }),
        colonne.accessor("nbUtilisateurs", {
          header: t("clients.colonneUtilisateurs"),
          meta: { classe: "text-right tabular-nums text-neutral-700" },
        }),
        colonne.accessor("nbProjets", {
          header: t("clients.colonneProjets"),
          meta: { classe: "text-right tabular-nums text-neutral-700" },
        }),
        colonne.display({
          id: "alerte",
          header: t("clients.colonneAlerte"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => {
            const alerte = alerteClient(row.original);
            if (!alerte) {
              return <span className="text-neutral-400">{t("alerte.aucune")}</span>;
            }
            return (
              <span className={`${BADGE} ${TON_ALERTE[alerte]}`}>{t(`alerte.${alerte}`)}</span>
            );
          },
        }),
      ]),
    [t],
  );

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre={t("clients.titre")}
        description={t("clients.sousTitre", { nombre: tous.length })}
      />

      {requete.isPending && <EtatChargement />}

      {requete.isError && (
        <EtatErreur
          message={t("erreurs.chargement")}
          onReessayer={() => void requete.refetch()}
        />
      )}

      {requete.isSuccess &&
        (tous.length === 0 ? (
          <EtatVide titre={t("clients.aucunTitre")} description={t("clients.aucunDescription")} />
        ) : (
          <TableauListe
            colonnes={colonnes}
            donnees={clients}
            cleLigne={(client) => client.id}
            messageVide={t("clients.aucun")}
            filtresActifs={criteresClientsActifs(criteres)}
            onReinitialiser={() => setCriteres(CRITERES_CLIENTS_VIDES)}
            cleCriteres={`${criteres.recherche}|${criteres.statutClient}|${criteres.plan}`}
            outils={
              <>
                <RechercheTableau
                  valeur={criteres.recherche}
                  onChangement={(recherche) => setCriteres({ ...criteres, recherche })}
                  libelle={t("clients.recherche")}
                  placeholder={t("clients.rechercheePlaceholder")}
                />
                <FiltreTableau
                  valeur={criteres.statutClient}
                  onChangement={(statutClient) => setCriteres({ ...criteres, statutClient })}
                  libelle={t("clients.filtreStatut")}
                  libelleTous={t("clients.filtreStatutTous")}
                  options={statuts.map((statut) => ({
                    valeur: statut,
                    libelle: t(`statutClient.${statut}`),
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
        ))}
    </div>
  );
}
