"use client";

import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
  LegendeAcces,
  supprimerRole,
} from "@/features/roles";
import type { AccesModule, CreationRolePayload, ModificationRolePayload, RoleItem } from "@/features/roles";
import { obtenirProfilMoi } from "@/features/auth/api";
import type { ProfilUtilisateur } from "@/features/auth/api";

export default function ParametresRolesPage() {
  const t = useTranslations("roles");
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
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

  async function handleCreationRole(payload: CreationRolePayload) {
    setActionEnCours(true);
    try {
      await creerRole(payload);
      setModalNouveauOuverte(false);
      toast.success(t("succesCreation", { role: payload.libelle }));
      await chargerDonnees();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "");
    } finally {
      setActionEnCours(false);
    }
  }

  async function handleChangementAcces(roleId: string, module: string, acces: AccesModule[]) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;

    // La matrice **complète** du rôle part au serveur, pas le seul module
    // touché : un `PATCH` qui remplace le champ JSON au lieu de le fusionner
    // effacerait sinon les onze autres modules.
    const permissions = { ...role.permissions_modules, [module]: acces };

    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, permissions_modules: permissions } : r))
    );

    try {
      await modifierRole(roleId, { permissions_modules: permissions });
    } catch (err: unknown) {
      await chargerDonnees();
      alert(err instanceof Error ? err.message : "");
    }
  }

  async function handleModificationRole(
    roleId: string,
    payload: Required<ModificationRolePayload>,
  ) {
    setActionEnCours(true);
    try {
      await modifierRole(roleId, payload);
      setRoleAEditer(null);
      toast.success(t("succesModification", { role: payload.libelle }));
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
      toast.success(
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
      {/* En-tête, alertes et légende restent sous la barre du haut (`h-16`)
          pendant que la matrice défile : la légende sert à lire chaque
          cellule. Les marges négatives reprennent le padding du `<main>` pour
          que le fond couvre toute la largeur. Pas sous `md` : sur téléphone,
          le bloc mangerait l'écran. */}
      <div className="flex flex-col gap-6 bg-background md:sticky md:top-16 md:z-30 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 md:pb-4">
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

        <div className="flex flex-wrap items-center gap-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
          <span style={{ fontWeight: "var(--font-weight-semibold)" }}>{t("legendeTitre")}</span>
          <LegendeAcces />
        </div>
      </div>

      <MatricePermissionsTable
        roles={roles}
        onChangeAcces={estDG ? handleChangementAcces : undefined}
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
