"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pause, Pencil, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Badge, Bouton, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { listerProjets } from "@/features/projets/adaptateur";
import { useGestionProjet } from "@/features/projets/components/GestionProjet";
import { TiroirCreationProjet } from "@/features/projets/components/TiroirCreationProjet";
import {
  chefsDeProjet,
  COLONNES_EXPORT_PROJETS,
  criteresActifs,
  CRITERES_VIDES,
  echeanceDepassee,
  filtrerProjets,
  largeurJauge,
  niveauAvancement,
  nomAbrege,
  peutReprendre,
  peutSuspendre,
  projetModifiable,
  statutsPresents,
  valeursExportProjet,
} from "@/features/projets/regles";
import type { CriteresProjets, NiveauAvancement } from "@/features/projets/regles";
import type { Projet, StatutProjet } from "@/features/projets/types";
import { ABSENT, couleurIndiceSante, formaterDate, formaterMillions, formaterMontant } from "@/lib/format";
import { cn } from "@/lib/utils";

import { TON_SANTE, TON_STATUT } from "./classes";

/**
 * La liste des chantiers de l'entreprise.
 *
 * Le tableau est le `TableauListe` commun — recherche, filtres, cases à cocher
 * et pagination — et non le `Tableau` du tableau de bord : celui-ci montre les
 * chantiers *actifs* du jour, en pleine largeur et sans pagination ; celui-là
 * est le portefeuille complet, qui dépasse l'écran dès la première année
 * d'exploitation. Cet écran a servi de modèle au gabarit : toutes les listes
 * de la plateforme, back-office compris, en reprennent désormais l'allure.
 *
 * **Aucun calcul ici.** Le niveau d'avancement, l'échéance dépassée et le nom
 * abrégé du chef de projet viennent de `features/projets/regles` ; la couleur
 * de l'indice de santé, de `lib/format`. Ce sont les mêmes seuils que la fiche
 * projet et le tableau de bord, et une copie locale finirait par ne plus dire
 * la même chose qu'eux.
 *
 * La création passe par le **même tiroir que le tableau de bord**
 * (`features/projets/components`). Il en a été sorti le jour où deux écrans
 * l'ont ouvert : un formulaire recopié est un formulaire dont les deux
 * exemplaires n'exigent bientôt plus les mêmes champs.
 *
 * **Le filtrage n'est pas dans ce fichier non plus.** `filtrerProjets` vit
 * dans `regles.ts` : chercher un chantier par sa référence, son client ou sa
 * ville est une question du domaine, et le rapport de portefeuille la posera
 * dans les mêmes termes. Le composant ne garde que l'état des trois
 * contrôles.
 */

/** La clé de cache est partagée : un autre écran qui liste les chantiers lira celui-ci. */
const CLE_LISTE_PROJETS = ["projets", "liste"] as const;

/** Le ton du chiffre d'avancement réel. */
const TON_AVANCEMENT: Record<NiveauAvancement, string> = {
  conforme: "text-succes",
  retard: "text-avertissement",
  critique: "text-erreur",
};

const colonne = aideColonnes<Projet>();

export function ListeProjets() {
  const t = useTranslations("projets");
  const clientRequetes = useQueryClient();
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  const [criteres, setCriteres] = useState<CriteresProjets>(CRITERES_VIDES);
  const { modifier, basculerSuspension, modaux } = useGestionProjet();

  const requete = useQuery({
    queryKey: CLE_LISTE_PROJETS,
    queryFn: ({ signal }) => listerProjets(signal),
  });

  // Le repli tient dans un `useMemo` : un `?? []` rend un tableau neuf à
  // chaque rendu, donc recalcule les trois dérivations qui en dépendent.
  const projets = useMemo(() => requete.data ?? [], [requete.data]);

  const projetsFiltres = useMemo(() => filtrerProjets(projets, criteres), [projets, criteres]);
  const statuts = useMemo(() => statutsPresents(projets), [projets]);
  const chefs = useMemo(() => chefsDeProjet(projets), [projets]);
  const filtresActifs = criteresActifs(criteres);

  /**
   * Le chantier créé est posé **en tête du cache** avant tout rechargement :
   * la ligne apparaît au moment où le tiroir se referme, sans le battement
   * d'une seconde requête. L'invalidation qui suit reste nécessaire — c'est
   * le serveur qui fait foi sur la référence, le statut et l'ordre.
   */
  const surProjetCree = useCallback(
    (projet: Projet) => {
      clientRequetes.setQueryData<Projet[]>(CLE_LISTE_PROJETS, (anciens) => [
        projet,
        ...(anciens ?? []),
      ]);
      void clientRequetes.invalidateQueries({ queryKey: CLE_LISTE_PROJETS });
    },
    [clientRequetes],
  );

  /** L'action reprise au centre de l'écran vide : pleine taille, elle y est seule. */
  const boutonNouveau = (
    <Bouton
      variante="primaire"
      iconeGauche={<Plus size={16} aria-hidden="true" />}
      onClick={() => setTiroirOuvert(true)}
    >
      {t("actionNouveau")}
    </Bouton>
  );

  /**
   * La même action dans la barre du tableau, juste après « Exporter », en version compacte : taille `sm`, et
   * sous 640 px réduite à son icône. Le libellé y coûtait le tiers de la
   * largeur de la barre, pour un bouton que son `+` suffit à désigner —
   * `aria-label` le nomme pour qui ne voit pas l'icône, et la règle terrain
   * (48 px sous un pointeur grossier) reste portée par `Bouton`.
   */
  const boutonNouveauCompact = (
    <Bouton
      variante="primaire"
      taille="sm"
      aria-label={t("actionNouveau")}
      iconeGauche={<Plus size={16} aria-hidden="true" />}
      onClick={() => setTiroirOuvert(true)}
      className="max-sm:gap-0 max-sm:px-3"
    >
      <span className="max-sm:hidden">{t("actionNouveau")}</span>
    </Bouton>
  );

  /**
   * L'export garde les colonnes de `COLONNES_EXPORT_PROJETS`, plus larges que
   * l'écran (référence, client) : un fichier sorti de l'application se relit
   * sans elle.
   */
  const exporter = useMemo<ExportTableau<Projet>>(() => {
    const libelles = {
      statut: (statut: StatutProjet) => t(`statut.${statut}`),
      typeProjet: (type: NonNullable<Projet["typeProjet"]>) =>
        t(`tiroirCreation.typeProjet.${type}`),
      formaterDate,
    };
    return {
      titre: t("export.titrePdf"),
      nomFichier: t("export.nomFichier"),
      colonnes: COLONNES_EXPORT_PROJETS.map((cle, rang) => ({
        entete: t(`export.colonnes.${cle}`),
        valeur: (projet: Projet) => valeursExportProjet(projet, libelles)[rang],
      })),
    };
  }, [t]);

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("nom", {
          header: t("colonneNom"),
          cell: ({ row }) => (
            <Link href={`/projets/${row.original.id}`} className="flex flex-col no-underline">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-neutral-900 hover:text-primary-600 hover:underline">
                  {row.original.nom}
                </span>
                {row.original.statut === "CRITIQUE" && (
                  <Badge variante="erreur">{t("statut.CRITIQUE")}</Badge>
                )}
              </span>
              <span className="text-xs text-neutral-600">
                {row.original.quartier
                  ? t("localisation", { quartier: row.original.quartier, ville: row.original.ville })
                  : row.original.ville}
              </span>
            </Link>
          ),
        }),
        colonne.accessor("typeProjet", {
          header: t("colonneType"),
          cell: ({ getValue }) => {
            const type = getValue();
            return type ? (
              <Badge variante="neutre">{t(`tiroirCreation.typeProjet.${type}`)}</Badge>
            ) : (
              <span className="text-neutral-500">{ABSENT}</span>
            );
          },
        }),
        colonne.accessor("chefProjet", {
          header: t("colonneChefProjet"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => nomAbrege(getValue()) ?? t("sansChefProjet"),
        }),
        colonne.accessor("avancementReel", {
          header: t("colonneAvancementReel"),
          cell: ({ row }) => (
            <span
              className={cn(
                "font-semibold tabular-nums",
                TON_AVANCEMENT[niveauAvancement(row.original)],
              )}
            >
              {t("pourcentage", { valeur: row.original.avancementReel })}
            </span>
          ),
        }),
        colonne.accessor("indiceSante", {
          header: t("colonneSante"),
          cell: ({ getValue }) => <AnneauSante indice={getValue() ?? null} />,
        }),
        colonne.accessor("dateFinPrevue", {
          header: t("colonneEcheance"),
          cell: ({ row }) => (
            <span
              className={cn(
                "tabular-nums",
                echeanceDepassee(row.original) ? "font-semibold text-erreur" : "text-neutral-600",
              )}
            >
              {formaterDate(row.original.dateFinPrevue)}
            </span>
          ),
        }),
        colonne.accessor("budgetInitial", {
          header: t("colonneBudget"),
          cell: ({ getValue }) => {
            const budget = getValue();
            return budget === null ? (
              <span className="text-xs text-neutral-500 italic">{t("budgetNonDefini")}</span>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="cursor-help font-semibold tabular-nums text-neutral-900">
                    {formaterMillions(budget)}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="tabular-nums">{formaterMontant(budget)}</TooltipContent>
              </Tooltip>
            );
          },
        }),
        colonne.accessor("statut", {
          header: t("colonneStatut"),
          cell: ({ getValue }) => (
            <Badge variante={TON_STATUT[getValue()]}>{t(`statut.${getValue()}`)}</Badge>
          ),
        }),
        colonne.display({
          id: "actions",
          header: t("colonneActions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => (
            <span className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" asChild>
                <Link
                  href={`/projets/${row.original.id}`}
                  aria-label={t("actionConsulter", { nom: row.original.nom })}
                  title={t("actionConsulter", { nom: row.original.nom })}
                >
                  <Eye />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => modifier(row.original)}
                disabled={!projetModifiable(row.original)}
                aria-label={t("actionModifier", { nom: row.original.nom })}
                title={t("actionModifier", { nom: row.original.nom })}
              >
                <Pencil />
              </Button>
              {peutSuspendre(row.original) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => basculerSuspension(row.original)}
                  aria-label={t("actionSuspendre", { nom: row.original.nom })}
                  title={t("actionSuspendre", { nom: row.original.nom })}
                  className="text-avertissement hover:text-avertissement"
                >
                  <Pause />
                </Button>
              )}
              {peutReprendre(row.original) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => basculerSuspension(row.original)}
                  aria-label={t("actionReprendre", { nom: row.original.nom })}
                  title={t("actionReprendre", { nom: row.original.nom })}
                  className="text-succes hover:text-succes"
                >
                  <Play />
                </Button>
              )}
            </span>
          ),
        }),
      ]),
    [t, modifier, basculerSuspension],
  );

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre={t("titre")}
        description={t("sousTitre", { nombre: projets.length })}
      />

      {requete.isPending && <EtatChargement />}

      {requete.isError && <EtatErreur onReessayer={() => void requete.refetch()} />}

      {requete.isSuccess &&
        (projets.length === 0 ? (
          // Un écran vide sans issue est un cul-de-sac : l'action y est reprise.
          <EtatVide titre={t("aucunTitre")} description={t("aucun")} action={boutonNouveau} />
        ) : (
          <TableauListe
            colonnes={colonnes}
            donnees={projetsFiltres}
            cleLigne={(projet) => projet.id}
            messageVide={filtresActifs ? t("aucunResultat") : t("aucuneLigne")}
            filtresActifs={filtresActifs}
            onReinitialiser={() => setCriteres(CRITERES_VIDES)}
            cleCriteres={`${criteres.recherche}|${criteres.statut}|${criteres.chefProjetId}`}
            exporter={exporter}
            actions={boutonNouveauCompact}
            outils={
              <>
                <RechercheTableau
                  valeur={criteres.recherche}
                  onChangement={(recherche) => setCriteres({ ...criteres, recherche })}
                  libelle={t("recherche")}
                  placeholder={t("recherchePlaceholder")}
                />
                <FiltreTableau
                  valeur={criteres.statut}
                  onChangement={(statut) => setCriteres({ ...criteres, statut })}
                  libelle={t("filtreStatut")}
                  libelleTous={t("filtreStatutTous")}
                  options={statuts.map((statut) => ({
                    valeur: statut,
                    libelle: t(`statut.${statut}`),
                  }))}
                />
                <FiltreTableau
                  valeur={criteres.chefProjetId}
                  onChangement={(chefProjetId) => setCriteres({ ...criteres, chefProjetId })}
                  libelle={t("filtreChefProjet")}
                  libelleTous={t("filtreChefProjetTous")}
                  options={chefs.map((chef) => ({ valeur: chef.id, libelle: chef.nomComplet }))}
                />
              </>
            }
          />
        ))}

      {modaux}

      <TiroirCreationProjet
        ouverte={tiroirOuvert}
        onFermer={() => setTiroirOuvert(false)}
        onProjetCree={surProjetCree}
      />
    </div>
  );
}

/** Le rayon de l'anneau, dans un repère SVG de 36 × 36. */
const RAYON_ANNEAU = 15;
const CIRCONFERENCE_ANNEAU = 2 * Math.PI * RAYON_ANNEAU;

/**
 * L'indice de santé en anneau : la part tracée est l'indice, la couleur suit
 * `couleurIndiceSante` (les seuils de la charte, pas ceux de l'écran).
 */
function AnneauSante({ indice }: { indice: number | null }) {
  const t = useTranslations("projets");

  if (indice === null) {
    return <span className="text-neutral-500">{ABSENT}</span>;
  }

  const trace = (largeurJauge(indice) / 100) * CIRCONFERENCE_ANNEAU;

  return (
    <span
      className={cn(
        "relative inline-flex size-9 items-center justify-center",
        TON_SANTE[couleurIndiceSante(indice)],
      )}
      role="img"
      aria-label={t("santeSur100", { indice })}
    >
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={RAYON_ANNEAU} fill="none" strokeWidth="4" className="stroke-neutral-200" />
        <circle
          cx="18"
          cy="18"
          r={RAYON_ANNEAU}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={`${trace} ${CIRCONFERENCE_ANNEAU}`}
        />
      </svg>
      <span className="text-xs font-semibold tabular-nums">{indice}</span>
    </span>
  );
}
