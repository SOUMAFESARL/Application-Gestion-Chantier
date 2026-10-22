"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { listerAlertes } from "@/features/alertes/adaptateur";
import { BadgeEtatAlerte, BadgeNiveauAlerte } from "@/features/alertes/components/BadgesAlerte";
import { ModaleClotureAlerte } from "@/features/alertes/components/ModaleClotureAlerte";
import { TiroirAlerte } from "@/features/alertes/components/TiroirAlerte";
import { CLE_LISTE_ALERTES } from "@/features/alertes/cles";
import {
  alerteOuverte,
  COLONNES_EXPORT_ALERTES,
  criteresActifs,
  CRITERES_PAR_DEFAUT,
  filtrerAlertes,
  ORDRE_ETATS,
  ORDRE_NIVEAUX,
  peutCloturerAlerte,
  projetsPresents,
  valeursExportAlerte,
} from "@/features/alertes/regles";
import type { CriteresAlertes } from "@/features/alertes/regles";
import type { AlerteRetard } from "@/features/alertes/types";
import { lireProfilLocal, obtenirProfilMoi } from "@/features/auth/api";
import { useDroits, useProjetsVisibles } from "@/features/habilitations";
import { ABSENT, formaterDate, formaterQuantite } from "@/lib/format";

/**
 * L'écran des alertes de retard : ce que le serveur a détecté comme lots (ou
 * chantiers) en retard sur leur avancement temporel, à traiter par le chef de
 * projet ou le Directeur des Opérations.
 *
 * Le tableau est le `TableauListe` commun, sans case à cocher : aucune action
 * ne porte sur une sélection. L'écran s'ouvre sur les alertes **ouvertes** —
 * c'est ce qu'on vient y chercher —, l'historique est un clic de filtre plus loin.
 *
 * **Aucune règle ici.** La teinte des pastilles, le filtrage, la recherche et
 * le droit de clôturer viennent de `features/alertes/regles` ; ce fichier ne
 * garde que l'état des contrôles et celui des deux volets (détail, clôture).
 * Le détail et la clôture sont des **identifiants**, pas des copies : la ligne
 * clôturée est relue dans le cache, donc le tiroir se met à jour tout seul.
 */

const colonne = aideColonnes<AlerteRetard>();

export function ListeAlertes() {
  const t = useTranslations("alertes");
  const clientRequetes = useQueryClient();
  const [criteres, setCriteres] = useState<CriteresAlertes>(CRITERES_PAR_DEFAUT);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [clotureId, setClotureId] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: CLE_LISTE_ALERTES,
    queryFn: ({ signal }) => listerAlertes(signal),
  });

  // Le repli tient dans un `useMemo` : un `?? []` rend un tableau neuf à chaque rendu.
  const alertes = useMemo(() => requete.data ?? [], [requete.data]);
  const alertesFiltrees = useMemo(() => filtrerAlertes(alertes, criteres), [alertes, criteres]);
  const projets = useMemo(() => projetsPresents(alertes), [alertes]);
  const nombreOuvertes = useMemo(() => alertes.filter(alerteOuverte).length, [alertes]);
  const filtresActifs = criteresActifs(criteres);

  // Le profil et les chantiers : de quoi décider si le bouton de clôture est proposé.
  const { droits } = useDroits();
  const requeteProfil = useQuery({ queryKey: ["profil-moi"], queryFn: obtenirProfilMoi });
  const profil = useMemo(() => requeteProfil.data ?? lireProfilLocal(), [requeteProfil.data]);
  const chantiers = useProjetsVisibles().data;

  const alerteDetail = alertes.find((alerte) => alerte.id === detailId) ?? null;
  const alerteCloture = alertes.find((alerte) => alerte.id === clotureId) ?? null;
  const detailCloturable =
    alerteDetail !== null &&
    peutCloturerAlerte(
      alerteDetail,
      chantiers?.find((chantier) => chantier.id === alerteDetail.projet.id),
      droits,
      profil,
    );

  /**
   * L'alerte clôturée remplace sa ligne dans le cache avant tout rechargement :
   * le tableau et le tiroir la montrent résolue aussitôt. L'invalidation qui
   * suit reste nécessaire — le serveur fait foi sur la liste.
   */
  const surCloturee = useCallback(
    (cloturee: AlerteRetard) => {
      clientRequetes.setQueryData<AlerteRetard[]>(CLE_LISTE_ALERTES, (anciennes) =>
        (anciennes ?? []).map((alerte) => (alerte.id === cloturee.id ? cloturee : alerte)),
      );
      void clientRequetes.invalidateQueries({ queryKey: CLE_LISTE_ALERTES });
    },
    [clientRequetes],
  );

  /** Le fichier garde la référence du chantier et l'indice de santé, que l'écran range dans le détail. */
  const exporter = useMemo<ExportTableau<AlerteRetard>>(() => {
    const libelles = {
      niveau: (niveau: AlerteRetard["niveau"]) => t(`niveau.${niveau}`),
      statut: (statut: AlerteRetard["statut"]) => t(`statut.${statut}`),
      formaterDate,
    };
    return {
      titre: t("export.titrePdf"),
      nomFichier: t("export.nomFichier"),
      colonnes: COLONNES_EXPORT_ALERTES.map((cle, rang) => ({
        entete: t(`export.colonnes.${cle}`),
        valeur: (alerte: AlerteRetard) => valeursExportAlerte(alerte, libelles)[rang],
      })),
    };
  }, [t]);

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.display({
          id: "projet",
          header: t("colonne.projet"),
          cell: ({ row }) => (
            <button
              type="button"
              onClick={() => setDetailId(row.original.id)}
              className="flex cursor-pointer appearance-none flex-col border-0 bg-transparent p-0 text-left"
            >
              <span className="font-semibold text-neutral-900 hover:text-primary-600 hover:underline">
                {row.original.projet.nom}
              </span>
              <span className="text-xs text-neutral-600">{row.original.projet.reference}</span>
            </button>
          ),
        }),
        colonne.display({
          id: "lot",
          header: t("colonne.lot"),
          cell: ({ row }) =>
            row.original.lot ? (
              <span className="flex flex-col">
                <span className="font-medium text-neutral-900">{row.original.lot.code}</span>
                <span className="text-xs text-neutral-600">{row.original.lot.libelle}</span>
              </span>
            ) : (
              <span className="text-neutral-600">{t("lotProjet")}</span>
            ),
        }),
        colonne.display({
          id: "niveau",
          header: t("colonne.niveau"),
          cell: ({ row }) => <BadgeNiveauAlerte niveau={row.original.niveau} />,
        }),
        colonne.display({
          id: "retard",
          header: t("colonne.retard"),
          cell: ({ row }) =>
            row.original.deltaPts === null ? (
              <span className="text-neutral-500">{ABSENT}</span>
            ) : (
              <span className="font-semibold tabular-nums text-neutral-900">
                {t("points", { valeur: formaterQuantite(row.original.deltaPts) })}
              </span>
            ),
        }),
        colonne.display({
          id: "dateDetection",
          header: t("colonne.dateDetection"),
          cell: ({ row }) => (
            <span className="tabular-nums text-neutral-600">
              {formaterDate(row.original.dateDetection)}
            </span>
          ),
        }),
        colonne.display({
          id: "etat",
          header: t("colonne.etat"),
          cell: ({ row }) => <BadgeEtatAlerte statut={row.original.statut} />,
        }),
        colonne.display({
          id: "actions",
          header: t("colonne.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDetailId(row.original.id)}
              aria-label={t("actionDetail", { projet: row.original.projet.nom })}
              title={t("actionDetail", { projet: row.original.projet.nom })}
            >
              <Eye />
            </Button>
          ),
        }),
      ]),
    [t],
  );

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre={t("titre")} description={t("sousTitre", { nombre: nombreOuvertes })} />

      {requete.isPending && <EtatChargement />}

      {requete.isError && <EtatErreur onReessayer={() => void requete.refetch()} />}

      {requete.isSuccess &&
        (alertes.length === 0 ? (
          <EtatVide titre={t("aucuneTitre")} description={t("aucune")} />
        ) : (
          <TableauListe
            colonnes={colonnes}
            donnees={alertesFiltrees}
            cleLigne={(alerte) => alerte.id}
            messageVide={filtresActifs ? t("aucunResultat") : t("aucuneLigne")}
            filtresActifs={filtresActifs}
            onReinitialiser={() => setCriteres(CRITERES_PAR_DEFAUT)}
            cleCriteres={`${criteres.recherche}|${criteres.niveau}|${criteres.projetId}|${criteres.etat}`}
            exporter={exporter}
            outils={
              <>
                <RechercheTableau
                  valeur={criteres.recherche}
                  onChangement={(recherche) => setCriteres({ ...criteres, recherche })}
                  libelle={t("recherche")}
                  placeholder={t("recherchePlaceholder")}
                />
                <FiltreTableau
                  valeur={criteres.niveau}
                  onChangement={(niveau) => setCriteres({ ...criteres, niveau })}
                  libelle={t("filtreNiveau")}
                  libelleTous={t("filtreNiveauTous")}
                  options={ORDRE_NIVEAUX.map((niveau) => ({
                    valeur: niveau,
                    libelle: t(`niveau.${niveau}`),
                  }))}
                />
                <FiltreTableau
                  valeur={criteres.projetId}
                  onChangement={(projetId) => setCriteres({ ...criteres, projetId })}
                  libelle={t("filtreProjet")}
                  libelleTous={t("filtreProjetTous")}
                  options={projets.map((projet) => ({
                    valeur: projet.id,
                    libelle: t("projetOption", { reference: projet.reference, nom: projet.nom }),
                  }))}
                />
                <FiltreTableau
                  valeur={criteres.etat}
                  onChangement={(etat) => setCriteres({ ...criteres, etat })}
                  libelle={t("filtreEtat")}
                  libelleTous={t("filtreEtatTous")}
                  options={ORDRE_ETATS.map((etat) => ({
                    valeur: etat,
                    libelle: etat === "OUVERTES" ? t("etatOuvertes") : t(`statut.${etat}`),
                  }))}
                />
              </>
            }
          />
        ))}

      <TiroirAlerte
        alerte={alerteDetail}
        onFermer={() => setDetailId(null)}
        peutCloturer={detailCloturable}
        onCloturer={(alerte) => setClotureId(alerte.id)}
      />

      <ModaleClotureAlerte
        alerte={alerteCloture}
        onFermer={() => setClotureId(null)}
        onCloturee={surCloturee}
      />
    </div>
  );
}
