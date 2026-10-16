"use client";

import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EnTetePage } from "@/components/layout/EnTetePage";
import { Alerte, Bouton, EtatChargement, EtatErreur } from "@/components/ui";
import { useDroits } from "@/features/habilitations";
import {
  colonnesDeMatrice,
  creerRole,
  gestesSurRole,
  listerModulesEntreprise,
  listerRoles,
  MatricePermissionsTable,
  ModalModificationRole,
  ModalNouveauRole,
  ModalReassignationRole,
  modifierRole,
  personnesTouchees,
  supprimerRole,
} from "@/features/roles";
import type {
  CreationRolePayload,
  ModificationRolePayload,
  ModuleCatalogue,
  RoleItem,
} from "@/features/roles";
import { ErreurApi } from "@/lib/api";

interface ConfirmationPortee {
  roleId: string;
  payload: ModificationRolePayload;
  personnes: number;
  versEntreprise: boolean;
}

export default function ParametresRolesPage() {
  const t = useTranslations("roles");
  const { estDirection, peutCode } = useDroits();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [catalogue, setCatalogue] = useState<ModuleCatalogue[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [modalNouveauOuverte, setModalNouveauOuverte] = useState(false);
  const [roleAEditer, setRoleAEditer] = useState<RoleItem | null>(null);
  const [roleASupprimer, setRoleASupprimer] = useState<RoleItem | null>(null);
  const [actionEnCours, setActionEnCours] = useState(false);
  const [confirmationPortee, setConfirmationPortee] = useState<ConfirmationPortee | null>(null);

  const chargerDonnees = useCallback(async () => {
    try {
      setChargement(true);
      setErreur(null);
      const [dataRoles, dataCatalogue] = await Promise.all([
        listerRoles(),
        listerModulesEntreprise(),
      ]);
      setRoles(dataRoles);
      setCatalogue(dataCatalogue);
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : t("chargement"));
    } finally {
      setChargement(false);
    }
  }, [t]);

  useEffect(() => {
    let vivant = true;
    Promise.all([listerRoles(), listerModulesEntreprise()])
      .then(([dataRoles, dataCatalogue]) => {
        if (vivant) {
          setRoles(dataRoles);
          setCatalogue(dataCatalogue);
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
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurAction"));
    } finally {
      setActionEnCours(false);
    }
  }

  async function handleModificationRole(
    roleId: string,
    payload: ModificationRolePayload,
  ) {
    setActionEnCours(true);
    try {
      await modifierRole(roleId, payload);
      setRoleAEditer(null);
      toast.success(t("succesModification", { role: payload.libelle ?? "" }));
      await chargerDonnees();
    } catch (err: unknown) {
      const touches = personnesTouchees(err);
      if (touches !== null) {
        setConfirmationPortee({
          roleId,
          payload,
          personnes: touches,
          versEntreprise: payload.portee === "ENTREPRISE",
        });
        return;
      }
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurAction"));
    } finally {
      setActionEnCours(false);
    }
  }

  async function handleConfirmerChangementPortee() {
    if (!confirmationPortee) return;
    setActionEnCours(true);
    try {
      await modifierRole(confirmationPortee.roleId, {
        ...confirmationPortee.payload,
        confirmer: true,
      });
      setConfirmationPortee(null);
      setRoleAEditer(null);
      toast.success(
        t("succesModification", { role: confirmationPortee.payload.libelle ?? "" }),
      );
      await chargerDonnees();
    } catch (err: unknown) {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurAction"));
    } finally {
      setActionEnCours(false);
    }
  }

  function handleDemandeSuppression(role: RoleItem) {
    const g = gestesSurRole(role, { estDirection }, catalogue);
    if (!g.supprimable) return;
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
        }),
      );
      await chargerDonnees();
    } catch (err: unknown) {
      toast.error(err instanceof ErreurApi && err.message ? err.message : t("erreurAction"));
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

  const colonnes = colonnesDeMatrice(roles, catalogue);
  const peutGerer = peutCode("administration.roles_gerer");
  const gestesRole = (r: RoleItem) => gestesSurRole(r, { estDirection }, catalogue);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <EnTetePage
          titre={t("titre")}
          description={t("sousTitre")}
          actions={
            peutGerer && (
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

        {!estDirection && (
          <Alerte type="information">
            {t("perimetreNonDg")}
          </Alerte>
        )}
      </div>

      <MatricePermissionsTable
        roles={roles}
        colonnes={colonnes}
        gestes={gestesRole}
        onOuvrirRole={setRoleAEditer}
        onSupprimerRole={handleDemandeSuppression}
      />

      <ModalNouveauRole
        ouverte={modalNouveauOuverte}
        rolesExistant={roles}
        catalogue={catalogue}
        enCours={actionEnCours}
        onEnregistrer={handleCreationRole}
        onFermer={() => setModalNouveauOuverte(false)}
      />

      <ModalModificationRole
        key={roleAEditer?.id ?? "vide"}
        ouverte={Boolean(roleAEditer)}
        role={roleAEditer}
        rolesExistant={roles}
        catalogue={catalogue}
        gestes={gestesSurRole(roleAEditer, { estDirection }, catalogue)}
        enCours={actionEnCours}
        onEnregistrer={handleModificationRole}
        onFermer={() => {
          setConfirmationPortee(null);
          setRoleAEditer(null);
        }}
        confirmationPortee={confirmationPortee}
        onConfirmerPortee={handleConfirmerChangementPortee}
        onAnnulerPortee={() => setConfirmationPortee(null)}
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
