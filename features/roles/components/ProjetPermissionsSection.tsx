"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alerte, EtatChargement, EtatErreur } from "@/components/ui";
import {
  listerRoles,
  obtenirMatriceProjet,
  sauvegarderMatriceProjet,
} from "../api";
import type { NiveauAcces, ProjetRoleMatrice, RoleItem } from "../types";
import { MatricePermissionsTable } from "./MatricePermissionsTable";
import { SelecteurNiveau } from "./SelecteurNiveau";

interface Props {
  projetId: string;
  nomProjet: string;
}

export function ProjetPermissionsSection({ projetId, nomProjet }: Props) {
  const t = useTranslations("roles");
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [matriceProjet, setMatriceProjet] = useState<ProjetRoleMatrice[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    Promise.all([listerRoles(), obtenirMatriceProjet(projetId)])
      .then(([dataRoles, dataProjet]) => {
        if (vivant) {
          setRoles(dataRoles);
          setMatriceProjet(dataProjet);
          setChargement(false);
        }
      })
      .catch((err: unknown) => {
        if (vivant) {
          setErreur(err instanceof Error ? err.message : t("chargement"));
          setChargement(false);
        }
      });

    return () => {
      vivant = false;
    };
  }, [projetId, t]);

  async function handleChangementNiveau(
    roleId: string,
    module: string,
    nouveauNiveau: NiveauAcces
  ) {
    try {
      const maj = await sauvegarderMatriceProjet(projetId, [
        {
          role_id: roleId,
          module,
          niveau: nouveauNiveau,
        },
      ]);
      setMatriceProjet(maj);
      setMessage(t("surchargeChantier"));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "");
    }
  }

  if (chargement) {
    return <EtatChargement message={t("chargement")} />;
  }

  if (erreur) {
    return (
      <EtatErreur
        message={erreur}
        onReessayer={() => {
          setChargement(true);
          setErreur(null);
          Promise.all([listerRoles(), obtenirMatriceProjet(projetId)])
            .then(([dataRoles, dataProjet]) => {
              setRoles(dataRoles);
              setMatriceProjet(dataProjet);
            })
            .catch((err: unknown) => {
              setErreur(err instanceof Error ? err.message : t("chargement"));
            })
            .finally(() => setChargement(false));
        }}
      />
    );
  }

  const nbSurcharges = matriceProjet.reduce((total, r) => {
    const surchargesRole = Object.values(r.modules).filter((m) => m.est_surcharge).length;
    return total + surchargesRole;
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)" }}>
            {t("titreChantier", { projet: nomProjet })}
          </h3>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-neutral-600)" }}>
            {t("descriptionChantier")}
          </p>
        </div>

        {nbSurcharges > 0 && (
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              padding: "var(--space-1) var(--space-2)",
              backgroundColor: "var(--color-primary-50)",
              color: "var(--color-primary-700)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-primary-200)",
              fontWeight: "var(--font-weight-medium)",
            }}
          >
            {t("exceptionsChantier", { n: nbSurcharges })}
          </span>
        )}
      </div>

      {message && (
        <Alerte type="succes">
          {message}
        </Alerte>
      )}

      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          alignItems: "center",
          padding: "var(--space-2) var(--space-3)",
          backgroundColor: "var(--color-neutral-50)",
          border: "1px solid var(--color-neutral-200)",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--font-size-xs)",
        }}
      >
        <span style={{ fontWeight: "var(--font-weight-medium)" }}>{t("legendeTitre")}</span>
        {([0, 1, 2, 3] as NiveauAcces[]).map((niv) => (
          <div key={niv} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <SelecteurNiveau valeur={niv} lectureSeule />
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <SelecteurNiveau valeur={2} lectureSeule estSurcharge />
          <span>{t("personnaliseSurChantier")}</span>
        </div>
      </div>

      <MatricePermissionsTable
        roles={roles}
        estProjet
        matriceProjet={matriceProjet}
        onChangeNiveau={handleChangementNiveau}
      />
    </div>
  );
}
