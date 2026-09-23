"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Badge, Bouton, Carte, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import type { VarianteBadge } from "@/components/ui";
import { aideColonnes, DataTable } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
 * Le tableau est un `DataTable` — cases à cocher et pagination — et non le
 * `Tableau` du tableau de bord : celui-ci montre les chantiers *actifs* du
 * jour, en pleine largeur et sans pagination ; celui-là est le portefeuille
 * complet, qui dépasse l'écran dès la première année d'exploitation.
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

/** Dix lignes : la hauteur d'un écran de bureau sans défilement du tableau. */
const TAILLE_DE_PAGE = 10;

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

/**
 * La carte colle le tableau à ses bords : les colonnes extrêmes portent la
 * gouttière — resserrée sous 640 px, comme celle de la page.
 */
const BORD_GAUCHE = "pl-4 sm:pl-6";
const BORD_DROIT = "pr-4 text-right sm:pr-6";

/**
 * Radix réserve la valeur vide au placeholder : « aucun filtre » a donc
 * besoin d'une valeur à lui, traduite en `""` à l'aller comme au retour.
 */
const TOUS = "tous";

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
          meta: { classe: `${BORD_DROIT} tabular-nums text-neutral-600` },
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
          // `p-0` aux deux ruptures : le tableau va d'un bord à l'autre de la carte.
          <Carte className="overflow-hidden p-0 md:p-0">
            <BarreOutils
              criteres={criteres}
              onChangement={setCriteres}
              statuts={statuts}
              chefs={chefs}
              filtresActifs={filtresActifs}
            />

            {/* La `key` remet la pagination à la première page quand le
                filtre change : sans elle, un filtre qui ramène trois lignes
                alors qu'on lisait la page 3 affiche un tableau vide. */}
            <DataTable
              key={`${criteres.recherche}|${criteres.statut}|${criteres.chefProjetId}`}
              colonnes={colonnes}
              donnees={projetsFiltres}
              cleLigne={(projet) => projet.id}
              messageVide={filtresActifs ? t("aucunResultat") : t("aucuneLigne")}
              selectionnable
              classeSelection={BORD_GAUCHE}
              tailleDePage={TAILLE_DE_PAGE}
              className="[&_td]:py-3"
            />
          </Carte>
        ))}

      <TiroirCreationProjet
        ouverte={tiroirOuvert}
        onFermer={() => setTiroirOuvert(false)}
        onProjetCree={surProjetCree}
      />
    </div>
  );
}

interface PropsBarreOutils {
  criteres: CriteresProjets;
  onChangement: (criteres: CriteresProjets) => void;
  statuts: StatutProjet[];
  chefs: { id: string; nomComplet: string }[];
  filtresActifs: boolean;
}

/**
 * La barre d'outils du tableau : une recherche et deux filtres.
 *
 * Les deux listes ne proposent que ce que le portefeuille contient
 * réellement — un statut qu'aucun chantier ne porte, ou un chef de projet
 * qui n'en suit aucun, ne donnerait qu'un tableau vide. Et parce qu'un filtre
 * actif explique un tableau presque vide, la remise à zéro s'affiche juste à
 * côté : c'est la sortie de secours de quelqu'un qui ne comprend pas
 * pourquoi « son » chantier a disparu.
 */
function BarreOutils({
  criteres,
  onChangement,
  statuts,
  chefs,
  filtresActifs,
}: PropsBarreOutils) {
  const t = useTranslations("projets");

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-3 sm:px-6 sm:py-4">
      {/* La recherche ne s'étire plus (`flex-1`) : une barre de 600 px pour
          une référence de douze caractères, et les deux filtres repoussés
          contre le bord droit de la carte. Elle prend la ligne sous 640 px,
          une largeur fixe au-delà. */}
      <div className="relative flex w-full items-center sm:w-60">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 text-neutral-500"
          aria-hidden="true"
        />
        <input
          type="search"
          className={[
            "h-[var(--button-height-sm)] w-full rounded-md border border-neutral-300 bg-neutral-0",
            "pr-3 pl-9 text-sm text-neutral-800 placeholder:text-neutral-500",
            "focus:border-primary-500 focus:shadow-[var(--shadow-focus)] focus:outline-none",
          ].join(" ")}
          placeholder={t("recherchePlaceholder")}
          aria-label={t("recherche")}
          value={criteres.recherche}
          onChange={(evenement) =>
            onChangement({ ...criteres, recherche: evenement.target.value })
          }
        />
      </div>

      {/* `Select` de shadcn plutôt que le `<select>` natif : la liste native
          est dessinée par le système, donc ni la charte ni la largeur du
          champ ne l'atteignent — sur Android elle s'ouvre en plein écran,
          et le chevron y est celui du navigateur. */}
      <Select
        value={criteres.statut || TOUS}
        onValueChange={(valeur) =>
          onChangement({ ...criteres, statut: valeur === TOUS ? "" : (valeur as StatutProjet) })
        }
      >
                <SelectTrigger
          size="sm"
          aria-label={t("filtreStatut")}
          className="min-w-0 flex-1 sm:min-w-40 sm:flex-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>{t("filtreStatutTous")}</SelectItem>
          {statuts.map((statut) => (
            <SelectItem key={statut} value={statut}>
              {t(`statut.${statut}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={criteres.chefProjetId || TOUS}
        onValueChange={(valeur) =>
          onChangement({ ...criteres, chefProjetId: valeur === TOUS ? "" : valeur })
        }
      >
        <SelectTrigger
          size="sm"
          aria-label={t("filtreChefProjet")}
          className="min-w-0 flex-1 sm:min-w-44 sm:flex-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>{t("filtreChefProjetTous")}</SelectItem>
          {chefs.map((chef) => (
            <SelectItem key={chef.id} value={chef.id}>
              {chef.nomComplet}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {filtresActifs && (
        <Bouton variante="ghost" taille="sm" onClick={() => onChangement(CRITERES_VIDES)}>
          {t("reinitialiserFiltres")}
        </Bouton>
      )}
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
