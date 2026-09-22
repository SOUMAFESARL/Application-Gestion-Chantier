"use client";

import { CheckCircle, ClockCountdown, HardHat } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Carte } from "@/components/ui/Carte";
import type { ReceptionMateriau } from "@/features/tableauDeBord/types";
import { CARTE_ENTETE, CARTE_TITRE } from "./classes";


interface Props {
  receptions: ReceptionMateriau[];
}

/** Les réceptions de matériaux du jour, conformes ou attendues. */
export function ListeReceptions({ receptions }: Props) {
  const t = useTranslations("tableauDeBord.materiaux");

  return (
    <Carte>
      <div className={CARTE_ENTETE}>
        <div className={CARTE_TITRE}>
          <HardHat size={18} style={{ color: "var(--color-neutral-700, #4F4C47)" }} />
          <span>{t("titre")}</span>
        </div>
      </div>
      <ul className="flex list-none flex-col gap-2 text-xs text-neutral-700">
        {receptions.map((reception) => (
          <li key={reception.id} className="flex items-center gap-1.5">
            {reception.conforme ? (
              <CheckCircle
                size={16}
                weight="fill"
                style={{ color: "var(--color-semantic-success, #166534)" }}
              />
            ) : (
              <ClockCountdown
                size={16}
                weight="fill"
                style={{ color: "var(--color-semantic-warning, #B45309)" }}
              />
            )}
            <span>
              <strong>{reception.projet} :</strong> {reception.description}
            </span>
          </li>
        ))}
      </ul>
    </Carte>
  );
}
