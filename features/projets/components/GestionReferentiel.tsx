"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Alerte, Badge, Bouton, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { ErreurApi } from "@/lib/api";

import {
  ajouterAuReferentiel,
  cleReferentiel,
  retirerDuReferentiel,
  useReferentiel,
  type CategorieReferentiel,
  type EntreeReferentiel,
} from "../referentiels";

/**
 * Une liste dynamique de l'entreprise (types de projet ou noms de lot) : ses
 * propres entrées s'ajoutent et se retirent ici ; celles de la plateforme
 * s'affichent, verrouillées.
 */
export function GestionReferentiel({ categorie }: { categorie: CategorieReferentiel }) {
  const t = useTranslations("projets.referentiels.gestion");
  const cache = useQueryClient();
  const { requete, entrees } = useReferentiel(categorie);
  const [saisie, setSaisie] = useState("");
  const [aRetirer, setARetirer] = useState<EntreeReferentiel | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function message(cause: unknown) {
    return cause instanceof ErreurApi ? cause.message : t("erreur");
  }

  const ajout = useMutation({
    mutationFn: () => ajouterAuReferentiel(categorie, saisie),
    onSuccess: () => {
      setSaisie("");
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

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (saisie.trim()) ajout.mutate();
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
        <Bouton
          type="submit"
          iconeGauche={<Plus size={16} />}
          disabled={!saisie.trim() || ajout.isPending}
          enCours={ajout.isPending}
        >
          {t("ajouter")}
        </Bouton>
      </form>
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
                {entree.groupe && <p className="truncate text-xs text-neutral-500">{entree.groupe}</p>}
              </div>
              {entree.origine === "PLATEFORME" ? (
                <Badge variante="neutre" title={t("aidePlateforme")}>
                  {t("plateforme")}
                </Badge>
              ) : (
                <Bouton
                  variante="ghost"
                  taille="sm"
                  className="text-erreur"
                  aria-label={t("retirer")}
                  onClick={() => setARetirer(entree)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Bouton>
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
