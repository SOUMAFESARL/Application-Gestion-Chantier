"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Eye, EyeOff, KeyRound, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { ChampsMotDePasse } from "@/components/metier/ChampsMotDePasse";
import {
  Alerte,
  Badge,
  Bouton,
  Champ,
  EtatChargement,
  EtatErreur,
} from "@/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ZonePreRemplie } from "@/components/ui/form";
import { paysEntreprise } from "@/features/configuration/api";
import {
  FORMATS_AVATAR,
  changerMotDePasseMoi,
  initialesProfil,
  modifierProfilMoi,
  nomAffiche,
  obtenirProfilMoi,
  refusAvatar,
  supprimerAvatar,
  televerserAvatar,
} from "@/features/auth";
import type { ProfilUtilisateur } from "@/features/auth";
import { schemaChangementMotDePasse, schemaProfil } from "@/features/auth/validations";
import type { SaisieProfil, ValeursProfil } from "@/features/auth/validations";
import { useReglesMotDePasse } from "@/features/auth/reglesMotDePasse";
import { PAYS_TELEPHONE_DEFAUT } from "@/features/referentiels/telephone";
import { CLE_MODULES_ENTREPRISE, listerModulesEntreprise } from "@/features/roles";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterDate, formaterDateHeure } from "@/lib/format";

/** La clé du profil dans le cache — l'écran et ses gestes la partagent. */
const CLE_PROFIL = ["auth", "profil"] as const;

const ACCEPT_AVATAR = FORMATS_AVATAR.join(",");

const CARTE = "rounded-lg border border-neutral-200 bg-neutral-0 p-5 shadow-md";
const LIGNE_DEFINITION =
  "flex items-baseline justify-between gap-4 py-1.5 text-sm";
const LIGNE_LIBELLE = "shrink-0 text-neutral-600";
const LIGNE_VALEUR = "min-w-0 truncate text-right font-medium text-neutral-900";
const PASTILLE_ICONE =
  "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600";

/** Le message d'une erreur, sans jamais laisser passer un `undefined`. */
function messageDe(cause: unknown, repli: string): string {
  return cause instanceof ErreurApi ? cause.message : repli;
}

function valeursDe(profil: ProfilUtilisateur): SaisieProfil {
  return {
    prenom: profil.prenom,
    nom: profil.nom,
    telephone: profil.telephone ?? "",
  };
}

/**
 * Le profil de l'utilisateur connecté, espace entreprise — `/auth/profil/`.
 *
 * Quatre blocs : la photo, les informations personnelles, le compte et la
 * lecture de ses droits. Chacun s'enregistre seul — changer sa photo ne soumet pas un
 * formulaire à moitié rempli.
 *
 * **Ni l'adresse ni le rôle ne se modifient ici.** L'adresse est l'identifiant
 * de connexion ; le rôle et les habilitations se donnent depuis la gestion des
 * collaborateurs — on ne s'accorde pas de droits soi-même.
 */
export function EcranProfil() {
  const t = useTranslations("profil");
  const requete = useQuery({
    queryKey: CLE_PROFIL,
    queryFn: obtenirProfilMoi,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Collant sur grand écran, sous la barre du haut (`h-16`). Il déborde
          sur la gouttière de `<main>` (`p-6`) pour que les cartes passent
          dessous plutôt que de se montrer entre lui et la barre. */}
      <EnTetePage
        className="bg-background lg:sticky lg:top-16 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6 lg:pb-4"
        titre={<span className="text-primary-600">{t("titre")}</span>}
        description={t("sousTitre")}
      />

      {requete.isPending ? (
        <EtatChargement message={t("chargement")} />
      ) : requete.isError ? (
        <EtatErreur
          message={t("erreurChargement")}
          onReessayer={() => requete.refetch()}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
          <BlocPhoto profil={requete.data} />
          <div className="flex flex-col gap-4">
            <BlocInformations profil={requete.data} />
            <BlocCompte profil={requete.data} />
            <BlocMotDePasse />
            <BlocHabilitations />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * La carte de gauche : la photo. Collante sur grand écran, sous l'en-tête de
 * page lui-même collant (`top-16` + 104 px d'en-tête + 16 px d'écart = `top-46`),
 * elle reste en vue pendant qu'on parcourt les autres blocs.
 *
 * La photo part **dès qu'elle est choisie** : il n'y a rien d'autre à saisir
 * avec elle, et un bouton « Enregistrer » de plus ne servirait qu'à être oublié.
 */
function BlocPhoto({ profil }: { profil: ProfilUtilisateur }) {
  const t = useTranslations("profil");
  const cache = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);

  const envoi = useMutation({
    mutationFn: (fichier: File | null) =>
      fichier ? televerserAvatar(fichier) : supprimerAvatar(),
    onSuccess: (nouveau) => {
      cache.setQueryData(CLE_PROFIL, nouveau);
      setErreur(null);
      toast.success(
        nouveau.avatar_url ? t("photo.succes") : t("photo.retiree"),
      );
    },
    onError: (cause) => {
      setErreur(messageDe(cause, t("erreurAction")));
    },
  });

  function choisirPhoto(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    // Vidé tout de suite : choisir deux fois le même fichier doit redéclencher `change`.
    evenement.target.value = "";
    if (!fichier) return;

    const refus = refusAvatar(fichier);
    if (refus) {
      setErreur(
        refus === "FORMAT" ? t("photo.formatInvalide") : t("photo.tropLourde"),
      );
      return;
    }
    envoi.mutate(fichier);
  }

  return (
    <section
      className={`${CARTE} flex flex-col gap-5 overflow-hidden p-0 pb-5 lg:sticky lg:top-46`}
    >
      {/* Le bandeau ne porte rien : il donne sa couleur à la carte et un fond à la photo. */}
      <div
        aria-hidden="true"
        className="h-24 bg-linear-to-br from-secondary-800 via-secondary-700 to-primary-700"
      />
      <div className="-mt-17 flex flex-col items-center gap-3 px-5 text-center">
        <Avatar className="size-24 rounded-full shadow-md ring-4 ring-neutral-0">
          {profil.avatar_url && (
            <AvatarImage
              src={profil.avatar_url}
              alt=""
              className="rounded-full object-cover"
            />
          )}
          <AvatarFallback className="rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-2xl font-semibold text-neutral-0">
            {initialesProfil(profil)}
          </AvatarFallback>
        </Avatar>
        <div className="flex max-w-full min-w-0 flex-col gap-0.5">
          <span className="truncate text-base font-semibold text-neutral-900">
            {nomAffiche(profil)}
          </span>
          <span className="truncate text-sm text-neutral-600">
            {profil.email}
          </span>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <label
            className={
              envoi.isPending
                ? "inline-flex cursor-wait items-center gap-2 rounded-md border border-primary-100 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-300"
                : "inline-flex cursor-pointer items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-100 focus-within:ring-2 focus-within:ring-primary-500/40"
            }
          >
            <input
              type="file"
              accept={ACCEPT_AVATAR}
              className="sr-only"
              disabled={envoi.isPending}
              onChange={choisirPhoto}
            />
            <Camera size={16} aria-hidden="true" />
            {envoi.isPending
              ? t("photo.enCours")
              : profil.avatar_url
                ? t("photo.changer")
                : t("photo.ajouter")}
          </label>
          {profil.avatar_url && (
            <Bouton
              variante="ghost"
              taille="sm"
              disabled={envoi.isPending}
              className="text-erreur hover:bg-erreur-fond hover:text-erreur"
              iconeGauche={<Trash2 size={16} aria-hidden="true" />}
              onClick={() => envoi.mutate(null)}
            >
              {t("photo.retirer")}
            </Bouton>
          )}
        </div>
        <span className="text-xs text-neutral-500">
          {t("photo.contrainte")}
        </span>
        {erreur && <p className="text-sm text-erreur">{erreur}</p>}
      </div>
    </section>
  );
}

/**
 * Prénom, nom, téléphone — l'adresse est montrée, pas modifiable.
 *
 * La réponse du `PATCH` remplace le profil dans le cache et est annoncée à la
 * coquille : le nom de la barre latérale change dans la seconde.
 */
function BlocInformations({ profil }: { profil: ProfilUtilisateur }) {
  const t = useTranslations("profil");
  const cache = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);
  const [pays, setPays] = useState("");

  useEffect(() => {
    let vivant = true;
    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const resolver = useMemo(
    () => zodResolver(schemaProfil(pays || PAYS_TELEPHONE_DEFAUT)),
    [pays],
  );

  const formulaire = useForm<SaisieProfil, unknown, ValeursProfil>({
    resolver,
    defaultValues: valeursDe(profil),
  });
  const { reset, setError } = formulaire;

  // Resynchronisé quand le profil change ailleurs (enregistrement, photo).
  useEffect(() => {
    reset(valeursDe(profil));
  }, [profil, reset]);

  const enregistrement = useMutation({
    mutationFn: (valeurs: ValeursProfil) => modifierProfilMoi(valeurs),
    onSuccess: (nouveau) => {
      cache.setQueryData(CLE_PROFIL, nouveau);
      setErreur(null);
      toast.success(t("succes"));
    },
    onError: (cause) => {
      const parChamp = cause instanceof ErreurApi ? cause.erreursParChamp : {};
      const champs = (["prenom", "nom", "telephone"] as const).filter(
        (champ) => parChamp[champ],
      );
      if (champs.length > 0) {
        for (const champ of champs)
          setError(champ, { message: parChamp[champ] });
        return;
      }
      setErreur(messageDe(cause, t("erreurAction")));
    },
  });

  const { errors, isDirty } = formulaire.formState;

  return (
    <section className={CARTE}>
      <div className="mb-5 flex items-start gap-3 border-b border-neutral-100 pb-4">
        <span className={PASTILLE_ICONE}>
          <UserRound size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="mb-0.5 text-sm font-semibold text-neutral-900">
            {t("sectionIdentite")}
          </h2>
          <p className="text-sm text-neutral-600">{t("sectionIdentiteAide")}</p>
        </div>
      </div>

      <form
        noValidate
        onSubmit={formulaire.handleSubmit((valeurs) => {
          setErreur(null);
          enregistrement.mutate(valeurs);
        })}
      >
        <div className="grid gap-x-4 sm:grid-cols-2">
          <ZonePreRemplie control={formulaire.control} nom="prenom">
            <Champ
              libelle={t("prenom")}
              required
              autoComplete="given-name"
              erreur={errors.prenom?.message}
              disabled={enregistrement.isPending}
              {...formulaire.register("prenom")}
            />
          </ZonePreRemplie>
          <ZonePreRemplie control={formulaire.control} nom="nom">
            <Champ
              libelle={t("nom")}
              required
              autoComplete="family-name"
              erreur={errors.nom?.message}
              disabled={enregistrement.isPending}
              {...formulaire.register("nom")}
            />
          </ZonePreRemplie>
          <Champ
            libelle={t("email")}
            type="email"
            value={profil.email}
            readOnly
            disabled
            aide={t("emailAide")}
          />
          <ZonePreRemplie control={formulaire.control} nom="telephone">
            <Controller
              control={formulaire.control}
              name="telephone"
              render={({ field, fieldState }) => (
                <ChampTelephone
                  libelle={t("telephone")}
                  paysDefaut={pays || PAYS_TELEPHONE_DEFAUT}
                  international
                  valeur={field.value}
                  onChange={field.onChange}
                  erreur={fieldState.error?.message}
                  disabled={enregistrement.isPending}
                />
              )}
            />
          </ZonePreRemplie>
        </div>

        {erreur && <Alerte type="erreur">{erreur}</Alerte>}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Bouton
            variante="ghost"
            disabled={!isDirty || enregistrement.isPending}
            onClick={() => reset(valeursDe(profil))}
          >
            {t("annuler")}
          </Bouton>
          <Bouton
            type="submit"
            variante="primaire"
            disabled={!isDirty}
            enCours={enregistrement.isPending}
          >
            {enregistrement.isPending ? t("enCours") : t("enregistrer")}
          </Bouton>
        </div>
      </form>
    </section>
  );
}

/**
 * Ce qui ne se modifie pas ici : rôle, entreprise, statut, sécurité et dates.
 */
function BlocCompte({ profil }: { profil: ProfilUtilisateur }) {
  const t = useTranslations("profil");
  const tNavigation = useTranslations("tableauDeBord.navigation");

  const role = profil.is_dg
    ? tNavigation("roleDirecteurGeneral")
    : profil.role_libelle || profil.role_global || ABSENT;
  const statut = !profil.statut
    ? ABSENT
    : t.has(`statuts.${profil.statut}`)
      ? t(`statuts.${profil.statut}`)
      : profil.statut;

  return (
    <section className={CARTE}>
      <div className="mb-4 flex items-start gap-3 border-b border-neutral-100 pb-4">
        <span className={PASTILLE_ICONE}>
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="mb-0.5 text-sm font-semibold text-neutral-900">
            {t("sectionCompte")}
          </h2>
          <p className="text-sm text-neutral-600">{t("roleAide")}</p>
        </div>
      </div>

      <dl className="grid gap-x-8 sm:grid-cols-2">
        <div className={`${LIGNE_DEFINITION} border-b border-neutral-100`}>
          <dt className={LIGNE_LIBELLE}>{t("role")}</dt>
          <dd className={LIGNE_VALEUR}>{role}</dd>
        </div>
        <div className={`${LIGNE_DEFINITION} border-b border-neutral-100`}>
          <dt className={LIGNE_LIBELLE}>{t("entreprise")}</dt>
          <dd
            className={LIGNE_VALEUR}
            title={profil.entreprise?.raison_sociale}
          >
            {profil.entreprise?.raison_sociale || ABSENT}
          </dd>
        </div>
        <div className={`${LIGNE_DEFINITION} border-b border-neutral-100`}>
          <dt className={LIGNE_LIBELLE}>{t("statut")}</dt>
          <dd className={LIGNE_VALEUR}>{statut}</dd>
        </div>
        <div className={`${LIGNE_DEFINITION} border-b border-neutral-100`}>
          <dt className={LIGNE_LIBELLE}>{t("doubleAuthentification")}</dt>
          <dd className={LIGNE_VALEUR}>
            {profil.double_authentification_active
              ? t("active")
              : t("inactive")}
          </dd>
        </div>
        <div className={`${LIGNE_DEFINITION} border-b border-neutral-100`}>
          <dt className={LIGNE_LIBELLE}>{t("derniereConnexion")}</dt>
          <dd className={LIGNE_VALEUR}>
            {formaterDateHeure(profil.derniere_connexion) || ABSENT}
          </dd>
        </div>
        <div className={`${LIGNE_DEFINITION} border-b border-neutral-100`}>
          <dt className={LIGNE_LIBELLE}>{t("membreDepuis")}</dt>
          <dd className={LIGNE_VALEUR}>
            {formaterDate(profil.cree_le) || ABSENT}
          </dd>
        </div>
      </dl>
    </section>
  );
}

type ErreursMotDePasse = Partial<Record<"actuel" | "nouveau", string>>;

/**
 * Le changement de mot de passe de l'utilisateur connecté.
 *
 * Mêmes règles et ergonomie que dans le back-office : double saisie, barre de
 * robustesse connectée au référentiel serveur, et mise à jour immédiate des jetons
 * pour éviter la déconnexion sur le poste actif.
 */
function BlocMotDePasse() {
  const t = useTranslations("profil");
  const tMotDePasse = useTranslations("motDePasse");
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [actuelVisible, setActuelVisible] = useState(false);
  const [erreurs, setErreurs] = useState<ErreursMotDePasse>({});
  const [erreur, setErreur] = useState<string | null>(null);

  const { regles, complet } = useReglesMotDePasse(nouveau, confirmation);

  const changement = useMutation({
    mutationFn: () => changerMotDePasseMoi({ actuel, nouveau }),
    onSuccess: () => {
      setActuel("");
      setNouveau("");
      setConfirmation("");
      setErreurs({});
      setErreur(null);
      toast.success(t("motDePasse.succes"));
    },
    onError: (cause) => {
      if (cause instanceof ErreurApi) {
        if (cause.code === "ancien_mot_de_passe_incorrect") {
          setErreurs({ actuel: cause.message || t("motDePasse.ancienIncorrect") });
          return;
        }
        if (cause.code === "mot_de_passe_identique") {
          setErreurs({ nouveau: cause.message || t("motDePasse.identique") });
          return;
        }
        const parChamp = cause.erreursParChamp;
        if (
          parChamp &&
          (parChamp.actuel ||
            parChamp.nouveau ||
            parChamp.ancien_mot_de_passe ||
            parChamp.nouveau_mot_de_passe)
        ) {
          setErreurs({
            actuel: parChamp.actuel || parChamp.ancien_mot_de_passe,
            nouveau: parChamp.nouveau || parChamp.nouveau_mot_de_passe,
          });
          return;
        }
        if (cause.details && typeof cause.details === "object") {
          const det = cause.details as Record<string, unknown>;
          if (det.nouveau_mot_de_passe) {
            const msg = Array.isArray(det.nouveau_mot_de_passe)
              ? String(det.nouveau_mot_de_passe[0])
              : String(det.nouveau_mot_de_passe);
            setErreurs({ nouveau: msg });
            return;
          }
          if (det.ancien_mot_de_passe) {
            const msg = Array.isArray(det.ancien_mot_de_passe)
              ? String(det.ancien_mot_de_passe[0])
              : String(det.ancien_mot_de_passe);
            setErreurs({ actuel: msg });
            return;
          }
        }
      }
      setErreur(messageDe(cause, t("motDePasse.erreur")));
    },
  });

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);

    const verification = schemaChangementMotDePasse.safeParse({ actuel, nouveau });
    if (!verification.success) {
      const trouvees: ErreursMotDePasse = {};
      for (const probleme of verification.error.issues) {
        const champ = probleme.path[0];
        if ((champ === "actuel" || champ === "nouveau") && !trouvees[champ]) {
          trouvees[champ] = probleme.message;
        }
      }
      setErreurs(trouvees);
      return;
    }

    setErreurs({});
    changement.mutate();
  }

  return (
    <section className={CARTE}>
      <div className="mb-4 flex items-start gap-3 border-b border-neutral-100 pb-4">
        <span className={PASTILLE_ICONE}>
          <KeyRound size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="mb-0.5 text-sm font-semibold text-neutral-900">
            {t("motDePasse.titre")}
          </h2>
          <p className="text-sm text-neutral-600">{t("motDePasse.aide")}</p>
        </div>
      </div>

      <form noValidate onSubmit={soumettre} className="flex flex-col" data-sans-sauvegarde>
        <Champ
          libelle={t("motDePasse.actuel")}
          type={actuelVisible ? "text" : "password"}
          autoComplete="current-password"
          required
          value={actuel}
          onChange={(evenement) => {
            setActuel(evenement.target.value);
            if (erreurs.actuel) setErreurs({ ...erreurs, actuel: undefined });
          }}
          disabled={changement.isPending}
          erreur={erreurs.actuel}
          actionDroite={
            <button
              type="button"
              className="flex cursor-pointer items-center border-0 bg-transparent p-1 text-neutral-500 hover:text-neutral-800"
              aria-label={actuelVisible ? tMotDePasse("masquer") : tMotDePasse("afficher")}
              onClick={() => setActuelVisible((visible) => !visible)}
            >
              {actuelVisible ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          }
        />

        <ChampsMotDePasse
          motDePasse={nouveau}
          confirmation={confirmation}
          onMotDePasse={(valeur) => {
            setNouveau(valeur);
            if (erreurs.nouveau) setErreurs({ ...erreurs, nouveau: undefined });
          }}
          onConfirmation={(valeur) => {
            setConfirmation(valeur);
          }}
          disabled={changement.isPending}
          regles={regles}
        />
        {erreurs.nouveau && <p className="mt-1 text-sm text-erreur">{erreurs.nouveau}</p>}

        {erreur && (
          <div className="mt-4 flex flex-col gap-3">
            <Alerte type="erreur">{erreur}</Alerte>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Bouton
            type="submit"
            variante="primaire"
            disabled={!actuel || !complet}
            enCours={changement.isPending}
          >
            {changement.isPending
              ? t("motDePasse.enCours")
              : t("motDePasse.enregistrer")}
          </Bouton>
        </div>
      </form>
    </section>
  );
}

/**
 * Les droits effectifs, en lecture : les permissions accordées, module par
 * module. `GET /modules/` ne sert à chacun que les permissions qu'il détient,
 * avec leurs libellés : c'est exactement la liste à montrer.
 */
function BlocHabilitations() {
  const t = useTranslations("profil");
  const requete = useQuery({
    queryKey: CLE_MODULES_ENTREPRISE,
    queryFn: ({ signal }) => listerModulesEntreprise(signal),
  });
  const modules = (requete.data ?? []).filter((m) => m.permissions.length > 0);

  return (
    <section className={CARTE}>
      <div className="mb-4 flex items-start gap-3 border-b border-neutral-100 pb-4">
        <span className={PASTILLE_ICONE}>
          <KeyRound size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="mb-0.5 text-sm font-semibold text-neutral-900">
            {t("sectionHabilitations")}
          </h2>
          <p className="text-sm text-neutral-600">
            {t("sectionHabilitationsAide")}
          </p>
        </div>
      </div>

      {requete.isPending ? (
        <EtatChargement />
      ) : requete.isError ? (
        <EtatErreur onReessayer={() => void requete.refetch()} />
      ) : modules.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("aucuneHabilitation")}</p>
      ) : (
        <dl className="divide-y divide-neutral-100">
          {modules.map((module) => (
            <div key={module.code} className="py-3 first:pt-0 last:pb-0">
              <dt className="mb-2 text-sm font-medium text-neutral-900">
                {module.libelle}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {module.permissions.map((p) => (
                  <Badge key={p.code} variante="primaire">
                    {p.libelle}
                  </Badge>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
