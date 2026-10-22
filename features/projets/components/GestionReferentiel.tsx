"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { SelecteurModeBase } from "@/components/metier/SelecteurModeBase";
import { Alerte, Badge, Bouton, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { Combobox, type OptionCombobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { ErreurApi } from "@/lib/api";

import { estModeExecutionBase } from "../regles";
import {
  ajouterAuReferentiel,
  cleReferentiel,
  REFERENTIEL_MODES_EXECUTION,
  retirerDuReferentiel,
  useDroitsReferentiels,
  useReferentiel,
  type CategorieReferentiel,
  type EntreeReferentiel,
} from "../referentiels";

const LONGUEUR_MAX_GROUPE = 100;

/**
 * Une liste dynamique de l'entreprise (types de projet, noms de lot ou modes
 * d'exécution) : ses propres entrées s'ajoutent et se retirent ici ; celles de
 * la plateforme s'affichent, verrouillées. Les boutons d'ajout et de retrait
 * ne s'affichent que pour qui en a le droit — le serveur le dit.
 *
 * Une entrée peut porter un groupe (facultatif, choisi parmi ceux de la liste
 * ou nouveau). Un mode d'exécution doit porter l'un des trois modes de base.
 */
export function GestionReferentiel({ categorie }: { categorie: CategorieReferentiel }) {
  const t = useTranslations("projets.referentiels.gestion");
  const tBase = useTranslations("projets.referentiels.modesBase");
  const cache = useQueryClient();
  const { requete, entrees } = useReferentiel(categorie);
  const { droits } = useDroitsReferentiels();
  const [saisie, setSaisie] = useState("");
  const [groupe, setGroupe] = useState("");
  const [aRetirer, setARetirer] = useState<EntreeReferentiel | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const groupeObligatoire = categorie === REFERENTIEL_MODES_EXECUTION;

  function message(cause: unknown) {
    return cause instanceof ErreurApi ? cause.message : t("erreur");
  }

  /** Le groupe tel qu'on le lit : un mode de base en toutes lettres, un autre groupe tel quel. */
  function libelleGroupe(valeur: string) {
    return estModeExecutionBase(valeur) ? tBase(valeur) : valeur;
  }

  const groupesPresents = useMemo<OptionCombobox[]>(() => {
    const distincts = [...new Set(entrees.map((entree) => entree.groupe).filter(Boolean))];
    return [
      { valeur: "", libelle: t("groupe.aucun") },
      ...distincts.map((valeur) => ({ valeur, libelle: valeur })),
    ];
  }, [entrees, t]);

  const ajout = useMutation({
    mutationFn: () => ajouterAuReferentiel(categorie, saisie, groupe),
    onSuccess: () => {
      setSaisie("");
      setGroupe("");
      setErreur(null);
      toast.success(t("succesAjout"));
      void cache.invalidateQueries({ queryKey: cleReferentiel(categorie) });
    },
    onError: (cause) => setErreur(message(cause)),
  });

  const retrait = useMutation({
    mutationFn: (entree: EntreeReferentiel) => retirerDuReferentiel(categorie, entree.code),
    onSuccess: () => {
      setARetirer(null);
      toast.success(t("succesRetrait"));
      void cache.invalidateQueries({ queryKey: cleReferentiel(categorie) });
    },
    onError: (cause) => {
      setARetirer(null);
      toast.error(message(cause));
    },
  });

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-0 p-4 sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">{t(`titre.${categorie}`)}</h2>
        <p className="text-sm text-neutral-600">{t("aide")}</p>
      </div>

      {droits.peutAjouter && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (saisie.trim() && (!groupeObligatoire || groupe)) ajout.mutate();
          }}
        >
          <Input
            value={saisie}
            maxLength={150}
            placeholder={t(`placeholder.${categorie}`)}
            aria-label={t(`placeholder.${categorie}`)}
            disabled={ajout.isPending}
            onChange={(e) => setSaisie(e.target.value)}
          />
          {groupeObligatoire ? (
            <SelecteurModeBase valeur={groupe} onChange={setGroupe} disabled={ajout.isPending} />
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-neutral-800">{t("groupe.libelle")}</span>
              <Combobox
                options={groupesPresents}
                valeur={groupe}
                onChange={(valeur) => setGroupe(valeur.slice(0, LONGUEUR_MAX_GROUPE))}
                placeholder={t("groupe.placeholder")}
                placeholderRecherche={t("groupe.rechercher")}
                aucunResultat={t("groupe.aucunResultat")}
                libelleSaisieLibre={(recherche) => t("groupe.creer", { saisie: recherche })}
                aria-label={t("groupe.libelle")}
                className="h-[var(--input-height-md)]"
                disabled={ajout.isPending}
              />
            </div>
          )}
          <Bouton
            type="submit"
            className="self-start"
            iconeGauche={<Plus size={16} />}
            disabled={!saisie.trim() || (groupeObligatoire && !groupe) || ajout.isPending}
            enCours={ajout.isPending}
          >
            {t("ajouter")}
          </Bouton>
        </form>
      )}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {requete.isPending ? (
        <EtatChargement />
      ) : requete.isError ? (
        <EtatErreur onReessayer={() => void requete.refetch()} />
      ) : (
        <ul className="flex max-h-96 flex-col divide-y divide-neutral-100 overflow-y-auto">
          {entrees.map((entree) => (
            <li key={`${entree.origine}-${entree.code}`} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-900">{entree.libelle}</p>
                {entree.groupe && (
                  <p className="truncate text-xs text-neutral-500">{libelleGroupe(entree.groupe)}</p>
                )}
              </div>
              {entree.origine === "PLATEFORME" ? (
                <Badge variante="neutre" title={t("aidePlateforme")}>
                  {t("plateforme")}
                </Badge>
              ) : (
                droits.peutRetirer && (
                  <Bouton
                    variante="ghost"
                    taille="sm"
                    className="text-erreur"
                    aria-label={t("retirer")}
                    onClick={() => setARetirer(entree)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Bouton>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <Modale
        ouverte={aRetirer !== null}
        titre={t("titreRetrait")}
        onFermer={retrait.isPending ? undefined : () => setARetirer(null)}
        actions={
          <>
            <Bouton variante="ghost" onClick={() => setARetirer(null)} disabled={retrait.isPending}>
              {t("annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              enCours={retrait.isPending}
              disabled={retrait.isPending}
              onClick={() => aRetirer && retrait.mutate(aRetirer)}
            >
              {t("retirer")}
            </Bouton>
          </>
        }
      >
        <p>{t("confirmationRetrait", { libelle: aRetirer?.libelle ?? "" })}</p>
      </Modale>
    </section>
  );
}
