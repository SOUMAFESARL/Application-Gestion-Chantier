"use client";

import { Pencil, Trash } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { Badge, Bouton } from "@/components/ui";
import { MODULES_CCD } from "../types";
import type { NiveauAcces, ProjetRoleMatrice, RoleItem } from "../types";
import { SelecteurNiveau } from "./SelecteurNiveau";
import styles from "./MatricePermissionsTable.module.css";

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
    <div className={styles.conteneur}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={`${styles.th} ${styles.thRole}`}>{t("role")}</th>
            {MODULES_CCD.map((code) => (
              <th key={code} className={styles.th} title={t(`modules.${code}.description`)}>
                {t(`modules.${code}.nom`)}
              </th>
            ))}
            {!estProjet && <th className={`${styles.th} ${styles.thActions}`}>{t("actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => {
            const roleProjetInfo = matriceProjet?.find((m) => m.role_id === role.id);

            return (
              <tr key={role.id} className={styles.tr}>
                <td className={styles.tdRole}>
                  <div className={styles.roleInfos}>
                    <div className={styles.roleTitre}>
                      <span>{role.libelle}</span>
                      {role.est_systeme ? (
                        <Badge variante="neutre">{t("systeme")}</Badge>
                      ) : (
                        <Badge variante="secondaire">{t("personnalise")}</Badge>
                      )}
                    </div>
                    <div className={styles.roleMeta}>
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
                    <td key={code} className={styles.tdCell}>
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
                  <td className={styles.tdActions}>
                    <div className={styles.actionsGrp}>
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
