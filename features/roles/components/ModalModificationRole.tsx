"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bouton, Modale } from "@/components/ui";
import type { RoleItem } from "../types";

interface Props {
  ouverte: boolean;
  role: RoleItem | null;
  rolesExistant: RoleItem[];
  onEnregistrer: (
    roleId: string,
    data: { libelle: string; description: string },
  ) => Promise<void>;
  onFermer: () => void;
  enCours?: boolean;
}

/**
 * `role` change de valeur quand la personne clique sur un autre rôle sans
 * fermer la modale : `page.tsx` remonte alors ce composant via `key={role.id}`,
 * ce qui réinitialise ces `useState` sans passer par un effet.
 */
export function ModalModificationRole({
  ouverte,
  role,
  rolesExistant,
  onEnregistrer,
  onFermer,
  enCours = false,
}: Props) {
  const t = useTranslations("roles");
  const [libelle, setLibelle] = useState(role?.libelle ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  if (!role) return null;

  async function valider() {
    if (!role) return;
    const err: Record<string, string> = {};
    const libelleNettoye = libelle.trim();

    if (!libelleNettoye) {
      err.libelle = t("erreurIntituleRequis");
    } else if (
      libelleNettoye.toLowerCase().includes("directeur general") ||
      // eslint-disable-next-line no-restricted-syntax -- comparaison, pas affichage
      libelleNettoye.toLowerCase().includes("directeur général")
    ) {
      err.libelle = t("erreurDgUnique");
    } else if (
      rolesExistant.some(
        (r) => r.id !== role.id && r.libelle.trim().toLowerCase() === libelleNettoye.toLowerCase(),
      )
    ) {
      err.libelle = t("erreurCodeExistant");
    }

    setErreurs(err);
    if (Object.keys(err).length > 0) return;

    await onEnregistrer(role.id, {
      libelle: libelleNettoye,
      description: description.trim(),
    });
  }

  const actions = (
    <>
      <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
        {t("annuler")}
      </Bouton>
      <Bouton variante="primaire" onClick={valider} enCours={enCours}>
        {t("enregistrer")}
      </Bouton>
    </>
  );

  return (
    <Modale
      ouverte={ouverte}
      titre={t("titreModification", { role: role.libelle })}
      onFermer={enCours ? undefined : onFermer}
      actions={actions}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <label
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: "var(--font-weight-medium)",
            }}
          >
            {t("champIntitule")} <span style={{ color: "var(--color-danger-500)", marginLeft: "2px" }}>*</span>
          </label>
          <input
            type="text"
            value={libelle}
            placeholder={t("placeholderIntitule")}
            onChange={(e) => setLibelle(e.target.value)}
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
          <label style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>
            {t("champDescription")}
          </label>
          <textarea
            value={description}
            rows={3}
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
      </div>
    </Modale>
  );
}
