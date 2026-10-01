"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Mail,
  Pause,
  Pencil,
  Play,
  Phone,
  Printer,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Badge, EtatChargement, EtatErreur } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AccesNonAutorise,
  peutCadrerProjet,
  peutDesignerChefProjet,
  peutGererEncadrement,
  projetVisible,
  useDroits,
} from "@/features/habilitations";
import { lireProjet, listerEquipes, listerLots } from "@/features/projets/adaptateur";
import { cleEquipes, cleLots, cleProjet } from "@/features/projets/cles";
import { useGestionProjet } from "@/features/projets/components/GestionProjet";
import {
  budgetRestant,
  ecartAvancement,
  echeancierProjet,
  effectifProjet,
  estEnRetard,
  largeurJauge,
  niveauBudget,
  peutReprendre,
  peutSuspendre,
  projetModifiable,
  ratioConsommationBudget,
  syntheseLots,
} from "@/features/projets/regles";
import type { NiveauBudget } from "@/features/projets/regles";
import type { Projet } from "@/features/projets/types";
import { afficherTelephone } from "@/features/referentiels/telephone";
import {
  ABSENT,
  couleurIndiceSante,
  formaterDate,
  formaterDuree,
  formaterMontant,
  formaterMontantCourt,
  formaterPourcentage,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  BARRE_PROJET,
  BARRE_PROJET_COLLEE,
  BLOC,
  FOND_INDICATEUR,
  TON_SANTE,
  TON_STATUT,
  type FondIndicateur,
} from "../classes";
import { useEstColle } from "../EnteteChantier";
import { lienEquipesChantier } from "../equipe-affectations/liens";
import { EquipeEncadrement } from "./EquipeEncadrement";
import { useGenerationFicheProjet } from "./GenerationFicheProjet";

/**
 * La fiche d'un projet.
 *
 * Trois chiffres d'abord, parce que ce sont eux qu'on vient chercher :
 * **les dates** (et le délai déjà consommé), **le budget** (et ce qu'il en
 * reste), **l'avancement** (et son écart au théorique). Viennent ensuite ce
 * que la création a saisi — maîtrise d'ouvrage et d'œuvre, type, lieu — la
 * structure en lots, et l'équipe d'encadrement et de gestion.
 *
 * Le planning et le budget ne se saisissent plus à la création : tant qu'ils
 * manquent, leurs cartes le disent, et seul le chef de projet du chantier a
 * le bouton qui les fixe.
 *
 * **Aucun calcul ici.** L'échéancier, le reste à engager, l'écart et son
 * seuil de retard, le niveau budgétaire viennent de `features/projets/regles`
 * — les mêmes que la liste et le tableau de bord, pour qu'aucun écran ne
 * qualifie un chantier autrement que les autres.
 *
 * Il n'y a plus de projet de repli affiché pendant le chargement : un
 * chantier inventé, montré le temps d'une requête, se lisait comme le vrai.
 */

/** La couleur de la jauge de consommation, selon le niveau budgétaire. */
const JAUGE_BUDGET: Record<NiveauBudget, string> = {
  conforme: "bg-succes",
  alerte: "bg-avertissement",
  depassement: "bg-erreur",
};

const TEXTE_BUDGET: Record<NiveauBudget, string> = {
  conforme: "text-succes",
  alerte: "text-avertissement",
  depassement: "text-erreur",
};

/**
 * La teinte d'une carte de chiffre clé : son fond (celui des tuiles
 * d'indicateurs, `FOND_INDICATEUR`) et la couleur de son icône, posée sur un
 * carré blanc pour rester lisible sur le fond teinté. La teinte suit l'état —
 * une échéance dépassée ou un budget épuisé passe au rouge.
 */
const ICONE: Record<Exclude<FondIndicateur, "neutre">, string> = {
  primaire: "text-primary-600",
  secondaire: "text-secondary-700",
  succes: "text-succes",
  avertissement: "text-avertissement",
  erreur: "text-erreur",
  information: "text-information",
};

/** Le filet qui sépare les chiffres secondaires, lisible sur n'importe quel fond. */
const FILET = "mt-auto border-0 border-t border-solid border-neutral-900/10 pt-3";

export function FicheProjet({ projetId }: { projetId: string }) {
  const t = useTranslations("ficheProjet");
  const tProjets = useTranslations("projets");

  const requete = useQuery({
    queryKey: cleProjet(projetId),
    queryFn: () => lireProjet(projetId),
  });
  const requeteLots = useQuery({
    queryKey: cleLots(projetId),
    queryFn: ({ signal }) => listerLots(projetId, signal),
  });
  const requeteEquipes = useQuery({
    queryKey: cleEquipes(projetId),
    queryFn: ({ signal }) => listerEquipes(projetId, signal),
  });

  /**
   * L'en-tête reste collé sous celui de l'application, comme le sélecteur
   * des écrans de chantier : on sait toujours de quel projet on lit la fiche.
   */
  const [entete, setEntete] = useState<HTMLDivElement | null>(null);
  const colle = useEstColle(entete);
  const { modifier, basculerSuspension, encadrer, retirerEncadrement, cadrer, modaux } =
    useGestionProjet();
  const fichePdf = useGenerationFicheProjet(requete.data);
  const { droits, peut } = useDroits();
  const peutSaisir = peut("projets", "saisie");
  const peutValider = peut("projets", "validation");
  const voitFinance = peut("finance");

  const synthese = useMemo(
    () => syntheseLots(requeteLots.data ?? []),
    [requeteLots.data],
  );

  const retour = (
    <nav>
      <Link
        href="/projets"
        className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 no-underline transition-colors hover:text-primary-600 hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        <span>{t("retourProjets")}</span>
      </Link>
    </nav>
  );

  if (requete.isPending) {
    return (
      <div className="flex flex-col gap-6">
        {retour}
        <EtatChargement />
      </div>
    );
  }

  if (requete.isError) {
    return (
      <div className="flex flex-col gap-6">
        {retour}
        <EtatErreur onReessayer={() => void requete.refetch()} />
      </div>
    );
  }

  const projet = requete.data;
  const lieu = [projet.quartier, projet.ville].filter(Boolean).join(", ");
  // Le planning et le budget : c'est le chef de projet du chantier qui les fixe.
  const cadrable = peutCadrerProjet(projet, droits);

  // Hors direction, un chantier dont on n'est pas n'a pas de fiche à montrer.
  if (!projetVisible(projet, droits)) {
    return (
      <div className="flex flex-col gap-6">
        {retour}
        <AccesNonAutorise />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {retour}

      <div
        ref={setEntete}
        className={cn(BARRE_PROJET, colle && BARRE_PROJET_COLLEE)}
      >
        {/*
         * Sur téléphone, le nom d'un chantier est long : collé à droite, les
         * badges et boutons l'écrasaient sur trois lignes à 28 px, et la
         * barre collante mangeait la moitié de l'écran. En dessous de `sm`,
         * les actions passent sous le titre, calées à gauche, et le titre
         * descend à `text-xl` (`!` : `.text-h2` est une classe globale hors
         * couche, qu'un utilitaire ne surclasse pas autrement).
         */}
        <EnTetePage
          className={cn(
            "max-sm:flex-col max-sm:gap-3",
            "max-sm:[&_h1]:text-xl!",
            "max-sm:[&_h1]:leading-snug!",
            "max-sm:[&>div:last-child]:justify-start max-sm:[&>div:last-child]:gap-2",
            !colle && "border-0 border-b border-solid border-neutral-200 pb-4",
          )}
          titre={projet.nom}
          description={
            <span className="mt-1 flex flex-wrap items-center gap-2">
              {projet.typeProjet && (
                <Badge variante="neutre">
                  {tProjets(`tiroirCreation.typeProjet.${projet.typeProjet}`)}
                </Badge>
              )}
              <Badge variante={TON_STATUT[projet.statut]}>
                {tProjets(`statut.${projet.statut}`)}
              </Badge>
            </span>
          }
          actions={
            /*
             * Les actions du projet sont regroupées derrière un seul bouton :
             * trois boutons côte à côte chargeaient l'en-tête collant, et
             * passaient sur deux lignes sur téléphone.
             */
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" aria-busy={fichePdf.enCours}>
                  {fichePdf.enCours && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                  {t("actions")}
                  <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" className="min-w-48">
                {peutSaisir && projetModifiable(projet) && (
                  <DropdownMenuItem onSelect={() => modifier(projet)}>
                    <Pencil aria-hidden="true" />
                    {t("modifier")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={fichePdf.generer} disabled={fichePdf.enCours}>
                  <Printer aria-hidden="true" />
                  {t("exporterPdf")}
                </DropdownMenuItem>
                {peutValider && (peutSuspendre(projet) || peutReprendre(projet)) && (
                  <DropdownMenuSeparator />
                )}
                {peutValider && peutSuspendre(projet) && (
                  <DropdownMenuItem
                    onSelect={() => basculerSuspension(projet)}
                    className="text-avertissement focus:text-avertissement"
                  >
                    <Pause className="text-avertissement" aria-hidden="true" />
                    {t("suspendre")}
                  </DropdownMenuItem>
                )}
                {peutValider && peutReprendre(projet) && (
                  <DropdownMenuItem
                    onSelect={() => basculerSuspension(projet)}
                    className="text-succes focus:text-succes"
                  >
                    <Play className="text-succes" aria-hidden="true" />
                    {t("reprendre")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </div>

      {/* Les trois chiffres qu'on vient chercher. */}
      <section
        className={cn(
          "grid gap-4 max-lg:grid-cols-1",
          voitFinance || cadrable ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        <CarteCalendrier
          projet={projet}
          onDefinir={cadrable ? () => cadrer(projet, "planning") : undefined}
        />
        {(voitFinance || cadrable) && (
          <CarteBudget
            projet={projet}
            onDefinir={cadrable ? () => cadrer(projet, "budget") : undefined}
          />
        )}
        <CarteAvancement projet={projet} />
      </section>

      <div className="grid grid-cols-[2fr_1fr] items-start gap-6 max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-6">
          <Bloc titre={t("informations.titre")}>
            <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
              <Information libelle={t("informations.reference")}>
                <span className="font-mono">{projet.reference}</span>
              </Information>
              <Information libelle={t("informations.type")}>
                {projet.typeProjet
                  ? tProjets(`tiroirCreation.typeProjet.${projet.typeProjet}`)
                  : t("informations.nonRenseigne")}
              </Information>
              <Information libelle={t("informations.maitreOuvrage")}>
                <span className="font-semibold">
                  {projet.client.raisonSociale}
                </span>
                {(projet.client.telephone || projet.client.email) && (
                  <span className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-600">
                    {projet.client.telephone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={12} aria-hidden="true" />
                        {afficherTelephone(projet.client.telephone)}
                      </span>
                    )}
                    {projet.client.email && (
                      <a
                        href={`mailto:${projet.client.email}`}
                        className="inline-flex items-center gap-1.5 text-primary-600 no-underline hover:underline"
                      >
                        <Mail size={12} aria-hidden="true" />
                        {projet.client.email}
                      </a>
                    )}
                  </span>
                )}
              </Information>
              <Information libelle={t("informations.maitreOeuvre")}>
                {projet.maitreOeuvre ?? (
                  <span className="text-neutral-500">
                    {t("informations.nonRenseigne")}
                  </span>
                )}
              </Information>
              <Information libelle={t("informations.localisation")}>
                {lieu || ABSENT}
              </Information>
              {projet.description && (
                <Information libelle={t("informations.description")} large>
                  <span className="text-neutral-700">{projet.description}</span>
                </Information>
              )}
            </dl>
          </Bloc>

          <Bloc titre={t("structure.titre")}>
            {requeteLots.isPending && <EtatChargement />}
            {requeteLots.isError && (
              <EtatErreur onReessayer={() => void requeteLots.refetch()} />
            )}
            {requeteLots.isSuccess && (
              <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
                <ChiffreStructure
                  libelle={t("structure.lots")}
                  valeur={String(synthese.lots)}
                  teinte="primaire"
                />
                <ChiffreStructure
                  libelle={t("structure.activites")}
                  valeur={String(synthese.activites)}
                  teinte="secondaire"
                />
                <ChiffreStructure
                  libelle={t("structure.avancementPondere")}
                  valeur={formaterPourcentage(synthese.avancement)}
                  teinte="succes"
                />
                <ChiffreStructure
                  libelle={t("structure.enRetard")}
                  valeur={String(synthese.enRetard)}
                  teinte={synthese.enRetard > 0 ? "erreur" : "neutre"}
                />
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <LienSection
                href={`/projets/lots-activites?projet=${encodeURIComponent(projet.id)}`}
              >
                {t("structure.voirLots")}
              </LienSection>
              <LienSection href={lienEquipesChantier(projet.id)}>
                {t("structure.voirEquipes")}
              </LienSection>
              {/* Pas de chiffre tant qu'on ne le connaît pas : « 0 » se lirait comme un fait. */}
              {requeteEquipes.isSuccess && (
                <span className="inline-flex items-center gap-2 rounded-md border border-solid border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700">
                  <Users size={16} aria-hidden="true" />
                  <span>
                    {t.rich("structure.collaborateurs", {
                      nombre: effectifProjet(requeteEquipes.data),
                      fort: (chunks) => (
                        <strong className="text-base font-bold">{chunks}</strong>
                      ),
                    })}
                  </span>
                </span>
              )}
            </div>
          </Bloc>
        </div>

        <EquipeEncadrement
          projet={projet}
          peutDesigner={peutDesignerChefProjet(projet, droits)}
          peutGerer={peutGererEncadrement(projet, droits)}
          onAjouter={(fonction, autorisees) => encadrer(projet, fonction, autorisees)}
          onRetirer={(fonction, intervenant) =>
            retirerEncadrement({ projet, fonction, intervenant })
          }
        />
      </div>

      {modaux}
      {fichePdf.indicateur}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Les trois cartes de chiffres clés.
 * ------------------------------------------------------------------ */

function CarteCle({
  icone,
  titre,
  pastille,
  mention,
  children,
}: {
  icone: ReactNode;
  titre: string;
  pastille: keyof typeof ICONE;
  /** Ce qui se lit à droite du titre : un badge d'état. */
  mention?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        // `@container` : la carte se mesure elle-même. Entre 1024 et ~1280 px,
        // trois cartes côte à côte à côté de la barre latérale n'ont que
        // ~220 px utiles — le badge d'état et les grands chiffres débordaient.
        "@container flex min-w-0 flex-col gap-4 rounded-xl border border-solid p-4 shadow-md sm:p-5",
        FOND_INDICATEUR[pastille],
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              "bg-neutral-0 shadow-xs",
              ICONE[pastille],
            )}
            aria-hidden="true"
          >
            {icone}
          </span>
          <h2 className="m-0 text-base font-semibold text-neutral-900">
            {titre}
          </h2>
        </div>
        {mention}
      </header>
      {children}
    </section>
  );
}

/** Une barre de progression, avec un repère facultatif (l'avancement théorique). */
function Jauge({
  valeur,
  className,
  repere,
  libelleRepere,
}: {
  valeur: number;
  /** La couleur du remplissage. */
  className: string;
  repere?: number;
  libelleRepere?: string;
}) {
  return (
    <div className="relative h-2.5 rounded-full bg-neutral-0">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          className,
        )}
        style={{ width: `${largeurJauge(valeur)}%` }}
      />
      {repere !== undefined && (
        <div
          title={libelleRepere}
          className="absolute -top-1 -bottom-1 w-[3px] -translate-x-1/2 rounded-sm bg-neutral-900"
          style={{ left: `${largeurJauge(repere)}%` }}
        />
      )}
    </div>
  );
}

/** Un chiffre secondaire sous le chiffre principal d'une carte. */
function Detail({
  libelle,
  valeur,
  className,
}: {
  libelle: string;
  valeur: string;
  /** La teinte du chiffre. */
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-neutral-500">{libelle}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums text-neutral-900",
          className,
        )}
      >
        {valeur}
      </span>
    </div>
  );
}

/**
 * Le geste de cadrage d'une carte, pour le chef de projet : « Définir » tant
 * que la valeur manque, « Modifier » ensuite.
 */
function BoutonCadrage({ defini, onClick }: { defini: boolean; onClick: () => void }) {
  const t = useTranslations("projets.cadrage");
  return (
    <Button
      type="button"
      size="sm"
      variant={defini ? "ghost" : "default"}
      className={cn(defini && "h-7 px-2 text-xs")}
      onClick={onClick}
    >
      <Pencil aria-hidden="true" />
      {defini ? t("modifier") : t("definir")}
    </Button>
  );
}

/**
 * Ce qu'une carte montre tant que le chef de projet n'a pas fixé sa valeur :
 * « Non défini », et qui doit le faire — ou, pour lui, le bouton qui le fait.
 */
function NonDefini({ onDefinir }: { onDefinir?: () => void }) {
  const t = useTranslations("projets.cadrage");
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xl font-bold text-neutral-400 @[17rem]:text-2xl">{t("nonDefini")}</span>
      {!onDefinir && <span className="text-xs text-neutral-600">{t("attenteChefProjet")}</span>}
    </div>
  );
}

function CarteCalendrier({ projet, onDefinir }: { projet: Projet; onDefinir?: () => void }) {
  const t = useTranslations("ficheProjet.calendrier");
  const echeancier = echeancierProjet(projet);
  const depasse =
    echeancier.joursRestants !== null && echeancier.joursRestants < 0;

  // Le planning ne se demande plus à la création : le chef de projet le fixe ensuite.
  if (!projet.dateDebutPrevue || !projet.dateFinPrevue) {
    return (
      <CarteCle
        icone={<CalendarDays size={18} />}
        titre={t("titre")}
        pastille="primaire"
        mention={onDefinir && <BoutonCadrage defini={false} onClick={onDefinir} />}
      >
        <NonDefini onDefinir={onDefinir} />
      </CarteCle>
    );
  }

  let mention: ReactNode;
  if (projet.dateFinReelle) {
    mention = (
      <Badge variante="succes">
        {t("termineLe", { date: formaterDate(projet.dateFinReelle) })}
      </Badge>
    );
  } else if (echeancier.joursRestants === null) {
    mention = <Badge variante="neutre">{t("clos")}</Badge>;
  } else if (depasse) {
    mention = (
      <Badge variante="erreur">
        {t("echeanceDepassee", { jours: Math.abs(echeancier.joursRestants) })}
      </Badge>
    );
  } else {
    mention = (
      <Badge variante="primaire">
        {t("joursRestants", { jours: echeancier.joursRestants })}
      </Badge>
    );
  }

  return (
    <CarteCle
      icone={<CalendarDays size={18} />}
      titre={t("titre")}
      pastille={depasse ? "erreur" : "primaire"}
      mention={mention}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-neutral-500">{t("debutPrevu")}</span>
          <span className="whitespace-nowrap text-xl font-bold @[17rem]:text-2xl tabular-nums text-neutral-900">
            {formaterDate(projet.dateDebutPrevue)}
          </span>
        </div>
        <ArrowRight
          size={18}
          className="mt-4 shrink-0 text-neutral-400"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-neutral-500">{t("finPrevue")}</span>
          <span
            className={cn(
              "whitespace-nowrap text-xl font-bold @[17rem]:text-2xl tabular-nums",
              depasse ? "text-erreur" : "text-neutral-900",
            )}
          >
            {formaterDate(projet.dateFinPrevue)}
          </span>
        </div>
      </div>

      {echeancier.tempsEcoule !== null && (
        <div className="flex flex-col gap-1.5">
          <Jauge
            valeur={echeancier.tempsEcoule}
            className={depasse ? "bg-erreur" : "bg-primary-500"}
          />
          <span className="text-xs text-neutral-600">
            {t("tempsEcoule", { valeur: echeancier.tempsEcoule })}
          </span>
        </div>
      )}

      <div className={cn(FILET, "flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600")}>
        <span>
          {t("duree", { duree: formaterDuree(echeancier.dureeJours) })}
        </span>
        <span>
          {projet.dateDebutReelle
            ? t("debutReel", { date: formaterDate(projet.dateDebutReelle) })
            : t("nonDemarre")}
        </span>
        {onDefinir && <BoutonCadrage defini onClick={onDefinir} />}
      </div>
    </CarteCle>
  );
}

function CarteBudget({ projet, onDefinir }: { projet: Projet; onDefinir?: () => void }) {
  const t = useTranslations("ficheProjet.budget");
  const ratio = ratioConsommationBudget(
    projet.budgetInitial,
    projet.budgetConsomme,
  );
  const niveau = niveauBudget(ratio);
  const restant = budgetRestant(projet);

  return (
    <CarteCle
      icone={<Wallet size={18} />}
      titre={t("titre")}
      pastille={
        niveau === "depassement"
          ? "erreur"
          : niveau === "alerte"
            ? "avertissement"
            : "secondaire"
      }
      mention={
        ratio !== null && niveau ? (
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              TEXTE_BUDGET[niveau],
            )}
          >
            {t("ratio", { valeur: ratio })}
          </span>
        ) : (
          onDefinir && projet.budgetInitial === null && <BoutonCadrage defini={false} onClick={onDefinir} />
        )
      }
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-neutral-500">{t("initial")}</span>
        {projet.budgetInitial !== null ? (
          <span className="whitespace-nowrap text-xl font-bold @[17rem]:text-2xl tabular-nums text-neutral-900">
            {formaterMontant(projet.budgetInitial)}
          </span>
        ) : (
          <NonDefini onDefinir={onDefinir} />
        )}
      </div>

      {ratio !== null && niveau && (
        <Jauge valeur={ratio} className={JAUGE_BUDGET[niveau]} />
      )}

      <div className={cn(FILET, "grid grid-cols-2 gap-3")}>
        <Detail
          libelle={t("consomme")}
          valeur={formaterMontantCourt(projet.budgetConsomme)}
        />
        <Detail
          libelle={
            restant !== null && restant < 0 ? t("depasse") : t("restant")
          }
          valeur={
            restant === null ? ABSENT : formaterMontantCourt(Math.abs(restant))
          }
          className={cn(restant !== null && restant < 0 && "text-erreur")}
        />
        {onDefinir && projet.budgetInitial !== null && (
          <div className="col-span-2 flex justify-end">
            <BoutonCadrage defini onClick={onDefinir} />
          </div>
        )}
      </div>
    </CarteCle>
  );
}

function CarteAvancement({ projet }: { projet: Projet }) {
  const t = useTranslations("ficheProjet");
  const format = useFormatter();
  const ecart = ecartAvancement(
    projet.avancementReel,
    projet.avancementTheorique,
  );
  const retard = estEnRetard(ecart);
  const sante = couleurIndiceSante(projet.indiceSante);

  return (
    <CarteCle
      icone={<TrendingUp size={18} />}
      titre={t("avancement.titre")}
      pastille={retard ? "avertissement" : "succes"}
      mention={
        <Badge variante={retard ? "avertissement" : "succes"}>
          {retard ? t("avancement.enRetard") : t("avancement.conforme")}
        </Badge>
      }
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-neutral-500">{t("avancement.reel")}</span>
        <span
          className={cn(
            "text-xl font-bold tabular-nums @[17rem]:text-2xl",
            retard ? "text-avertissement" : "text-neutral-900",
          )}
        >
          {formaterPourcentage(projet.avancementReel)}
        </span>
      </div>

      <Jauge
        valeur={projet.avancementReel}
        className={retard ? "bg-avertissement" : "bg-succes"}
        repere={projet.avancementTheorique}
        libelleRepere={t("avancement.repereTheorique")}
      />

      <div className={cn(FILET, "grid grid-cols-3 gap-3")}>
        <Detail
          libelle={t("avancement.theorique")}
          valeur={formaterPourcentage(projet.avancementTheorique)}
        />
        <Detail
          libelle={t("avancement.ecart")}
          valeur={t("points", {
            valeur: format.number(ecart, {
              signDisplay: "exceptZero",
              maximumFractionDigits: 1,
            }),
          })}
          className={cn(retard ? "text-avertissement" : "text-succes")}
        />
        <Detail
          libelle={t("avancement.sante")}
          valeur={
            projet.indiceSante === null
              ? t("avancement.santeInconnue")
              : String(projet.indiceSante)
          }
          className={TON_SANTE[sante]}
        />
      </div>
    </CarteCle>
  );
}

/* ------------------------------------------------------------------ *
 * Les blocs du détail.
 * ------------------------------------------------------------------ */

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className={cn(BLOC, "p-4 shadow-md sm:p-5")}>
      <h2 className="m-0 mb-4 text-base font-semibold text-neutral-900">
        {titre}
      </h2>
      {children}
    </section>
  );
}

function Information({
  libelle,
  large = false,
  children,
}: {
  libelle: string;
  /** Sur toute la largeur de la grille — une description. */
  large?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", large && "col-span-full")}>
      <dt className="text-xs font-medium text-neutral-500">{libelle}</dt>
      <dd className="m-0 flex flex-col text-sm text-neutral-900">{children}</dd>
    </div>
  );
}

/**
 * Une tuile de la structure : une teinte par chiffre, comme les tuiles
 * d'indicateurs des écrans de chantier. Les retards ne rougissent que s'il y
 * en a — un zéro rouge alarmerait pour rien.
 */
function ChiffreStructure({
  libelle,
  valeur,
  teinte,
}: {
  libelle: string;
  valeur: string;
  teinte: FondIndicateur;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-solid p-3",
        FOND_INDICATEUR[teinte],
      )}
    >
      <span className="text-xs text-neutral-600">{libelle}</span>
      <span
        className={cn(
          "text-xl font-bold tabular-nums",
          teinte === "neutre" ? "text-neutral-900" : ICONE[teinte],
        )}
      >
        {valeur}
      </span>
    </div>
  );
}

function LienSection({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border border-solid border-neutral-200 bg-neutral-0 px-3 py-2 text-sm font-medium text-neutral-800 no-underline transition-colors hover:border-primary-300 hover:text-primary-700"
    >
      {children}
      <ChevronRight size={14} aria-hidden="true" />
    </Link>
  );
}
