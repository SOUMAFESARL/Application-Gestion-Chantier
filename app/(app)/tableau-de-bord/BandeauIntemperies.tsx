"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Alerte } from "@/components/ui/Alerte";
import { Bouton } from "@/components/ui/Bouton";
import type { AlerteIntemperies } from "@/features/projets/types";
import type { MeteoPilotage } from "@/features/tableauDeBord/types";

/** La condition retenue quand l'alerte ne la précise pas. */
const CONDITION_DEFAUT = "VARIABLE";

interface Props {
  alerte: AlerteIntemperies | null;
  meteo: MeteoPilotage;
}

/**
 * L'alerte intempéries du portefeuille — RG-12.
 *
 * Elle était rendue par une fonction anonyme appelée sur place au milieu du
 * JSX, avec trois transtypages pour aller chercher des champs que le type
 * déclaré ne portait pas. Le domaine porte désormais ces champs, et il ne
 * reste ici que le choix du repli.
 */
export function BandeauIntemperies({ alerte, meteo }: Props) {
  const t = useTranslations("tableauDeBord");

  if (!alerte) return null;

  const condition = t(`navigation.meteo.condition.${alerte.condition ?? CONDITION_DEFAUT}`);
  const ville = alerte.ville ?? meteo.ville;

  return (
    <div style={{ marginBottom: "20px" }}>
      <Alerte
        type="avertissement"
        titre={t("alertes.intemperiesTitre", { projet: alerte.projet })}
        action={
          <Link href="/rapports" style={{ textDecoration: "none" }}>
            <Bouton variante="secondaire" taille="sm">
              {t("alertes.voirRapport")}
            </Bouton>
          </Link>
        }
      >
        {t("alertes.intemperiesCorps", {
          projet: alerte.projet,
          ville,
          condition,
        })}
      </Alerte>
    </div>
  );
}
