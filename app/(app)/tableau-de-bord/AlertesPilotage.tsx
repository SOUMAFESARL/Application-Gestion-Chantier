"use client";

import {
  Banknote,
  CalendarClock,
  CloudRain,
  PackageX,
  ShieldAlert,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui";
import { trierAlertes } from "@/features/tableauDeBord";
import type { AlertePilotage, TypeAlerte } from "@/features/tableauDeBord";
import { formaterDate, formaterMontantCourt } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  BADGE_GRAVITE,
  BLOC,
  BLOC_CORPS,
  BLOC_ENTETE,
  BLOC_SOUS_TITRE,
  BLOC_TITRE,
  BLOC_VIDE,
  ICONE_GRAVITE,
  LIGNE_LISTE,
  PROJET_DETAIL,
} from "./classes";

const ICONE_TYPE: Record<TypeAlerte, LucideIcon> = {
  PAIEMENT_RETARD: Banknote,
  DEPENSE_INHABITUELLE: TriangleAlert,
  DEPENSE_SEUIL: Wallet,
  INCIDENT_SECURITE: ShieldAlert,
  ECHEANCE_CONTRAT: CalendarClock,
  RUPTURE_STOCK: PackageX,
  INTEMPERIES: CloudRain,
};

/**
 * Les alertes qui remontent des chantiers — CDC module 3 (paiement en
 * retard, dépense anormale ou au-delà du seuil), module 8 (incident de
 * sécurité), module 9 (échéance contractuelle), plus les ruptures de stock et
 * les intempéries.
 *
 * Les alertes qui se lisent dans les chiffres d'un chantier (budget à 80 %,
 * marge négative, retard) n'y figurent pas : elles sont dans « Chantiers à
 * surveiller », et s'afficheraient sinon deux fois. Le bandeau météo
 * permanent a disparu : il n'y a plus que l'alerte, quand il y en a une.
 */
export function AlertesPilotage({ alertes }: { alertes: AlertePilotage[] }) {
  const t = useTranslations("tableauDeBord.alertes");
  const triees = trierAlertes(alertes);

  return (
    <section className={BLOC}>
      <header className={BLOC_ENTETE}>
        <div>
          <h2 className={BLOC_TITRE}>{t("titre")}</h2>
          <p className={BLOC_SOUS_TITRE}>{t("sousTitre")}</p>
        </div>
        {triees.length > 0 && <Badge variante="erreur">{triees.length}</Badge>}
      </header>

      <div className={BLOC_CORPS}>
        {triees.length === 0 ? (
          <p className={BLOC_VIDE}>{t("aucune")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {triees.map((alerte) => {
              const Icone = ICONE_TYPE[alerte.type];
              const contexte = t("contexte", {
                chantier: alerte.chantierNom ?? "",
                date: formaterDate(alerte.survenueLe),
              });

              return (
                <li key={alerte.id} className={LIGNE_LISTE}>
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                      ICONE_GRAVITE[alerte.gravite],
                    )}
                  >
                    <Icone className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">
                      {t(`types.${alerte.type}`, {
                        sujet: alerte.sujet,
                        montant: formaterMontantCourt(alerte.montant),
                        jours: alerte.jours ?? 0,
                      })}
                    </p>
                    {alerte.chantierId ? (
                      <Link
                        href={`/projets/${alerte.chantierId}`}
                        className={cn(PROJET_DETAIL, "no-underline hover:text-primary-600 hover:underline")}
                      >
                        {contexte}
                      </Link>
                    ) : (
                      <span className={PROJET_DETAIL}>{contexte}</span>
                    )}
                  </div>
                  <Badge variante={BADGE_GRAVITE[alerte.gravite]}>{t(`gravite.${alerte.gravite}`)}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
