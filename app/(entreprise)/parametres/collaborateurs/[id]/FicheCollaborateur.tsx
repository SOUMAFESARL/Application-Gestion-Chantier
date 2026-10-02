"use client";

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderKanban,
  Pause,
  Play,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import {
  Badge,
  Bouton,
  EtatChargement,
  EtatErreur,
  EtatVide,
} from "@/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { obtenirProfilMoi } from "@/features/auth/api";
import {
  cleCollaborateur,
  lireCollaborateur,
} from "@/features/invitations/adaptateur";
import { useGestionCollaborateur } from "@/features/invitations/components/GestionCollaborateur";
import {
  initiales,
  reactivationPossible,
  suppressionPossible,
  suspensionPossible,
} from "@/features/invitations/regles";
import type { Collaborateur } from "@/features/invitations/types";
import { listerProjets } from "@/features/projets/adaptateur";
import { CLE_LISTE_PROJETS } from "@/features/projets/cles";
import {
  affectationsDuCollaborateur,
  affectationsParStatut,
  largeurJauge,
} from "@/features/projets/regles";
import type { AffectationProjet, Projet } from "@/features/projets/types";
import { afficherTelephone } from "@/features/referentiels/telephone";
import { ErreurApi } from "@/lib/api";
import {
  ABSENT,
  formaterDate,
  formaterDateHeure,
  formaterPourcentage,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  BARRE_PROJET,
  BARRE_PROJET_COLLEE,
  TON_STATUT as TON_STATUT_PROJET,
} from "../../../projets/classes";
import { useEstColle } from "../../../projets/EnteteChantier";
import { TON_STATUT } from "../tons";

const CARTE = "rounded-lg border border-neutral-200 bg-neutral-0 p-5 shadow-md";
const LIGNE_DEFINITION =
  "flex items-baseline justify-between gap-4 py-1.5 text-sm";
const LIGNE_LIBELLE = "shrink-0 text-neutral-600";
const LIGNE_VALEUR = "min-w-0 truncate text-right font-medium text-neutral-900";
const PASTILLE_ICONE =
  "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600";

/**
 * La hauteur d'un élément, suivie quand elle change : les boutons de l'en-tête
 * passent à la ligne sur un écran étroit, et la carte collée dessous doit
 * suivre plutôt que de passer sous lui.
 */
function useHauteur(element: HTMLElement | null): number {
  const [hauteur, setHauteur] = useState(0);

  useEffect(() => {
    if (!element) return;
    const observateur = new ResizeObserver(([entree]) =>
      setHauteur(entree.borderBoxSize[0]?.blockSize ?? element.offsetHeight),
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [element]);

  return hauteur;
}

/**
 * La fiche d'un collaborateur, espace entreprise.
 *
 * Deux blocs : qui il est (identité, rôle, compte) et ce qu'on lui a confié
 * (les chantiers où il est désigné dans l'équipe projet, rangés par statut).
 * Les gestes de la liste — suspendre, réactiver, supprimer — s'y retrouvent,
 * par le même `useGestionCollaborateur` : les deux écrans laissent le même
 * cache derrière eux.
 */
export function FicheCollaborateur({
  collaborateurId,
}: {
  collaborateurId: string;
}) {
  const t = useTranslations("gestionCollaborateurs");
  const router = useRouter();
  const [moiId, setMoiId] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: cleCollaborateur(collaborateurId),
    queryFn: () => lireCollaborateur(collaborateurId),
  });
  const requeteProjets = useQuery({
    queryKey: CLE_LISTE_PROJETS,
    queryFn: ({ signal }) => listerProjets(signal),
  });

  /**
   * L'en-tête (nom, rôle, statut, gestes) reste collé sous celui de
   * l'application, comme celui de la fiche projet : on sait toujours de qui
   * on lit la fiche. Sa hauteur place la carte de l'avatar juste dessous.
   */
  const [entete, setEntete] = useState<HTMLDivElement | null>(null);
  const colle = useEstColle(entete);
  const hauteurEntete = useHauteur(entete);

  const { suspendre, reactiver, supprimer, modaux } = useGestionCollaborateur({
    onSupprime: () => router.replace("/parametres/collaborateurs"),
  });

  useEffect(() => {
    let vivant = true;
    // Ne sert qu'à ne pas proposer à quelqu'un de se suspendre lui-même.
    obtenirProfilMoi()
      .then((profil) => {
        if (vivant) setMoiId(profil.id);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  const retour = (
    <nav>
      <Link
        href="/parametres/collaborateurs"
        className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 no-underline transition-colors hover:text-primary-600 hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        <span>{t("fiche.retour")}</span>
      </Link>
    </nav>
  );

  if (requete.isPending) {
    return (
      <div className="flex flex-col gap-6">
        {retour}
        <EtatChargement message={t("fiche.chargement")} />
      </div>
    );
  }

  if (requete.isError) {
    const introuvable =
      requete.error instanceof ErreurApi && requete.error.statut === 404;
    return (
      <div className="flex flex-col gap-6">
        {retour}
        {introuvable ? (
          <EtatVide
            titre={t("fiche.introuvable")}
            description={t("fiche.introuvableAide")}
          />
        ) : (
          <EtatErreur
            message={t("fiche.erreurChargement")}
            onReessayer={() => void requete.refetch()}
          />
        )}
      </div>
    );
  }

  const collaborateur = requete.data;
  const nom = collaborateur.nomComplet || t("collaborateurInvite");

  return (
    <div
      className="flex flex-col gap-6"
      style={{ "--hauteur-entete": `${hauteurEntete}px` } as CSSProperties}
    >
      {retour}

      <div
        ref={setEntete}
        className={cn(BARRE_PROJET, colle && BARRE_PROJET_COLLEE)}
      >
        <EnTetePage
          className={cn(
            "max-sm:flex-col max-sm:gap-3",
            "max-sm:[&_h1]:text-xl!",
            "max-sm:[&>div:last-child]:justify-start max-sm:[&>div:last-child]:gap-2",
            !colle && "border-0 border-b border-solid border-neutral-200 pb-4",
          )}
          titre={nom}
          description={
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variante="neutre">{libelleRole(t, collaborateur)}</Badge>
              <BadgeStatut collaborateur={collaborateur} />
            </span>
          }
          actions={
            <>
              {suspensionPossible(collaborateur, moiId) && (
                <Bouton
                  variante="secondaire"
                  taille="sm"
                  iconeGauche={<Pause size={16} aria-hidden="true" />}
                  onClick={() => suspendre(collaborateur)}
                >
                  {t("fiche.suspendre")}
                </Bouton>
              )}
              {reactivationPossible(collaborateur, moiId) && (
                <Bouton
                  variante="primaire"
                  taille="sm"
                  iconeGauche={<Play size={16} aria-hidden="true" />}
                  onClick={() => reactiver(collaborateur)}
                >
                  {t("fiche.reactiver")}
                </Bouton>
              )}
              {suppressionPossible(collaborateur, moiId) && (
                <Bouton
                  variante="ghost"
                  taille="sm"
                  className="text-erreur hover:bg-erreur-fond hover:text-erreur"
                  iconeGauche={<Trash2 size={16} aria-hidden="true" />}
                  onClick={() => supprimer(collaborateur)}
                >
                  {t("fiche.supprimer")}
                </Bouton>
              )}
            </>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        <BlocIdentite collaborateur={collaborateur} />
        <div className="flex flex-col gap-4">
          <BlocInformations collaborateur={collaborateur} />
          <BlocProjets
            collaborateurId={collaborateur.id}
            requete={requeteProjets}
          />
        </div>
      </div>

      {modaux}
    </div>
  );
}

/** Le catalogue d'abord ; un code qu'il ne connaît pas garde le libellé du serveur. */
function libelleRole(
  t: ReturnType<typeof useTranslations<"gestionCollaborateurs">>,
  collaborateur: Collaborateur,
): string {
  return t.has(`roleOptions.${collaborateur.role}`)
    ? t(`roleOptions.${collaborateur.role}`)
    : collaborateur.roleLibelle;
}

function BadgeStatut({ collaborateur }: { collaborateur: Collaborateur }) {
  const t = useTranslations("gestionCollaborateurs");
  const statut = collaborateur.statut;
  return (
    <Badge variante={TON_STATUT[statut]}>
      {statut === "ACTIF" && <CheckCircle2 size={14} aria-hidden="true" />}
      {statut === "INVITE" && <Clock size={14} aria-hidden="true" />}
      {statut === "DESACTIVE" && <Ban size={14} aria-hidden="true" />}
      {t(`statut.${statut}`)}
    </Badge>
  );
}

/** La carte de gauche : la photo et ce qui identifie la personne d'un coup d'œil. */
function BlocIdentite({ collaborateur }: { collaborateur: Collaborateur }) {
  const t = useTranslations("gestionCollaborateurs");
  const nom = collaborateur.nomComplet || t("collaborateurInvite");

  return (
    // Collée sous l'en-tête de la fiche, lui-même collé sous la barre de
    // l'application (`top-16`) ; `--hauteur-entete` est posée par la fiche.
    <section
      className={`${CARTE} flex flex-col gap-5 overflow-hidden p-0 pb-5 lg:sticky lg:top-[calc(var(--spacing)*20+var(--hauteur-entete))]`}
    >
      {/* Le bandeau ne porte rien : il donne sa couleur à la carte et un fond à la photo. */}
      <div
        aria-hidden="true"
        className="h-24 bg-linear-to-br from-secondary-800 via-secondary-700 to-primary-700"
      />
      <div className="-mt-17 flex flex-col items-center gap-3 px-5 text-center">
        <Avatar className="size-24 rounded-full shadow-md ring-4 ring-neutral-0">
          {collaborateur.avatarUrl && (
            <AvatarImage
              src={collaborateur.avatarUrl}
              alt=""
              className="rounded-full object-cover"
            />
          )}
          <AvatarFallback className="rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-2xl font-semibold text-neutral-0">
            {initiales(nom)}
          </AvatarFallback>
        </Avatar>
        <div className="flex max-w-full min-w-0 flex-col gap-0.5">
          <span className="truncate text-base font-semibold text-neutral-900">
            {nom}
          </span>
          <span className="truncate text-sm text-neutral-600">
            {collaborateur.email}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variante="neutre">{libelleRole(t, collaborateur)}</Badge>
          {collaborateur.estProprietaire && (
            <Badge variante="primaire">{t("fiche.proprietaire")}</Badge>
          )}
        </div>
      </div>
    </section>
  );
}

/** Identité et compte, en lecture : le collaborateur modifie les siens depuis son profil. */
function BlocInformations({ collaborateur }: { collaborateur: Collaborateur }) {
  const t = useTranslations("gestionCollaborateurs");

  const lignes: { libelle: string; valeur: string }[] = [
    { libelle: t("champPrenom"), valeur: collaborateur.prenom || ABSENT },
    { libelle: t("champNom"), valeur: collaborateur.nom || ABSENT },
    { libelle: t("champEmail"), valeur: collaborateur.email },
    {
      libelle: t("colonneTelephone"),
      valeur: afficherTelephone(collaborateur.telephone) || ABSENT,
    },
    { libelle: t("colonneRole"), valeur: libelleRole(t, collaborateur) },
    {
      libelle: t("colonneStatut"),
      valeur: t(`statut.${collaborateur.statut}`),
    },
    {
      libelle: t("fiche.membreDepuis"),
      valeur: formaterDate(collaborateur.creeLe) || ABSENT,
    },
    {
      libelle: t("fiche.derniereConnexion"),
      valeur: collaborateur.derniereConnexion
        ? formaterDateHeure(collaborateur.derniereConnexion)
        : t("fiche.jamaisConnecte"),
    },
  ];

  return (
    <section className={CARTE}>
      <div className="mb-4 flex items-start gap-3 border-b border-neutral-100 pb-4">
        <span className={PASTILLE_ICONE}>
          <UserRound size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="mb-0.5 text-sm font-semibold text-neutral-900">
            {t("fiche.sectionInfos")}
          </h2>
          <p className="text-sm text-neutral-600">
            {t("fiche.sectionInfosAide")}
          </p>
        </div>
      </div>

      <dl className="grid gap-x-8 sm:grid-cols-2">
        {lignes.map((ligne) => (
          <div
            key={ligne.libelle}
            className={`${LIGNE_DEFINITION} border-b border-neutral-100`}
          >
            <dt className={LIGNE_LIBELLE}>{ligne.libelle}</dt>
            <dd className={LIGNE_VALEUR} title={ligne.valeur}>
              {ligne.valeur}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Les chantiers où la personne est désignée dans l'équipe projet, rangés par
 * statut — l'urgent d'abord. Le comptage se lit en tête, les groupes dessous.
 */
function BlocProjets({
  collaborateurId,
  requete,
}: {
  collaborateurId: string;
  requete: UseQueryResult<Projet[]>;
}) {
  const t = useTranslations("gestionCollaborateurs.fiche");
  const tProjets = useTranslations("projets");

  const groupes = useMemo(
    () =>
      affectationsParStatut(
        affectationsDuCollaborateur(requete.data ?? [], collaborateurId),
      ),
    [requete.data, collaborateurId],
  );
  const total = groupes.reduce(
    (somme, groupe) => somme + groupe.affectations.length,
    0,
  );

  return (
    <section className={CARTE}>
      <div className="mb-4 flex items-start gap-3 border-b border-neutral-100 pb-4">
        <span className={PASTILLE_ICONE}>
          <FolderKanban size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="mb-0.5 text-sm font-semibold text-neutral-900">
            {t("sectionProjets", { nombre: total })}
          </h2>
          <p className="text-sm text-neutral-600">{t("sectionProjetsAide")}</p>
        </div>
      </div>

      {requete.isPending ? (
        <EtatChargement message={t("chargementProjets")} />
      ) : requete.isError ? (
        <EtatErreur
          message={t("erreurProjets")}
          onReessayer={() => void requete.refetch()}
        />
      ) : total === 0 ? (
        <EtatVide
          titre={t("aucunProjet")}
          description={t("aucunProjetAide")}
          icone={<FolderKanban size={28} aria-hidden="true" />}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {groupes.map(({ statut, affectations }) => (
              <li key={statut}>
                <Badge variante={TON_STATUT_PROJET[statut]}>
                  {t("compteStatut", {
                    statut: tProjets(`statut.${statut}`),
                    nombre: affectations.length,
                  })}
                </Badge>
              </li>
            ))}
          </ul>

          {groupes.map(({ statut, affectations }) => (
            <div key={statut} className="flex flex-col gap-2">
              <h3 className="m-0 flex items-center gap-2 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
                {tProjets(`statut.${statut}`)}
                <span className="text-neutral-400">
                  ({affectations.length})
                </span>
              </h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {affectations.map((affectation) => (
                  <LigneProjet
                    key={affectation.projet.id}
                    affectation={affectation}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LigneProjet({ affectation }: { affectation: AffectationProjet }) {
  const t = useTranslations("gestionCollaborateurs.fiche");
  const { projet, fonctions } = affectation;
  const lieu = [projet.quartier, projet.ville].filter(Boolean).join(", ");

  return (
    <li>
      <Link
        href={`/projets/${projet.id}`}
        className="group flex flex-col gap-3 rounded-lg border border-neutral-200 px-4 py-3 text-neutral-900 no-underline transition-colors hover:border-primary-200 hover:bg-primary-50 sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-xs font-medium text-neutral-500 tabular-nums">
              {projet.reference}
            </span>
            <span className="truncate font-semibold">{projet.nom}</span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {fonctions.map((fonction) => (
              <Badge key={fonction} variante="secondaire">
                {t(`fonction.${fonction}`)}
              </Badge>
            ))}
            {lieu && <span className="text-xs text-neutral-500">{lieu}</span>}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:w-64">
          <div className="flex flex-1 flex-col gap-1">
            <span className="flex justify-between text-xs text-neutral-600">
              <span>{t("avancement")}</span>
              <span className="font-medium text-neutral-900 tabular-nums">
                {formaterPourcentage(projet.avancementReel)}
              </span>
            </span>
            <span
              className="h-1.5 overflow-hidden rounded-full bg-neutral-100"
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full bg-primary-500"
                style={{ width: `${largeurJauge(projet.avancementReel)}%` }}
              />
            </span>
            <span className="text-xs text-neutral-500 tabular-nums">
              {t("echeance", {
                date: formaterDate(projet.dateFinPrevue) || ABSENT,
              })}
            </span>
          </div>
          <ChevronRight
            size={16}
            aria-hidden="true"
            className="text-neutral-400 transition-colors group-hover:text-primary-600"
          />
        </div>
      </Link>
    </li>
  );
}
