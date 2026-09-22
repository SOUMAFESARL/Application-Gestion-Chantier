"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Bouton, Modale } from "@/components/ui";
import { MODULES_CCD } from "../types";
import type { NiveauAcces, RoleItem } from "../types";
import { SelecteurNiveau } from "./SelecteurNiveau";

interface Props {
  ouverte: boolean;
  rolesExistant: RoleItem[];
  onEnregistrer: (data: {
    code: string;
    libelle: string;
    description: string;
    permissions_modules: Record<string, NiveauAcces>;
  }) => Promise<void>;
  onFermer: () => void;
  enCours?: boolean;
}

export function ModalNouveauRole({
  ouverte,
  rolesExistant,
  onEnregistrer,
  onFermer,
  enCours = false,
}: Props) {
  const t = useTranslations("roles");
  const [code, setCode] = useState("");
  const [libelle, setLibelle] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Record<string, NiveauAcces>>(() => {
    const init: Record<string, NiveauAcces> = {};
    for (const code of MODULES_CCD) {
      init[code] = 3;
    }
    return init;
  });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  function handleLibelleChange(nouveauLibelle: string) {
    setLibelle(nouveauLibelle);
    const slug = nouveauLibelle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .slice(0, 30);
    setCode(slug);
  }

  function copierDepuis(roleId: string) {
    const modele = rolesExistant.find((r) => r.id === roleId);
    if (modele) {
      setPermissions({ ...modele.permissions_modules });
    }
  }

  function changerNiveauModule(module: string, niveau: NiveauAcces) {
    setPermissions((prev) => ({ ...prev, [module]: niveau }));
  }

  async function valider() {
    const err: Record<string, string> = {};
    const codeNettoye = code.trim().toUpperCase();
    const libelleNettoye = libelle.trim();

    // Ces trois messages nommaient le **champ** au lieu de dire ce qui n'allait
    // pas : la personne lisait « Intitulé du rôle » et « Code identifiant » en
    // rouge sous les champs concernés, sans savoir s'ils étaient vides, trop
    // longs ou déjà pris — et le même libellé servait pour « vide » et pour
    // « déjà utilisé », deux causes qui n'ont pas la même correction.
    if (!libelleNettoye) {
      err.libelle = t("erreurIntituleRequis");
    } else if (
      libelleNettoye.toLowerCase().includes("directeur general") ||
      // On reconnaît ce que la personne a tapé, avec et sans accents.
      // eslint-disable-next-line no-restricted-syntax -- comparaison, pas affichage
      libelleNettoye.toLowerCase().includes("directeur général")
    ) {
      err.libelle = t("erreurDgUnique");
    }

    if (!codeNettoye) {
      err.code = t("erreurCodeRequis");
    } else if (["DG", "ADMIN", "AD"].includes(codeNettoye)) {
      err.code = t("erreurCodeReserve");
    } else if (rolesExistant.some((r) => r.code.toUpperCase() === codeNettoye)) {
      err.code = t("erreurCodeExistant");
    }

    setErreurs(err);
    if (Object.keys(err).length > 0) return;

    await onEnregistrer({
      code: codeNettoye,
      libelle: libelleNettoye,
      description: description.trim(),
      permissions_modules: permissions,
    });
  }

  const actions = (
    <>
      <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
        {t("annuler")}
      </Bouton>
      <Bouton variante="primaire" onClick={valider} enCours={enCours}>
        {t("creer")}
      </Bouton>
    </>
  );

  return (
    <Modale
      ouverte={ouverte}
      titre={t("titreCreation")}
      taille="large"
      onFermer={enCours ? undefined : onFermer}
      actions={actions}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-3)", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: "var(--font-weight-medium)",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                height: "20px",
              }}
            >
              {t("champIntitule")} <span style={{ color: "var(--color-danger-500)", marginLeft: "2px" }}>*</span>
            </label>
            <input
              type="text"
              value={libelle}
              placeholder={t("placeholderIntitule")}
              onChange={(e) => handleLibelleChange(e.target.value)}
              style={{
                width: "100%",
                height: "40px",
                boxSizing: "border-box",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-neutral-300)",
                fontSize: "var(--font-size-sm)",
              }}
            />
            {erreurs.libelle && (
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-danger-500)" }}>
                {erreurs.libelle}
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: "var(--font-weight-medium)",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                height: "20px",
              }}
            >
              {t("champCode")} <span style={{ color: "var(--color-danger-500)", marginLeft: "2px" }}>*</span>
            </label>
            <input
              type="text"
              value={code}
              placeholder={t("placeholderCode")}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{
                width: "100%",
                height: "40px",
                boxSizing: "border-box",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-neutral-300)",
                fontFamily: "monospace",
                fontSize: "var(--font-size-sm)",
              }}
            />
            {erreurs.code && (
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-danger-500)" }}>
                {erreurs.code}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <label style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>
            {t("champDescription")}
          </label>
          <textarea
            value={description}
            rows={2}
            placeholder={t("placeholderDescription")}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-neutral-300)",
              fontFamily: "inherit",
              fontSize: "var(--font-size-sm)",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <label style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>
            {t("champModele")}
          </label>
          <select
            onChange={(e) => copierDepuis(e.target.value)}
            defaultValue=""
            style={{
              width: "100%",
              height: "40px",
              boxSizing: "border-box",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-neutral-300)",
              backgroundColor: "var(--color-neutral-0)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            <option value="">{t("choisirModele")}</option>
            {rolesExistant.map((r) => (
              <option key={r.id} value={r.id}>
                {t("copierDroitsDe", { role: r.libelle })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: "var(--font-weight-medium)" }}>
            {t("matriceDroitsTitre")}
          </label>
          <div
            style={{
              maxHeight: "320px",
              overflowY: "auto",
              border: "1px solid var(--color-neutral-200)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-sm)" }}>
              <thead style={{ backgroundColor: "var(--color-neutral-50)", position: "sticky", top: 0 }}>
                <tr>
                  <th style={{ padding: "var(--space-2)", textAlign: "left" }}>{t("role")}</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {MODULES_CCD.map((code) => (
                  <tr key={code} style={{ borderTop: "1px solid var(--color-neutral-200)" }}>
                    <td style={{ padding: "var(--space-2)" }}>
                      <strong>{t(`modules.${code}.nom`)}</strong>
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-neutral-500)" }}>
                        {t(`modules.${code}.description`)}
                      </div>
                    </td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>
                      <SelecteurNiveau
                        valeur={permissions[code] ?? 0}
                        onChange={(nouveau) => changerNiveauModule(code, nouveau)}
                        libelleAria={t(`modules.${code}.nom`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modale>
  );
}
