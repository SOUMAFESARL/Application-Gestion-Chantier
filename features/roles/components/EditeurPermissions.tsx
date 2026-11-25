"use client";

import { List, Lock, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge, EtatVide } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ACTIONS_GED,
  basculerCode,
  compterPermissionsGed,
  grouperPermissionsGed,
} from "../regles";
import type { ModuleCatalogue, PermissionCatalogue } from "../types";

interface Props {
  catalogue: ModuleCatalogue[];
  codes: string[];
  onChange?: (codes: string[]) => void; // absent : lecture seule
  disabled?: boolean;
}

/**
 * L'éditeur des droits d'un rôle : une case par permission du catalogue, module
 * par module. Ce qui est coché est ce qui part au serveur, rien d'autre.
 */
export function EditeurPermissions({
  catalogue,
  codes,
  onChange,
  disabled = false,
}: Props) {
  const t = useTranslations("roles.editeur");
  const [vueDetailleeGed, setVueDetailleeGed] = useState(false);
  const lectureSeule = !onChange || disabled;
  const codesEnsemble = new Set(codes.map((c) => c.toLowerCase()));

  if (catalogue.length === 0) {
    return <EtatVide titre={t("catalogueVide")} />;
  }

  function rendreCasePermission(moduleCode: string, perm: PermissionCatalogue) {
    const codePerm = perm.code.toLowerCase();
    const cochee = codesEnsemble.has(codePerm);
    const idCase = `perm-${moduleCode}-${perm.code}`;

    return (
      <div key={perm.id || perm.code} className="flex items-start gap-2.5">
        <Checkbox
          id={idCase}
          checked={cochee}
          disabled={lectureSeule}
          onCheckedChange={(checked) => {
            if (onChange) {
              onChange(basculerCode(codes, codePerm, checked === true));
            }
          }}
          className="mt-0.5"
        />
        <label
          htmlFor={idCase}
          className={cn(
            "flex flex-1 flex-col text-xs select-none",
            lectureSeule ? "cursor-default" : "cursor-pointer",
          )}
        >
          <span className="font-medium text-neutral-800">{perm.libelle}</span>
          {/* Le catalogue sert souvent une description identique au libellé. */}
          {perm.description && perm.description !== perm.libelle && (
            <span className="mt-0.5 text-neutral-500">{perm.description}</span>
          )}
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-xs text-neutral-500">{t("aide")}</p>

      {catalogue.map((module) => {
        const estGed = module.code.toLowerCase() === "ged";
        const groupesGed = estGed ? grouperPermissionsGed(module.permissions) : null;
        const comptageGed = estGed ? compterPermissionsGed(module.permissions, codesEnsemble) : null;

        return (
          <div
            key={module.id || module.code}
            className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="m-0 text-sm font-semibold text-neutral-900">{module.libelle}</h4>
                {module.description && (
                  <p className="m-0 mt-0.5 text-xs text-neutral-500">{module.description}</p>
                )}
              </div>

              {estGed && groupesGed && groupesGed.categories.length > 0 && comptageGed && (
                <div className="flex items-center gap-2">
                  <Badge variante="neutre">
                    {t("ged.compteur", {
                      selectionnees: comptageGed.selectionnees,
                      total: comptageGed.total,
                    })}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setVueDetailleeGed((precedent) => !precedent)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-200 bg-transparent px-2 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    {vueDetailleeGed ? (
                      <>
                        <Table2 className="size-3.5" aria-hidden="true" />
                        <span>{t("ged.vueMatrice")}</span>
                      </>
                    ) : (
                      <>
                        <List className="size-3.5" aria-hidden="true" />
                        <span>{t("ged.vueDetaillee")}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {groupesGed && groupesGed.categories.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-neutral-100 pt-3">
                {groupesGed.generales.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-neutral-600">
                      {t("ged.titreGenerales")}
                    </span>
                    <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                      {groupesGed.generales.map((perm) => rendreCasePermission(module.code, perm))}
                    </div>
                  </div>
                )}

                {vueDetailleeGed ? (
                  <div className="flex flex-col gap-3">
                    {groupesGed.categories.map(({ categorie, actions }) => (
                      <div
                        key={categorie}
                        className="flex flex-col gap-2 rounded border border-neutral-200 bg-neutral-50/50 p-3"
                      >
                        <span className="text-xs font-semibold text-neutral-800">
                          {t(`ged.categories.${categorie}`)}
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                          {ACTIONS_GED.map((action) => {
                            const perm = actions[action];
                            if (!perm) return null;
                            return (
                              <div key={perm.id || perm.code} className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  {rendreCasePermission(module.code, perm)}
                                </div>
                                {action === "supprimer" && (
                                  <Badge
                                    variante="avertissement"
                                    icone={<Lock className="size-3" aria-hidden="true" />}
                                  >
                                    {t("ged.badgeSuppression")}
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded border border-neutral-200">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                          <th className="px-3 py-2 text-left font-semibold">
                            {t("ged.colonneCategorie")}
                          </th>
                          {ACTIONS_GED.map((action) => (
                            <th key={action} className="px-2 py-2 text-center font-semibold">
                              <span className="inline-flex items-center justify-center gap-1">
                                <span>{t(`ged.actions.${action}`)}</span>
                                {action === "supprimer" && (
                                  <Badge
                                    variante="avertissement"
                                    icone={<Lock className="size-3" aria-hidden="true" />}
                                  >
                                    {t("ged.badgeSuppression")}
                                  </Badge>
                                )}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groupesGed.categories.map(({ categorie, actions }) => (
                          <tr
                            key={categorie}
                            className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50"
                          >
                            <td className="px-3 py-2 font-medium text-neutral-800">
                              {t(`ged.categories.${categorie}`)}
                            </td>
                            {ACTIONS_GED.map((action) => {
                              const perm = actions[action];
                              if (!perm) {
                                return (
                                  <td key={action} className="px-2 py-2 text-center text-neutral-400">
                                    {t("ged.indisponible")}
                                  </td>
                                );
                              }
                              const codePerm = perm.code.toLowerCase();
                              const cochee = codesEnsemble.has(codePerm);
                              const idCase = `perm-${module.code}-${perm.code}`;
                              const infobulle =
                                perm.description && perm.description !== perm.libelle
                                  ? `${perm.libelle} — ${perm.description}`
                                  : perm.libelle;
                              return (
                                <td key={action} className="px-2 py-2 text-center">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <label
                                        htmlFor={idCase}
                                        className={cn(
                                          "inline-flex items-center justify-center p-1",
                                          lectureSeule ? "cursor-default" : "cursor-pointer",
                                        )}
                                      >
                                        <Checkbox
                                          id={idCase}
                                          aria-label={perm.libelle}
                                          title={perm.libelle}
                                          checked={cochee}
                                          disabled={lectureSeule}
                                          onCheckedChange={(checked) => {
                                            if (onChange) {
                                              onChange(basculerCode(codes, codePerm, checked === true));
                                            }
                                          }}
                                        />
                                        <span className="sr-only">{perm.libelle}</span>
                                      </label>
                                    </TooltipTrigger>
                                    <TooltipContent>{infobulle}</TooltipContent>
                                  </Tooltip>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div
                  className="flex items-start gap-2 rounded-md border border-information/25 bg-information/8 px-3 py-2 text-xs text-neutral-700"
                  role="note"
                >
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-information" aria-hidden="true" />
                  <p className="m-0 leading-relaxed">{t("ged.noteSuppression")}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 border-t border-neutral-100 pt-3">
                {module.permissions.map((perm) => rendreCasePermission(module.code, perm))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
