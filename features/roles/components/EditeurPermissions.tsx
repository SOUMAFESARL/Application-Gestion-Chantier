"use client";

import { useTranslations } from "next-intl";
import { Badge, EtatVide } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ACTIONS_GED, basculerCode, grouperPermissionsGed } from "../regles";
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

        return (
          <div
            key={module.id || module.code}
            className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4"
          >
            <div>
              <h4 className="m-0 text-sm font-semibold text-neutral-900">{module.libelle}</h4>
              {module.description && (
                <p className="m-0 mt-0.5 text-xs text-neutral-500">{module.description}</p>
              )}
            </div>

            {groupesGed && groupesGed.categories.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-neutral-100 pt-3">
                {groupesGed.generales.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                    {groupesGed.generales.map((perm) => rendreCasePermission(module.code, perm))}
                  </div>
                )}

                <div className="overflow-x-auto rounded border border-neutral-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                        <th className="px-3 py-2 text-left font-semibold">
                          {t("ged.colonneCategorie")}
                        </th>
                        {ACTIONS_GED.map((action) => (
                          <th key={action} className="px-2 py-2 text-center font-semibold">
                            <span className="inline-flex items-center gap-1">
                              <span>{t(`ged.actions.${action}`)}</span>
                              {action === "supprimer" && (
                                <Badge variante="neutre">{t("ged.badgeSuppression")}</Badge>
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
                            return (
                              <td key={action} className="px-2 py-2 text-center">
                                <div className="inline-flex items-center justify-center">
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
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="m-0 text-xs text-neutral-500">{t("ged.noteSuppression")}</p>
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
