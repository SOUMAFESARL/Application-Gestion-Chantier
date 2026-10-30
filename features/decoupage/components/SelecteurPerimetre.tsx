"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { lireArbre } from "../adaptateur";
import { cleArbre } from "../cles";
import { aplatirCases } from "../regles";

/**
 * Choisir des cases dans l'arbre d'un projet — le périmètre d'une affectation (§13bis), ou la
 * case où poser une équipe (`unique`).
 *
 * Une liste indentée plutôt qu'un arbre à déplier : on y cherche par intitulé, et la sélection se
 * lit d'un coup d'œil. Cocher une case couvre sa branche ; rien de coché : tout le projet.
 */
export function SelecteurPerimetre({
  projetId,
  valeur,
  onChange,
  unique = false,
  desactive = false,
}: {
  projetId: string;
  valeur: string[];
  onChange: (ids: string[]) => void;
  /** Une seule case (radio) plutôt qu'un ensemble. */
  unique?: boolean;
  desactive?: boolean;
}) {
  const t = useTranslations("decoupage.perimetre");
  const [recherche, setRecherche] = useState("");
  const requete = useQuery({ queryKey: cleArbre(projetId), queryFn: ({ signal }) => lireArbre(projetId, signal) });

  const cases = useMemo(
    () =>
      aplatirCases(requete.data?.cases ?? []).filter(
        (une) => une.acces === "COMPLET" && une.estActif,
      ),
    [requete.data],
  );
  const filtre = recherche.trim().toLowerCase();
  const visibles = filtre ? cases.filter((une) => une.libelle.toLowerCase().includes(filtre)) : cases;

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  function basculer(id: string, coche: boolean) {
    if (unique) {
      onChange(coche ? [id] : []);
      return;
    }
    onChange(coche ? [...valeur, id] : valeur.filter((autre) => autre !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder={t("rechercher")}
        aria-label={t("rechercher")}
        disabled={desactive}
      />
      <p className="m-0 text-xs text-neutral-500">
        {valeur.length === 0
          ? unique
            ? t("aucuneCase")
            : t("toutLeProjet")
          : t("casesChoisies", { nombre: valeur.length })}
      </p>
      <ul className="m-0 flex max-h-72 list-none flex-col gap-0.5 overflow-y-auto rounded-md border border-solid border-neutral-200 p-1">
        {visibles.length === 0 && <li className="p-2 text-sm text-neutral-500">{t("aucunResultat")}</li>}
        {visibles.map((une) => {
          const profondeur = (une.numero ?? "").split(".").length - 1;
          return (
            <li key={une.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-50",
                  valeur.includes(une.id) && "bg-primary-50",
                )}
                style={{ paddingLeft: filtre ? undefined : `calc(var(--spacing) * ${2 + profondeur * 4})` }}
              >
                <Checkbox
                  checked={valeur.includes(une.id)}
                  onCheckedChange={(coche) => basculer(une.id, coche === true)}
                  disabled={desactive}
                />
                <span className="font-mono text-xs text-neutral-500">{une.numero}</span>
                <span className={une.estFeuille ? "text-neutral-700" : "font-medium text-neutral-900"}>
                  {une.libelle}
                </span>
                {une.niveau.libelle && <span className="ml-auto text-xs text-neutral-400">{une.niveau.libelle}</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
