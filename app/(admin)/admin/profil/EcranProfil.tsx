"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Eye, EyeOff, KeyRound, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useForm } from "react-hook-form";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { ChampsMotDePasse } from "@/components/metier/ChampsMotDePasse";
import { Alerte, Bouton, Champ, EtatChargement } from "@/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  FORMATS_PHOTO_PROFIL,
  initialesAdministrateur,
  refusPhotoProfil,
} from "@/features/administration";
import type { ProfilAdministrateur } from "@/features/administration";
import {
  changerMotDePasse,
  modifierPhotoProfil,
  modifierProfil,
} from "@/features/administration/adaptateur";
import {
  schemaChangementMotDePasse,
  schemaProfilAdministrateur,
} from "@/features/administration/validations";
import type {
  SaisieProfilAdministrateur,
  ValeursProfilAdministrateur,
} from "@/features/administration/validations";
import { useReglesMotDePasse } from "@/features/auth/reglesMotDePasse";
import { ErreurApi } from "@/lib/api";

import { useAdministrateur } from "../ContexteAdministrateur";
import { CLES_ADMINISTRATION } from "../cles";
import {
  BADGE,
  CARTE,
  CARTE_TITRE,
  LIGNE_DEFINITION,
  LIGNE_LIBELLE,
  TON_ROLE_ADMINISTRATEUR,
} from "../tons";

const ACCEPT_PHOTO = FORMATS_PHOTO_PROFIL.join(",");

/** Les cartes du profil se détachent du fond : même carte que la fiche client, avec une ombre. */
const CARTE_PROFIL = `${CARTE} shadow-md`;

/** La pastille d'icône qui précède le titre d'un bloc. */
const PASTILLE_ICONE =
  "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600";

function valeursDe(profil: ProfilAdministrateur): SaisieProfilAdministrateur {
  return {
    prenom: profil.prenom,
    nom: profil.nom,
    email: profil.email,
    telephone: profil.telephone,
  };
}

/** Le message d'une erreur, sans jamais laisser passer un `undefined`. */
function messageDe(cause: unknown, repli: string): string {
  return cause instanceof ErreurApi ? cause.message : repli;
}

/**
 * Le profil de l'agent connecté : ce qu'il est, et ce qu'il peut en changer.
 *
 * Trois gestes indépendants, trois blocs : la photo, les informations
 * personnelles, le mot de passe. Chacun s'enregistre seul — changer sa photo
 * ne doit pas soumettre un formulaire à moitié rempli, et une erreur de mot de
 * passe ne doit pas effacer un nom qu'on venait de corriger.
 *
 * **Le rôle s'affiche mais ne se modifie pas ici.** On ne s'accorde pas la
 * supervision soi-même : il se change depuis la gestion des comptes, par un
 * autre superviseur.
 */
export function EcranProfil() {
  const t = useTranslations("administration");
  const profil = useAdministrateur();

  if (!profil) return <EtatChargement />;

  return (
    <div className="flex flex-col gap-6">
      <EnTetePage
        titre={<span className="text-primary-600">{t("profil.titre")}</span>}
        description={t("profil.sousTitre")}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        <BlocIdentiteCompte profil={profil} />

        <div className="flex flex-col gap-4">
          <BlocInformations profil={profil} />
          <BlocMotDePasse />
        </div>
      </div>
    </div>
  );
}

/**
 * La carte de gauche : la photo, et ce qui ne se modifie pas ici.
 *
 * La photo part **dès qu'elle est choisie** : il n'y a rien d'autre à saisir
 * avec elle, et un bouton « Enregistrer » de plus ne servirait qu'à être oublié.
 */
function BlocIdentiteCompte({ profil }: { profil: ProfilAdministrateur }) {
  const t = useTranslations("administration");
  const cache = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState<string | null>(null);

  const envoi = useMutation({
    mutationFn: (fichier: File | null) => modifierPhotoProfil(fichier),
    onSuccess: (nouveau) => {
      cache.setQueryData(CLES_ADMINISTRATION.moi(), nouveau);
      setErreur(null);
      setAnnonce(nouveau.photo ? t("profil.photo.succes") : t("profil.photo.retiree"));
    },
    onError: (cause) => {
      setAnnonce(null);
      setErreur(messageDe(cause, t("erreurs.action")));
    },
  });

  function choisirPhoto(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    // Vidé tout de suite : choisir deux fois le même fichier doit redéclencher `change`.
    evenement.target.value = "";
    if (!fichier) return;

    const refus = refusPhotoProfil(fichier);
    if (refus) {
      setAnnonce(null);
      setErreur(
        refus === "FORMAT" ? t("profil.photo.formatInvalide") : t("profil.photo.tropLourde"),
      );
      return;
    }
    envoi.mutate(fichier);
  }

  return (
    <section className={`${CARTE_PROFIL} flex flex-col gap-5 overflow-hidden p-0`}>
      {/* Le bandeau ne porte rien : il donne sa couleur à la carte et un fond à la photo. */}
      <div
        aria-hidden="true"
        className="h-24 bg-linear-to-br from-secondary-800 via-secondary-700 to-primary-700"
      />
      <div className="-mt-17 flex flex-col items-center gap-3 px-5 text-center">
        <Avatar className="size-24 rounded-full shadow-md ring-4 ring-neutral-0">
          {profil.photo && (
            <AvatarImage src={profil.photo} alt="" className="rounded-full object-cover" />
          )}
          <AvatarFallback className="rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-2xl font-semibold text-neutral-0">
            {initialesAdministrateur(profil)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-base font-semibold text-neutral-900">
            {profil.nomComplet}
          </span>
          <span className="truncate text-sm text-neutral-600">{profil.email}</span>
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
              accept={ACCEPT_PHOTO}
              className="sr-only"
              disabled={envoi.isPending}
              onChange={choisirPhoto}
            />
            <Camera size={16} aria-hidden="true" />
            {envoi.isPending
              ? t("profil.photo.enCours")
              : profil.photo
                ? t("profil.photo.changer")
                : t("profil.photo.ajouter")}
          </label>
          {profil.photo && (
            <Bouton
              variante="ghost"
              taille="sm"
              disabled={envoi.isPending}
              className="text-erreur hover:bg-erreur-fond hover:text-erreur"
              iconeGauche={<Trash2 size={16} aria-hidden="true" />}
              onClick={() => envoi.mutate(null)}
            >
              {t("profil.photo.retirer")}
            </Bouton>
          )}
        </div>
        <span className="text-xs text-neutral-500">{t("profil.photo.contrainte")}</span>
        {erreur && <p className="text-sm text-erreur">{erreur}</p>}
        {annonce && <p className="text-sm font-medium text-succes">{annonce}</p>}
      </div>

      <div className="mx-5 mb-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <h2 className={`${CARTE_TITRE} mb-2 flex items-center gap-2`}>
          <ShieldCheck size={16} className="text-primary-600" aria-hidden="true" />
          {t("profil.sectionCompte")}
        </h2>
        <div className={LIGNE_DEFINITION}>
          <span className={LIGNE_LIBELLE}>{t("profil.role")}</span>
          <span className={`${BADGE} ${TON_ROLE_ADMINISTRATEUR[profil.role]}`}>
            {t(`role.${profil.role}`)}
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{t("profil.roleAide")}</p>
      </div>
    </section>
  );
}

/**
 * Prénom, nom, adresse, téléphone.
 *
 * La réponse du serveur remplace le profil dans le cache de la coquille : le
 * nom de l'en-tête change dans la seconde, sans rechargement.
 */
function BlocInformations({ profil }: { profil: ProfilAdministrateur }) {
  const t = useTranslations("administration");
  const cache = useQueryClient();
  const [succes, setSucces] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const formulaire = useForm<SaisieProfilAdministrateur, unknown, ValeursProfilAdministrateur>({
    resolver: zodResolver(schemaProfilAdministrateur),
    defaultValues: valeursDe(profil),
  });
  const { reset, setError } = formulaire;

  // Resynchronisé quand le profil change ailleurs (enregistrement, photo).
  useEffect(() => {
    reset(valeursDe(profil));
  }, [profil, reset]);

  const enregistrement = useMutation({
    mutationFn: (valeurs: ValeursProfilAdministrateur) => modifierProfil(valeurs),
    onSuccess: (nouveau) => {
      cache.setQueryData(CLES_ADMINISTRATION.moi(), nouveau);
      setErreur(null);
      setSucces(true);
    },
    onError: (cause) => {
      setSucces(false);
      const champEmail = cause instanceof ErreurApi ? cause.erreursParChamp.email : undefined;
      if (champEmail) {
        setError("email", { message: champEmail });
        return;
      }
      setErreur(messageDe(cause, t("erreurs.action")));
    },
  });

  const { errors, isDirty } = formulaire.formState;

  return (
    <section className={CARTE_PROFIL}>
      <div className="mb-5 flex items-start gap-3 border-b border-neutral-100 pb-4">
        <span className={PASTILLE_ICONE}>
          <UserRound size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="mb-0.5 text-sm font-semibold text-neutral-900">
            {t("profil.sectionIdentite")}
          </h2>
          <p className="text-sm text-neutral-600">{t("profil.sectionIdentiteAide")}</p>
        </div>
      </div>

      <form
        noValidate
        onSubmit={formulaire.handleSubmit((valeurs) => {
          setSucces(false);
          setErreur(null);
          enregistrement.mutate(valeurs);
        })}
      >
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Champ
            libelle={t("profil.prenom")}
            required
            autoComplete="given-name"
            erreur={errors.prenom?.message}
            disabled={enregistrement.isPending}
            {...formulaire.register("prenom")}
          />
          <Champ
            libelle={t("profil.nom")}
            required
            autoComplete="family-name"
            erreur={errors.nom?.message}
            disabled={enregistrement.isPending}
            {...formulaire.register("nom")}
          />
          <Champ
            libelle={t("profil.email")}
            type="email"
            required
            autoComplete="email"
            aide={t("profil.emailAide")}
            erreur={errors.email?.message}
            disabled={enregistrement.isPending}
            {...formulaire.register("email")}
          />
          <Champ
            libelle={t("profil.telephone")}
            type="tel"
            autoComplete="tel"
            placeholder={t("profil.telephonePlaceholder")}
            erreur={errors.telephone?.message}
            disabled={enregistrement.isPending}
            {...formulaire.register("telephone")}
          />
        </div>

        {succes && !isDirty && <Alerte type="succes">{t("profil.succes")}</Alerte>}
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Bouton
            variante="ghost"
            disabled={!isDirty || enregistrement.isPending}
            onClick={() => reset(valeursDe(profil))}
          >
            {t("profil.annuler")}
          </Bouton>
          <Bouton
            type="submit"
            variante="primaire"
            disabled={!isDirty}
            enCours={enregistrement.isPending}
          >
            {enregistrement.isPending ? t("profil.enCours") : t("profil.enregistrer")}
          </Bouton>
        </div>
      </form>
    </section>
  );
}

type ErreursMotDePasse = Partial<Record<"actuel" | "nouveau", string>>;

/**
 * Le changement de mot de passe.
 *
 * La double saisie et la barre de robustesse sont celles de l'activation et de
 * la réinitialisation (`ChampsMotDePasse`) : un seul couloir pour ce geste,
 * dans les deux espaces. Les règles de robustesse viennent du référentiel du
 * serveur ; tant qu'elles ne sont pas satisfaites, le bouton reste grisé — et
 * s'il n'a pas pu les charger, seul le serveur tranche, à l'envoi.
 *
 * Les trois champs sont vidés après un succès : un mot de passe qui reste
 * affiché dans un formulaire n'a plus rien à y faire.
 */
function BlocMotDePasse() {
  const t = useTranslations("administration");
  const tMotDePasse = useTranslations("motDePasse");
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [actuelVisible, setActuelVisible] = useState(false);
  const [erreurs, setErreurs] = useState<ErreursMotDePasse>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  const { regles, complet } = useReglesMotDePasse(nouveau, confirmation);

  const changement = useMutation({
    mutationFn: () => changerMotDePasse({ actuel, nouveau }),
    onSuccess: () => {
      setActuel("");
      setNouveau("");
      setConfirmation("");
      setErreurs({});
      setErreur(null);
      setSucces(true);
    },
    onError: (cause) => {
      setSucces(false);
      const parChamp = cause instanceof ErreurApi ? cause.erreursParChamp : {};
      if (parChamp.actuel || parChamp.nouveau) {
        setErreurs({ actuel: parChamp.actuel, nouveau: parChamp.nouveau });
        return;
      }
      setErreur(messageDe(cause, t("erreurs.action")));
    },
  });

  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setSucces(false);
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
    <section className={CARTE_PROFIL}>
      <div className="mb-5 flex items-start gap-3 border-b border-neutral-100 pb-4">
        <span className={PASTILLE_ICONE}>
          <KeyRound size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="mb-0.5 text-sm font-semibold text-neutral-900">
            {t("profil.motDePasse.titre")}
          </h2>
          <p className="text-sm text-neutral-600">{t("profil.motDePasse.description")}</p>
        </div>
      </div>

      <form noValidate onSubmit={soumettre} className="flex flex-col" data-sans-sauvegarde>
        <Champ
          libelle={t("profil.motDePasse.actuel")}
          type={actuelVisible ? "text" : "password"}
          autoComplete="current-password"
          required
          value={actuel}
          onChange={(evenement) => {
            setActuel(evenement.target.value);
            setSucces(false);
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
            setSucces(false);
            if (erreurs.nouveau) setErreurs({ ...erreurs, nouveau: undefined });
          }}
          onConfirmation={(valeur) => {
            setConfirmation(valeur);
            setSucces(false);
          }}
          disabled={changement.isPending}
          regles={regles}
        />
        {erreurs.nouveau && <p className="mt-1 text-sm text-erreur">{erreurs.nouveau}</p>}

        {(succes || erreur) && (
          <div className="mt-4 flex flex-col gap-3">
            {succes && <Alerte type="succes">{t("profil.motDePasse.succes")}</Alerte>}
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
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
              ? t("profil.motDePasse.enCours")
              : t("profil.motDePasse.enregistrer")}
          </Bouton>
        </div>
      </form>
    </section>
  );
}
