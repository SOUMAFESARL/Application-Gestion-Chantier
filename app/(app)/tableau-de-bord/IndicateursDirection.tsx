"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  indicateurBudget,
  indicateurMarge,
  indicateurPortefeuille,
  indicateurSante,
  niveauxIndicateurs,
} from "@/features/tableauDeBord";
import type { LigneChantier, NiveauSante } from "@/features/tableauDeBord";
import { formaterMontantCourt } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Indicateur } from "../projets/EnteteChantier";
import type { FondIndicateur } from "../projets/classes";
import { PASTILLE_SANTE, TEXTE_SANTE, TUILE_UNITE } from "./classes";

/**
 * Le fond d'une tuile suit son niveau, comme celles de la liste des projets
 * suivent leur statut. Sans niveau — pas de donnée — la tuile reste neutre.
 */
const FOND_NIVEAU: Record<NiveauSante, FondIndicateur> = {
  BON: "succes",
  VIGILANCE: "avertissement",
  CRITIQUE: "erreur",
};

const fond = (niveau: NiveauSante | null): FondIndicateur =>
  niveau ? FOND_NIVEAU[niveau] : "neutre";

/** La ligne d'alerte n'est colorée que si elle signale quelque chose. */
const texteAlerte = (niveau: NiveauSante | null) =>
  niveau && niveau !== "BON" ? TEXTE_SANTE[niveau] : "text-neutral-500";

interface Tuile {
  cle: string;
  libelle: string;
  valeur: ReactNode;
  detail: ReactNode;
  alerte?: ReactNode;
  fond: FondIndicateur;
  niveau: NiveauSante | null;
}

/**
 * Les quatre chiffres de direction — CDC module 12 : projets actifs, santé
 * du portefeuille, dépassements budgétaires, rentabilité globale.
 *
 * Chaque tuile se lit dans le même ordre : **combien**, **de quoi c'est
 * fait**, **ce qui cloche**. Le fond de la tuile — la même tuile que la
 * liste des projets — prend le niveau que lui donne `niveauxIndicateurs`,
 * réglé sur le pire cas, pas sur la moyenne.
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
      valeur: portefeuille.actifs,
      detail: t("detailActifs", {
        montant: formaterMontantCourt(portefeuille.carnetCommandes),
        enAttente: portefeuille.enAttente,
        suspendus: portefeuille.suspendus,
      }),
      fond: "secondaire",
      niveau: null,
    },
    {
      cle: "sante",
      libelle: t("sante"),
      valeur:
        sante.moyenne === null ? (
          t("sansDonnee")
        ) : (
          <>
            {sante.moyenne}
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
      fond: fond(niveaux.sante),
      niveau: niveaux.sante,
    },
    {
      cle: "budget",
      libelle: t("budget"),
      valeur:
        budget.tauxConsommation === null
          ? t("sansDonnee")
          : t("pourcent", { valeur: budget.tauxConsommation }),
      detail: t("detailBudget", {
        consomme: formaterMontantCourt(budget.consommeTotal),
        total: formaterMontantCourt(budget.budgetTotal),
      }),
      alerte: t("depassements", { n: budget.depassements }),
      fond: fond(niveaux.budget),
      niveau: niveaux.budget,
    },
    {
      cle: "marge",
      libelle: t("marge"),
      valeur:
        marge.taux === null ? t("sansDonnee") : t("pourcent", { valeur: marge.taux }),
      detail: t("detailMarge", { montant: formaterMontantCourt(marge.montant) }),
      alerte: t("margesNegatives", { n: marge.negatives }),
      fond: fond(niveaux.marge),
      niveau: niveaux.marge,
    },
  ];

  return (
    <section aria-label={t("aria")} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tuiles.map((tuile) => (
        <Indicateur
          key={tuile.cle}
          libelle={tuile.libelle}
          valeur={tuile.valeur}
          fond={tuile.fond}
          // Un chiffre ne prend la teinte de sa tuile que s'il alerte.
          alerte={tuile.niveau === "VIGILANCE" || tuile.niveau === "CRITIQUE"}
          detail={
            <div className="flex flex-col gap-1">
              {tuile.detail}
              {tuile.alerte && (
                <span className={cn("font-medium", texteAlerte(tuile.niveau))}>
                  {tuile.alerte}
                </span>
              )}
            </div>
          }
        />
      ))}
    </section>
  );
}
