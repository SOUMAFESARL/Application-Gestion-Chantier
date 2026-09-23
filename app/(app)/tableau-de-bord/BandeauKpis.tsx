"use client";

import {
  BuildingOffice,
  CurrencyCircleDollar,
  HardHat,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Carte } from "@/components/ui/Carte";
import { joursDeRetardEstimes } from "@/features/tableauDeBord/regles";
import type { LigneChantier, MetriquesPilotage } from "@/features/tableauDeBord/types";
import { formaterMontantCourt } from "@/lib/format";

import { cn } from "@/lib/utils";

/** Les quatre indicateurs se lisent de la meme facon : libelle, chiffre, appui. */
const KPI_ETIQUETTE = "flex items-center justify-between text-[13px] font-medium text-neutral-600";
const KPI_VALEUR = "mt-1.5 text-[26px] leading-[1.1] font-bold text-neutral-900 tabular-nums";
const KPI_TOTAL = "text-[15px] font-medium text-neutral-500";
const KPI_SOUS = "mt-1.5 flex flex-wrap items-center gap-1 text-xs text-neutral-500";


interface Props {
  metriques: MetriquesPilotage;
  chantiers: LigneChantier[];
}

/**
 * Les quatre indicateurs de pilotage — maquette M10.
 *
 * Ils occupaient une centaine de lignes au milieu du composant de page, entre
 * la liste des chantiers et les bons de paiement. Les isoler ne change rien à
 * l'affichage ; ça rend simplement lisible le fait que cette section ne
 * dépend que des métriques.
 */
export function BandeauKpis({ metriques, chantiers }: Props) {
  const t = useTranslations("tableauDeBord.kpis");

  return (
    <section className="mb-8 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-[640px]:grid-cols-1" aria-label={t("indicateursCles")}>
      {/* Tuile 1 : Chantiers en cours */}
      <Carte className="text-left">
        <div className={KPI_ETIQUETTE}>
          <span>{t("chantiersActifs")}</span>
          <BuildingOffice size={18} style={{ color: "var(--color-primary-500)" }} />
        </div>
        <div className={KPI_VALEUR}>{metriques.chantiersActifs}</div>
        <div className={KPI_SOUS}>
          <Badge variante="succes">{t("conforme", { n: metriques.chantiersConformes })}</Badge>
          {metriques.chantiersEnRetard > 0 ? (
            <Badge variante="avertissement">
              {t("retard", {
                n: metriques.chantiersEnRetard,
                jours: joursDeRetardEstimes(chantiers),
              })}
            </Badge>
          ) : null}
        </div>
      </Carte>

      {/* Tuile 2 : Santé moyenne portefeuille (D8) */}
      <Carte className="text-left">
        <div className={KPI_ETIQUETTE}>
          <span>{t("santeMoyenne")}</span>
          <HardHat size={18} style={{ color: "var(--color-semantic-success, #166534)" }} />
        </div>
        <div className={KPI_VALEUR}>
          <span style={{ color: "var(--color-semantic-success, #166534)" }}>
            {metriques.santeGlobale}
          </span>
          <span className={KPI_TOTAL}>{t("surCent")}</span>
        </div>
        <div className={KPI_SOUS}>
          <span>{t("securite", { taux: metriques.santeDetails.securite })}</span>
          <span>-</span>
          <span>{t("delais", { taux: metriques.santeDetails.delais })}</span>
          <span>-</span>
          <span>{t("budget", { taux: metriques.santeDetails.budget })}</span>
        </div>
      </Carte>

      {/* Tuile 3 : Budget engagé vs total */}
      <Carte className="text-left">
        <div className={KPI_ETIQUETTE}>
          <span>{t("budgetEngage")}</span>
          <CurrencyCircleDollar size={18} style={{ color: "var(--color-neutral-700, #4F4C47)" }} />
        </div>
        <div className={KPI_VALEUR}>
          <span>{formaterMontantCourt(metriques.budgetEngage)}</span>
          <span className={KPI_TOTAL}>
            {" "}
            / {formaterMontantCourt(metriques.budgetTotal)}
          </span>
        </div>
        {metriques.bonsASignerNombre > 0 ? (
          <div className={cn(KPI_SOUS, "font-semibold text-avertissement")}>
            <Warning size={14} weight="fill" />
            <span>
              {t("bonsASignerAlerte", {
                n: metriques.bonsASignerNombre,
                montant: formaterMontantCourt(metriques.bonsASignerMontant),
              })}
            </span>
          </div>
        ) : null}
      </Carte>

      {/* Tuile 4 : Effectifs chantiers & Rapports */}
      <Carte className="text-left">
        <div className={KPI_ETIQUETTE}>
          <span>{t("effectifs")}</span>
          <UsersThree size={18} style={{ color: "var(--color-neutral-700, #4F4C47)" }} />
        </div>
        <div className={KPI_VALEUR}>
          <span>{metriques.effectifsSurSite.total}</span>
          <span className={KPI_TOTAL}> {t("ouvriers")}</span>
        </div>
        <div className={KPI_SOUS}>
          <span>
            {t("repartitionEffectifs", {
              regie: metriques.effectifsSurSite.regie,
              tacherons: metriques.effectifsSurSite.tacherons,
            })}
          </span>
          <span>-</span>
          <Badge variante="neutre">
            {t("rapportsTransmis", {
              soumis: metriques.rapportsJournaliers.soumis,
              attendus: metriques.rapportsJournaliers.attendus,
            })}
          </Badge>
        </div>
      </Carte>
    </section>
  );
}
