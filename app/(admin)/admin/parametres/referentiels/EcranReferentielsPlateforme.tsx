"use client";

import { FolderKanban, Layers, ListChecks, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { EnTeteParametrage } from "../EnTeteParametrage";
import { GestionListesDecoupagePlateforme } from "./GestionListesDecoupagePlateforme";
import { GestionModelesDecoupagePlateforme } from "./GestionModelesDecoupagePlateforme";
import { ListeReferentiel } from "./ListeReferentiel";

type OngletReferentielPlateforme =
  | "listes"
  | "modeles"
  | "modes-execution"
  | "types-projet";

const ONGLETS: {
  id: OngletReferentielPlateforme;
  cle: "ongletListes" | "ongletModeles" | "ongletModesExecution" | "ongletTypesProjet";
  icone: typeof ListChecks;
}[] = [
  { id: "listes", cle: "ongletListes", icone: ListChecks },
  { id: "modeles", cle: "ongletModeles", icone: Layers },
  { id: "modes-execution", cle: "ongletModesExecution", icone: Wrench },
  { id: "types-projet", cle: "ongletTypesProjet", icone: FolderKanban },
];

export function EcranReferentielsPlateforme() {
  const t = useTranslations("administration.parametres.referentiels");
  const [onglet, setOnglet] = useState<OngletReferentielPlateforme>("listes");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 bg-background md:sticky md:top-16 md:z-30 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 md:pb-3">
        <EnTeteParametrage section="referentiels" />
        <nav
          aria-label={t("titre")}
          className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200 pb-3"
        >
          {ONGLETS.map(({ id, cle, icone: Icone }) => {
            const actif = onglet === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setOnglet(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  actif
                    ? "bg-primary-600 text-neutral-0 shadow-xs"
                    : "bg-neutral-100/70 text-neutral-700 hover:bg-neutral-200/70 hover:text-neutral-900",
                )}
              >
                <Icone className="size-4 shrink-0" aria-hidden="true" />
                <span>{t(cle)}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {onglet === "listes" && <GestionListesDecoupagePlateforme />}
      {onglet === "modeles" && <GestionModelesDecoupagePlateforme />}
      {(onglet === "modes-execution" || onglet === "types-projet") && (
        <ListeReferentiel key={onglet} categorie={onglet} />
      )}
    </div>
  );
}
