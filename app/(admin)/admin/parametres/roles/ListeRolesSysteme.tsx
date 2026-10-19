"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Alerte, Bouton, Champ, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Label } from "@/components/ui/label";
import { BORD_DROIT_TABLEAU, TableauListe } from "@/components/ui/tableau-liste";
import { Textarea } from "@/components/ui/textarea";
import { peutParametrerPlateforme, peutSupprimerRoleSysteme } from "@/features/administration";
import type {
  DemandeRoleSysteme,
  RoleSysteme,
} from "@/features/administration";
import {
  creerRoleSysteme,
  listerRolesSysteme,
  modifierRoleSysteme,
  supprimerRoleSysteme,
} from "@/features/administration/adaptateur";
import { ErreurApi } from "@/lib/api";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";

const colonne = aideColonnes<RoleSysteme>();

const SAISIE_VIDE: DemandeRoleSysteme = {
  code: "",
  libelle: "",
  description: "",
};

type Action =
  | { type: "formulaire"; role: RoleSysteme | null }
  | { type: "suppression"; role: RoleSysteme }
  | null;

/**
 * Les rôles système : gabarits de la plateforme recopiés dans chaque
 * entreprise. Créer propage partout, en portée Projet et sans permission ;
 * modifier réécrit libellé et description partout ; supprimer laisse le
 * rôle à chaque entreprise, devenu personnalisé. Le DG de chaque
 * entreprise attribue les permissions.
 */
export function ListeRolesSysteme() {
  const t = useTranslations("administration.parametres.rolesSysteme");
  const profil = useAdministrateur();
  const cache = useQueryClient();
  const peutAgir = peutParametrerPlateforme(profil);

  const [action, setAction] = useState<Action>(null);
  const [saisie, setSaisie] = useState<DemandeRoleSysteme>(SAISIE_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.rolesSysteme(),
    queryFn: ({ signal }) => listerRolesSysteme(signal),
  });
  const enModification = action?.type === "formulaire" ? action.role : null;

  function ouvrirFormulaire(role: RoleSysteme | null) {
    setErreur(null);
    setSaisie(
      role
        ? {
            code: role.code,
            libelle: role.libelle,
            description: role.description,
          }
        : SAISIE_VIDE,
    );
    setAction({ type: "formulaire", role });
  }

  function fermer() {
    setAction(null);
    setErreur(null);
  }

  function surErreur(cause: unknown) {
    setErreur(cause instanceof ErreurApi ? cause.message : t("erreur"));
  }

  const enregistrement = useMutation({
    mutationFn: () => {
      if (enModification) {
        return modifierRoleSysteme(enModification.id, {
          libelle: saisie.libelle,
          description: saisie.description,
        });
      }
      return creerRoleSysteme(saisie);
    },
    onSuccess: () => {
      toast.success(enModification ? t("succesModification") : t("succesCreation"));
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.rolesSysteme() });
      fermer();
    },
    onError: surErreur,
  });

  const suppression = useMutation({
    mutationFn: (role: RoleSysteme) => supprimerRoleSysteme(role.id),
    onSuccess: () => {
      toast.success(t("succesSuppression"));
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.rolesSysteme() });
      fermer();
    },
    onError: surErreur,
  });

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("libelle", {
          id: "libelle",
          header: t("colonneRole"),
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span className="font-medium text-neutral-900">{row.original.libelle}</span>
              <span className="text-xs text-neutral-500">{row.original.code}</span>
            </div>
          ),
        }),
        colonne.accessor("portee", {
          id: "portee",
          header: t("colonnePortee"),
          cell: ({ row }) => t(`portee.${row.original.portee}`),
        }),
        colonne.display({
          id: "actions",
          header: "",
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) =>
            peutAgir && (
              <div className="flex justify-end gap-1">
                <Bouton
                  variante="ghost"
                  taille="sm"
                  aria-label={t("modifier")}
                  onClick={() => ouvrirFormulaire(row.original)}
                >
                  <Pencil size={16} aria-hidden="true" />
                </Bouton>
                {peutSupprimerRoleSysteme(row.original) && (
                  <Bouton
                    variante="ghost"
                    taille="sm"
                    className="text-erreur"
                    aria-label={t("supprimer")}
                    onClick={() => {
                      setErreur(null);
                      setAction({ type: "suppression", role: row.original });
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Bouton>
                )}
              </div>
            ),
        }),
      ]),
    [t, peutAgir],
  );

  const exporter = useMemo<ExportTableau<RoleSysteme>>(
    () => ({
      titre: t("titre"),
      nomFichier: t("nomFichier"),
      colonnes: [
        { entete: t("colonneRole"), valeur: (r) => r.libelle },
        { entete: t("code"), valeur: (r) => r.code },
        { entete: t("colonnePortee"), valeur: (r) => t(`portee.${r.portee}`) },
      ],
    }),
    [t],
  );

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  const valide = saisie.libelle.trim() !== "" && (enModification || saisie.code.trim() !== "");

  return (
    <>
      <TableauListe
        colonnes={colonnes}
        donnees={requete.data}
        cleLigne={(r) => r.id}
        messageVide={t("vide")}
        exporter={exporter}
        actions={
          peutAgir && (
            <Bouton taille="sm" iconeGauche={<Plus size={16} />} onClick={() => ouvrirFormulaire(null)}>
              {t("nouveau")}
            </Bouton>
          )
        }
      />

      <Modale
        ouverte={action?.type === "formulaire"}
        titre={enModification ? t("titreModification") : t("titreCreation")}
        onFermer={enregistrement.isPending ? undefined : fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer} disabled={enregistrement.isPending}>
              {t("annuler")}
            </Bouton>
            <Bouton
              disabled={!valide || enregistrement.isPending}
              enCours={enregistrement.isPending}
              onClick={() => enregistrement.mutate()}
            >
              {t("enregistrer")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {enModification ? (
            <Alerte type="information">{t("aideModification")}</Alerte>
          ) : (
            <Alerte type="information">{t("aideCreation")}</Alerte>
          )}
          <Champ
            libelle={t("code")}
            value={saisie.code}
            maxLength={30}
            disabled={Boolean(enModification) || enregistrement.isPending}
            aide={enModification ? undefined : t("aideCode")}
            onChange={(e) => setSaisie((s) => ({ ...s, code: e.target.value.toUpperCase() }))}
          />
          <Champ
            libelle={t("libelle")}
            value={saisie.libelle}
            maxLength={100}
            disabled={enregistrement.isPending}
            onChange={(e) => setSaisie((s) => ({ ...s, libelle: e.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-systeme-description">{t("champDescription")}</Label>
            <Textarea
              id="role-systeme-description"
              value={saisie.description}
              disabled={enregistrement.isPending}
              onChange={(e) => setSaisie((s) => ({ ...s, description: e.target.value }))}
            />
          </div>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        </div>
      </Modale>

      <Modale
        ouverte={action?.type === "suppression"}
        titre={t("titreSuppression")}
        onFermer={suppression.isPending ? undefined : fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer} disabled={suppression.isPending}>
              {t("annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              enCours={suppression.isPending}
              disabled={suppression.isPending}
              onClick={() => action?.type === "suppression" && suppression.mutate(action.role)}
            >
              {t("supprimer")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>
            {t("confirmationSuppression", {
              role: action?.type === "suppression" ? action.role.libelle : "",
            })}
          </p>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        </div>
      </Modale>
    </>
  );
}
