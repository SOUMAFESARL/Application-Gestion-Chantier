"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Badge, Bouton, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import type { VarianteBadge } from "@/components/ui";
import { aideColonnes } from "@/components/ui/data-table";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { listerProjets } from "@/features/projets/adaptateur";
import { TiroirCreationProjet } from "@/features/projets/components/TiroirCreationProjet";
import {
  chefsDeProjet,
  criteresActifs,
  CRITERES_VIDES,
  ecartAvancement,
  ecartSigne,
  estEnRetard,
  filtrerProjets,
  niveauBudget,
  ratioConsommationBudget,
  statutsPresents,
} from "@/features/projets/regles";
import type { CriteresProjets, NiveauBudget } from "@/features/projets/regles";
import type { Projet, StatutProjet } from "@/features/projets/types";
import { formaterDate, formaterMontantCourt } from "@/lib/format";

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
 * **Aucun calcul ici.** Le retard, le ratio de consommation et son niveau
 * d'alerte viennent de `features/projets/regles` : ce sont les mêmes seuils
 * que la fiche chantier et le tableau de bord, et une copie locale finirait
 * par ne plus dire la même chose qu'eux.
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

/** Le ton d'un statut. C'est de l'affichage — il ne descend pas dans `regles`. */
const TON_STATUT: Record<StatutProjet, VarianteBadge> = {
  EN_ATTENTE: "neutre",
  EN_COURS: "primaire",
  EN_RETARD: "avertissement",
  CRITIQUE: "erreur",
  SUSPENDU: "avertissement",
  TERMINE: "succes",
  ARCHIVE: "neutre",
};

const TON_BUDGET: Record<NiveauBudget, VarianteBadge> = {
  conforme: "succes",
  alerte: "avertissement",
  depassement: "erreur",
};

const colonne = aideColonnes<Projet>();

export function ListeProjets() {
  const t = useTranslations("projets");
  const clientRequetes = useQueryClient();
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  const [criteres, setCriteres] = useState<CriteresProjets>(CRITERES_VIDES);

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
   * La même action dans l'en-tête, en version compacte : taille `sm`, et
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

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("reference", {
          header: t("colonneReference"),
          meta: { classe: "font-mono text-xs text-neutral-600" },
        }),
        colonne.accessor("nom", {
          header: t("colonneChantier"),
          cell: ({ row }) => (
            <Link href={`/projets/${row.original.id}`} className="flex flex-col no-underline">
              <span className="font-semibold text-neutral-900 hover:text-primary-600 hover:underline">
                {row.original.nom}
              </span>
              <span className="text-xs text-neutral-600">
                {t("detail", {
                  client: row.original.client.raisonSociale,
                  ville: row.original.ville,
                })}
              </span>
            </Link>
          ),
        }),
        colonne.accessor("statut", {
          header: t("colonneStatut"),
          cell: ({ getValue }) => (
            <Badge variante={TON_STATUT[getValue()]}>{t(`statut.${getValue()}`)}</Badge>
          ),
        }),
        colonne.accessor("avancementReel", {
          id: "avancement",
          header: t("colonneAvancement"),
          cell: ({ row }) => {
            const ecart = ecartAvancement(
              row.original.avancementReel,
              row.original.avancementTheorique,
            );
            return (
              <span className="flex flex-col gap-1">
                <span className="tabular-nums text-neutral-900">
                  {t("avancement", {
                    reel: row.original.avancementReel,
                    theorique: row.original.avancementTheorique,
                  })}
                </span>
                <Badge variante={estEnRetard(ecart) ? "avertissement" : "succes"}>
                  {t("ecart", { ecart: ecartSigne(ecart) })}
                </Badge>
              </span>
            );
          },
        }),
        colonne.accessor("budgetConsomme", {
          id: "budget",
          header: t("colonneBudget"),
          cell: ({ row }) => <CelluleBudget projet={row.original} />,
        }),
        colonne.accessor("chefProjet", {
          header: t("colonneChefProjet"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => getValue()?.nomComplet || t("sansChefProjet"),
        }),
        colonne.accessor("dateFinPrevue", {
          header: t("colonneEcheance"),
          meta: { classe: `${BORD_DROIT_TABLEAU} tabular-nums text-neutral-600` },
          cell: ({ getValue }) => formaterDate(getValue()),
        }),
      ]),
    [t],
  );

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre={t("titre")}
        description={t("sousTitre", { nombre: projets.length })}
        actions={boutonNouveauCompact}
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

      <TiroirCreationProjet
        ouverte={tiroirOuvert}
        onFermer={() => setTiroirOuvert(false)}
        onProjetCree={surProjetCree}
      />
    </div>
  );
}

/** Le consommé sur le prévu, et son niveau d'alerte. */
function CelluleBudget({ projet }: { projet: Projet }) {
  const t = useTranslations("projets");

  if (projet.budgetInitial === null) {
    return <span className="text-xs text-neutral-500 italic">{t("budgetNonDefini")}</span>;
  }

  const ratio = ratioConsommationBudget(projet.budgetInitial, projet.budgetConsomme);
  const niveau = niveauBudget(ratio) ?? "conforme";

  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-baseline gap-1 tabular-nums">
        <span className="font-medium text-neutral-900">
          {formaterMontantCourt(projet.budgetConsomme)}
        </span>
        <span className="text-xs text-neutral-600">
          / {formaterMontantCourt(projet.budgetInitial)}
        </span>
      </span>
      <Badge variante={TON_BUDGET[niveau]}>{t("budgetRatio", { taux: ratio ?? 0 })}</Badge>
    </span>
  );
}
