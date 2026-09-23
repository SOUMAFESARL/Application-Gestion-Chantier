"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Badge, Carte, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import type { VarianteBadge } from "@/components/ui";
import { aideColonnes, DataTable } from "@/components/ui/data-table";
import { listerHistoriquePaiements } from "@/features/abonnement/api";
import type { LignePaiement, StatutPaiement } from "@/features/abonnement/api";
import { ErreurApi } from "@/lib/api";
import { formaterDateHeure, formaterMontant } from "@/lib/format";

const CLE_HISTORIQUE_PAIEMENTS = ["abonnement", "historique"] as const;

const TON_STATUT: Record<StatutPaiement, VarianteBadge> = {
  REUSSI: "succes",
  ECHOUE: "erreur",
};

/** La carte n'a pas de gouttière : la colonne de bord droit la porte. */
const BORD_DROIT = "pr-4 text-right sm:pr-6";

const colonne = aideColonnes<LignePaiement>();

/**
 * L'historique des paiements — `GET /abonnement/paiements/`, T-025.
 *
 * Même contrat de simulation que `AssistantAbonnement` : sous
 * `NEXT_PUBLIC_API_SIMULE`, la liste vient de `features/abonnement/simulation.ts`
 * et s'enrichit d'une ligne à chaque souscription réussie sur `/abonnement/tarifs`.
 */
export function HistoriquePaiements() {
  const t = useTranslations("abonnement.historique");
  const tMode = useTranslations("abonnement.mode");
  const tPlan = useTranslations("abonnement.plan");

  const requete = useQuery({
    queryKey: CLE_HISTORIQUE_PAIEMENTS,
    queryFn: () => listerHistoriquePaiements(),
  });

  const lignes = useMemo(() => requete.data ?? [], [requete.data]);

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("date_heure", {
          header: t("colonneDate"),
          meta: { classe: "text-neutral-600" },
          cell: ({ getValue }) => formaterDateHeure(getValue()),
        }),
        colonne.accessor("reference_transaction", {
          header: t("colonneReference"),
          meta: { classe: "font-mono text-xs text-neutral-600" },
        }),
        colonne.accessor("numero_facture", {
          header: t("colonneFacture"),
          meta: { classe: "font-mono text-xs text-neutral-600" },
        }),
        colonne.accessor("plan", {
          header: t("colonnePlan"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => tPlan(`${getValue()}.libelle`),
        }),
        colonne.accessor("mode_paiement", {
          header: t("colonneMode"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => tMode(getValue()),
        }),
        colonne.accessor("statut", {
          header: t("colonneStatut"),
          cell: ({ getValue }) => (
            <Badge variante={TON_STATUT[getValue()]}>
              {getValue() === "REUSSI" ? t("statutReussi") : t("statutEchoue")}
            </Badge>
          ),
        }),
        colonne.accessor("montant_centimes", {
          id: "montant",
          header: t("colonneMontant"),
          meta: { classe: `${BORD_DROIT} tabular-nums font-medium text-neutral-900` },
          cell: ({ getValue }) => formaterMontant(getValue()),
        }),
      ]),
    [t, tMode, tPlan],
  );

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre={t("titre")} description={t("sousTitre")} />

      {requete.isPending && <EtatChargement />}

      {requete.isError && (
        <EtatErreur
          message={(requete.error as ErreurApi)?.message}
          onReessayer={() => void requete.refetch()}
        />
      )}

      {requete.isSuccess &&
        (lignes.length === 0 ? (
          <EtatVide titre={t("aucun")} />
        ) : (
          <Carte className="overflow-hidden p-0 md:p-0">
            <DataTable
              colonnes={colonnes}
              donnees={lignes}
              cleLigne={(ligne) => ligne.id}
              messageVide={t("aucun")}
              className="[&_td]:py-3 [&_th:first-child]:pl-4 [&_td:first-child]:pl-4 sm:[&_th:first-child]:pl-6 sm:[&_td:first-child]:pl-6"
            />
          </Carte>
        ))}
    </div>
  );
}
