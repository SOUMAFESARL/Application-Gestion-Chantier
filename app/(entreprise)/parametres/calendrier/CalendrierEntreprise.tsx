"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Alerte, Bouton, Carte, EtatChargement, EtatErreur } from "@/components/ui";
import { lireCalendrier } from "@/features/calendrier/adaptateur";
import { cleCalendrier } from "@/features/calendrier/cles";
import {
  aujourdhuiIso,
  compterOuvres,
  joursDuMois,
  libelleDuMois,
  memeMois,
  moisDecale,
  moisDeLaDate,
  PERMISSION_GERER_CALENDRIER,
  periodeDuMois,
  statutDuJour,
} from "@/features/calendrier";
import type { MoisAffiche } from "@/features/calendrier";
import { useDroits } from "@/features/habilitations";
import { ErreurApi } from "@/lib/api";

import { GrilleMois } from "./GrilleMois";
import { ModaleException } from "./ModaleException";
import { SemaineTypeCarte } from "./SemaineTypeCarte";

/**
 * Calendrier de l'entreprise — écran de paramètres.
 *
 * **Tout le monde consulte, seuls les comptes qui ont `administration.calendrier_gerer`
 * modifient** (DG et AD). Les contrôles d'écriture ne sont pas rendus sans ce droit :
 * ce n'est pas une barrière, le serveur refuse (403) à qui n'a pas le code.
 *
 * Le serveur est lu **par mois** : la période demandée est celle du mois affiché.
 */
export function CalendrierEntreprise() {
  const t = useTranslations("calendrier");
  const { peutCode } = useDroits();
  const peutGerer = peutCode(PERMISSION_GERER_CALENDRIER);

  const aujourdhui = aujourdhuiIso();
  const [affiche, setAffiche] = useState<MoisAffiche>(() => moisDeLaDate(aujourdhui));
  const [dateChoisie, setDateChoisie] = useState<string | null>(null);

  const periode = periodeDuMois(affiche);
  const calendrier = useQuery({
    queryKey: cleCalendrier(periode.debut, periode.fin),
    queryFn: ({ signal }) => lireCalendrier(periode.debut, periode.fin, signal),
  });

  const donnees = calendrier.data;
  const jours = donnees ? joursDuMois(affiche, donnees).jours : [];
  const jourChoisi = donnees && dateChoisie ? statutDuJour(dateChoisie, donnees) : null;

  return (
    <div className="flex flex-col">
      <EnTetePage className="mb-5" titre={t("titre")} description={t("description")} />

      <Alerte type="information">{t("aideFetes")}</Alerte>
      {!peutGerer && <Alerte type="information">{t("lectureSeule")}</Alerte>}

      {calendrier.isPending && <EtatChargement message={t("chargement")} />}

      {calendrier.isError && (
        <EtatErreur
          message={calendrier.error instanceof ErreurApi ? calendrier.error.message : undefined}
          onReessayer={() => void calendrier.refetch()}
        />
      )}

      {donnees && (
        <div className="flex flex-col gap-5">
          <SemaineTypeCarte semaine={donnees.semaineType} peutGerer={peutGerer} />

          <Carte
            titre={libelleDuMois(affiche)}
            actions={
              <>
                {!memeMois(affiche, moisDeLaDate(aujourdhui)) && (
                  <Bouton
                    variante="ghost"
                    taille="sm"
                    onClick={() => setAffiche(moisDeLaDate(aujourdhui))}
                  >
                    {t("mois.courant")}
                  </Bouton>
                )}
                <Bouton
                  variante="secondaire"
                  taille="sm"
                  aria-label={t("mois.precedent")}
                  title={t("mois.precedent")}
                  onClick={() => setAffiche((precedent) => moisDecale(precedent, -1))}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </Bouton>
                <Bouton
                  variante="secondaire"
                  taille="sm"
                  aria-label={t("mois.suivant")}
                  title={t("mois.suivant")}
                  onClick={() => setAffiche((precedent) => moisDecale(precedent, 1))}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </Bouton>
              </>
            }
          >
            <p className="mb-4 text-sm text-neutral-600">
              {t("mois.resume", { n: compterOuvres(jours) })}
              {peutGerer && ` ${t("mois.aideClic")}`}
            </p>
            <GrilleMois
              mois={affiche}
              calendrier={donnees}
              aujourdhui={aujourdhui}
              peutGerer={peutGerer}
              onChoisir={setDateChoisie}
            />
          </Carte>
        </div>
      )}

      {peutGerer && donnees && (
        <ModaleException
          jour={jourChoisi}
          calendrier={donnees}
          onFermer={() => setDateChoisie(null)}
        />
      )}
    </div>
  );
}
