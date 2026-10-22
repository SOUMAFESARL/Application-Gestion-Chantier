"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Alerte, Bouton, Champ, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { SelecteurModeBase } from "@/components/metier/SelecteurModeBase";
import { BORD_DROIT_TABLEAU, RechercheTableau, TableauListe } from "@/components/ui/tableau-liste";
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

  const entrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    const toutes = requete.data ?? [];
    return terme
      ? toutes.filter((e) =>
          `${e.libelle} ${libelleGroupe(e.groupe)}`.toLowerCase().includes(terme),
        )
      : toutes;
  }, [requete.data, recherche, libelleGroupe]);

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
          cell: ({ row }) => libelleGroupe(row.original.groupe),
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

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-neutral-900">{t("titre")}</h2>
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
          cleCriteres={recherche}
          outils={
            <RechercheTableau
              valeur={recherche}
              onChangement={setRecherche}
              libelle={tCommun("rechercher")}
              placeholder={tCommun("rechercher")}
            />
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
            <Champ
              libelle={tCommun("colonneGroupe")}
              aide={t("aideGroupe")}
              value={groupe}
              maxLength={100}
              disabled={enregistrement.isPending}
              onChange={(e) => setGroupe(e.target.value)}
            />
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
