"use client";

import { Eye, Pencil, Trash, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Badge, Bouton } from "@/components/ui";
import { accesDepuisNiveau } from "../regles";
import type { ColonneMatrice, gestesSurRole } from "../regles";
import type { RoleItem } from "../types";
import { SelecteurAcces } from "./SelecteurAcces";

interface Props {
  roles: RoleItem[];
  colonnes: ColonneMatrice[];
  onOuvrirRole: (role: RoleItem) => void;
  onSupprimerRole?: (role: RoleItem) => void;
  gestes: (role: RoleItem) => ReturnType<typeof gestesSurRole>;
}

export function MatricePermissionsTable({
  roles,
  colonnes,
  onOuvrirRole,
  onSupprimerRole,
  gestes,
}: Props) {
  const t = useTranslations("roles");

  return (
    <div className="w-full overflow-x-auto rounded-md border border-neutral-200 bg-neutral-0 shadow-sm">
      <table className="w-full min-w-[980px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-2 min-w-[220px] border-b-2 border-neutral-200 bg-neutral-50 px-2 py-3 text-left font-semibold whitespace-nowrap text-neutral-700 shadow-[1px_0_0_var(--color-neutral-200)]">
              {t("role")}
            </th>
            {colonnes.map((col) => (
              <th
                key={col.code}
                className="border-b-2 border-neutral-200 bg-neutral-50 px-2 py-3 text-center font-semibold whitespace-nowrap text-neutral-700"
                title={col.description}
              >
                {col.libelle}
              </th>
            ))}
            <th className="min-w-[100px] border-b-2 border-neutral-200 bg-neutral-50 px-2 py-3 pr-3 text-right font-semibold whitespace-nowrap text-neutral-700">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => {
            const g = gestes(role);

            return (
              <tr
                key={role.id}
                className="group border-b border-neutral-200 transition-colors hover:bg-neutral-50"
              >
                <td className="sticky left-0 z-1 bg-neutral-0 px-2 py-3 shadow-[1px_0_0_var(--color-neutral-200)] group-hover:bg-neutral-50">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <span>{role.libelle}</span>
                      {role.est_systeme ? (
                        <Badge variante="neutre">{t("systeme")}</Badge>
                      ) : (
                        <Badge variante="secondaire">{t("personnalise")}</Badge>
                      )}
                      {/* Emplacement badge portée (F5) */}
                      {role.avertissements && role.avertissements.length > 0 && (
                        <span
                          title={t("avertissementPresent")}
                          aria-label={t("avertissementPresent")}
                          className="inline-flex shrink-0"
                        >
                          <WarningCircle
                            size={16}
                            weight="fill"
                            className="text-avertissement"
                          />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span>{role.code}</span>
                      <span>•</span>
                      <span>{t("utilisateursCount", { n: role.nb_utilisateurs })}</span>
                    </div>
                  </div>
                </td>

                {colonnes.map((col) => {
                  const modRole = role.modules?.find(
                    (m) => m.code.toLowerCase() === col.code.toLowerCase(),
                  );
                  const niveau = modRole?.niveau ?? 0;
                  const valeur = accesDepuisNiveau(niveau);
                  const libelles = (modRole?.permissions ?? []).map((p) => p.libelle);
                  const titreCellule =
                    libelles.length > 0 ? libelles.join(", ") : t("aucunePermission");

                  return (
                    <td key={col.code} className="p-2 text-center" title={titreCellule}>
                      <SelecteurAcces
                        valeur={valeur}
                        titre={titreCellule}
                        libelleAria={`${role.libelle} — ${col.libelle}`}
                      />
                    </td>
                  );
                })}

                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Bouton
                      variante="secondaire"
                      taille="sm"
                      iconeGauche={g.modifiable ? <Pencil size={14} /> : <Eye size={14} />}
                      onClick={() => onOuvrirRole(role)}
                      aria-label={
                        g.modifiable
                          ? `${t("modifier")} ${role.libelle}`
                          : `${t("consulter")} ${role.libelle}`
                      }
                      title={
                        g.modifiable
                          ? `${t("modifier")} ${role.libelle}`
                          : `${t("consulter")} ${role.libelle}`
                      }
                    >
                      {g.modifiable ? t("modifier") : t("consulter")}
                    </Bouton>
                    {onSupprimerRole && g.supprimable && (
                      <Bouton
                        variante="danger"
                        taille="sm"
                        iconeGauche={<Trash size={14} />}
                        onClick={() => onSupprimerRole(role)}
                        aria-label={`${t("supprimer")} ${role.libelle}`}
                        title={`${t("supprimer")} ${role.libelle}`}
                      >
                        {t("supprimer")}
                      </Bouton>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
