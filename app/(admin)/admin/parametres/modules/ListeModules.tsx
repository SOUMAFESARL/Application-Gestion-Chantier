"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Pencil, Play, Plus } from "lucide-react";
import { Key } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alerte, Bouton, Champ, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  CRITERES_MODULES_VIDES,
  criteresModulesActifs,
  desactivationModulePossible,
  differenceRattachement,
  filtrerModules,
  permissionsRattachables,
  peutParametrerPlateforme,
  reactivationModulePossible,
  STATUTS_MODULE,
  trierModules,
} from "@/features/administration";
import type { CriteresModules, ModulePlateforme } from "@/features/administration";
import {
  creerModule,
  desactiverModule,
  listerModules,
  listerPermissions,
  modifierModule,
  rattacherPermissionsModule,
  reactiverModule,
} from "@/features/administration/adaptateur";
import { schemaModule } from "@/features/administration/validations";
import type { SaisieModule, ValeursModule } from "@/features/administration/validations";
import { ErreurApi } from "@/lib/api";
import { formaterDate } from "@/lib/format";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";
import { BADGE, TON_STATUT_MODULE } from "../../tons";

const colonne = aideColonnes<ModulePlateforme>();

/** Relie le bouton du pied de modale au formulaire, rendu dans le corps. */
const ID_FORM_MODULE = "form-module-plateforme";

const VALEURS_VIDES: SaisieModule = { libelle: "", description: "", ordre: 0, icone: "box" };

type Action =
  | { type: "formulaire"; module: ModulePlateforme | null }
  | { type: "desactivation"; module: ModulePlateforme }
  | { type: "reactivation"; module: ModulePlateforme }
  | {
      type: "permissions";
      module: ModulePlateforme;
      etape: "selection" | "confirmation";
      codesChoisis: string[];
    }
  | null;

export function ListeModules() {
  const t = useTranslations("administration");
  const profil = useAdministrateur();
  const cache = useQueryClient();
  const peutAgir = peutParametrerPlateforme(profil);
  const idDescription = useId();

  const [criteres, setCriteres] = useState<CriteresModules>(CRITERES_MODULES_VIDES);
  const [action, setAction] = useState<Action>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.modules(),
    queryFn: ({ signal }) => listerModules(signal),
  });

  const requetePermissions = useQuery({
    queryKey: CLES_ADMINISTRATION.permissions(),
    queryFn: ({ signal }) => listerPermissions(signal),
    enabled: action?.type === "permissions",
  });

  const tous = useMemo(() => requete.data ?? [], [requete.data]);
  const modules = useMemo(() => trierModules(filtrerModules(tous, criteres)), [tous, criteres]);

  const formulaire = useForm<SaisieModule, unknown, ValeursModule>({
    resolver: zodResolver(schemaModule),
    defaultValues: VALEURS_VIDES,
  });

  const enModification = action?.type === "formulaire" ? action.module : null;

  function ouvrirFormulaire(cible: ModulePlateforme | null) {
    setErreurAction(null);
    formulaire.reset(
      cible
        ? {
            libelle: cible.libelle,
            description: cible.description,
            ordre: cible.ordre,
            icone: cible.icone,
          }
        : VALEURS_VIDES,
    );
    setAction({ type: "formulaire", module: cible });
  }

  function ouvrirPermissions(cible: ModulePlateforme) {
    setErreurAction(null);
    setAction({
      type: "permissions",
      module: cible,
      etape: "selection",
      codesChoisis: (cible.permissions ?? []).map((p) => p.code.toLowerCase()),
    });
  }

  function fermer() {
    setAction(null);
    setErreurAction(null);
    formulaire.reset(VALEURS_VIDES);
  }

  function remplacer(cible: ModulePlateforme) {
    cache.setQueryData<ModulePlateforme[]>(CLES_ADMINISTRATION.modules(), (liste) =>
      liste?.some((m) => m.id === cible.id)
        ? liste.map((m) => (m.id === cible.id ? cible : m))
        : [...(liste ?? []), cible],
    );
  }

  function surEchec(cause: unknown) {
    setErreurAction(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
  }

  const enregistrement = useMutation({
    mutationFn: ({ id, valeurs }: { id: string | null; valeurs: ValeursModule }) =>
      id ? modifierModule(id, valeurs) : creerModule(valeurs),
    onSuccess: (cible, { id }) => {
      remplacer(cible);
      toast.success(
        t(
          id
            ? "parametres.modules.formulaire.succesModification"
            : "parametres.modules.formulaire.succesCreation",
          { libelle: cible.libelle },
        ),
      );
      fermer();
    },
    onError: (cause) => {
      const champLibelle = cause instanceof ErreurApi ? cause.erreursParChamp.libelle : undefined;
      if (champLibelle) {
        formulaire.setError("libelle", { message: champLibelle });
        return;
      }
      surEchec(cause);
    },
  });

  const rattachement = useMutation({
    mutationFn: ({ id, codes }: { id: string; codes: string[] }) =>
      rattacherPermissionsModule(id, codes),
    onSuccess: (cible) => {
      remplacer(cible);
      cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.permissions() });
      toast.success(t("parametres.modules.succesPermissions", { libelle: cible.libelle }));
      fermer();
    },
    onError: surEchec,
  });

  const desactivation = useMutation({
    mutationFn: (id: string) => desactiverModule(id),
    onSuccess: (cible) => {
      remplacer(cible);
      fermer();
    },
    onError: surEchec,
  });

  const reactivation = useMutation({
    mutationFn: (id: string) => reactiverModule(id),
    onSuccess: (cible) => {
      remplacer(cible);
      fermer();
    },
    onError: surEchec,
  });

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("ordre", {
          header: t("parametres.modules.colonneOrdre"),
          meta: { classe: "text-right" },
          cell: ({ getValue }) => <span className="tabular-nums font-mono">{getValue()}</span>,
        }),
        colonne.accessor("libelle", {
          header: t("parametres.modules.colonneModule"),
          cell: ({ row }) => (
            <span className="flex flex-col">
              <span className="font-semibold text-neutral-900">{row.original.libelle}</span>
              <code className="text-xs text-neutral-600">{row.original.code}</code>
            </span>
          ),
        }),
        colonne.accessor("icone", {
          header: t("parametres.modules.colonneIcone"),
          cell: ({ getValue }) => <code className="font-mono text-xs">{getValue()}</code>,
        }),
        colonne.accessor("description", {
          header: t("parametres.modules.colonneDescription"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => <span className="line-clamp-2">{getValue()}</span>,
        }),
        colonne.display({
          id: "permissions",
          header: t("parametres.modules.colonnePermissions"),
          cell: ({ row }) => {
            const perms = row.original.permissions ?? [];
            const codes = perms.map((p) => p.code).join(", ");
            return (
              <span title={codes || undefined}>
                {t("parametres.modules.nbPermissions", { n: perms.length })}
              </span>
            );
          },
        }),
        colonne.accessor("statut", {
          header: t("parametres.modules.colonneStatut"),
          cell: ({ getValue }) => (
            <span className={`${BADGE} ${TON_STATUT_MODULE[getValue()]}`}>
              {t(`parametres.modules.statut.${getValue()}`)}
            </span>
          ),
        }),
        colonne.accessor("creeLe", {
          header: t("parametres.modules.colonneCreeLe"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => formaterDate(getValue()),
        }),
        colonne.display({
          id: "actions",
          header: () => <span className="sr-only">{t("parametres.modules.colonneActions")}</span>,
          meta: { classe: `${BORD_DROIT_TABLEAU} text-right` },
          cell: ({ row }) => {
            const cible = row.original;
            return (
              <span className="inline-flex items-center justify-end gap-1">
                <Bouton
                  variante="ghost"
                  taille="sm"
                  disabled={!peutAgir}
                  iconeGauche={<Pencil size={16} aria-hidden="true" />}
                  onClick={() => ouvrirFormulaire(cible)}
                >
                  {t("parametres.modules.modifier")}
                </Bouton>
                <Bouton
                  variante="ghost"
                  taille="sm"
                  disabled={!peutAgir}
                  iconeGauche={<Key size={16} aria-hidden="true" />}
                  onClick={() => ouvrirPermissions(cible)}
                >
                  {t("parametres.modules.permissions")}
                </Bouton>
                {desactivationModulePossible(cible) && (
                  <Bouton
                    variante="ghost"
                    taille="sm"
                    disabled={!peutAgir}
                    className="text-erreur hover:bg-erreur-fond hover:text-erreur"
                    iconeGauche={<Ban size={16} aria-hidden="true" />}
                    onClick={() => {
                      setErreurAction(null);
                      setAction({ type: "desactivation", module: cible });
                    }}
                  >
                    {t("parametres.modules.desactiver")}
                  </Bouton>
                )}
                {reactivationModulePossible(cible) && (
                  <Bouton
                    variante="ghost"
                    taille="sm"
                    disabled={!peutAgir}
                    iconeGauche={<Play size={16} aria-hidden="true" />}
                    onClick={() => {
                      setErreurAction(null);
                      setAction({ type: "reactivation", module: cible });
                    }}
                  >
                    {t("parametres.modules.reactiver")}
                  </Bouton>
                )}
              </span>
            );
          },
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, peutAgir],
  );

  const exporter = useMemo<ExportTableau<ModulePlateforme>>(
    () => ({
      titre: t("parametres.modules.export.titre"),
      nomFichier: t("parametres.modules.export.nomFichier"),
      colonnes: [
        { entete: t("parametres.modules.colonneOrdre"), valeur: (m) => m.ordre },
        { entete: t("parametres.modules.colonneModule"), valeur: (m) => m.libelle },
        { entete: t("parametres.modules.colonneCode"), valeur: (m) => m.code },
        { entete: t("parametres.modules.colonneIcone"), valeur: (m) => m.icone },
        { entete: t("parametres.modules.colonneDescription"), valeur: (m) => m.description },
        {
          entete: t("parametres.modules.colonnePermissions"),
          valeur: (m) => t("parametres.modules.nbPermissions", { n: m.permissions?.length ?? 0 }),
        },
        {
          entete: t("parametres.modules.colonneStatut"),
          valeur: (m) => t(`parametres.modules.statut.${m.statut}`),
        },
        { entete: t("parametres.modules.colonneCreeLe"), valeur: (m) => formaterDate(m.creeLe) },
      ],
    }),
    [t],
  );

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) {
    return (
      <EtatErreur message={t("erreurs.chargement")} onReessayer={() => void requete.refetch()} />
    );
  }

  const { errors } = formulaire.formState;
  const idErreurDescription = `${idDescription}-erreur`;

  const permissionsCible = action?.type === "permissions" ? action.module : null;
  const cataloguePerms = requetePermissions.data ?? [];
  const rattachables = permissionsCible
    ? permissionsRattachables(permissionsCible, cataloguePerms)
    : [];
  const diffPerms =
    action?.type === "permissions"
      ? differenceRattachement(action.module, action.codesChoisis)
      : { ajoutes: [], retires: [] };
  const rienChangePerms = diffPerms.ajoutes.length === 0 && diffPerms.retires.length === 0;

  return (
    <>
      <TableauListe
        colonnes={colonnes}
        donnees={modules}
        cleLigne={(m) => m.id}
        messageVide={t("parametres.modules.aucun")}
        filtresActifs={criteresModulesActifs(criteres)}
        onReinitialiser={() => setCriteres(CRITERES_MODULES_VIDES)}
        cleCriteres={`${criteres.recherche}|${criteres.statut}`}
        exporter={exporter}
        actions={
          <Bouton
            variante="primaire"
            taille="sm"
            disabled={!peutAgir}
            iconeGauche={<Plus size={16} aria-hidden="true" />}
            onClick={() => ouvrirFormulaire(null)}
          >
            {t("parametres.modules.ajouter")}
          </Bouton>
        }
        outils={
          <>
            <RechercheTableau
              valeur={criteres.recherche}
              onChangement={(recherche) => setCriteres({ ...criteres, recherche })}
              libelle={t("parametres.modules.recherche")}
              placeholder={t("parametres.modules.recherchePlaceholder")}
            />
            <FiltreTableau
              valeur={criteres.statut}
              onChangement={(statut) => setCriteres({ ...criteres, statut })}
              libelle={t("parametres.modules.filtreStatut")}
              libelleTous={t("parametres.modules.filtreStatutTous")}
              options={STATUTS_MODULE.map((statut) => ({
                valeur: statut,
                libelle: t(`parametres.modules.statut.${statut}`),
              }))}
            />
          </>
        }
      />

      {/* Modale Formulaire (Création / Modification) */}
      <Modale
        ouverte={action?.type === "formulaire"}
        titre={
          enModification
            ? t("parametres.modules.formulaire.titreModification", {
                libelle: enModification.libelle,
              })
            : t("parametres.modules.formulaire.titreCreation")
        }
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("parametres.modules.formulaire.annuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              type="submit"
              form={ID_FORM_MODULE}
              enCours={enregistrement.isPending}
            >
              {enregistrement.isPending
                ? t("parametres.modules.formulaire.enCours")
                : enModification
                  ? t("parametres.modules.formulaire.confirmerModification")
                  : t("parametres.modules.formulaire.confirmerCreation")}
            </Bouton>
          </>
        }
      >
        <form
          id={ID_FORM_MODULE}
          noValidate
          onSubmit={formulaire.handleSubmit((valeurs) => {
            setErreurAction(null);
            enregistrement.mutate({ id: enModification?.id ?? null, valeurs });
          })}
          className="flex flex-col"
        >
          <p className="mb-4 text-sm text-neutral-600">
            {enModification
              ? t("parametres.modules.formulaire.descriptionModification", {
                  code: enModification.code,
                })
              : t("parametres.modules.formulaire.descriptionCreation")}
          </p>
          <Champ
            libelle={t("parametres.modules.formulaire.libelle")}
            taille="md"
            required
            placeholder={t("parametres.modules.formulaire.libellePlaceholder")}
            erreur={errors.libelle?.message}
            disabled={enregistrement.isPending}
            {...formulaire.register("libelle")}
          />
          <div className="mb-4 flex flex-col gap-1">
            <label className="text-sm font-semibold text-neutral-800" htmlFor={idDescription}>
              {t("parametres.modules.formulaire.description")}
              <span className="ml-0.5 text-erreur" aria-hidden="true">
                *
              </span>
            </label>
            <Textarea
              id={idDescription}
              rows={3}
              required
              aria-required
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={errors.description ? idErreurDescription : undefined}
              placeholder={t("parametres.modules.formulaire.descriptionPlaceholder")}
              disabled={enregistrement.isPending}
              {...formulaire.register("description")}
            />
            {errors.description && (
              <p id={idErreurDescription} className="text-xs font-medium text-erreur">
                {errors.description.message}
              </p>
            )}
          </div>
          <Champ
            libelle={t("parametres.modules.formulaire.ordre")}
            type="number"
            min={0}
            max={999}
            required
            placeholder={t("parametres.modules.formulaire.ordrePlaceholder")}
            erreur={errors.ordre?.message}
            disabled={enregistrement.isPending}
            {...formulaire.register("ordre")}
          />
          <div className="mb-4 flex flex-col gap-1">
            <Champ
              libelle={t("parametres.modules.formulaire.icone")}
              type="text"
              required
              placeholder={t("parametres.modules.formulaire.iconePlaceholder")}
              erreur={errors.icone?.message}
              disabled={enregistrement.isPending}
              {...formulaire.register("icone")}
            />
            <span className="text-xs text-neutral-500">
              {t("parametres.modules.formulaire.iconeAide")}
            </span>
          </div>
          {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
        </form>
      </Modale>

      {/* Modale Permissions rattachées */}
      {action?.type === "permissions" && (
        <Modale
          ouverte={true}
          titre={
            action.etape === "confirmation"
              ? t("parametres.modules.permissionsModal.titreConfirmation")
              : t("parametres.modules.permissionsModal.titre", {
                  libelle: action.module.libelle,
                })
          }
          onFermer={fermer}
          actions={
            action.etape === "confirmation" ? (
              <>
                <Bouton
                  variante="ghost"
                  onClick={() => setAction({ ...action, etape: "selection" })}
                  disabled={rattachement.isPending}
                >
                  {t("parametres.modules.permissionsModal.retour")}
                </Bouton>
                <Bouton
                  variante={diffPerms.retires.length > 0 ? "danger" : "primaire"}
                  onClick={() =>
                    rattachement.mutate({
                      id: action.module.id,
                      codes: action.codesChoisis,
                    })
                  }
                  enCours={rattachement.isPending}
                >
                  {t("parametres.modules.permissionsModal.confirmer")}
                </Bouton>
              </>
            ) : (
              <>
                <Bouton variante="ghost" onClick={fermer}>
                  {t("parametres.modules.permissionsModal.annuler")}
                </Bouton>
                <Bouton
                  variante="primaire"
                  disabled={rienChangePerms || requetePermissions.isPending}
                  onClick={() => setAction({ ...action, etape: "confirmation" })}
                >
                  {t("parametres.modules.permissionsModal.continuer")}
                </Bouton>
              </>
            )
          }
        >
          {action.etape === "selection" ? (
            requetePermissions.isPending ? (
              <EtatChargement />
            ) : rattachables.length === 0 ? (
              <p className="text-sm text-neutral-600">
                {t("parametres.modules.aucunePermissionRattachable", {
                  code: action.module.code,
                })}
              </p>
            ) : (
              <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
                {rattachables.map((perm) => {
                  const code = perm.code.toLowerCase();
                  const coche = action.codesChoisis.includes(code);
                  return (
                    <div key={perm.id} className="flex items-start gap-2 py-1.5 border-b border-neutral-100 last:border-b-0">
                      <Checkbox
                        id={`perm-${perm.id}`}
                        checked={coche}
                        onCheckedChange={(c) => {
                          const nouveaux = c
                            ? [...action.codesChoisis, code]
                            : action.codesChoisis.filter((x) => x !== code);
                          setAction({ ...action, codesChoisis: nouveaux });
                        }}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`perm-${perm.id}`}
                        className="flex flex-col cursor-pointer text-sm"
                      >
                        <span className="font-medium text-neutral-900 flex items-center gap-2">
                          {perm.libelle}
                          {!perm.actif && (
                            <span className="text-xs text-neutral-400">
                              ({t("parametres.modules.permissionInactive")})
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-xs text-neutral-500">{perm.code}</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3">
              {diffPerms.ajoutes.length > 0 && (
                <Alerte type="information">
                  {t("parametres.modules.confirmationAjout", {
                    n: diffPerms.ajoutes.length,
                  })}
                </Alerte>
              )}
              {diffPerms.retires.length > 0 && (
                <Alerte type="avertissement">
                  {t("parametres.modules.confirmationRetrait", {
                    n: diffPerms.retires.length,
                    module: action.module.libelle,
                    codes: diffPerms.retires.join(", "),
                  })}
                </Alerte>
              )}
            </div>
          )}
          {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
        </Modale>
      )}

      {/* Modale Désactivation */}
      <Modale
        ouverte={action?.type === "desactivation"}
        titre={
          action?.type === "desactivation"
            ? t("parametres.modules.desactivation.titre", { libelle: action.module.libelle })
            : ""
        }
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("parametres.modules.desactivation.annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              enCours={desactivation.isPending}
              onClick={() =>
                action?.type === "desactivation" && desactivation.mutate(action.module.id)
              }
            >
              {desactivation.isPending
                ? t("parametres.modules.desactivation.enCours")
                : t("parametres.modules.desactivation.confirmer")}
            </Bouton>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          {t("parametres.modules.desactivation.description")}
        </p>
        {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
      </Modale>

      {/* Modale Réactivation */}
      <Modale
        ouverte={action?.type === "reactivation"}
        titre={
          action?.type === "reactivation"
            ? t("parametres.modules.reactivation.titre", { libelle: action.module.libelle })
            : ""
        }
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("parametres.modules.reactivation.annuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              enCours={reactivation.isPending}
              onClick={() =>
                action?.type === "reactivation" && reactivation.mutate(action.module.id)
              }
            >
              {reactivation.isPending
                ? t("parametres.modules.reactivation.enCours")
                : t("parametres.modules.reactivation.confirmer")}
            </Bouton>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          {t("parametres.modules.reactivation.description")}
        </p>
        {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
      </Modale>
    </>
  );
}
