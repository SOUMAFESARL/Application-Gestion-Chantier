"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { aideColonnes, DataTable } from "@/components/ui/data-table";
import { derniersAbonnements } from "@/features/administration";
import type { ClientPlateforme } from "@/features/administration";
import { formaterDate, formaterMontant, nomDePays } from "@/lib/format";

import { BADGE, TON_STATUT_ABONNEMENT } from "./tons";

/**
 * Les cinq dernières souscriptions.
 *
 * **Ce n'est pas la liste des abonnements en plus petit.** Celle-là répond à
 * « qu'est-ce qui arrive à échéance » et se trie par date de fin ; celle-ci
 * répond à « qu'est-ce qui vient d'être signé » et se trie par date de début.
 * Les deux lisent le même cache (`CLES_ADMINISTRATION.clients()`), donc ce
 * bloc ne coûte aucune requête.
 *
 * Le classement venant du domaine (`derniersAbonnements`), le `DataTable` est
 * monté sans tri ni recherche : cinq lignes déjà ordonnées n'ont rien à filtrer,
 * et un en-tête cliquable qui reclasserait « les plus récentes » viderait le
 * bloc de son sens.
 */
const colonne = aideColonnes<ClientPlateforme>();

/** La carte n'a pas de gouttière (`px-0`) : les colonnes de bord la portent. */
const BORD_GAUCHE = "pl-6";
const BORD_DROIT = "pr-6 text-right";

export function DerniersAbonnements({ clients }: { clients: ClientPlateforme[] }) {
  const t = useTranslations("administration");

  const lignes = useMemo(() => derniersAbonnements(clients), [clients]);

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor((client) => client.abonnement.referenceTransaction, {
          id: "reference",
          header: t("derniersAbonnements.colonneReference"),
          meta: { classe: "font-mono text-xs text-neutral-600" },
          cell: ({ getValue }) => `#${getValue()}`,
        }),
        colonne.accessor("nomCommercial", {
          header: t("derniersAbonnements.colonneClient"),
          cell: ({ row }) => (
            <Link href={`/admin/clients/${row.original.id}`} className="flex flex-col">
              <span className="font-medium text-neutral-900 hover:underline">
                {row.original.nomCommercial}
              </span>
              <span className="text-xs text-neutral-600">
                {t("clients.villePays", {
                  ville: row.original.ville,
                  pays: nomDePays(row.original.pays),
                })}
              </span>
            </Link>
          ),
        }),
        colonne.accessor((client) => client.abonnement.plan, {
          id: "plan",
          header: t("derniersAbonnements.colonnePlan"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => t(`plan.${getValue()}`),
        }),
        colonne.accessor((client) => client.abonnement.statut, {
          id: "statut",
          header: t("derniersAbonnements.colonneStatut"),
          cell: ({ getValue }) => (
            <span className={`${BADGE} ${TON_STATUT_ABONNEMENT[getValue()]}`}>
              {t(`statutAbonnement.${getValue()}`)}
            </span>
          ),
        }),
        colonne.accessor((client) => client.abonnement.montantMensuelCentimes, {
          id: "montant",
          header: t("derniersAbonnements.colonneMontant"),
          meta: { classe: "text-right font-medium tabular-nums text-neutral-900" },
          cell: ({ getValue }) => formaterMontant(getValue()),
        }),
        colonne.accessor((client) => client.abonnement.dateDebut, {
          id: "dateDebut",
          header: t("derniersAbonnements.colonneDate"),
          meta: { classe: `${BORD_DROIT} tabular-nums text-neutral-600` },
          cell: ({ getValue }) => formaterDate(getValue()),
        }),
      ]),
    [t],
  );

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">{t("derniersAbonnements.titre")}</CardTitle>
        <CardDescription>{t("derniersAbonnements.sousTitre")}</CardDescription>
        <CardAction>
          <Link
            href="/admin/abonnements"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
          >
            {t("derniersAbonnements.voirTous")}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0">
        <DataTable
          colonnes={colonnes}
          donnees={lignes}
          cleLigne={(client) => client.id}
          messageVide={t("derniersAbonnements.aucun")}
          selectionnable
          classeSelection={BORD_GAUCHE}
          className="[&_td]:py-2 [&_th]:h-8"
        />
      </CardContent>
    </Card>
  );
}
