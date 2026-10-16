"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import {
  Alerte,
  Bouton,
  EtatChargement,
  EtatErreur,
  Modale,
} from "@/components/ui";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import {
  filtrerJournal,
  filtresJournalActifs,
  filtresJournalVides,
  lignesDetailJournal,
  PLAFOND_JOURNAL,
} from "@/features/administration";
import type {
  EntreeJournalPlateforme,
  FiltresJournalPlateforme,
} from "@/features/administration";
import {
  listerActionsJournal,
  listerAdministrateurs,
  listerClients,
  listerJournalPlateforme,
} from "@/features/administration/adaptateur";
import { ABSENT, formaterDateHeure } from "@/lib/format";

import { CLES_ADMINISTRATION } from "../cles";
import { LIGNE_DEFINITION, LIGNE_LIBELLE, LIGNE_VALEUR } from "../tons";

const colonne = aideColonnes<EntreeJournalPlateforme>();

/** Le sélecteur de date à la taille des filtres de la barre d'outils. */
const CHAMP_DATE = "h-[var(--button-height-sm)] min-w-0 text-sm sm:w-40";

export function JournalPlateforme() {
  const t = useTranslations("administration");
  const [filtres, setFiltres] = useState<FiltresJournalPlateforme>(filtresJournalVides);
  const [recherche, setRecherche] = useState("");
  const [entreeSelectionnee, setEntreeSelectionnee] =
    useState<EntreeJournalPlateforme | null>(null);

  const requeteJournal = useQuery({
    queryKey: CLES_ADMINISTRATION.journal(filtres),
    queryFn: ({ signal }) => listerJournalPlateforme(filtres, signal),
  });

  const requeteComptes = useQuery({
    queryKey: CLES_ADMINISTRATION.comptes(),
    queryFn: ({ signal }) => listerAdministrateurs(signal),
  });

  const requeteClients = useQuery({
    queryKey: CLES_ADMINISTRATION.clients(),
    queryFn: ({ signal }) => listerClients(signal),
  });

  const requeteActions = useQuery({
    queryKey: CLES_ADMINISTRATION.actionsJournal(),
    queryFn: ({ signal }) => listerActionsJournal(signal),
  });

  const optionsAgents = useMemo(
    () =>
      (requeteComptes.data ?? []).map((compte) => ({
        valeur: compte.id,
        libelle: `${compte.prenom} ${compte.nom}`.trim() || compte.email,
      })),
    [requeteComptes.data],
  );

  const optionsEntreprises = useMemo(
    () =>
      (requeteClients.data ?? []).map((client) => ({
        valeur: client.id,
        libelle: client.nomCommercial,
      })),
    [requeteClients.data],
  );

  const optionsActions = useMemo(
    () =>
      (requeteActions.data ?? []).map((code) => ({
        valeur: code,
        libelle: t.has(`journal.actions.${code}`)
          ? t(`journal.actions.${code}`)
          : code,
      })),
    [requeteActions.data, t],
  );

  const page = requeteJournal.data;
  const toutesEntrees = useMemo(() => page?.entrees ?? [], [page]);
  const entrees = useMemo(
    () => filtrerJournal(toutesEntrees, recherche),
    [toutesEntrees, recherche],
  );

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("horodatage", {
          id: "date",
          header: t("journal.colonnes.date"),
          cell: ({ row }) => formaterDateHeure(row.original.horodatage),
        }),
        colonne.accessor("agent", {
          id: "agent",
          header: t("journal.colonnes.agent"),
          cell: ({ row }) => (
            <span className="font-medium text-neutral-900">
              {row.original.agent}
            </span>
          ),
        }),
        colonne.accessor("action", {
          id: "action",
          header: t("journal.colonnes.action"),
          cell: ({ row }) => {
            const code = row.original.action;
            const libelle = t.has(`journal.actions.${code}`)
              ? t(`journal.actions.${code}`)
              : code;
            return <span className="text-neutral-800">{libelle}</span>;
          },
        }),
        colonne.accessor("entreprise", {
          id: "entreprise",
          header: t("journal.colonnes.entreprise"),
          cell: ({ row }) =>
            row.original.entreprise ? (
              <span className="text-neutral-700">
                {row.original.entreprise}
              </span>
            ) : (
              <span className="text-neutral-400">{ABSENT}</span>
            ),
        }),
        colonne.accessor("adresseIp", {
          id: "adresseIp",
          header: t("journal.colonnes.adresseIp"),
          cell: ({ row }) => (
            <span className="font-mono text-xs text-neutral-600">
              {row.original.adresseIp || ABSENT}
            </span>
          ),
        }),
        colonne.display({
          id: "detail",
          header: t("journal.colonnes.detail"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => (
            <Bouton
              variante="ghost"
              taille="sm"
              onClick={() => setEntreeSelectionnee(row.original)}
            >
              {t("journal.colonnes.detail")}
            </Bouton>
          ),
        }),
      ]),
    [t],
  );

  const exporter = useMemo<ExportTableau<EntreeJournalPlateforme>>(
    () => ({
      titre: t("journal.export.titre"),
      nomFichier: t("journal.export.nomFichier"),
      colonnes: [
        {
          entete: t("journal.colonnes.date"),
          valeur: (e) => e.horodatage.toISOString(),
        },
        { entete: t("journal.colonnes.agent"), valeur: (e) => e.agent },
        {
          entete: t("journal.export.colonneCode"),
          valeur: (e) => e.action,
        },
        {
          entete: t("journal.colonnes.action"),
          valeur: (e) =>
            t.has(`journal.actions.${e.action}`)
              ? t(`journal.actions.${e.action}`)
              : e.action,
        },
        {
          entete: t("journal.colonnes.entreprise"),
          valeur: (e) => e.entreprise || "",
        },
        {
          entete: t("journal.colonnes.adresseIp"),
          valeur: (e) => e.adresseIp || "",
        },
        {
          entete: t("journal.export.colonneAppareil"),
          valeur: (e) => e.appareil || "",
        },
        {
          entete: t("journal.colonnes.detail"),
          valeur: (e) => JSON.stringify(e.detail),
        },
      ],
    }),
    [t],
  );

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre={t("journal.titre")}
        description={t("journal.description")}
      />

      {page?.tronque && (
        <Alerte type="information">
          {t("journal.tronque", {
            total: page.total,
            plafond: PLAFOND_JOURNAL,
          })}
        </Alerte>
      )}

      {requeteJournal.isPending && <EtatChargement />}

      {requeteJournal.isError && (
        <EtatErreur
          message={
            requeteJournal.error instanceof Error
              ? requeteJournal.error.message
              : t("erreurs.chargement")
          }
          onReessayer={() => void requeteJournal.refetch()}
        />
      )}

      {requeteJournal.isSuccess && (
        <TableauListe
          colonnes={colonnes}
          donnees={entrees}
          cleLigne={(entree) => String(entree.id)}
          messageVide={t("journal.vide")}
          filtresActifs={filtresJournalActifs(filtres) || recherche !== ""}
          onReinitialiser={() => {
            setFiltres(filtresJournalVides());
            setRecherche("");
          }}
          cleCriteres={JSON.stringify({ filtres, recherche })}
          exporter={exporter}
          outils={
            <>
              <RechercheTableau
                valeur={recherche}
                onChangement={setRecherche}
                libelle={t("journal.filtres.recherche")}
                placeholder={t("journal.filtres.recherchePlaceholder")}
              />
              {/* Les deux bornes restent ensemble : côte à côte sur
                  téléphone, chacune à la hauteur des autres filtres. */}
              <div className="flex w-full items-center gap-3 sm:w-auto">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                  <span className="shrink-0 text-xs font-medium text-neutral-600">
                    {t("journal.filtres.du")}
                  </span>
                  <SelecteurDate
                    valeur={filtres.du}
                    onChange={(du) => setFiltres((f) => ({ ...f, du }))}
                    placeholder={t("journal.filtres.du")}
                    auPlusTard={filtres.au || undefined}
                    aria-label={t("journal.filtres.du")}
                    className={CHAMP_DATE}
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                  <span className="shrink-0 text-xs font-medium text-neutral-600">
                    {t("journal.filtres.au")}
                  </span>
                  <SelecteurDate
                    valeur={filtres.au}
                    onChange={(au) => setFiltres((f) => ({ ...f, au }))}
                    placeholder={t("journal.filtres.au")}
                    auPlusTot={filtres.du || undefined}
                    aria-label={t("journal.filtres.au")}
                    className={CHAMP_DATE}
                  />
                </div>
              </div>
              <FiltreTableau
                valeur={filtres.agentId}
                onChangement={(agentId) => setFiltres((f) => ({ ...f, agentId }))}
                libelle={t("journal.filtres.agent")}
                libelleTous={t("journal.filtres.agentTous")}
                options={optionsAgents}
              />
              <FiltreTableau
                valeur={filtres.entrepriseId}
                onChangement={(entrepriseId) =>
                  setFiltres((f) => ({ ...f, entrepriseId }))
                }
                libelle={t("journal.filtres.entreprise")}
                libelleTous={t("journal.filtres.entrepriseTous")}
                options={optionsEntreprises}
              />
              <FiltreTableau
                valeur={filtres.action}
                onChangement={(action) => setFiltres((f) => ({ ...f, action }))}
                libelle={t("journal.filtres.action")}
                libelleTous={t("journal.filtres.actionTous")}
                options={optionsActions}
              />
            </>
          }
        />
      )}

      <Modale
        ouverte={entreeSelectionnee !== null}
        titre={t("journal.detail.titre")}
        onFermer={() => setEntreeSelectionnee(null)}
        actions={
          <Bouton variante="ghost" onClick={() => setEntreeSelectionnee(null)}>
            {t("journal.detail.fermer")}
          </Bouton>
        }
      >
        {entreeSelectionnee && (
          <dl className="divide-y divide-neutral-200">
            {lignesDetailJournal(entreeSelectionnee.detail).map(({ cle, valeur }) => (
              <div key={cle} className={LIGNE_DEFINITION}>
                <dt className={LIGNE_LIBELLE}>{cle}</dt>
                <dd className={LIGNE_VALEUR}>{valeur || ABSENT}</dd>
              </div>
            ))}
            {entreeSelectionnee.appareil && (
              <div className={LIGNE_DEFINITION}>
                <dt className={LIGNE_LIBELLE}>{t("journal.detail.appareil")}</dt>
                <dd className={LIGNE_VALEUR}>{entreeSelectionnee.appareil}</dd>
              </div>
            )}
          </dl>
        )}
      </Modale>
    </div>
  );
}
