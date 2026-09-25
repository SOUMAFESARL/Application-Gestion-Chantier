"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { chantiersAAttention, estMotifGrave } from "@/features/tableauDeBord";
import type { LigneChantier, MotifAttention } from "@/features/tableauDeBord";
import { cn } from "@/lib/utils";

import {
  BLOC,
  BLOC_CORPS,
  BLOC_ENTETE,
  BLOC_SOUS_TITRE,
  BLOC_TITRE,
  BLOC_VIDE,
  PROJET_DETAIL,
} from "./classes";
import { PastilleSante } from "./PastilleSante";

/** Au-delà, la liste cesse d'être « ce qui réclame votre intervention ». */
const NOMBRE_MAXIMAL = 5;

/**
 * Les chantiers qui demandent l'intervention du DG — CDC module 12,
 * « identifier immédiatement les projets en difficulté ».
 *
 * Chaque ligne dit **pourquoi** elle est là : « santé 38 » oblige à ouvrir la
 * fiche, « budget dépassé (106 %) · marge -4,2 % » dit déjà quelle question
 * poser au directeur de projet. Les motifs viennent de `motifsAttention`.
 */
export function ChantiersAttention({ chantiers }: { chantiers: LigneChantier[] }) {
  const t = useTranslations("tableauDeBord.attention");
  const lignes = chantiersAAttention(chantiers).slice(0, NOMBRE_MAXIMAL);

  const libelleMotif = (motif: MotifAttention) =>
    t(`motifs.${motif.type}`, {
      valeur: motif.type === "RETARD" ? Math.abs(motif.valeur ?? 0) : (motif.valeur ?? 0),
    });

  return (
    <section className={BLOC}>
      <header className={BLOC_ENTETE}>
        <div>
          <h2 className={BLOC_TITRE}>{t("titre")}</h2>
          <p className={BLOC_SOUS_TITRE}>{t("sousTitre")}</p>
        </div>
      </header>

      <div className={BLOC_CORPS}>
        {lignes.length === 0 ? (
          <p className={BLOC_VIDE}>{t("aucun")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {lignes.map(({ chantier, motifs }) => (
              <li key={chantier.id} className="border-b border-neutral-100 last:border-b-0">
                <Link
                  href={`/projets/${chantier.id}`}
                  aria-label={t("ouvrir", { nom: chantier.nom })}
                  className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-3 no-underline transition-colors hover:bg-neutral-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="truncate font-semibold text-neutral-900 group-hover:text-primary-600">
                        {chantier.nom}
                      </span>
                      <PastilleSante indice={chantier.indiceSante} />
                    </div>
                    <div className={cn(PROJET_DETAIL, "mt-0.5")}>{chantier.chefProjetNom || chantier.clientNom}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {/* La santé critique est déjà dite par la pastille, juste au-dessus. */}
                      {motifs.filter((motif) => motif.type !== "SANTE_CRITIQUE").map((motif) => (
                        <span
                          key={motif.type}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            estMotifGrave(motif)
                              ? "bg-erreur-fond text-erreur"
                              : "bg-avertissement-fond text-avertissement",
                          )}
                        >
                          {libelleMotif(motif)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-neutral-400 group-hover:text-primary-600"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
