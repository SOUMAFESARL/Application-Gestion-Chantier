"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Badge, Bouton, Carte } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { modifierSemaineType } from "@/features/calendrier/adaptateur";
import { CLE_CALENDRIER } from "@/features/calendrier/cles";
import {
  appliquerHoraireAuxJoursOuvres,
  horairesIdentiques,
  JOURS_SEMAINE,
  premierJourHoraireInvalide,
  semainesIdentiques,
  semaineValide,
} from "@/features/calendrier";
import type { HorairesSemaine, JourSemaine, PlageHoraire, SemaineType } from "@/features/calendrier";
import { ErreurApi } from "@/lib/api";

interface Props {
  /** La semaine type enregistrée côté serveur. */
  semaine: SemaineType;
  /** Les horaires de travail par jour enregistrés côté serveur. */
  horaires: HorairesSemaine;
  peutGerer: boolean;
}

/**
 * La semaine type et les horaires de travail des jours ouvrés.
 *
 * Sans le droit d'écriture, elle se lit seulement. Avec lui, chaque jour se coche et
 * porte ses horaires de début et de fin ; une semaine sans aucun jour ou avec une plage
 * horaire incohérente (fin <= début) est refusée avant l'appel.
 */
export function SemaineTypeCarte({ semaine, horaires, peutGerer }: Props) {
  const t = useTranslations("calendrier");
  const cache = useQueryClient();
  const idBase = useId();

  // Le brouillon n'existe que pendant la modification : sans lui, on lit la semaine du serveur.
  const [brouillon, setBrouillon] = useState<SemaineType | null>(null);
  const [brouillonHoraires, setBrouillonHoraires] = useState<HorairesSemaine | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const affichee = brouillon ?? semaine;
  const horairesAffiches = brouillonHoraires ?? horaires;
  const modifiee =
    (brouillon !== null && !semainesIdentiques(brouillon, semaine)) ||
    (brouillonHoraires !== null && !horairesIdentiques(brouillonHoraires, horaires));

  const enregistrement = useMutation({
    mutationFn: (payload: { semaine: SemaineType; horaires: HorairesSemaine }) =>
      modifierSemaineType(payload.semaine, payload.horaires),
    onSuccess: () => {
      setBrouillon(null);
      setBrouillonHoraires(null);
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

  function changerHoraire(jour: JourSemaine, champ: keyof PlageHoraire, valeur: string) {
    setBrouillonHoraires({
      ...horairesAffiches,
      [jour]: {
        ...horairesAffiches[jour],
        [champ]: valeur,
      },
    });
    setErreur(null);
  }

  function propagerAuxOuvres(jourSource: JourSemaine) {
    setBrouillonHoraires(
      appliquerHoraireAuxJoursOuvres(affichee, horairesAffiches, horairesAffiches[jourSource]),
    );
    setErreur(null);
  }

  function enregistrer() {
    if (!semaineValide(affichee)) {
      setErreur(t("semaineType.erreurVide"));
      return;
    }
    const jourInvalide = premierJourHoraireInvalide(affichee, horairesAffiches);
    if (jourInvalide) {
      setErreur(t("semaineType.erreurHoraire", { jour: t(`jours.${jourInvalide}`) }));
      return;
    }
    setErreur(null);
    enregistrement.mutate({ semaine: affichee, horaires: horairesAffiches });
  }

  if (!peutGerer) {
    return (
      <Carte titre={t("semaineType.titre")}>
        <p className="mb-3 text-sm text-neutral-600">{t("semaineType.aideLecture")}</p>
        <ul className="flex flex-wrap gap-2">
          {JOURS_SEMAINE.map((jour) => (
            <li key={jour}>
              <Badge variante={semaine[jour] ? "succes" : "neutre"}>
                {semaine[jour]
                  ? t("semaineType.jourEtatHoraire", {
                      jour: t(`jours.${jour}`),
                      etat: t("etat.ouvre"),
                      debut: horaires[jour].debut,
                      fin: horaires[jour].fin,
                    })
                  : t("semaineType.jourEtat", {
                      jour: t(`jours.${jour}`),
                      etat: t("etat.nonOuvre"),
                    })}
              </Badge>
            </li>
          ))}
        </ul>
      </Carte>
    );
  }

  const premierOuvre = JOURS_SEMAINE.find((jour) => affichee[jour]) ?? null;

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

      <div className="mt-5 border-t border-neutral-200 pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="m-0 text-sm font-semibold text-neutral-900">
              {t("semaineType.horairesTitre")}
            </h4>
            <p className="m-0 mt-0.5 text-xs text-neutral-600">
              {t("semaineType.horairesAide")}
            </p>
          </div>
          {premierOuvre && (
            <Bouton
              variante="secondaire"
              taille="sm"
              disabled={enregistrement.isPending}
              onClick={() => propagerAuxOuvres(premierOuvre)}
            >
              {t("semaineType.appliquerATous", { jour: t(`jours.${premierOuvre}`) })}
            </Bouton>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {JOURS_SEMAINE.map((jour) => {
            const estOuvre = affichee[jour];
            const plage = horairesAffiches[jour];
            return (
              <div
                key={`horaires-${jour}`}
                className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50/60 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-800">
                    {t(`jours.${jour}`)}
                  </span>
                  <Badge variante={estOuvre ? "succes" : "neutre"}>
                    {estOuvre ? t("etat.ouvre") : t("etat.nonOuvre")}
                  </Badge>
                </div>
                {estOuvre ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor={`${idBase}-${jour}-debut`}
                        className="text-xs text-neutral-600"
                      >
                        {t("semaineType.heureDebut")}
                      </Label>
                      <Input
                        id={`${idBase}-${jour}-debut`}
                        type="time"
                        value={plage.debut}
                        disabled={enregistrement.isPending}
                        onChange={(e) => changerHoraire(jour, "debut", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor={`${idBase}-${jour}-fin`}
                        className="text-xs text-neutral-600"
                      >
                        {t("semaineType.heureFin")}
                      </Label>
                      <Input
                        id={`${idBase}-${jour}-fin`}
                        type="time"
                        value={plage.fin}
                        disabled={enregistrement.isPending}
                        onChange={(e) => changerHoraire(jour, "fin", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="m-0 py-2 text-xs text-neutral-400">
                    {t("semaineType.jourNonTravaille")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
              setBrouillonHoraires(null);
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
