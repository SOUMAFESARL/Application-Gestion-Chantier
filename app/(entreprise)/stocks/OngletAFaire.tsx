"use client";

import { AlertTriangle, ArrowRight, CircleCheck, ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui";
import type { AlerteStock, Tache, TypeTache } from "@/features/stocks";
import {
  DELAI_INVENTAIRE_JOURS,
  DELAI_VALIDATION_CP_HEURES,
  DELAI_VALIDATION_CT_HEURES,
  SEUIL_ECART_INVENTAIRE,
} from "@/features/stocks";
import { formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BLOC, BLOC_CORPS, BLOC_ENTETE, BLOC_SOUS_TITRE, BLOC_TITRE, BLOC_VIDE, LIGNE_LISTE } from "./classes";
import { useStock } from "./contexte";

/** L'ordre des familles de tâches : ce qui bloque le stock d'abord. */
const ORDRE: readonly TypeTache[] = [
  "VALIDER_CT",
  "VALIDER_CP",
  "DEPOSER_BL",
  "RECEPTIONNER",
  "COMMANDER",
  "TRANSMETTRE",
  "VALIDER_INVENTAIRE",
  "TERMINER_INVENTAIRE",
  "LANCER_INVENTAIRE",
  "REAPPROVISIONNER",
  "CLOTURER",
  "REGLER_SEUIL",
];

/**
 * Ce que le compte doit faire du stock, et ce qui alerte (RG-STK-11).
 *
 * C'est la réponse à « que dois-je faire ou voir ici ? » pour chaque profil :
 * les tâches viennent de `tachesStock`, qui ne propose que les gestes du
 * compte sur chaque chantier. Un clic ouvre la pièce dans son onglet.
 */
export function OngletAFaire({ taches, alertes }: { taches: Tache[]; alertes: AlerteStock[] }) {
  const t = useTranslations("stocks.afaire");
  const { ouvrir, libelleLot, libelleProjet, projets } = useStock();
  const plusieurs = projets.length > 1;

  const familles = ORDRE.map((type) => ({ type, taches: taches.filter((tache) => tache.type === type) })).filter(
    (famille) => famille.taches.length > 0,
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <section className={cn(BLOC, "lg:col-span-3")} aria-labelledby="titre-taches">
        <div className={BLOC_ENTETE}>
          <div>
            <h2 id="titre-taches" className={BLOC_TITRE}>
              {t("titre")}
            </h2>
            <p className={BLOC_SOUS_TITRE}>{t("sousTitre")}</p>
          </div>
          <ClipboardList className="size-5 text-primary-500" aria-hidden="true" />
        </div>
        <div className={BLOC_CORPS}>
          {familles.length === 0 ? (
            <p className={cn(BLOC_VIDE, "flex flex-col items-center gap-2")}>
              <CircleCheck className="size-6 text-succes" aria-hidden="true" />
              {t("rien")}
            </p>
          ) : (
            familles.map((famille) => (
              <div key={famille.type} className="mt-3 first:mt-1">
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                  {t(`familles.${famille.type}`, { n: famille.taches.length })}
                </h3>
                <ul className="m-0 list-none p-0">
                  {famille.taches.map((tache) => (
                    <li key={`${tache.type}-${tache.cible}`} className={LIGNE_LISTE}>
                      <button
                        type="button"
                        onClick={() => ouvrir({ onglet: tache.onglet, type: tache.type, cible: tache.cible })}
                        className="group flex w-full cursor-pointer items-start gap-3 border-0 bg-transparent p-0 text-left"
                      >
                        <span
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            tache.urgente ? "bg-erreur" : "bg-primary-300",
                          )}
                          aria-hidden="true"
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-medium text-neutral-900 group-hover:text-primary-600">
                            {t(`actions.${tache.type}`, { objet: tache.objet })}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {plusieurs
                              ? t("ouLot", { projet: libelleProjet(tache.projetId), lot: libelleLot(tache.lotId) })
                              : libelleLot(tache.lotId)}
                          </span>
                        </span>
                        {tache.urgente && <Badge variante="erreur">{t("urgent")}</Badge>}
                        <ArrowRight
                          className="mt-0.5 size-4 shrink-0 text-neutral-400 group-hover:text-primary-600"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>

      <section className={cn(BLOC, "lg:col-span-2")} aria-labelledby="titre-alertes">
        <div className={BLOC_ENTETE}>
          <div>
            <h2 id="titre-alertes" className={BLOC_TITRE}>
              {t("alertes.titre")}
            </h2>
            <p className={BLOC_SOUS_TITRE}>{t("alertes.sousTitre")}</p>
          </div>
          <AlertTriangle className="size-5 text-avertissement" aria-hidden="true" />
        </div>
        <div className={BLOC_CORPS}>
          {alertes.length === 0 ? (
            <p className={BLOC_VIDE}>{t("alertes.aucune")}</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {alertes.map((alerte) => (
                <li key={`${alerte.type}-${alerte.lotId}-${alerte.objet}`} className={LIGNE_LISTE}>
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      alerte.critique ? "bg-erreur-fond text-erreur" : "bg-avertissement-fond text-avertissement",
                    )}
                  >
                    <AlertTriangle className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-neutral-900">
                      {t(`alertes.types.${alerte.type}`, {
                        objet: alerte.objet,
                        valeur: formaterQuantite(alerte.valeur),
                        delaiCT: DELAI_VALIDATION_CT_HEURES,
                        delaiCP: DELAI_VALIDATION_CP_HEURES,
                        seuil: SEUIL_ECART_INVENTAIRE,
                        jours: DELAI_INVENTAIRE_JOURS,
                      })}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {t("alertes.ouEtQui", {
                        projet: libelleProjet(alerte.projetId),
                        lot: libelleLot(alerte.lotId),
                        qui: t(`alertes.destinataires.${alerte.type}`),
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
