"use client";

import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { EnTetePage } from "@/components/layout/EnTetePage";
import { Alerte, Bouton, EtatChargement, EtatErreur } from "@/components/ui";
import {
  creerRole,
  listerRoles,
  MatricePermissionsTable,
  ModalModificationRole,
  ModalNouveauRole,
  ModalReassignationRole,
  modifierRole,
  SelecteurNiveau,
  supprimerRole,
} from "@/features/roles";
import type { NiveauAcces, RoleItem } from "@/features/roles";
import { obtenirProfilMoi } from "@/features/auth/api";
import type { ProfilUtilisateur } from "@/features/auth/api";

export default function ParametresRolesPage() {
  const t = useTranslations("roles");
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succesMessage, setSuccesMessage] = useState<string | null>(null);
  const [profil, setProfil] = useState<ProfilUtilisateur | null>(null);

  const [modalNouveauOuverte, setModalNouveauOuverte] = useState(false);
  const [roleAEditer, setRoleAEditer] = useState<RoleItem | null>(null);
  const [roleASupprimer, setRoleASupprimer] = useState<RoleItem | null>(null);
  const [actionEnCours, setActionEnCours] = useState(false);

  const chargerDonnees = useCallback(async () => {
    try {
      setChargement(true);
      setErreur(null);
      const [dataRoles, dataProfil] = await Promise.all([
        listerRoles(),
        obtenirProfilMoi(),
      ]);
      setRoles(dataRoles);
      setProfil(dataProfil);
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : t("chargement"));
    } finally {
      setChargement(false);
    }
  }, [t]);

  useEffect(() => {
    let vivant = true;
    Promise.all([listerRoles(), obtenirProfilMoi()])
      .then(([dataRoles, dataProfil]) => {
        if (vivant) {
          setRoles(dataRoles);
          setProfil(dataProfil);
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
  }, [t]);

  async function handleCreationRole(payload: {
    code: string;
    libelle: string;
    description: string;
    permissions_modules: Record<string, NiveauAcces>;
  }) {
    setActionEnCours(true);
    try {
      await creerRole(payload);
      setModalNouveauOuverte(false);
      setSuccesMessage(t("succesCreation", { role: payload.libelle }));
      await chargerDonnees();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "");
    } finally {
      setActionEnCours(false);
    }
  }

  async function handleChangementNiveau(roleId: string, module: string, nouveauNiveau: NiveauAcces) {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id === roleId) {
          return {
            ...r,
            permissions_modules: {
              ...r.permissions_modules,
              [module]: nouveauNiveau,
            },
          };
        }
        return r;
      })
    );

    try {
      await modifierRole(roleId, {
        permissions_modules: {
          [module]: nouveauNiveau,
        },
      });
    } catch (err: unknown) {
      await chargerDonnees();
      alert(err instanceof Error ? err.message : "");
    }
  }

  async function handleModificationRole(
    roleId: string,
    payload: { libelle: string; description: string },
  ) {
    setActionEnCours(true);
    try {
      await modifierRole(roleId, payload);
      setRoleAEditer(null);
      setSuccesMessage(t("succesModification", { role: payload.libelle }));
      await chargerDonnees();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "");
    } finally {
      setActionEnCours(false);
    }
  }

  function handleDemandeSuppression(role: RoleItem) {
    if (role.est_systeme) return;
    setRoleASupprimer(role);
  }

  async function handleConfirmationSuppression(roleCibleId: string) {
    if (!roleASupprimer) return;

    setActionEnCours(true);
    try {
      const res = await supprimerRole(roleASupprimer.id, {
        role_substitution_id: roleCibleId,
        reassigner_vers_role_id: roleCibleId,
      });
      setRoleASupprimer(null);
      setSuccesMessage(
        t("succesSuppression", {
          users: res.utilisateurs_reassignes,
          aff: res.affectations_reassignees,
        })
      );
      await chargerDonnees();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "");
    } finally {
      setActionEnCours(false);
    }
  }

  if (chargement) {
    return (
      <div className="flex flex-col gap-6">
        <EtatChargement message={t("chargement")} />
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="flex flex-col gap-6">
        <EtatErreur message={erreur} onReessayer={chargerDonnees} />
      </div>
    );
  }

  const estDG = Boolean(profil?.is_dg || profil?.role_global === "DG");

  return (
    <div className="flex flex-col gap-6">
      <EnTetePage
        titre={t("titre")}
        description={t("sousTitre")}
        actions={
          estDG && (
            <Bouton
              variante="primaire"
              iconeGauche={<Plus size={16} weight="bold" />}
              onClick={() => setModalNouveauOuverte(true)}
            >
              {t("nouveauRole")}
            </Bouton>
          )
        }
      />

      {!estDG && (
        <Alerte type="avertissement">
          {t("restrictionDgMessage")}
        </Alerte>
      )}

      {succesMessage && (
        <Alerte type="succes">
          {succesMessage}
        </Alerte>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <span style={{ fontWeight: "var(--font-weight-semibold)" }}>{t("legendeTitre")}</span>
        {([0, 1, 2, 3] as NiveauAcces[]).map((niv) => (
          <div key={niv} className="flex items-center gap-2">
            <SelecteurNiveau valeur={niv} lectureSeule />
          </div>
        ))}
      </div>

      <MatricePermissionsTable
        roles={roles}
        onChangeNiveau={estDG ? handleChangementNiveau : undefined}
        onEditerRole={estDG ? setRoleAEditer : undefined}
        onSupprimerRole={estDG ? handleDemandeSuppression : undefined}
      />

      <ModalNouveauRole
        ouverte={modalNouveauOuverte}
        rolesExistant={roles}
        enCours={actionEnCours}
        onEnregistrer={handleCreationRole}
        onFermer={() => setModalNouveauOuverte(false)}
      />

      <ModalModificationRole
        key={roleAEditer?.id ?? "vide"}
        ouverte={Boolean(roleAEditer)}
        role={roleAEditer}
        rolesExistant={roles}
        enCours={actionEnCours}
        onEnregistrer={handleModificationRole}
        onFermer={() => setRoleAEditer(null)}
      />

      <ModalReassignationRole
        ouverte={Boolean(roleASupprimer)}
        roleASupprimer={roleASupprimer}
        rolesDisponibles={roles}
        enCours={actionEnCours}
        onConfirmer={handleConfirmationSuppression}
        onFermer={() => setRoleASupprimer(null)}
      />
    </div>
  );
}
