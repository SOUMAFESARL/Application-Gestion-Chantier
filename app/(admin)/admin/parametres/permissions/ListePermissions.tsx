"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  Alerte,
  Bouton,
  Champ,
  EtatChargement,
  EtatErreur,
  Modale,
} from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { Textarea } from "@/components/ui/textarea";
import {
  CRITERES_PERMISSIONS_VIDES,
  criteresPermissionsActifs,
  filtrerPermissions,
  modulesPresentsDansPermissions,
  peutParametrerPlateforme,
  trierPermissions,
} from "@/features/administration";
import type {
  CriteresPermissions,
  DemandePermission,
  ModulePermission,
  PermissionPlateforme,
} from "@/features/administration";
import {
  basculerPermission,
  creerPermission,
  listerModules,
  listerPermissions,
  modifierPermission,
  rattacherPermission,
  supprimerPermission,
} from "@/features/administration/adaptateur";
import {
  schemaModificationPermission,
  schemaPermission,
} from "@/features/administration/validations";
import type {
  SaisieModificationPermission,
  SaisiePermission,
  ValeursModificationPermission,
  ValeursPermission,
} from "@/features/administration/validations";
import { ErreurApi } from "@/lib/api";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";
import { BADGE } from "../../tons";

const colonne = aideColonnes<PermissionPlateforme>();

const ID_FORM_CREATION = "form-permission-creation";
const ID_FORM_MODIFICATION = "form-permission-modification";

type Action =
  | { type: "creer" }
  | { type: "modifier"; permission: PermissionPlateforme }
  | { type: "modules"; permission: PermissionPlateforme }
  | { type: "desactiver"; permission: PermissionPlateforme }
  | { type: "supprimer"; permission: PermissionPlateforme }
  | null;

export function ListePermissions() {
  const t = useTranslations("administration");
  const profil = useAdministrateur();
  const cache = useQueryClient();
  const peutAgir = peutParametrerPlateforme(profil);

  const [criteres, setCriteres] = useState<CriteresPermissions>(
    CRITERES_PERMISSIONS_VIDES,
  );
  const [action, setAction] = useState<Action>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  // Pour la modale de changement de modules
  const [modulesChoisis, setModulesChoisis] = useState<string[]>([]);
  // Pour la modale de création (modules sélectionnés)
  const [modulesCreation, setModulesCreation] = useState<string[]>([]);
  // Pour la modale de suppression définitive
  const [codeConfirmation, setCodeConfirmation] = useState("");

  const requetePermissions = useQuery({
    queryKey: CLES_ADMINISTRATION.permissions(),
    queryFn: ({ signal }) => listerPermissions(signal),
  });

  const requeteModules = useQuery({
    queryKey: CLES_ADMINISTRATION.modules(),
    queryFn: ({ signal }) => listerModules(signal),
  });

  const toutesPermissions = useMemo(
    () => trierPermissions(requetePermissions.data ?? []),
    [requetePermissions.data],
  );

  const permissions = useMemo(
    () => filtrerPermissions(toutesPermissions, criteres),
    [toutesPermissions, criteres],
  );

  const modulesPresents = useMemo(
    () => modulesPresentsDansPermissions(toutesPermissions),
    [toutesPermissions],
  );

  const modulesCatalogue = useMemo(
    () => requeteModules.data ?? [],
    [requeteModules.data],
  );

  const formulaireCreation = useForm<SaisiePermission, unknown, ValeursPermission>({
    resolver: zodResolver(schemaPermission),
    defaultValues: {
      code: "",
      libelle: "",
      description: "",
      modules: [],
    },
  });

  const formulaireModification = useForm<
    SaisieModificationPermission,
    unknown,
    ValeursModificationPermission
  >({
    resolver: zodResolver(schemaModificationPermission),
    defaultValues: {
      libelle: "",
      description: "",
    },
  });

  function fermer() {
    setAction(null);
    setErreurAction(null);
    setCodeConfirmation("");
    setModulesChoisis([]);
    setModulesCreation([]);
    formulaireCreation.reset();
    formulaireModification.reset();
  }

  function invalider() {
    void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.permissions() });
    void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.modules() });
  }

  const activation = useMutation({
    mutationFn: (id: string) => basculerPermission(id, true),
    onSuccess: (p) => {
      toast.success(t("permissions.succes.activee", { code: p.code }));
      invalider();
    },
    onError: (cause) =>
      toast.error(cause instanceof Error ? cause.message : ""),
  });

  const desactivation = useMutation({
    mutationFn: (id: string) => basculerPermission(id, false),
    onSuccess: (p) => {
      toast.success(t("permissions.succes.desactivee", { code: p.code }));
      invalider();
      fermer();
    },
    onError: (cause) =>
      setErreurAction(
        cause instanceof ErreurApi
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "",
      ),
  });

  const creation = useMutation({
    mutationFn: (demande: DemandePermission) => creerPermission(demande),
    onSuccess: (p) => {
      toast.success(t("permissions.succes.creee", { code: p.code }));
      invalider();
      fermer();
    },
    onError: (cause) => {
      if (cause instanceof ErreurApi) {
        if (cause.erreursParChamp.code) {
          formulaireCreation.setError("code", {
            message: cause.erreursParChamp.code,
          });
          return;
        }
        if (
          cause.details &&
          typeof cause.details === "object" &&
          "detail" in cause.details
        ) {
          formulaireCreation.setError("code", {
            message: String(cause.details.detail),
          });
          return;
        }
        setErreurAction(cause.message);
      } else {
        setErreurAction(cause instanceof Error ? cause.message : "");
      }
    },
  });

  const modification = useMutation({
    mutationFn: ({
      id,
      valeurs,
    }: {
      id: string;
      valeurs: ValeursModificationPermission;
    }) => modifierPermission(id, valeurs),
    onSuccess: (p) => {
      toast.success(t("permissions.succes.modifiee", { code: p.code }));
      invalider();
      fermer();
    },
    onError: (cause) =>
      setErreurAction(
        cause instanceof ErreurApi
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "",
      ),
  });

  const affectationModules = useMutation({
    mutationFn: ({ id, modules }: { id: string; modules: string[] }) =>
      rattacherPermission(id, modules),
    onSuccess: (p) => {
      toast.success(t("permissions.succes.modules", { code: p.code }));
      invalider();
      fermer();
    },
    onError: (cause) =>
      setErreurAction(
        cause instanceof ErreurApi
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "",
      ),
  });

  const suppression = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      supprimerPermission(id, code),
    onSuccess: (_, { code }) => {
      toast.success(t("permissions.succes.supprimee", { code }));
      invalider();
      fermer();
    },
    onError: (cause) =>
      setErreurAction(
        cause instanceof ErreurApi
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "",
      ),
  });

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("code", {
          id: "code",
          header: t("permissions.colonnes.code"),
          cell: ({ row }) => (
            <span className="font-mono text-xs font-semibold text-neutral-800">
              {row.original.code}
            </span>
          ),
        }),
        colonne.accessor("libelle", {
          id: "libelle",
          header: t("permissions.colonnes.libelle"),
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span className="font-medium text-neutral-900">
                {row.original.libelle}
              </span>
              {row.original.description && (
                <span className="text-xs text-neutral-500">
                  {row.original.description}
                </span>
              )}
            </div>
          ),
        }),
        colonne.display({
          id: "modules",
          header: t("permissions.colonnes.modules"),
          cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
              {row.original.modules.length > 0 ? (
                row.original.modules.map((m: ModulePermission) => (
                  <span
                    key={m.id || m.code}
                    className={`${BADGE} border border-neutral-200 bg-neutral-100 text-neutral-800`}
                  >
                    {m.libelle}
                  </span>
                ))
              ) : (
                <span className="text-xs text-neutral-400">
                  {t("permissions.aucunModule")}
                </span>
              )}
            </div>
          ),
        }),
        colonne.accessor("actif", {
          id: "active",
          header: t("permissions.colonnes.active"),
          cell: ({ row }) => (
            <Checkbox
              checked={row.original.actif}
              disabled={
                !peutAgir ||
                activation.isPending ||
                desactivation.isPending
              }
              onCheckedChange={(coche) => {
                if (coche) {
                  activation.mutate(row.original.id);
                } else {
                  setErreurAction(null);
                  setAction({
                    type: "desactiver",
                    permission: row.original,
                  });
                }
              }}
              aria-label={row.original.libelle}
            />
          ),
        }),
        colonne.display({
          id: "actions",
          header: t("permissions.colonnes.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => (
            <div className="flex items-center gap-1">
              <Bouton
                variante="ghost"
                taille="sm"
                disabled={!peutAgir}
                onClick={() => {
                  setErreurAction(null);
                  formulaireModification.reset({
                    libelle: row.original.libelle,
                    description: row.original.description,
                  });
                  setAction({
                    type: "modifier",
                    permission: row.original,
                  });
                }}
                aria-label={t("permissions.actions.modifier")}
              >
                <Pencil size={15} aria-hidden="true" />
              </Bouton>
              <Bouton
                variante="ghost"
                taille="sm"
                disabled={!peutAgir}
                onClick={() => {
                  setErreurAction(null);
                  setModulesChoisis(row.original.modules.map((m) => m.code));
                  setAction({
                    type: "modules",
                    permission: row.original,
                  });
                }}
                aria-label={t("permissions.actions.modules")}
              >
                <Settings2 size={15} aria-hidden="true" />
              </Bouton>
              <Bouton
                variante="ghost"
                taille="sm"
                disabled={!peutAgir}
                onClick={() => {
                  setErreurAction(null);
                  setCodeConfirmation("");
                  setAction({
                    type: "supprimer",
                    permission: row.original,
                  });
                }}
                aria-label={t("permissions.actions.supprimer")}
                className="text-erreur hover:bg-erreur-fond hover:text-erreur"
              >
                <Trash2 size={15} aria-hidden="true" />
              </Bouton>
            </div>
          ),
        }),
      ]),
    [
      t,
      peutAgir,
      activation,
      desactivation.isPending,
      formulaireModification,
    ],
  );

  const exporter = useMemo<ExportTableau<PermissionPlateforme>>(
    () => ({
      titre: t("permissions.export.titre"),
      nomFichier: t("permissions.export.nomFichier"),
      colonnes: [
        {
          entete: t("permissions.colonnes.code"),
          valeur: (p) => p.code,
        },
        {
          entete: t("permissions.colonnes.libelle"),
          valeur: (p) => p.libelle,
        },
        {
          entete: t("permissions.champs.description"),
          valeur: (p) => p.description,
        },
        {
          entete: t("permissions.colonnes.modules"),
          valeur: (p) => p.modules.map((m) => m.code).join(", "),
        },
        {
          entete: t("permissions.colonnes.active"),
          valeur: (p) =>
            p.actif ? t("permissions.oui") : t("permissions.non"),
        },
      ],
    }),
    [t],
  );

  if (requetePermissions.isPending) return <EtatChargement />;
  if (requetePermissions.isError) {
    return (
      <EtatErreur
        message={t("erreurs.chargement")}
        onReessayer={() => void requetePermissions.refetch()}
      />
    );
  }

  const { errors: erreursCreation } = formulaireCreation.formState;
  const { errors: erreursModification } = formulaireModification.formState;

  return (
    <>
      <TableauListe
        colonnes={colonnes}
        donnees={permissions}
        cleLigne={(p) => p.id}
        messageVide={t("permissions.vide")}
        filtresActifs={criteresPermissionsActifs(criteres)}
        onReinitialiser={() => setCriteres(CRITERES_PERMISSIONS_VIDES)}
        cleCriteres={`${criteres.recherche}|${criteres.module}|${criteres.etat}`}
        exporter={exporter}
        actions={
          <Bouton
            variante="primaire"
            taille="sm"
            disabled={!peutAgir}
            iconeGauche={<Plus size={16} aria-hidden="true" />}
            onClick={() => {
              setErreurAction(null);
              formulaireCreation.reset({
                code: "",
                libelle: "",
                description: "",
                modules: [],
              });
              setAction({ type: "creer" });
            }}
          >
            {t("permissions.nouvelle")}
          </Bouton>
        }
        outils={
          <>
            <RechercheTableau
              valeur={criteres.recherche}
              onChangement={(recherche) =>
                setCriteres({ ...criteres, recherche })
              }
              libelle={t("permissions.filtres.recherche")}
              placeholder={t("permissions.filtres.recherchePlaceholder")}
            />
            <FiltreTableau
              valeur={criteres.module}
              onChangement={(module) =>
                setCriteres({ ...criteres, module })
              }
              libelle={t("permissions.filtres.module")}
              libelleTous={t("permissions.filtres.moduleTous")}
              options={modulesPresents.map((m) => ({
                valeur: m.code,
                libelle: m.libelle,
              }))}
            />
            <FiltreTableau
              valeur={criteres.etat}
              onChangement={(etat) =>
                setCriteres({
                  ...criteres,
                  etat: etat as CriteresPermissions["etat"],
                })
              }
              libelle={t("permissions.filtres.etat")}
              libelleTous={t("permissions.filtres.etatTous")}
              options={[
                {
                  valeur: "ACTIVE",
                  libelle: t("permissions.filtres.etatActive"),
                },
                {
                  valeur: "INACTIVE",
                  libelle: t("permissions.filtres.etatInactive"),
                },
              ]}
            />
          </>
        }
      />

      {/* Modale de création / rétablissement */}
      <Modale
        ouverte={action?.type === "creer"}
        titre={t("permissions.creerTitre")}
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("permissions.annuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              type="submit"
              form={ID_FORM_CREATION}
              enCours={creation.isPending}
            >
              {t("permissions.creerConfirmer")}
            </Bouton>
          </>
        }
      >
        <form
          id={ID_FORM_CREATION}
          noValidate
          onSubmit={formulaireCreation.handleSubmit((valeurs) => {
            setErreurAction(null);
            creation.mutate({ ...valeurs, modules: modulesCreation });
          })}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-neutral-600">
            {t("permissions.creerDescription")}
          </p>

          {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}

          <Champ
            libelle={t("permissions.champs.code")}
            taille="md"
            required
            placeholder={t("permissions.placeholderCode")}
            aide={t("permissions.codeAide")}
            erreur={erreursCreation.code?.message}
            disabled={creation.isPending}
            {...formulaireCreation.register("code")}
          />

          <Champ
            libelle={t("permissions.champs.libelle")}
            taille="md"
            required
            placeholder={t("permissions.champs.libelle")}
            erreur={erreursCreation.libelle?.message}
            disabled={creation.isPending}
            {...formulaireCreation.register("libelle")}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-neutral-800">
              {t("permissions.champs.description")}
            </label>
            <Textarea
              rows={3}
              placeholder={t("permissions.placeholderDescription")}
              disabled={creation.isPending}
              {...formulaireCreation.register("description")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-neutral-800">
              {t("permissions.champs.modules")}
            </span>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto rounded-md border border-neutral-200 p-3">
              {modulesCatalogue.map((mod) => (
                <label
                  key={mod.id}
                  className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer"
                >
                  <Checkbox
                    checked={modulesCreation.includes(mod.code)}
                    onCheckedChange={(coche) => {
                      if (coche) {
                        setModulesCreation((actuels) => [...actuels, mod.code]);
                      } else {
                        setModulesCreation((actuels) =>
                          actuels.filter((c) => c !== mod.code),
                        );
                      }
                    }}
                  />
                  <span>{mod.libelle}</span>
                  <span className="font-mono text-xs text-neutral-500">
                    ({mod.code})
                  </span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modale>

      {/* Modale de modification (libellé, description) */}
      <Modale
        ouverte={action?.type === "modifier"}
        titre={
          action?.type === "modifier"
            ? t("permissions.modifierTitre", {
                code: action.permission.code,
              })
            : ""
        }
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("permissions.annuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              type="submit"
              form={ID_FORM_MODIFICATION}
              enCours={modification.isPending}
            >
              {t("permissions.modifierConfirmer")}
            </Bouton>
          </>
        }
      >
        {action?.type === "modifier" && (
          <form
            id={ID_FORM_MODIFICATION}
            noValidate
            onSubmit={formulaireModification.handleSubmit((valeurs) => {
              setErreurAction(null);
              modification.mutate({
                id: action.permission.id,
                valeurs,
              });
            })}
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-neutral-600">
              {t("permissions.modifierDescription")}
            </p>

            {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}

            <Champ
              libelle={t("permissions.champs.libelle")}
              taille="md"
              required
              erreur={erreursModification.libelle?.message}
              disabled={modification.isPending}
              {...formulaireModification.register("libelle")}
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-neutral-800">
                {t("permissions.champs.description")}
              </label>
              <Textarea
                rows={3}
                disabled={modification.isPending}
                {...formulaireModification.register("description")}
              />
            </div>
          </form>
        )}
      </Modale>

      {/* Modale de changement des modules */}
      <Modale
        ouverte={action?.type === "modules"}
        titre={
          action?.type === "modules"
            ? t("permissions.modulesTitre", {
                code: action.permission.code,
              })
            : ""
        }
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("permissions.annuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              enCours={affectationModules.isPending}
              onClick={() => {
                if (action?.type === "modules") {
                  setErreurAction(null);
                  affectationModules.mutate({
                    id: action.permission.id,
                    modules: modulesChoisis,
                  });
                }
              }}
            >
              {t("permissions.modulesConfirmer")}
            </Bouton>
          </>
        }
      >
        {action?.type === "modules" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto rounded-md border border-neutral-200 p-3">
              {modulesCatalogue.map((mod) => {
                const estCoche = modulesChoisis.includes(mod.code);
                return (
                  <label
                    key={mod.id}
                    className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer"
                  >
                    <Checkbox
                      checked={estCoche}
                      onCheckedChange={(coche) => {
                        if (coche) {
                          setModulesChoisis((m) => [...m, mod.code]);
                        } else {
                          setModulesChoisis((m) =>
                            m.filter((c) => c !== mod.code),
                          );
                        }
                      }}
                    />
                    <span>{mod.libelle}</span>
                    <span className="font-mono text-xs text-neutral-500">
                      ({mod.code})
                    </span>
                  </label>
                );
              })}
            </div>

            <p className="text-xs text-neutral-600">
              {t("permissions.modulesTexte")}
            </p>

            {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
          </div>
        )}
      </Modale>

      {/* Modale de confirmation de désactivation */}
      <Modale
        ouverte={action?.type === "desactiver"}
        titre={
          action?.type === "desactiver"
            ? t("permissions.desactiverTitre", {
                code: action.permission.code,
              })
            : ""
        }
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("permissions.annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              enCours={desactivation.isPending}
              onClick={() => {
                if (action?.type === "desactiver") {
                  desactivation.mutate(action.permission.id);
                }
              }}
            >
              {t("permissions.desactiverConfirmer")}
            </Bouton>
          </>
        }
      >
        {action?.type === "desactiver" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-700">
              {t("permissions.desactiverTexte", {
                code: action.permission.code,
              })}
            </p>
            {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
          </div>
        )}
      </Modale>

      {/* Modale de suppression définitive avec saisie du code */}
      <Modale
        ouverte={action?.type === "supprimer"}
        titre={
          action?.type === "supprimer"
            ? t("permissions.supprimerTitre", {
                code: action.permission.code,
              })
            : ""
        }
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("permissions.annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              disabled={
                action?.type === "supprimer" &&
                codeConfirmation.trim() !== action.permission.code
              }
              enCours={suppression.isPending}
              onClick={() => {
                if (action?.type === "supprimer") {
                  suppression.mutate({
                    id: action.permission.id,
                    code: action.permission.code,
                  });
                }
              }}
            >
              {t("permissions.supprimerConfirmer")}
            </Bouton>
          </>
        }
      >
        {action?.type === "supprimer" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-700">
              {t("permissions.supprimerTexte", {
                code: action.permission.code,
              })}
            </p>

            <Champ
              libelle={t("permissions.supprimerSaisieLibelle")}
              taille="md"
              required
              placeholder={action.permission.code}
              aide={t("permissions.supprimerSaisieAide", {
                code: action.permission.code,
              })}
              value={codeConfirmation}
              onChange={(e) => setCodeConfirmation(e.target.value)}
            />

            {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
          </div>
        )}
      </Modale>
    </>
  );
}
