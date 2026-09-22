"use client";

import { Pencil, Trash } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Badge, Bouton } from "@/components/ui";
import { MODULES_CCD } from "../types";
import type { NiveauAcces, ProjetRoleMatrice, RoleItem } from "../types";
import { SelecteurNiveau } from "./SelecteurNiveau";

interface Props {
  roles: RoleItem[];
  onEditerRole?: (role: RoleItem) => void;
  onSupprimerRole?: (role: RoleItem) => void;
  onChangeNiveau?: (roleId: string, module: string, niveau: NiveauAcces) => void;
  estProjet?: boolean;
  matriceProjet?: ProjetRoleMatrice[];
}

export function MatricePermissionsTable({
  roles,
  onEditerRole,
  onSupprimerRole,
  onChangeNiveau,
  estProjet = false,
  matriceProjet,
}: Props) {
  const t = useTranslations("roles");

  return (
    <div className="w-full overflow-x-auto rounded-md border border-neutral-200 bg-neutral-0 shadow-sm">
      <table className="w-full min-w-[980px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="px-2 py-3 text-center font-semibold whitespace-nowrap text-neutral-700 bg-neutral-50 border-b-2 border-neutral-200 sticky left-0 z-2 min-w-[220px] text-left shadow-[1px_0_0_var(--color-neutral-200)]">{t("role")}</th>
            {MODULES_CCD.map((code) => (
              <th key={code} className="px-2 py-3 text-center font-semibold whitespace-nowrap text-neutral-700 bg-neutral-50 border-b-2 border-neutral-200" title={t(`modules.${code}.description`)}>
                {t(`modules.${code}.nom`)}
              </th>
            ))}
            {!estProjet && <th className="px-2 py-3 text-center font-semibold whitespace-nowrap text-neutral-700 bg-neutral-50 border-b-2 border-neutral-200 min-w-[100px] pr-3 text-right">{t("actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => {
            const roleProjetInfo = matriceProjet?.find((m) => m.role_id === role.id);

            return (
              <tr key={role.id} className="group border-b border-neutral-200 transition-colors hover:bg-neutral-50">
                <td className="sticky left-0 z-1 bg-neutral-0 px-2 py-3 shadow-[1px_0_0_var(--color-neutral-200)] group-hover:bg-neutral-50">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <span>{role.libelle}</span>
                      {role.est_systeme ? (
                        <Badge variante="neutre">{t("systeme")}</Badge>
                      ) : (
                        <Badge variante="secondaire">{t("personnalise")}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span>{role.code}</span>
                      <span>•</span>
                      <span>{t("utilisateursCount", { n: role.nb_utilisateurs })}</span>
                    </div>
                  </div>
                </td>

                {MODULES_CCD.map((code) => {
                  let niveau: NiveauAcces = role.permissions_modules?.[code] ?? 0;
                  let estSurcharge = false;

                  if (estProjet && roleProjetInfo?.modules[code]) {
                    niveau = roleProjetInfo.modules[code].niveau;
                    estSurcharge = roleProjetInfo.modules[code].est_surcharge;
                  }

                  return (
                    <td key={code} className="p-2 text-center">
                      <SelecteurNiveau
                        valeur={niveau}
                        estSurcharge={estSurcharge}
                        lectureSeule={!onChangeNiveau}
                        onChange={(nouveau) => onChangeNiveau?.(role.id, code, nouveau)}
                        libelleAria={`${role.libelle} — ${t(`modules.${code}.nom`)}`}
                      />
                    </td>
                  );
                })}

                {!estProjet && (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {onEditerRole && (
                        <Bouton
                          variante="secondaire"
                          taille="sm"
                          iconeGauche={<Pencil size={14} />}
                          onClick={() => onEditerRole(role)}
                          aria-label={`${t("editer")} ${role.libelle}`}
                        >
                          {t("editer")}
                        </Bouton>
                      )}
                      {onSupprimerRole && (
                        <Bouton
                          variante="danger"
                          taille="sm"
                          iconeGauche={<Trash size={14} />}
                          disabled={role.est_systeme}
                          onClick={() => onSupprimerRole(role)}
                          aria-label={`${t("supprimer")} ${role.libelle}`}
                          title={
                            role.est_systeme
                              ? t("systeme")
                              : `${t("supprimer")} ${role.libelle}`
                          }
                        >
                          {t("supprimer")}
                        </Bouton>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
