"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Play, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Alerte, Bouton, Champ, EtatChargement, EtatErreur, Modale } from "@/components/ui";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import {
  CRITERES_COMPTES_VIDES,
  criteresComptesActifs,
  filtrerComptes,
  peutParametrerPlateforme,
  reactivationComptePossible,
  ROLES_ADMINISTRATEUR,
  STATUTS_COMPTE,
  suspensionComptePossible,
  trierComptes,
} from "@/features/administration";
import type { CompteAdministrateur, CriteresComptes } from "@/features/administration";
import {
  creerAdministrateur,
  listerAdministrateurs,
  reactiverAdministrateur,
  suspendreAdministrateur,
} from "@/features/administration/adaptateur";
import { schemaCreationAdministrateur } from "@/features/administration/validations";
import type {
  SaisieCreationAdministrateur,
  ValeursCreationAdministrateur,
} from "@/features/administration/validations";
import { ErreurApi } from "@/lib/api";
import { formaterDate } from "@/lib/format";

import { useAdministrateur } from "../../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../../cles";
import { BADGE, TON_ROLE_ADMINISTRATEUR, TON_STATUT_COMPTE } from "../../tons";

const colonne = aideColonnes<CompteAdministrateur>();

/** Relie le bouton du pied de modale au formulaire — voir `ID_FORM_SUSPENSION`. */
const ID_FORM_CREATION = "form-creation-administrateur";

const VALEURS_CREATION: SaisieCreationAdministrateur = {
  prenom: "",
  nom: "",
  email: "",
  // Un seul rôle à la création : le compte naît administrateur.
  role: "SUPERVISEUR",
};

/** Une seule modale à la fois ; la cible voyage avec l'action qui la concerne. */
type Action =
  | { type: "creation" }
  | { type: "suspension"; compte: CompteAdministrateur }
  | { type: "reactivation"; compte: CompteAdministrateur }
  | null;

/**
 * Les comptes des agents de la plateforme.
 *
 * **Suspendre, jamais supprimer** : un compte supprimé effacerait l'auteur des
 * suspensions et changements de plan qu'il a faits, au journal. La liste garde
 * donc les suspendus, triés après les actifs.
 *
 * La ligne de l'agent connecté porte « Vous » et n'offre pas la suspension
 * (`suspensionComptePossible`) : le serveur la refuserait, et un superviseur
 * seul qui se suspendrait n'aurait plus personne pour le réactiver.
 *
 * Le rôle `SUPPORT` voit la liste et l'exporte ; les boutons d'action sont
 * désactivés, pas masqués — il doit comprendre que la fonction existe.
 */
export function ListeComptes() {
  const t = useTranslations("administration");
  const profil = useAdministrateur();
  const cache = useQueryClient();
  const peutAgir = peutParametrerPlateforme(profil);

  const [criteres, setCriteres] = useState<CriteresComptes>(CRITERES_COMPTES_VIDES);
  const [action, setAction] = useState<Action>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.comptes(),
    queryFn: ({ signal }) => listerAdministrateurs(signal),
  });

  const tous = useMemo(() => requete.data ?? [], [requete.data]);
  const comptes = useMemo(() => trierComptes(filtrerComptes(tous, criteres)), [tous, criteres]);

  const formulaire = useForm<SaisieCreationAdministrateur, unknown, ValeursCreationAdministrateur>({
    resolver: zodResolver(schemaCreationAdministrateur),
    defaultValues: VALEURS_CREATION,
  });

  function fermer() {
    setAction(null);
    setErreurAction(null);
    formulaire.reset(VALEURS_CREATION);
  }

  /** Remplace la ligne modifiée dans le cache, sans relire toute la liste. */
  function remplacer(compte: CompteAdministrateur) {
    cache.setQueryData<CompteAdministrateur[]>(CLES_ADMINISTRATION.comptes(), (liste) =>
      liste?.some((c) => c.id === compte.id)
        ? liste.map((c) => (c.id === compte.id ? compte : c))
        : [...(liste ?? []), compte],
    );
  }

  function surEchec(cause: unknown) {
    setErreurAction(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
  }

  const creation = useMutation({
    mutationFn: (valeurs: ValeursCreationAdministrateur) => creerAdministrateur(valeurs),
    onSuccess: (compte) => {
      remplacer(compte);
      setAnnonce(t("parametres.comptes.creation.succes", { nom: compte.nomComplet }));
      fermer();
    },
    onError: (cause) => {
      const champEmail = cause instanceof ErreurApi ? cause.erreursParChamp.email : undefined;
      if (champEmail) {
        formulaire.setError("email", { message: champEmail });
        return;
      }
      surEchec(cause);
    },
  });

  const suspension = useMutation({
    mutationFn: (id: string) => suspendreAdministrateur(id),
    onSuccess: (compte) => {
      remplacer(compte);
      fermer();
    },
    onError: surEchec,
  });

  const reactivation = useMutation({
    mutationFn: (id: string) => reactiverAdministrateur(id),
    onSuccess: (compte) => {
      remplacer(compte);
      fermer();
    },
    onError: surEchec,
  });

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("nomComplet", {
          id: "agent",
          header: t("parametres.comptes.colonneAgent"),
          cell: ({ row }) => (
            <span className="flex flex-col">
              <span className="flex items-center gap-2 font-semibold text-neutral-900">
                {row.original.nomComplet}
                {row.original.id === profil?.id && (
                  <span className={`${BADGE} border border-primary-200 bg-primary-50 text-primary-700`}>
                    {t("parametres.comptes.vous")}
                  </span>
                )}
              </span>
              <span className="text-xs text-neutral-600">{row.original.email}</span>
            </span>
          ),
        }),
        colonne.accessor("role", {
          header: t("parametres.comptes.colonneRole"),
          cell: ({ getValue }) => (
            <span className={`${BADGE} ${TON_ROLE_ADMINISTRATEUR[getValue()]}`}>
              {t(`role.${getValue()}`)}
            </span>
          ),
        }),
        colonne.accessor("statut", {
          header: t("parametres.comptes.colonneStatut"),
          cell: ({ getValue }) => (
            <span className={`${BADGE} ${TON_STATUT_COMPTE[getValue()]}`}>
              {t(`parametres.comptes.statut.${getValue()}`)}
            </span>
          ),
        }),
        colonne.accessor("derniereConnexion", {
          header: t("parametres.comptes.colonneDerniereConnexion"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => {
            const date = getValue();
            return date ? (
              formaterDate(date)
            ) : (
              <span className="text-neutral-400">{t("parametres.comptes.jamaisConnecte")}</span>
            );
          },
        }),
        colonne.accessor("creeLe", {
          header: t("parametres.comptes.colonneCreeLe"),
          meta: { classe: "text-neutral-700" },
          cell: ({ getValue }) => formaterDate(getValue()),
        }),
        colonne.display({
          id: "actions",
          header: () => <span className="sr-only">{t("parametres.comptes.colonneActions")}</span>,
          meta: { classe: `${BORD_DROIT_TABLEAU} text-right` },
          cell: ({ row }) => {
            const compte = row.original;
            if (suspensionComptePossible(compte, profil)) {
              return (
                <Bouton
                  variante="ghost"
                  taille="sm"
                  disabled={!peutAgir}
                  className="text-erreur hover:bg-erreur-fond hover:text-erreur"
                  iconeGauche={<Ban size={16} aria-hidden="true" />}
                  onClick={() => {
                    setErreurAction(null);
                    setAction({ type: "suspension", compte });
                  }}
                >
                  {t("parametres.comptes.suspendre")}
                </Bouton>
              );
            }
            if (reactivationComptePossible(compte)) {
              return (
                <Bouton
                  variante="ghost"
                  taille="sm"
                  disabled={!peutAgir}
                  iconeGauche={<Play size={16} aria-hidden="true" />}
                  onClick={() => {
                    setErreurAction(null);
                    setAction({ type: "reactivation", compte });
                  }}
                >
                  {t("parametres.comptes.reactiver")}
                </Bouton>
              );
            }
            return null;
          },
        }),
      ]),
    [t, profil, peutAgir],
  );

  const exporter = useMemo<ExportTableau<CompteAdministrateur>>(
    () => ({
      titre: t("parametres.comptes.export.titre"),
      nomFichier: t("parametres.comptes.export.nomFichier"),
      colonnes: [
        { entete: t("parametres.comptes.export.prenom"), valeur: (c) => c.prenom },
        { entete: t("parametres.comptes.export.nom"), valeur: (c) => c.nom },
        { entete: t("parametres.comptes.export.email"), valeur: (c) => c.email },
        { entete: t("parametres.comptes.colonneTelephone"), valeur: (c) => c.telephone || null },
        { entete: t("parametres.comptes.colonneRole"), valeur: (c) => t(`role.${c.role}`) },
        { entete: t("parametres.comptes.colonneStatut"), valeur: (c) => t(`parametres.comptes.statut.${c.statut}`) },
        {
          entete: t("parametres.comptes.colonneDerniereConnexion"),
          valeur: (c) => (c.derniereConnexion ? formaterDate(c.derniereConnexion) : null),
        },
        { entete: t("parametres.comptes.colonneCreeLe"), valeur: (c) => formaterDate(c.creeLe) },
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

  return (
    <>
      {annonce && <Alerte type="succes">{annonce}</Alerte>}

      <TableauListe
        colonnes={colonnes}
        donnees={comptes}
        cleLigne={(compte) => compte.id}
        messageVide={t("parametres.comptes.aucun")}
        filtresActifs={criteresComptesActifs(criteres)}
        onReinitialiser={() => setCriteres(CRITERES_COMPTES_VIDES)}
        cleCriteres={`${criteres.recherche}|${criteres.role}|${criteres.statut}`}
        exporter={exporter}
        actions={
          <Bouton
            variante="primaire"
            taille="sm"
            disabled={!peutAgir}
            iconeGauche={<UserPlus size={16} aria-hidden="true" />}
            onClick={() => {
              setErreurAction(null);
              setAction({ type: "creation" });
            }}
          >
            {t("parametres.comptes.ajouter")}
          </Bouton>
        }
        outils={
          <>
            <RechercheTableau
              valeur={criteres.recherche}
              onChangement={(recherche) => setCriteres({ ...criteres, recherche })}
              libelle={t("parametres.comptes.recherche")}
              placeholder={t("parametres.comptes.recherchePlaceholder")}
            />
            <FiltreTableau
              valeur={criteres.role}
              onChangement={(role) => setCriteres({ ...criteres, role })}
              libelle={t("parametres.comptes.filtreRole")}
              libelleTous={t("parametres.comptes.filtreRoleTous")}
              options={ROLES_ADMINISTRATEUR.map((role) => ({
                valeur: role,
                libelle: t(`role.${role}`),
              }))}
            />
            <FiltreTableau
              valeur={criteres.statut}
              onChangement={(statut) => setCriteres({ ...criteres, statut })}
              libelle={t("parametres.comptes.filtreStatut")}
              libelleTous={t("parametres.comptes.filtreStatutTous")}
              options={STATUTS_COMPTE.map((statut) => ({
                valeur: statut,
                libelle: t(`parametres.comptes.statut.${statut}`),
              }))}
            />
          </>
        }
      />

      <Modale
        ouverte={action?.type === "creation"}
        titre={t("parametres.comptes.creation.titre")}
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("parametres.comptes.creation.annuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              type="submit"
              form={ID_FORM_CREATION}
              enCours={creation.isPending}
            >
              {creation.isPending ? t("parametres.comptes.creation.enCours") : t("parametres.comptes.creation.confirmer")}
            </Bouton>
          </>
        }
      >
        <form
          id={ID_FORM_CREATION}
          noValidate
          onSubmit={formulaire.handleSubmit((valeurs) => {
            setErreurAction(null);
            creation.mutate(valeurs);
          })}
          className="flex flex-col"
        >
          <p className="mb-4 text-sm text-neutral-600">{t("parametres.comptes.creation.description")}</p>
          <Champ
            libelle={t("parametres.comptes.creation.prenom")}
            taille="md"
            required
            erreur={errors.prenom?.message}
            disabled={creation.isPending}
            {...formulaire.register("prenom")}
          />
          <Champ
            libelle={t("parametres.comptes.creation.nom")}
            taille="md"
            required
            erreur={errors.nom?.message}
            disabled={creation.isPending}
            {...formulaire.register("nom")}
          />
          <Champ
            libelle={t("parametres.comptes.creation.email")}
            type="email"
            taille="md"
            required
            placeholder={t("parametres.comptes.creation.emailPlaceholder")}
            erreur={errors.email?.message}
            disabled={creation.isPending}
            {...formulaire.register("email")}
          />
          {erreurAction && (
            <div className="mt-3">
              <Alerte type="erreur">{erreurAction}</Alerte>
            </div>
          )}
        </form>
      </Modale>

      <Modale
        ouverte={action?.type === "suspension"}
        titre={
          action?.type === "suspension"
            ? t("parametres.comptes.suspension.titre", { nom: action.compte.nomComplet })
            : ""
        }
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("parametres.comptes.suspension.annuler")}
            </Bouton>
            <Bouton
              variante="danger"
              enCours={suspension.isPending}
              onClick={() => action?.type === "suspension" && suspension.mutate(action.compte.id)}
            >
              {suspension.isPending ? t("parametres.comptes.suspension.enCours") : t("parametres.comptes.suspension.confirmer")}
            </Bouton>
          </>
        }
      >
        <p className="text-sm text-neutral-600">{t("parametres.comptes.suspension.description")}</p>
        {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
      </Modale>

      <Modale
        ouverte={action?.type === "reactivation"}
        titre={
          action?.type === "reactivation"
            ? t("parametres.comptes.reactivation.titre", { nom: action.compte.nomComplet })
            : ""
        }
        onFermer={fermer}
        actions={
          <>
            <Bouton variante="ghost" onClick={fermer}>
              {t("parametres.comptes.reactivation.annuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              enCours={reactivation.isPending}
              onClick={() =>
                action?.type === "reactivation" && reactivation.mutate(action.compte.id)
              }
            >
              {reactivation.isPending ? t("parametres.comptes.reactivation.enCours") : t("parametres.comptes.reactivation.confirmer")}
            </Bouton>
          </>
        }
      >
        <p className="text-sm text-neutral-600">{t("parametres.comptes.reactivation.description")}</p>
        {erreurAction && <Alerte type="erreur">{erreurAction}</Alerte>}
      </Modale>
    </>
  );
}
