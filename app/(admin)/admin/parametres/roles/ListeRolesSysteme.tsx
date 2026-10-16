"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Alerte, Badge, Bouton, Champ, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Label } from "@/components/ui/label";
import { BORD_DROIT_TABLEAU, TableauListe } from "@/components/ui/tableau-liste";
import { Textarea } from "@/components/ui/textarea";
import { peutParametrerPlateforme } from "@/features/administration";
import type {
  DemandeRoleSysteme,
  PorteeRoleSysteme,
  RoleSysteme,
} from "@/features/administration";
import {
  creerRoleSysteme,
  listerModules,
  listerRolesSysteme,
  modifierRoleSysteme,
  supprimerRoleSysteme,
} from "@/features/administration/adaptateur";
import { ErreurApi } from "@/lib/api";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";

const colonne = aideColonnes<RoleSysteme>();

const PORTEES: PorteeRoleSysteme[] = ["ENTREPRISE", "PROJET"];

const SAISIE_VIDE: DemandeRoleSysteme = {
  code: "",
  libelle: "",
  description: "",
  portee: "PROJET",
  modules: [],
};

type Action =
  | { type: "formulaire"; role: RoleSysteme | null }
  | { type: "suppression"; role: RoleSysteme }
  | null;

/**
 * Les rôles système : gabarits de la plateforme recopiés dans chaque
 * entreprise. Créer propage partout ; modifier réécrit libellé et
 * description partout, les modules ne valant que pour les entreprises à
 * venir ; supprimer laisse le rôle à chaque entreprise, devenu personnalisé.
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
  const requeteModules = useQuery({
    queryKey: CLES_ADMINISTRATION.modules(),
    queryFn: ({ signal }) => listerModules(signal),
    enabled: action?.type === "formulaire",
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
            portee: role.portee,
            modules: role.modules,
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
          portee: saisie.portee,
          modules: saisie.modules,
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
        colonne.accessor("modules", {
          id: "modules",
          header: t("colonneModules"),
          cell: ({ row }) => row.original.modules.length,
        }),
        colonne.accessor("protege", {
          id: "protege",
          header: t("colonneType"),
          cell: ({ row }) =>
            row.original.protege ? (
              <Badge variante="neutre">{t("socle")}</Badge>
            ) : (
              <Badge variante="primaire">{t("ajoute")}</Badge>
            ),
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
                {!row.original.protege && (
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
        { entete: t("colonneModules"), valeur: (r) => r.modules.join(", ") },
      ],
    }),
    [t],
  );

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;

  const modules = requeteModules.data ?? [];
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
        taille="large"
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
          {enModification && <Alerte type="information">{t("aideModification")}</Alerte>}
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
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-neutral-800">{t("colonnePortee")}</legend>
            <div className="flex flex-wrap gap-4">
              {PORTEES.map((portee) => (
                <label key={portee} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="radio"
                    name="portee-role-systeme"
                    checked={saisie.portee === portee}
                    disabled={enregistrement.isPending}
                    onChange={() => setSaisie((s) => ({ ...s, portee }))}
                  />
                  {t(`portee.${portee}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-neutral-800">{t("colonneModules")}</legend>
            {requeteModules.isPending ? (
              <EtatChargement />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {modules.map((module) => {
                  const code = module.code.toLowerCase();
                  const id = `role-systeme-module-${code}`;
                  return (
                    <div key={module.id} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={saisie.modules.includes(code)}
                        disabled={enregistrement.isPending}
                        onCheckedChange={(coche) =>
                          setSaisie((s) => ({
                            ...s,
                            modules:
                              coche === true
                                ? [...s.modules, code]
                                : s.modules.filter((m) => m !== code),
                          }))
                        }
                      />
                      <Label htmlFor={id} className="text-sm font-normal">
                        {module.libelle}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </fieldset>
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
