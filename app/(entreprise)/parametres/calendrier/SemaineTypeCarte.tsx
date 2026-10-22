"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Badge, Bouton, Carte } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { modifierSemaineType } from "@/features/calendrier/adaptateur";
import { CLE_CALENDRIER } from "@/features/calendrier/cles";
import { JOURS_SEMAINE, semainesIdentiques, semaineValide } from "@/features/calendrier";
import type { JourSemaine, SemaineType } from "@/features/calendrier";
import { ErreurApi } from "@/lib/api";

interface Props {
  /** La semaine type enregistrée côté serveur. */
  semaine: SemaineType;
  peutGerer: boolean;
}

/**
 * La semaine type : les jours de la semaine que l'entreprise travaille.
 *
 * Sans le droit d'écriture, elle se lit seulement. Avec lui, elle se coche, et
 * une semaine sans aucun jour est refusée **avant** l'appel (le serveur la
 * refuserait aussi, en 422).
 */
export function SemaineTypeCarte({ semaine, peutGerer }: Props) {
  const t = useTranslations("calendrier");
  const cache = useQueryClient();
  const idBase = useId();

  // Le brouillon n'existe que pendant la modification : sans lui, on lit la semaine du serveur.
  const [brouillon, setBrouillon] = useState<SemaineType | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const affichee = brouillon ?? semaine;
  const modifiee = brouillon !== null && !semainesIdentiques(brouillon, semaine);

  const enregistrement = useMutation({
    mutationFn: (nouvelle: SemaineType) => modifierSemaineType(nouvelle),
    onSuccess: () => {
      setBrouillon(null);
      void cache.invalidateQueries({ queryKey: CLE_CALENDRIER });
      toast.success(t("semaineType.succes"));
    },
    onError: (cause) => {
      toast.error(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
    },
  });

  function basculer(jour: JourSemaine, coche: boolean) {
    setBrouillon({ ...affichee, [jour]: coche });
    setErreur(null);
  }

  function enregistrer() {
    if (!semaineValide(affichee)) {
      setErreur(t("semaineType.erreurVide"));
      return;
    }
    setErreur(null);
    enregistrement.mutate(affichee);
  }

  if (!peutGerer) {
    return (
      <Carte titre={t("semaineType.titre")}>
        <p className="mb-3 text-sm text-neutral-600">{t("semaineType.aideLecture")}</p>
        <ul className="flex flex-wrap gap-2">
          {JOURS_SEMAINE.map((jour) => (
            <li key={jour}>
              <Badge variante={semaine[jour] ? "succes" : "neutre"}>
                {t("semaineType.jourEtat", {
                  jour: t(`jours.${jour}`),
                  etat: semaine[jour] ? t("etat.ouvre") : t("etat.nonOuvre"),
                })}
              </Badge>
            </li>
          ))}
        </ul>
      </Carte>
    );
  }

  return (
    <Carte titre={t("semaineType.titre")}>
      <p className="mb-4 text-sm text-neutral-600">{t("semaineType.aide")}</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-3">
        {JOURS_SEMAINE.map((jour) => (
          <li key={jour} className="flex items-center gap-2">
            <Checkbox
              id={`${idBase}-${jour}`}
              className="bg-card"
              checked={affichee[jour]}
              disabled={enregistrement.isPending}
              onCheckedChange={(coche) => basculer(jour, coche === true)}
            />
            <Label htmlFor={`${idBase}-${jour}`}>{t(`jours.${jour}`)}</Label>
          </li>
        ))}
      </ul>

      {erreur && (
        <p role="alert" className="mt-3 text-xs font-medium text-erreur">
          {erreur}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-3">
        {modifiee && (
          <Bouton
            variante="ghost"
            taille="sm"
            disabled={enregistrement.isPending}
            onClick={() => {
              setBrouillon(null);
              setErreur(null);
            }}
          >
            {t("semaineType.annuler")}
          </Bouton>
        )}
        <Bouton
          variante="primaire"
          taille="sm"
          disabled={!modifiee}
          enCours={enregistrement.isPending}
          onClick={enregistrer}
        >
          {enregistrement.isPending ? t("semaineType.enCours") : t("semaineType.enregistrer")}
        </Bouton>
      </div>
    </Carte>
  );
}
