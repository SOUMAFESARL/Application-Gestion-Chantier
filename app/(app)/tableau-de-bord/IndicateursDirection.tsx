"use client";

import { Building2, HeartPulse, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  indicateurBudget,
  indicateurMarge,
  indicateurPortefeuille,
  indicateurSante,
  niveauSante,
  niveauxIndicateurs,
} from "@/features/tableauDeBord";
import type { LigneChantier, NiveauSante } from "@/features/tableauDeBord";
import { formaterMontantCourt } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  PASTILLE_SANTE,
  TEXTE_SANTE,
  TUILE,
  TUILE_DETAIL,
  TUILE_FILET,
  TUILE_LIBELLE,
  TUILE_UNITE,
  TUILE_VALEUR,
} from "./classes";

const ICONE = "size-4 text-neutral-500";

/** Une tuile sans niveau — le portefeuille, ou un indicateur sans donnée — prend la marque. */
const filet = (niveau: NiveauSante | null) => (niveau ? PASTILLE_SANTE[niveau] : "bg-primary-500");

/** La ligne d'alerte n'est colorée que si elle signale quelque chose. */
const texteAlerte = (niveau: NiveauSante | null) =>
  niveau && niveau !== "BON" ? TEXTE_SANTE[niveau] : "text-neutral-500";

interface Tuile {
  cle: string;
  libelle: string;
  icone: ReactNode;
  valeur: ReactNode;
  detail: ReactNode;
  alerte?: ReactNode;
  niveau: NiveauSante | null;
}

/**
 * Les quatre chiffres de direction — CDC module 12 : projets actifs, santé
 * du portefeuille, dépassements budgétaires, rentabilité globale.
 *
 * Chaque tuile se lit dans le même ordre : **combien**, **de quoi c'est
 * fait**, **ce qui cloche**. Le filet du bas prend le niveau que lui donne
 * `niveauxIndicateurs` — réglé sur le pire cas, pas sur la moyenne.
 *
 * Tout est déduit des lignes du portefeuille par `regles.ts` : aucun chiffre
 * n'arrive à part, qui pourrait contredire le tableau juste en dessous.
 */
export function IndicateursDirection({ chantiers }: { chantiers: LigneChantier[] }) {
  const t = useTranslations("tableauDeBord.indicateurs");

  const portefeuille = indicateurPortefeuille(chantiers);
  const sante = indicateurSante(chantiers);
  const budget = indicateurBudget(chantiers);
  const marge = indicateurMarge(chantiers);
  const niveaux = niveauxIndicateurs(sante, budget, marge);

  const tuiles: Tuile[] = [
    {
      cle: "actifs",
      libelle: t("actifs"),
      icone: <Building2 className={ICONE} aria-hidden="true" />,
      valeur: portefeuille.actifs,
      detail: t("detailActifs", {
        montant: formaterMontantCourt(portefeuille.carnetCommandes),
        enAttente: portefeuille.enAttente,
        suspendus: portefeuille.suspendus,
      }),
      niveau: null,
    },
    {
      cle: "sante",
      libelle: t("sante"),
      icone: <HeartPulse className={ICONE} aria-hidden="true" />,
      valeur:
        sante.moyenne === null ? (
          t("sansDonnee")
        ) : (
          <>
            <span className={TEXTE_SANTE[niveauSante(sante.moyenne)]}>{sante.moyenne}</span>
            <span className={TUILE_UNITE}>{t("surCent")}</span>
          </>
        ),
      detail: (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {(["BON", "VIGILANCE", "CRITIQUE"] as const).map((niveau) => (
            <span key={niveau} aria-hidden="true" className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", PASTILLE_SANTE[niveau])} />
              <span className="font-semibold tabular-nums text-neutral-800">
                {sante.repartition[niveau]}
              </span>
            </span>
          ))}
          <span className="sr-only">
            {t("repartition", {
              bon: sante.repartition.BON,
              vigilance: sante.repartition.VIGILANCE,
              critique: sante.repartition.CRITIQUE,
            })}
          </span>
        </span>
      ),
      niveau: niveaux.sante,
    },
    {
      cle: "budget",
      libelle: t("budget"),
      icone: <Wallet className={ICONE} aria-hidden="true" />,
      valeur:
        budget.tauxConsommation === null
          ? t("sansDonnee")
          : t("pourcent", { valeur: budget.tauxConsommation }),
      detail: t("detailBudget", {
        consomme: formaterMontantCourt(budget.consommeTotal),
        total: formaterMontantCourt(budget.budgetTotal),
      }),
      alerte: t("depassements", { n: budget.depassements }),
      niveau: niveaux.budget,
    },
    {
      cle: "marge",
      libelle: t("marge"),
      icone: <TrendingUp className={ICONE} aria-hidden="true" />,
      valeur:
        marge.taux === null ? (
          t("sansDonnee")
        ) : (
          <span className={marge.taux < 0 ? "text-erreur" : undefined}>
            {t("pourcent", { valeur: marge.taux })}
          </span>
        ),
      detail: t("detailMarge", { montant: formaterMontantCourt(marge.montant) }),
      alerte: t("margesNegatives", { n: marge.negatives }),
      niveau: niveaux.marge,
    },
  ];

  return (
    <section aria-label={t("aria")} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tuiles.map((tuile) => (
        <article key={tuile.cle} className={cn(TUILE, "pb-5")}>
          <span className={TUILE_LIBELLE}>
            {tuile.icone}
            {tuile.libelle}
          </span>
          <span className={TUILE_VALEUR}>{tuile.valeur}</span>
          <span className={TUILE_DETAIL}>{tuile.detail}</span>
          {tuile.alerte && (
            <span className={cn("text-xs font-medium", texteAlerte(tuile.niveau))}>
              {tuile.alerte}
            </span>
          )}
          <span aria-hidden="true" className={cn(TUILE_FILET, filet(tuile.niveau))} />
        </article>
      ))}
    </section>
  );
}
