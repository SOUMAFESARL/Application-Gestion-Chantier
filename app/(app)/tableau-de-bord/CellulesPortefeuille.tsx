"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui";
import type { VarianteBadge } from "@/components/ui";
import { niveauBudget, ratioConsommationBudget } from "@/features/projets/regles";
import type { NiveauBudget } from "@/features/projets/regles";
import type { StatutProjet } from "@/features/projets/types";
import { joursAvant } from "@/features/tableauDeBord";
import type { LigneChantier } from "@/features/tableauDeBord";
import { formaterDate, formaterMontantCourt } from "@/lib/format";
import { cn } from "@/lib/utils";

import { MONTANT_TAB, PROJET_DETAIL } from "./classes";

/**
 * Les cellules du portefeuille, partagées par la vue tableau et la vue
 * cartes : un même chantier ne peut plus afficher deux choses différentes
 * selon la largeur de l'écran.
 */

/** Le ton d'un statut — le même que sur la liste des projets. */
const TON_STATUT: Record<StatutProjet, VarianteBadge> = {
  EN_ATTENTE: "neutre",
  EN_COURS: "primaire",
  EN_RETARD: "avertissement",
  CRITIQUE: "erreur",
  SUSPENDU: "avertissement",
  TERMINE: "succes",
  ARCHIVE: "neutre",
};

const TON_BUDGET: Record<NiveauBudget, string> = {
  conforme: "text-succes",
  alerte: "text-avertissement",
  depassement: "text-erreur",
};

export function CelluleChantier({ chantier }: { chantier: LigneChantier }) {
  const t = useTranslations("tableauDeBord.portefeuille");
  const tStatut = useTranslations("projets.statut");

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/projets/${chantier.id}`}
          className="font-semibold text-neutral-900 no-underline hover:text-primary-600 hover:underline"
        >
          {chantier.nom}
        </Link>
        <Badge variante={TON_STATUT[chantier.statut]}>{tStatut(chantier.statut)}</Badge>
      </div>
      <div className={PROJET_DETAIL}>
        {t("detailProjet", { client: chantier.clientNom, ville: chantier.ville })}
      </div>
    </div>
  );
}

export function CelluleBudget({ chantier }: { chantier: LigneChantier }) {
  const t = useTranslations("tableauDeBord.portefeuille");

  if (chantier.budgetInitial === null) {
    return <span className="text-xs text-neutral-500 italic">{t("budgetNonDefini")}</span>;
  }

  const ratio = ratioConsommationBudget(chantier.budgetInitial, chantier.budgetConsomme) ?? 0;
  const niveau = niveauBudget(ratio) ?? "conforme";

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm">
        <span className={MONTANT_TAB}>{formaterMontantCourt(chantier.budgetConsomme)}</span>
        <span className={PROJET_DETAIL}> / {formaterMontantCourt(chantier.budgetInitial)}</span>
      </span>
      <span className={cn("text-xs font-medium", TON_BUDGET[niveau])}>
        {niveau === "depassement"
          ? t("ratioDepassement", { taux: ratio })
          : t("ratioConsommation", { taux: ratio })}
      </span>
    </div>
  );
}

export function CelluleMarge({ chantier }: { chantier: LigneChantier }) {
  const t = useTranslations("tableauDeBord.portefeuille");
  const marge = chantier.margePrevisionnelle;

  if (marge === null) return <span className="text-neutral-400">{t("inconnue")}</span>;

  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn(MONTANT_TAB, "text-sm", marge < 0 ? "text-erreur" : "text-neutral-900")}>
        {t("pourcent", { valeur: marge })}
      </span>
      {chantier.montantMarche !== null && (
        <span className={PROJET_DETAIL}>{formaterMontantCourt(chantier.montantMarche)}</span>
      )}
    </div>
  );
}

export function CelluleFin({ chantier }: { chantier: LigneChantier }) {
  const t = useTranslations("tableauDeBord.portefeuille");

  if (!chantier.dateFinPrevue) return <span className="text-neutral-400">{t("sansDate")}</span>;

  const jours = joursAvant(chantier.dateFinPrevue);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm tabular-nums text-neutral-900">{formaterDate(chantier.dateFinPrevue)}</span>
      <span className={cn("text-xs", jours < 0 ? "font-medium text-erreur" : "text-neutral-500")}>
        {jours < 0 ? t("finDepassee", { jours: Math.abs(jours) }) : t("finDans", { jours })}
      </span>
    </div>
  );
}
