"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AlerteRetard } from "@/features/alertes/types";
import { ABSENT, formaterDate, formaterDateHeure, formaterQuantite } from "@/lib/format";

import { BadgeEtatAlerte, BadgeNiveauAlerte } from "./BadgesAlerte";

interface Props {
  /** `null` : le tiroir est fermé. */
  alerte: AlerteRetard | null;
  onFermer: () => void;
  /** Le geste est proposé ou non : la règle est décidée par l'écran, dans `regles.ts`. */
  peutCloturer: boolean;
  onCloturer: (alerte: AlerteRetard) => void;
}

/** Un titre de section du détail. */
function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-neutral-900">{titre}</h3>
      {children}
    </section>
  );
}

/** Une ligne « libellé : valeur » du détail. */
function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="text-neutral-600">{libelle}</dt>
      <dd className="m-0 text-right font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

/**
 * Le détail d'une alerte de retard, dans le tiroir latéral du produit : ce qui
 * la caractérise, ce que le serveur a relevé comme causes sur les sept derniers
 * jours, et ce qu'il recommande d'en faire. Une alerte déjà résolue rappelle
 * qui l'a clôturée, quand, et pourquoi.
 */
export function TiroirAlerte({ alerte, onFermer, peutCloturer, onCloturer }: Props) {
  const t = useTranslations("alertes.detail");

  return (
    <Sheet open={alerte !== null} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        {alerte && (
          <>
            <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg text-neutral-900">
                {alerte.lot
                  ? t("titreLot", { code: alerte.lot.code })
                  : t("titreProjet")}
                <BadgeNiveauAlerte niveau={alerte.niveau} />
              </SheetTitle>
              <SheetDescription>
                {t("sousTitre", { reference: alerte.projet.reference, nom: alerte.projet.nom })}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
              <Section titre={t("sectionAlerte")}>
                <dl className="m-0 flex flex-col gap-2">
                  <Ligne libelle={t("projet")}>
                    <Link
                      href={`/projets/${alerte.projet.id}`}
                      className="text-primary-600 no-underline hover:underline"
                    >
                      {t("projetValeur", { reference: alerte.projet.reference, nom: alerte.projet.nom })}
                    </Link>
                  </Ligne>
                  <Ligne libelle={t("lot")}>
                    {alerte.lot
                      ? t("lotValeur", { code: alerte.lot.code, libelle: alerte.lot.libelle })
                      : t("lotProjet")}
                  </Ligne>
                  <Ligne libelle={t("retard")}>
                    {alerte.deltaPts === null
                      ? ABSENT
                      : t("points", { valeur: formaterQuantite(alerte.deltaPts) })}
                  </Ligne>
                  <Ligne libelle={t("dateDetection")}>{formaterDate(alerte.dateDetection)}</Ligne>
                  <Ligne libelle={t("indiceSante")}>
                    {alerte.indiceSante === null
                      ? ABSENT
                      : t("santeSur100", { indice: alerte.indiceSante })}
                  </Ligne>
                  <Ligne libelle={t("etat")}>
                    <BadgeEtatAlerte statut={alerte.statut} />
                  </Ligne>
                </dl>
              </Section>

              <Section titre={t("sectionCauses")}>
                <dl className="m-0 flex flex-col gap-2">
                  <Ligne libelle={t("absences")}>{alerte.causes.absences}</Ligne>
                  <Ligne libelle={t("incidents")}>{alerte.causes.incidents}</Ligne>
                </dl>
                <div className="flex flex-col gap-1">
                  <p className="m-0 text-sm text-neutral-600">{t("blocagesOuverts")}</p>
                  {alerte.causes.blocagesOuverts.length === 0 ? (
                    <p className="m-0 text-sm text-neutral-500 italic">{t("aucunBlocage")}</p>
                  ) : (
                    <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-900">
                      {alerte.causes.blocagesOuverts.map((blocage, rang) => (
                        <li key={`${rang}-${blocage}`}>{blocage}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </Section>

              <Section titre={t("sectionActions")}>
                {alerte.actionsRecommandees.length === 0 ? (
                  <p className="m-0 text-sm text-neutral-500 italic">{t("aucuneAction")}</p>
                ) : (
                  <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-900">
                    {alerte.actionsRecommandees.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                )}
              </Section>

              {alerte.commentaireResolution && (
                <Section titre={t("sectionResolution")}>
                  <p className="m-0 flex items-center gap-2 text-sm text-neutral-600">
                    <CircleCheck size={16} className="shrink-0 text-succes" aria-hidden="true" />
                    {alerte.resoluePar
                      ? t("resoluePar", {
                          nom: alerte.resoluePar,
                          date: formaterDateHeure(alerte.resolueLe),
                        })
                      : t("resolueLe", { date: formaterDateHeure(alerte.resolueLe) })}
                  </p>
                  <p className="m-0 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm whitespace-pre-line text-neutral-800">
                    {alerte.commentaireResolution}
                  </p>
                </Section>
              )}
            </div>

            {peutCloturer && (
              <SheetFooter className="border-t border-neutral-200 px-6 py-4">
                <Button type="button" onClick={() => onCloturer(alerte)}>
                  {t("cloturer")}
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
