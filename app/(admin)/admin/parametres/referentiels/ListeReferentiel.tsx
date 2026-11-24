"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { SelecteurModeBase } from "@/components/metier/SelecteurModeBase";
import { Alerte, Badge, Bouton, Champ, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { peutParametrerPlateforme } from "@/features/administration";
import type {
  CategorieReferentielPlateforme,
  EntreeReferentielPlateforme,
} from "@/features/administration";
import {
  ajouterReferentielPlateforme,
  listerReferentielPlateforme,
  modifierReferentielPlateforme,
  supprimerReferentielPlateforme,
} from "@/features/administration/adaptateur";
import { estModeExecutionBase } from "@/features/projets/regles";
import { ErreurApi } from "@/lib/api";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";

const colonne = aideColonnes<EntreeReferentielPlateforme>();

type Action =
  | { type: "formulaire"; entree: EntreeReferentielPlateforme | null }
  | { type: "suppression"; entree: EntreeReferentielPlateforme }
  | null;

/**
 * Un référentiel de la plateforme : ce qui s'y ajoute est proposé aussitôt
 * à toutes les entreprises, qui ne peuvent pas le supprimer. Une entrée
 * retirée ici n'est plus proposée ; les projets qui l'utilisent la gardent.
 *
 * Les modes d'exécution portent un groupe obligatoire : l'un des trois modes
 * de base, sur lesquels le rapport journalier raisonne.
 */
export function ListeReferentiel({ categorie }: { categorie: CategorieReferentielPlateforme }) {
  const t = useTranslations(`administration.parametres.referentiels.${categorie}`);
  const tCommun = useTranslations("administration.parametres.referentiels");
  const tModesBase = useTranslations("projets.referentiels.modesBase");
  const profil = useAdministrateur();
  const cache = useQueryClient();
  const peutAgir = peutParametrerPlateforme(profil);
  const cle = CLES_ADMINISTRATION.referentiels(categorie);
  const groupeObligatoire = categorie === "modes-execution";

  /** Le groupe tel qu'on le lit : un mode de base en toutes lettres, un autre groupe tel quel. */
  const libelleGroupe = useMemo(
    () => (groupe: string) => (estModeExecutionBase(groupe) ? tModesBase(groupe) : groupe),
    [tModesBase],
  );

  const [action, setAction] = useState<Action>(null);
  const [libelle, setLibelle] = useState("");
  const [groupe, setGroupe] = useState("");
  const [recherche, setRecherche] = useState("");
  const [filtreGroupe, setFiltreGroupe] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: cle,
    queryFn: ({ signal }) => listerReferentielPlateforme(categorie, signal),
  });

  const enModification = action?.type === "formulaire" ? action.entree : null;

  function ouvrir(entree: EntreeReferentielPlateforme | null) {
    setErreur(null);
    setLibelle(entree?.libelle ?? "");
    setGroupe(entree?.groupe ?? "");
    setAction({ type: "formulaire", entree });
  }

  function fermer() {
    setAction(null);
    setErreur(null);
  }

  function surErreur(cause: unknown) {
    setErreur(cause instanceof ErreurApi ? cause.message : tCommun("erreur"));
  }

  const enregistrement = useMutation({
    mutationFn: () =>
      enModification
        ? modifierReferentielPlateforme(categorie, enModification.id, { libelle, groupe })
        : ajouterReferentielPlateforme(categorie, { libelle, groupe }),
    onSuccess: () => {
      toast.success(tCommun("succes"));
      void cache.invalidateQueries({ queryKey: cle });
      fermer();
    },
    onError: surErreur,
  });

  const suppression = useMutation({
    mutationFn: (entree: EntreeReferentielPlateforme) =>
      supprimerReferentielPlateforme(categorie, entree.id),
    onSuccess: () => {
      toast.success(tCommun("succesSuppression"));
      void cache.invalidateQueries({ queryKey: cle });
      fermer();
    },
    onError: surErreur,
  });

  const groupesPresents = useMemo(() => {
    const distincts = [
      ...new Set((requete.data ?? []).map((e) => e.groupe).filter(Boolean)),
    ];
    return distincts.map((valeur) => ({ valeur, libelle: libelleGroupe(valeur) }));
  }, [requete.data, libelleGroupe]);

  const optionsComboboxGroupe = useMemo<OptionCombobox[]>(
    () => [{ valeur: "", libelle: tCommun("groupeAucun") }, ...groupesPresents],
    [groupesPresents, tCommun],
  );

  const entrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    const toutes = requete.data ?? [];
    return toutes.filter((e) => {
      if (filtreGroupe && e.groupe !== filtreGroupe) return false;
      if (!terme) return true;
      return `${e.libelle} ${libelleGroupe(e.groupe)}`.toLowerCase().includes(terme);
    });
  }, [requete.data, recherche, filtreGroupe, libelleGroupe]);

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("libelle", {
          id: "libelle",
          header: tCommun("colonneLibelle"),
          cell: ({ row }) => (
            <span className="font-medium text-neutral-900">{row.original.libelle}</span>
          ),
        }),
        colonne.accessor("groupe", {
          id: "groupe",
          header: tCommun("colonneGroupe"),
          cell: ({ row }) =>
            row.original.groupe ? (
              <Badge variante="neutre">{libelleGroupe(row.original.groupe)}</Badge>
            ) : (
              <span className="text-neutral-400">{tCommun("sansGroupe")}</span>
            ),
        }),
        colonne.display({
          id: "actions",
          header: "",
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) =>
            peutAgir && (
              <div className="flex justify-end gap-1">
                <Bouton
                  variante="ghost"
                  taille="sm"
                  aria-label={tCommun("modifier")}
                  onClick={() => ouvrir(row.original)}
                >
                  <Pencil size={16} aria-hidden="true" />
                </Bouton>
                <Bouton
                  variante="ghost"
                  taille="sm"
                  className="text-erreur"
                  aria-label={tCommun("supprimer")}
                  onClick={() => {
                    setErreur(null);
                    setAction({ type: "suppression", entree: row.original });
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Bouton>
              </div>
            ),
        }),
      ]),
    [tCommun, peutAgir, libelleGroupe],
  );

  const exporter = useMemo<ExportTableau<EntreeReferentielPlateforme>>(
    () => ({
      titre: t("titre"),
      nomFichier: t("nomFichier"),
      colonnes: [
        { entete: tCommun("colonneLibelle"), valeur: (e) => e.libelle },
        { entete: tCommun("colonneGroupe"), valeur: (e) => libelleGroupe(e.groupe) },
        { entete: tCommun("colonneCode"), valeur: (e) => e.code },
      ],
    }),
    [t, tCommun, libelleGroupe],
  );

  const filtresActifs = recherche.trim() !== "" || filtreGroupe !== "";

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">{t("titre")}</h2>
        <p className="text-sm text-neutral-600">{t("description")}</p>
      </div>
      {requete.isPending ? (
        <EtatChargement />
      ) : requete.isError ? (
        <EtatErreur onReessayer={() => void requete.refetch()} />
      ) : (
        <TableauListe
          colonnes={colonnes}
          donnees={entrees}
          cleLigne={(e) => e.id}
          messageVide={t("vide")}
          exporter={exporter}
          cleCriteres={`${recherche}|${filtreGroupe}`}
          filtresActifs={filtresActifs}
          onReinitialiser={() => {
            setRecherche("");
            setFiltreGroupe("");
          }}
          outils={
            <>
              <RechercheTableau
                valeur={recherche}
                onChangement={setRecherche}
                libelle={tCommun("rechercher")}
                placeholder={tCommun("rechercher")}
              />
              {groupesPresents.length > 0 && (
                <FiltreTableau<string>
                  valeur={filtreGroupe}
                  onChangement={setFiltreGroupe}
                  libelle={tCommun("filtreGroupe")}
                  libelleTous={tCommun("filtreGroupeTous")}
                  options={groupesPresents}
                />
              )}
            </>
          }
          actions={
            peutAgir && (
              <Bouton taille="sm" iconeGauche={<Plus size={16} />} onClick={() => ouvrir(null)}>
                {t("ajouter")}
              </Bouton>
            )
          }
        />
      )}

      <Modale
        ouverte={action?.type === "formulaire"}
        titre={enModification ? tCommun("titreModification") : t("ajouter")}
        onFermer={enregistrement.isPending ? undefined : fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer} disabled={enregistrement.isPending}>
              {tCommun("annuler")}
            </Bouton>
            <Bouton
              disabled={!libelle.trim() || (groupeObligatoire && !groupe) || enregistrement.isPending}
              enCours={enregistrement.isPending}
              onClick={() => enregistrement.mutate()}
            >
              {tCommun("enregistrer")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Champ
            libelle={tCommun("colonneLibelle")}
            value={libelle}
            maxLength={150}
            disabled={enregistrement.isPending}
            onChange={(e) => setLibelle(e.target.value)}
          />
          {groupeObligatoire ? (
            <SelecteurModeBase
              valeur={groupe}
              onChange={setGroupe}
              disabled={enregistrement.isPending}
            />
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-neutral-800">
                {tCommun("colonneGroupe")}
              </span>
              <Combobox
                options={optionsComboboxGroupe}
                valeur={groupe}
                onChange={(v) => setGroupe(v.slice(0, 100))}
                placeholder={tCommun("groupePlaceholder")}
                placeholderRecherche={tCommun("groupeRechercher")}
                aucunResultat={tCommun("groupeAucunResultat")}
                libelleSaisieLibre={(saisie) => tCommun("groupeCreer", { saisie })}
                aria-label={tCommun("colonneGroupe")}
                className="h-[var(--input-height-md)]"
                disabled={enregistrement.isPending}
              />
              <span className="text-xs text-neutral-500">{t("aideGroupe")}</span>
            </div>
          )}
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        </div>
      </Modale>

      <Modale
        ouverte={action?.type === "suppression"}
        titre={tCommun("titreSuppression")}
        onFermer={suppression.isPending ? undefined : fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer} disabled={suppression.isPending}>
              {tCommun("annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              enCours={suppression.isPending}
              disabled={suppression.isPending}
              onClick={() => action?.type === "suppression" && suppression.mutate(action.entree)}
            >
              {tCommun("supprimer")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>
            {tCommun("confirmationSuppression", {
              libelle: action?.type === "suppression" ? action.entree.libelle : "",
            })}
          </p>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        </div>
      </Modale>
    </section>
  );
}
