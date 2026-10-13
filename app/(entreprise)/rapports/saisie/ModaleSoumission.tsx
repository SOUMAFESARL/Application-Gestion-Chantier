"use client";

import { LoaderCircle, Send, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ResumeSaisie } from "@/features/chantier";
import { SEUIL_ALERTE_PRESENCE } from "@/features/chantier";
import { formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * La confirmation de soumission (SFD §6.2) : le résumé de ce que le chef de
 * chantier certifie. Après, le rapport ne se modifie plus — il le lit donc
 * ici une dernière fois, chiffres en tête.
 */
export function ModaleSoumission({
  resume,
  chantier,
  jour,
  ouverte,
  enCours,
  onFermer,
  onConfirmer,
}: {
  resume: ResumeSaisie | null;
  chantier: string;
  jour: string;
  ouverte: boolean;
  enCours: boolean;
  onFermer: () => void;
  onConfirmer: () => void;
}) {
  const t = useTranslations("journal.saisie.soumission");
  const tSaisie = useTranslations("journal.saisie");

  const lignes: { libelle: string; valeur: string; alerte?: boolean }[] = resume
    ? [
        ...(resume.effectifPrevu > 0 || resume.effectifPresent > 0
          ? [
              {
                libelle: t("effectifs"),
                valeur: t("effectifsValeur", {
                  presents: resume.effectifPresent,
                  prevus: resume.effectifPrevu,
                  taux: resume.taux ?? 0,
                }),
                alerte: resume.taux !== null && resume.taux < SEUIL_ALERTE_PRESENCE,
              },
              { libelle: t("heures"), valeur: tSaisie("heures", { valeur: formaterQuantite(resume.heures) }) },
            ]
          : []),
        {
          libelle: t("activites"),
          valeur: t("activitesValeur", { avancees: resume.activitesAvancees, total: resume.activites }),
        },
        ...(resume.avancementLot !== null
          ? [{ libelle: t("avancementLot"), valeur: tSaisie("pourcent", { valeur: resume.avancementLot }) }]
          : []),
        { libelle: t("materiaux"), valeur: String(resume.materiaux) },
        { libelle: t("livraisons"), valeur: String(resume.livraisons) },
        {
          libelle: t("incidents"),
          valeur: t("incidentsValeur", { n: resume.incidents, graves: resume.incidentsGraves }),
          alerte: resume.incidentsGraves > 0,
        },
        {
          libelle: t("blocage"),
          valeur: tSaisie(`blocage.niveaux.${resume.blocage}`),
          alerte: resume.blocage === "BLOQUANT",
        },
        { libelle: t("photos"), valeur: String(resume.photos) },
      ]
    : [];

  return (
    <Dialog open={ouverte} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("titre")}</DialogTitle>
          <DialogDescription>{t("description", { chantier, jour })}</DialogDescription>
        </DialogHeader>

        <dl className="m-0 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {lignes.map((ligne) => (
            <div key={ligne.libelle} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <dt className="text-neutral-600">{ligne.libelle}</dt>
              <dd className={cn("m-0 text-right font-semibold tabular-nums", ligne.alerte ? "text-erreur" : "text-neutral-900")}>
                {ligne.valeur}
              </dd>
            </div>
          ))}
        </dl>

        <p className="m-0 flex items-start gap-2 rounded-lg bg-avertissement-fond px-3 py-2 text-sm text-avertissement">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("immuable")}
        </p>

        <DialogFooter className="grid grid-cols-2 gap-3 sm:flex">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("relire")}
          </Button>
          <Button type="button" onClick={onConfirmer} disabled={enCours}>
            {enCours ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {t("confirmer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
