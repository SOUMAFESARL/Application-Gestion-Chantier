"use client";

import { useTranslations } from "next-intl";
import { EtatVide } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { basculerCode } from "../regles";
import type { ModuleCatalogue } from "../types";

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

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-xs text-neutral-500">{t("aide")}</p>

      {catalogue.map((module) => {
        return (
          <div
            key={module.id || module.code}
            className="rounded-md border border-neutral-200 p-4 flex flex-col gap-3"
          >
            <div>
              <h4 className="m-0 text-sm font-semibold text-neutral-900">{module.libelle}</h4>
              {module.description && (
                <p className="m-0 mt-0.5 text-xs text-neutral-500">{module.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-neutral-100 pt-3">
              {module.permissions.map((perm) => {
                const codePerm = perm.code.toLowerCase();
                const cochee = codesEnsemble.has(codePerm);
                const idCase = `perm-${module.code}-${perm.code}`;

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
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
