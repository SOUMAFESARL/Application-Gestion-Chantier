"use client";

import { useTranslations } from "next-intl";

import { ABSENT, formaterJourMoisNumerique } from "@/lib/format";

/** « 01/07 → 15/07 » — repris de l'écran « Lots & activités », retiré au lot 4 du découpage. */
export function Periode({ debut, fin }: { debut: string | null; fin: string | null }) {
  const t = useTranslations("projets.lotsActivites");
  if (!debut && !fin) return <>{ABSENT}</>;
  return (
    <>
      {t("periode", {
        debut: formaterJourMoisNumerique(debut),
        fin: formaterJourMoisNumerique(fin),
      })}
    </>
  );
}
