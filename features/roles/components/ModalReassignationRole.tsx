"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alerte, Bouton, Modale } from "@/components/ui";
import type { RoleItem } from "../types";

interface Props {
  ouverte: boolean;
  roleASupprimer: RoleItem | null;
  rolesDisponibles: RoleItem[];
  onConfirmer: (roleCibleId: string) => Promise<void>;
  onFermer: () => void;
  enCours?: boolean;
}

export function ModalReassignationRole({
  ouverte,
  roleASupprimer,
  rolesDisponibles,
  onConfirmer,
  onFermer,
  enCours = false,
}: Props) {
  const t = useTranslations("roles");
  const [roleCibleId, setRoleCibleId] = useState<string>("");
  const [erreur, setErreur] = useState<string | null>(null);

  if (!roleASupprimer) return null;

  const rolesEligibles = rolesDisponibles.filter(
    (r) => (r.id !== roleASupprimer.id && !r.est_systeme) || (r.est_systeme && r.code !== "AD")
  );

  async function valider() {
    if (!roleCibleId) {
      setErreur(t("champRoleRemplacement"));
      return;
    }
    setErreur(null);
    await onConfirmer(roleCibleId);
  }

  const actions = (
    <>
      <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
        {t("annuler")}
      </Bouton>
      <Bouton
        variante="danger"
        onClick={valider}
        enCours={enCours}
        disabled={!roleCibleId || enCours}
      >
        {t("confirmerSuppression")}
      </Bouton>
    </>
  );

  return (
    <Modale
      ouverte={ouverte}
      titre={t("titreSuppression", { role: roleASupprimer.libelle })}
      onFermer={enCours ? undefined : onFermer}
      actions={actions}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Alerte type="avertissement">
          {roleASupprimer.nb_utilisateurs > 0
            ? t("avertissementSuppression", { n: roleASupprimer.nb_utilisateurs })
            : t("confirmationSuppressionSimple")}
        </Alerte>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <label style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>
            {t("champRoleRemplacement")}{" "}
            <span style={{ color: "var(--color-danger-500)" }}>*</span>
          </label>
          <select
            value={roleCibleId}
            onChange={(e) => {
              setRoleCibleId(e.target.value);
              setErreur(null);
            }}
            style={{
              width: "100%",
              padding: "var(--space-2)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-neutral-300)",
              backgroundColor: "var(--color-neutral-0)",
            }}
          >
            <option value="">{t("choisirRemplacement")}</option>
            {rolesEligibles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.libelle} ({r.code})
              </option>
            ))}
          </select>
          {erreur && (
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-danger-500)" }}>
              {erreur}
            </span>
          )}
        </div>
      </div>
    </Modale>
  );
}
