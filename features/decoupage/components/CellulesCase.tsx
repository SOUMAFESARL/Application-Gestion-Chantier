"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui";
import { ABSENT, formaterDate, formaterMontant, formaterPourcentage } from "@/lib/format";
import { cn } from "@/lib/utils";

import { etatAvancement } from "../regles";
import type { CaseArbre } from "../types";

/*
 * Les cellules d'une case, communes au tableau en arbre et au tiroir de la case.
 */

/** Ce qu'un montant devient sans `projets.voir_montants` (décision P7). */
export const MONTANT_MASQUE = "•••";

/** Le montant d'une feuille, le poids d'un parent ; « ••• » sans le droit de les voir. */
export function Montant({ une, voitMontants }: { une: CaseArbre; voitMontants: boolean }) {
  if (une.acces !== "COMPLET") return <>{ABSENT}</>;
  if (!voitMontants) return <span className="text-neutral-500">{MONTANT_MASQUE}</span>;
  const valeur = une.estFeuille ? une.montant : une.poids;
  return (
    <span className={cn("whitespace-nowrap tabular-nums", une.depasseEnveloppe && "text-erreur")}>
      {valeur === null ? ABSENT : formaterMontant(valeur)}
    </span>
  );
}

/** L'avancement physique : « indisponible » ou « partiel » plutôt qu'un faux 0 % (lot 12). */
export function Physique({ une }: { une: CaseArbre }) {
  const t = useTranslations("decoupage.arbre");
  if (une.acces !== "COMPLET") return <>{ABSENT}</>;
  const etat = etatAvancement(une);
  if (etat === "indisponible") return <span className="text-xs text-neutral-500">{t("indisponible")}</span>;
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      {formaterPourcentage(une.avancement)}
      {etat === "partiel" && <Badge variante="avertissement">{t("partiel")}</Badge>}
      {une.depassement !== null && (
        <Badge variante="information">{t("depassement", { valeur: une.depassement })}</Badge>
      )}
    </span>
  );
}

/** L'écart temporel − physique, en points : positif, la case est en retard. */
export function Ecart({ valeur }: { valeur: number | null }) {
  const t = useTranslations("decoupage.arbre");
  if (valeur === null) return <>{ABSENT}</>;
  return (
    <span className={cn("whitespace-nowrap tabular-nums", valeur > 0 ? "text-erreur" : "text-succes")}>
      {t("points", { valeur: valeur > 0 ? `+${valeur}` : String(valeur) })}
    </span>
  );
}

export function Statut({ une }: { une: CaseArbre }) {
  const t = useTranslations("decoupage.arbre.etats");
  if (une.acces !== "COMPLET") return null;
  if (!une.estActif) return <Badge variante="neutre">{t("desactivee")}</Badge>;
  if (une.cloture) return <Badge variante="succes">{t("cloturee")}</Badge>;
  if (une.suspendu) return <Badge variante="avertissement">{t("suspendue")}</Badge>;
  if (une.aCloturer) return <Badge variante="information">{t("aCloturer")}</Badge>;
  if (une.aCompleter) return <Badge variante="avertissement">{t("aCompleter")}</Badge>;
  return <Badge variante={une.commence ? "information" : "neutre"}>{une.commence ? t("commencee") : t("aVenir")}</Badge>;
}

/** « 01/07/2026 → 15/08/2026 » ; un tiret quand aucune des deux dates n'est connue. */
export function Periode({ debut, fin }: { debut: string | null; fin: string | null }) {
  const t = useTranslations("decoupage.arbre");
  if (!debut && !fin) return <>{ABSENT}</>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {t("periode", { debut: formaterDate(debut), fin: formaterDate(fin) })}
    </span>
  );
}
