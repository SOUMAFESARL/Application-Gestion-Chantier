"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Pencil, Play, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alerte, Bouton, Champ, EtatChargement, EtatErreur, Modale } from "@/components/ui";
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
  filtrerModules,
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
  modifierModule,
  reactiverModule,
} from "@/features/administration/adaptateur";
import { schemaModule } from "@/features/administration/validations";
import type { SaisieModule, ValeursModule } from "@/features/administration/validations";
import { SelecteurAcces } from "@/features/roles/components/SelecteurAcces";
import { ErreurApi } from "@/lib/api";
import { formaterDate } from "@/lib/format";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";
import { BADGE, TON_STATUT_MODULE } from "../../tons";

const colonne = aideColonnes<ModulePlateforme>();

/** Relie le bouton du pied de modale au formulaire, rendu dans le corps. */
const ID_FORM_MODULE = "form-module-plateforme";

/** La liste des accès s'ouvre hors de la modale (`z-100`) : elle doit passer devant. */
const LISTE_AU_DESSUS_DE_LA_MODALE = "z-110";

/**
 * « Aucun » par défaut : un nouveau module arrive fermé dans les entreprises,
 * et c'est l'agent qui choisit de l'ouvrir — jamais un repli silencieux.
 */
const VALEURS_VIDES: SaisieModule = { libelle: "", description: "", accesParDefaut: [] };

/**
 * Une seule modale à la fois ; la cible voyage avec l'action qui la concerne.
 * `formulaire` sans module est une création, avec un module une modification :
 * mêmes champs, même validation, seul le verbe change.
 */
type Action =
  | { type: "formulaire"; module: ModulePlateforme | null }
  | { type: "desactivation"; module: ModulePlateforme }
  | { type: "reactivation"; module: ModulePlateforme }
  | null;

/**
 * Le catalogue des modules du produit.
 *
 * **Le catalogue, pas les droits.** On y décrit ce que le produit contient —
 * un libellé, une description. Ce qu'un utilisateur peut faire dans un module
 * (lecture, saisie, validation) se décide dans chaque entreprise, par ses
 * rôles. L'accès par défaut n'est que leur **point de départ** : le serveur
 * le pose sur les rôles non système quand le module arrive, puis chaque
 * entreprise le change. Il se saisit donc avec le sélecteur des rôles
 * (`SelecteurAcces`), dans le même vocabulaire.
 *
 * **Désactiver, jamais supprimer** (`desactivationModulePossible`) : les rôles
 * des entreprises référencent le module par son code, qu'une suppression
 * laisserait orphelin.
 *
 * Le rôle `SUPPORT` consulte et exporte ; les actions sont désactivées, pas
 * masquées — comme sur la page des comptes.
 */
export function ListeModules() {
  const t = useTranslations("administration");
  const tRoles = useTranslations("roles");
  const profil = useAdministrateur();
  const cache = useQueryClient();
  const peutAgir = peutParametrerPlateforme(profil);
  const idDescription = useId();
  const idAccesParDefaut = useId();

  const [criteres, setCriteres] = useState<CriteresModules>(CRITERES_MODULES_VIDES);
  const [action, setAction] = useState<Action>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.modules(),
    queryFn: ({ signal }) => listerModules(signal),
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
            accesParDefaut: cible.accesParDefaut,
          }
        : VALEURS_VIDES,
    );
    setAction({ type: "formulaire", module: cible });
  }

  function fermer() {
    setAction(null);
    setErreurAction(null);
    formulaire.reset(VALEURS_VIDES);
  }

  /** Remplace la ligne modifiée dans le cache, sans relire toute la liste. */
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
        colonne.accessor("libelle", {
          header: t("parametres.modules.colonneModule"),
          cell: ({ row }) => (
            <span className="flex flex-col">
              <span className="font-semibold text-neutral-900">{row.original.libelle}</span>
              <code className="text-xs text-neutral-600">{row.original.code}</code>
            </span>
          ),
        }),
        colonne.accessor("description", {
          header: t("parametres.modules.colonneDescription"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => <span className="line-clamp-2">{getValue()}</span>,
        }),
        colonne.accessor("accesParDefaut", {
          header: t("parametres.modules.colonneAccesParDefaut"),
          cell: ({ getValue }) => <SelecteurAcces valeur={getValue()} variante="champ" />,
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
    // `ouvrirFormulaire` ne lit que des références stables (`formulaire`, setters).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, peutAgir],
  );

  const exporter = useMemo<ExportTableau<ModulePlateforme>>(
    () => ({
      titre: t("parametres.modules.export.titre"),
      nomFichier: t("parametres.modules.export.nomFichier"),
      colonnes: [
        { entete: t("parametres.modules.colonneModule"), valeur: (m) => m.libelle },
        { entete: t("parametres.modules.colonneCode"), valeur: (m) => m.code },
        { entete: t("parametres.modules.colonneDescription"), valeur: (m) => m.description },
        {
          entete: t("parametres.modules.colonneAccesParDefaut"),
          valeur: (m) =>
            m.accesParDefaut.length === 0
              ? tRoles("acces.aucun")
              : m.accesParDefaut.map((a) => tRoles(`acces.${a}`)).join(", "),
        },
        {
          entete: t("parametres.modules.colonneStatut"),
          valeur: (m) => t(`parametres.modules.statut.${m.statut}`),
        },
        { entete: t("parametres.modules.colonneCreeLe"), valeur: (m) => formaterDate(m.creeLe) },
      ],
    }),
    [t, tRoles],
  );

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) {
    return (
      <EtatErreur message={t("erreurs.chargement")} onReessayer={() => void requete.refetch()} />
    );
  }

  const { errors } = formulaire.formState;
  const idErreurDescription = `${idDescription}-erreur`;

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
          {/* `Champ` ne rend qu'un `input` : même libellé, même erreur sous le
              champ, reliée par `aria-describedby`. */}
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
          <div className="mb-4 flex flex-col gap-1">
            <span id={idAccesParDefaut} className="text-sm font-semibold text-neutral-800">
              {t("parametres.modules.formulaire.accesParDefaut")}
            </span>
            <Controller
              control={formulaire.control}
              name="accesParDefaut"
              render={({ field }) => (
                <SelecteurAcces
                  valeur={field.value}
                  onChange={field.onChange}
                  variante="champ"
                  libelleAria={t("parametres.modules.formulaire.accesParDefaut")}
                  disabled={enregistrement.isPending}
                  classeListe={LISTE_AU_DESSUS_DE_LA_MODALE}
                />
              )}
            />
          </div>
          {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
        </form>
      </Modale>

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
