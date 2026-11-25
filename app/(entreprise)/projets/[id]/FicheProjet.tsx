"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  FileDown,
  History,
  Mail,
  Pencil,
  Phone,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { ReactNode } from "react";

import { Badge, EtatChargement, EtatErreur } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { lireProfilLocal, obtenirProfilMoi } from "@/features/auth/api";
import {
  peutCadrerProjet,
  peutDesignerChefProjet,
  peutGererEncadrement,
  useDroits,
} from "@/features/habilitations";
import {
  lireHistoriqueSante,
  lireProjet,
  lireSanteProjet,
  lireStatistiques,
  listerAffectationsCollaborateurs,
  listerEquipes,
  telechargerContratProjet,
  telechargerOrdreServiceProjet,
} from "@/features/projets/adaptateur";
import {
  cleAffectationsCollaborateurs,
  cleEquipes,
  cleHistoriqueSante,
  cleProjet,
  cleSanteProjet,
  cleStatistiques,
} from "@/features/projets/cles";
import { useGestionProjet } from "@/features/projets/components/GestionProjet";
import { HistoriqueDatesProjet } from "@/features/projets/components/HistoriqueDatesProjet";
import {
  aDureeContractuelle,
  aProlongationContractuelle,
  budgetEnVigueur,
  budgetRestant,
  depassementDecoupage,
  dureeContractuelleTotale,
  ecartAvancement,
  echeancierProjet,
  effectifProjet,
  estEnRetard,
  largeurJauge,
  libelleDelta,
  niveauBudget,
  nomFichierSansExtension,
  principalePenalite,
  ratioConsommationBudget,
  ROLE_PROJET_PAR_FONCTION,
  sourcePlafondBudget,
  tonSante,
} from "@/features/projets/regles";
import { REFERENTIEL_TYPES_PROJET, useReferentiel } from "@/features/projets/referentiels";
import type { NiveauBudget } from "@/features/projets/regles";
import type { AffectationCollaborateur, BadgeSante, Projet } from "@/features/projets/types";
import { afficherTelephone } from "@/features/referentiels/telephone";
import {
  ABSENT,
  couleurIndiceSante,
  formaterDate,
  formaterDuree,
  formaterDureeCalendaire,
  formaterEcartAvancement,
  formaterMontant,
  formaterMontantCourt,
  formaterPourcentage,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  BLOC,
  FOND_INDICATEUR,
  TON_SANTE,
  type FondIndicateur,
} from "../classes";
import {
  AffectationsCollaborateurs,
  FenetreRemplacement,
  TiroirAffectationCollaborateur,
} from "./AffectationsCollaborateurs";
import { EquipeEncadrement } from "./EquipeEncadrement";

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
  const { libelle: libelleType } = useReferentiel(REFERENTIEL_TYPES_PROJET);

  const requete = useQuery({
    queryKey: cleProjet(projetId),
    queryFn: () => lireProjet(projetId),
  });
  const requeteEquipes = useQuery({
    queryKey: cleEquipes(projetId),
    queryFn: ({ signal }) => listerEquipes(projetId, signal),
  });
  const requeteStatistiques = useQuery({
    queryKey: cleStatistiques(projetId),
    queryFn: ({ signal }) => lireStatistiques(projetId, signal),
  });

  // Les fenêtres de retrait de l'encadrement et de cadrage ; celles du projet (modifier, suspendre,
  // supprimer) vivent dans l'en-tête commun aux onglets (`CadreFicheProjet`).
  const { retirerEncadrement, cadrer, modaux } = useGestionProjet(() => undefined);
  const { droits, voitMontants } = useDroits();

  // Pourvoir une place de l'encadrement ouvre **le tiroir d'affectations**, le même que celui du
  // tableau en dessous : il n'y a qu'une façon d'affecter un collaborateur. Changer le chef de
  // projet passe par « Remplacer », la seule voie d'un rôle unique par projet.
  const [ajout, setAjout] = useState<{ role: string; rang: number } | null>(null);
  const [remplacement, setRemplacement] = useState<AffectationCollaborateur | null>(null);
  const [historiqueContratsOuvert, setHistoriqueContratsOuvert] = useState(false);
  const requeteAffectations = useQuery({
    queryKey: cleAffectationsCollaborateurs(projetId),
    queryFn: ({ signal }) => listerAffectationsCollaborateurs(projetId, signal),
  });

  const requeteProfil = useQuery({
    queryKey: ["profil-moi"],
    queryFn: obtenirProfilMoi,
  });
  const profilRetrait = useMemo(() => {
    const p = requeteProfil.data ?? lireProfilLocal();
    if (!p) return null;
    return {
      id: p.id,
      estDg: Boolean(p.is_dg || p.role_global === "DG"),
      estAdministrateur: Boolean(p.role_global === "AD" || p.role_global === "ADMIN"),
    };
  }, [requeteProfil.data]);

  // Les chiffres de structure, recomptés par le serveur sur l'arbre de cases.
  const synthese = requeteStatistiques.data ?? requete.data?.statistiques ?? null;

  // Le cadre (`CadreFicheProjet`) n'affiche l'onglet qu'une fois le projet lu et visible.
  const projet = requete.data;
  if (!projet) return null;
  const lieu = [projet.quartier, projet.ville].filter(Boolean).join(", ");
  // Le planning et le budget : c'est le chef de projet du chantier qui les fixe.
  const cadrable = peutCadrerProjet(projet, droits);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Les chiffres clés : planning, budget, avancement, santé. */}
      <section
        className={cn(
          "grid gap-4 max-lg:grid-cols-1",
          voitMontants
            ? "grid-cols-4 max-2xl:grid-cols-2"
            : "grid-cols-3 max-xl:grid-cols-2",
        )}
      >
        <CarteCalendrier
          projet={projet}
          onDefinir={cadrable ? () => cadrer(projet, "planning") : undefined}
        />
        {voitMontants && (
          <CarteBudget
            projet={projet}
            onDefinir={cadrable ? () => cadrer(projet, "budget") : undefined}
          />
        )}
        <CarteAvancement
          projet={projet}
          avancementReel={
            requeteStatistiques.data?.avancement ?? requete.data?.statistiques?.avancement ?? undefined
          }
        />
        <CarteSante projet={projet} />
      </section>

      <div className="grid grid-cols-[2fr_1fr] items-start gap-6 max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-6">
          <Bloc titre={t("informations.titre")}>
            <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 max-sm:grid-cols-1">
              <Information libelle={t("informations.reference")}>
                <span className="font-mono">{projet.reference}</span>
              </Information>
              <Information libelle={t("informations.natureProjet")}>
                {projet.natureProjet
                  ? tProjets(`natureProjet.${projet.natureProjet}`)
                  : t("informations.nonRenseigne")}
              </Information>
              <Information libelle={t("informations.type")}>
                {projet.typeProjet
                  ? libelleType(projet.typeProjet)
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
              <Information libelle={t("informations.ordreService")}>
                {projet.ordreService ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const blob = await telechargerOrdreServiceProjet(projet.id);
                        const lien = document.createElement("a");
                        lien.href = URL.createObjectURL(blob);
                        lien.download =
                          projet.ordreService?.nom || `ordre-service-${projet.reference}`;
                        lien.click();
                        URL.revokeObjectURL(lien.href);
                      } catch {
                        toast.error(t("informations.erreurTelechargement"));
                      }
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left text-sm font-medium text-primary-600 hover:underline"
                  >
                    <FileDown size={14} aria-hidden="true" />
                    <span className="truncate">{projet.ordreService.nom}</span>
                  </button>
                ) : (
                  <span className="text-neutral-500">
                    {t("informations.nonRenseigne")}
                  </span>
                )}
              </Information>
              {(() => {
                const contratActif = projet.contratActif ?? projet.contrats[0] ?? null;
                const anciennesVersions = projet.historiqueContrats.filter(
                  (c) => !c.estActif && c.id !== contratActif?.id,
                );
                if (!contratActif && anciennesVersions.length === 0) return null;
                const telecharger = async (contrat: (typeof projet.contrats)[number]) => {
                  try {
                    const blob = await telechargerContratProjet(projet.id, contrat.id);
                    const lien = document.createElement("a");
                    lien.href = URL.createObjectURL(blob);
                    lien.download = contrat.nom;
                    lien.click();
                    URL.revokeObjectURL(lien.href);
                  } catch {
                    toast.error(t("informations.erreurTelechargement"));
                  }
                };
                return (
                  <Information libelle={t("informations.contrats")} large>
                    <div className="flex flex-col gap-2">
                      {contratActif && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void telecharger(contratActif)}
                            className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left text-sm font-medium text-primary-600 hover:underline"
                          >
                            <FileDown size={14} aria-hidden="true" />
                            <span>
                              {contratActif.nomSansExtension ||
                                nomFichierSansExtension(contratActif.nom)}
                            </span>
                          </button>
                          {(contratActif.version > 1 || anciennesVersions.length > 0) && (
                            <Badge variante="primaire">
                              {t("informations.versionContrat", {
                                version: contratActif.version,
                              })}
                            </Badge>
                          )}
                          {anciennesVersions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setHistoriqueContratsOuvert((o) => !o)}
                              className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium text-neutral-600 hover:text-primary-600 hover:underline"
                            >
                              <History size={13} aria-hidden="true" />
                              <span>
                                {t("informations.historiqueContrats", {
                                  nombre: anciennesVersions.length,
                                })}
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                      {historiqueContratsOuvert && anciennesVersions.length > 0 && (
                        <ul className="m-0 flex list-none flex-col gap-1.5 rounded-md border border-solid border-neutral-200 bg-neutral-50 p-2.5">
                          {anciennesVersions.map((version) => (
                            <li
                              key={version.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <span className="flex items-center gap-2 text-neutral-700">
                                <Badge variante="neutre">
                                  {t("informations.versionContrat", {
                                    version: version.version,
                                  })}
                                </Badge>
                                <span className="font-medium">
                                  {version.nomSansExtension ||
                                    nomFichierSansExtension(version.nom)}
                                </span>
                                {version.creeLe && (
                                  <span className="text-neutral-500">
                                    {formaterDate(version.creeLe)}
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => void telecharger(version)}
                                className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium text-primary-600 hover:underline"
                              >
                                <FileDown size={13} aria-hidden="true" />
                                <span>{t("informations.telechargerVersion")}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Information>
                );
              })()}
              {projet.description && (
                <Information libelle={t("informations.description")} large>
                  <span className="text-neutral-700">{projet.description}</span>
                </Information>
              )}
            </dl>
          </Bloc>

          <Bloc titre={t("structure.titre")}>
            {!synthese && requeteStatistiques.isPending && <EtatChargement />}
            {!synthese && requeteStatistiques.isError && (
              <EtatErreur onReessayer={() => void requeteStatistiques.refetch()} />
            )}
            {synthese && (
              <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
                <ChiffreStructure
                  libelle={t("structure.cases")}
                  valeur={String(synthese.cases)}
                  teinte="primaire"
                />
                <ChiffreStructure
                  libelle={t("structure.taches")}
                  valeur={String(synthese.taches)}
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
                href={`/projets/${projet.id}/decoupage`}
              >
                {t("structure.voirLots")}
              </LienSection>
              <LienSection href={`/projets/${projet.id}/equipes`}>
                {t("structure.voirEquipes")}
              </LienSection>
              {/* Pas de chiffre tant qu'on ne le connaît pas : « 0 » se lirait comme un fait.
                  Deux chiffres, deux réalités : les collaborateurs (des comptes affectés au
                  projet) et les membres d'équipes (la main-d'œuvre du registre, sans compte). */}
              {requeteAffectations.isSuccess && (
                <PastilleEffectif>
                  {t.rich("structure.collaborateurs", {
                    nombre: requeteAffectations.data.filter((a) => !a.dateFin).length,
                    fort: (chunks) => <strong className="text-base font-bold">{chunks}</strong>,
                  })}
                </PastilleEffectif>
              )}
              {requeteEquipes.isSuccess && (
                <PastilleEffectif>
                  {t.rich("structure.membresEquipes", {
                    nombre: effectifProjet(requeteEquipes.data),
                    fort: (chunks) => <strong className="text-base font-bold">{chunks}</strong>,
                  })}
                </PastilleEffectif>
              )}
            </div>
          </Bloc>
        </div>

        <EquipeEncadrement
          projet={projet}
          profil={profilRetrait}
          peutDesigner={peutDesignerChefProjet(projet, droits)}
          peutGerer={peutGererEncadrement(projet, droits)}
          onAjouter={(fonction) => {
            const chef = projet.chefProjet;
            const affectationChef = chef
              ? requeteAffectations.data?.find((a) => a.utilisateur.id === chef.id)
              : undefined;
            if (fonction === "CHEF_PROJET" && affectationChef) {
              setRemplacement(affectationChef);
              return;
            }
            setAjout((courant) => ({
              role: fonction === "AUTRE_MEMBRE" ? "" : ROLE_PROJET_PAR_FONCTION[fonction],
              rang: (courant?.rang ?? 0) + 1,
            }));
          }}
          onRetirer={(fonction, intervenant, affectationId, roleLibelle) =>
            retirerEncadrement({ projet, fonction, intervenant, affectationId, roleLibelle })
          }
        />
      </div>

      <AffectationsCollaborateurs projet={projet} />

      <HistoriqueDatesProjet projet={projet} />

      {ajout && (
        <TiroirAffectationCollaborateur
          key={ajout.rang}
          projet={projet}
          affectation={null}
          roleInitial={ajout.role}
          onFermer={() => setAjout(null)}
        />
      )}
      {remplacement && (
        <FenetreRemplacement projet={projet} affectation={remplacement} onFermer={() => setRemplacement(null)} />
      )}

      {modaux}
    </div>
  );
}

function PastilleEffectif({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-solid border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700">
      <Users size={16} aria-hidden="true" />
      <span>{children}</span>
    </span>
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
function BoutonCadrage({
  defini,
  onClick,
  libelle,
}: {
  defini: boolean;
  onClick: () => void;
  libelle?: string;
}) {
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
      {libelle ?? (defini ? t("modifier") : t("definir"))}
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
  const tReprog = useTranslations("projets.reprogrammation");
  const echeancier = echeancierProjet(projet);
  const depasse =
    echeancier.joursRestants !== null && echeancier.joursRestants < 0;
  const aDebutContractuel = Boolean(projet.dateDebutContractuelle);
  const aDuree = aDureeContractuelle(projet);
  const aProlongation = aProlongationContractuelle(projet);
  const dureeTotale = dureeContractuelleTotale(projet);
  const aPrevisionnel = Boolean(projet.dateDebutPrevue && projet.dateFinPrevue);

  let mention: ReactNode;
  if (projet.dateFinReelle) {
    mention = (
      <Badge variante="succes">
        {t("termineLe", { date: formaterDate(projet.dateFinReelle) })}
      </Badge>
    );
  } else if (!aPrevisionnel) {
    mention = onDefinir ? <BoutonCadrage defini={false} onClick={onDefinir} /> : undefined;
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
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {t("blocContractuel")}
        </span>
        {aDebutContractuel && projet.dateFinContractuelle ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-neutral-500">{t("debutContractuel")}</span>
                <span className="whitespace-nowrap text-lg font-bold tabular-nums text-neutral-900 @[20rem]:text-xl">
                  {formaterDate(projet.dateDebutContractuelle)}
                </span>
              </div>
              <ArrowRight
                size={16}
                className="mt-4 shrink-0 text-neutral-400"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-neutral-500">{t("finContractuelle")}</span>
                <span className="whitespace-nowrap text-lg font-bold tabular-nums text-neutral-900 @[20rem]:text-xl">
                  {formaterDate(projet.dateFinContractuelle)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
              {dureeTotale && (
                <span>
                  {t(aProlongation ? "dureeContractuelleTotale" : "dureeContractuelle", {
                    duree: formaterDureeCalendaire(dureeTotale),
                  })}
                </span>
              )}
              {aProlongation && projet.dateFinContractuelleInitiale && (
                <span className="text-neutral-500">
                  {t("finContractuelleInitiale", {
                    date: formaterDate(projet.dateFinContractuelleInitiale),
                  })}
                </span>
              )}
              {aProlongation && (
                <span className="font-medium text-primary-700">
                  {t("avenantsDelai", {
                    duree: formaterDureeCalendaire({
                      annees: projet.prolongationAnnees,
                      mois: projet.prolongationMois,
                      jours: projet.prolongationJours,
                    }),
                  })}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
            {aDebutContractuel && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-neutral-500">{t("debutContractuel")}</span>
                <span className="text-sm font-semibold tabular-nums text-neutral-900">
                  {formaterDate(projet.dateDebutContractuelle)}
                </span>
              </div>
            )}
            {dureeTotale && (
              <span>
                {t(aProlongation ? "dureeContractuelleTotale" : "dureeContractuelle", {
                  duree: formaterDureeCalendaire(dureeTotale),
                })}
              </span>
            )}
            {aProlongation && (
              <span className="font-medium text-primary-700">
                {t("avenantsDelai", {
                  duree: formaterDureeCalendaire({
                    annees: projet.prolongationAnnees,
                    mois: projet.prolongationMois,
                    jours: projet.prolongationJours,
                  }),
                })}
              </span>
            )}
            <span className="text-neutral-500">
              {!aDebutContractuel && !aDuree
                ? t("attenteCadreContractuel")
                : !aDebutContractuel
                  ? t("attenteOs")
                  : t("attenteDuree")}
            </span>
          </div>
        )}
      </div>

      <div className={cn(FILET, "flex min-w-0 flex-col gap-2")}>
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {t("blocPrevisionnel")}
        </span>
        {aPrevisionnel ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-neutral-500">{t("debutPrevu")}</span>
                <span className="whitespace-nowrap text-lg font-bold tabular-nums text-neutral-900 @[20rem]:text-xl">
                  {formaterDate(projet.dateDebutPrevue)}
                </span>
              </div>
              <ArrowRight
                size={16}
                className="mt-4 shrink-0 text-neutral-400"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-neutral-500">{t("finPrevue")}</span>
                <span
                  className={cn(
                    "whitespace-nowrap text-lg font-bold tabular-nums @[20rem]:text-xl",
                    depasse ? "text-erreur" : "text-neutral-900",
                  )}
                >
                  {formaterDate(projet.dateFinPrevue)}
                </span>
              </div>
            </div>

            {echeancier.tempsEcoule !== null && (
              <div className="flex flex-col gap-1">
                <Jauge
                  valeur={echeancier.tempsEcoule}
                  className={depasse ? "bg-erreur" : "bg-primary-500"}
                />
                <span className="text-xs text-neutral-600">
                  {t("tempsEcoule", { valeur: echeancier.tempsEcoule })}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-neutral-600">
              <span>
                {t("duree", { duree: formaterDuree(projet.duree ?? echeancier.duree) })}
              </span>
              <span>
                {projet.dateDebutReelle
                  ? t("debutReel", { date: formaterDate(projet.dateDebutReelle) })
                  : t("nonDemarre")}
              </span>
              {onDefinir && (
                <BoutonCadrage
                  defini
                  onClick={onDefinir}
                  libelle={tReprog("modifierDates")}
                />
              )}
            </div>
          </>
        ) : (
          <NonDefini onDefinir={onDefinir} />
        )}
      </div>
    </CarteCle>
  );
}

function CarteBudget({ projet, onDefinir }: { projet: Projet; onDefinir?: () => void }) {
  const t = useTranslations("ficheProjet.budget");
  // Tout se mesure sur le budget en vigueur : contractuel dès qu'un contrat le fixe, prévisionnel
  // sinon. Le « consommé » est la valeur de ce qui est réalisé (Σ montant × avancement).
  const ratio = ratioConsommationBudget(budgetEnVigueur(projet), projet.budgetConsomme);
  const niveau = niveauBudget(ratio);
  const restant = budgetRestant(projet);
  const depasseDecoupage = depassementDecoupage(projet);
  const sourcePlafond = sourcePlafondBudget(projet);
  const aBudgetContractuel = projet.budgetCourant !== null;
  const boutonEnTete = !ratio && onDefinir && !aBudgetContractuel && projet.budgetInitial === null;

  return (
    <CarteCle
      icone={<Wallet size={18} />}
      titre={t("titre")}
      pastille={niveau === "depassement" || (depasseDecoupage ?? 0) > 0 ? "erreur" : "secondaire"}
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
          boutonEnTete && <BoutonCadrage defini={false} onClick={onDefinir} />
        )
      }
    >
      <div className="flex flex-col gap-1">
        {aBudgetContractuel ? (
          <>
            <span className="text-xs text-neutral-500">{t("contractuel")}</span>
            <span className="whitespace-nowrap text-xl font-bold @[17rem]:text-2xl tabular-nums text-neutral-900">
              {formaterMontant(projet.budgetCourant)}
            </span>
          </>
        ) : (
          <>
            <span className="text-xs text-neutral-500">{t("initial")}</span>
            {projet.budgetInitial !== null ? (
              <span className="whitespace-nowrap text-xl font-bold @[17rem]:text-2xl tabular-nums text-neutral-900">
                {formaterMontant(projet.budgetInitial)}
              </span>
            ) : (
              <NonDefini onDefinir={onDefinir} />
            )}
            <span className="text-xs text-neutral-500">
              {t("contractuel")} : {t("sansContrat")}
            </span>
          </>
        )}
      </div>

      {ratio !== null && niveau && (
        <Jauge valeur={ratio} className={JAUGE_BUDGET[niveau]} />
      )}

      <div className={cn(FILET, "grid grid-cols-2 gap-3")}>
        {aBudgetContractuel && (
          <Detail
            libelle={t("initial")}
            valeur={
              projet.budgetInitial !== null
                ? formaterMontantCourt(projet.budgetInitial)
                : ABSENT
            }
          />
        )}
        {aBudgetContractuel && projet.montantAvenants > 0 && projet.budgetContractuelInitial !== null && (
          <Detail
            libelle={t("contractuelInitial")}
            valeur={formaterMontantCourt(projet.budgetContractuelInitial)}
          />
        )}
        {projet.montantAvenants > 0 && (
          <Detail
            libelle={t("avenants")}
            valeur={t("avenantsValeur", {
              sens: "plus",
              montant: formaterMontantCourt(projet.montantAvenants),
            })}
          />
        )}
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
        {projet.budgetDecoupage !== null && projet.budgetDecoupage > 0 && (
          <Detail
            libelle={t("decoupage")}
            valeur={formaterMontantCourt(projet.budgetDecoupage)}
            className={cn((depasseDecoupage ?? 0) > 0 && "text-erreur")}
          />
        )}
        {(depasseDecoupage ?? 0) > 0 && (
          <p className="col-span-2 m-0 text-xs text-erreur">
            {t(
              sourcePlafond === "CONTRACTUEL"
                ? "decoupageDepasseContractuel"
                : "decoupageDepassePrevisionnel",
              { montant: formaterMontantCourt(depasseDecoupage ?? 0) },
            )}
          </p>
        )}
        {onDefinir && !boutonEnTete && (
          <div className="col-span-2 flex justify-end">
            <BoutonCadrage defini={projet.budgetInitial !== null} onClick={onDefinir} />
          </div>
        )}
      </div>
    </CarteCle>
  );
}

function CarteAvancement({
  projet,
  avancementReel,
}: {
  projet: Projet;
  avancementReel?: number;
}) {
  const t = useTranslations("ficheProjet");
  const reel = avancementReel ?? projet.avancementReel;
  const ecart = ecartAvancement(
    reel,
    projet.avancementTheorique,
  );
  const retard = estEnRetard(ecart);
  const sante = couleurIndiceSante(projet.indiceSante);
  const infoDelta = libelleDelta(projet.deltaRetard);

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
          {formaterPourcentage(reel)}
        </span>
      </div>

      <Jauge
        valeur={reel}
        className={retard ? "bg-avertissement" : "bg-succes"}
        repere={projet.avancementTheorique}
        libelleRepere={t("avancement.repereTheorique")}
      />

      <div
        className={cn(
          FILET,
          infoDelta ? "grid grid-cols-2 gap-3 sm:grid-cols-4" : "grid grid-cols-3 gap-3",
        )}
      >
        <Detail
          libelle={t("avancement.theorique")}
          valeur={formaterPourcentage(projet.avancementTheorique)}
        />
        <Detail
          libelle={t("avancement.ecart")}
          valeur={formaterEcartAvancement(ecart)}
          className={cn(retard ? "text-avertissement" : "text-succes")}
        />
        {infoDelta && (
          <Detail
            libelle={t("avancement.delta")}
            valeur={t(infoDelta.cle, infoDelta.params)}
            className={cn(
              (projet.deltaRetard ?? 0) > 0
                ? "text-avertissement"
                : (projet.deltaRetard ?? 0) < 0
                  ? "text-succes"
                  : "text-neutral-900",
            )}
          />
        )}
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

function CourbeSante({
  points,
  badge,
}: {
  points: number[];
  badge?: BadgeSante | string | null;
}) {
  if (points.length < 2) return null;

  const min = 0;
  const max = 100;
  const width = 80;
  const height = 30;
  const padding = 2;

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((p - min) / (max - min)) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const couleurStroke =
    badge === "VERT"
      ? "stroke-succes"
      : badge === "ORANGE"
        ? "stroke-avertissement"
        : badge === "ROUGE"
          ? "stroke-erreur"
          : "stroke-neutral-500";

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible shrink-0"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={couleurStroke}
        points={coords.join(" ")}
      />
    </svg>
  );
}

function CarteSante({ projet }: { projet: Projet }) {
  const t = useTranslations("ficheProjet");
  const requeteSante = useQuery({
    queryKey: cleSanteProjet(projet.id),
    queryFn: () => lireSanteProjet(projet.id),
  });
  const requeteHistorique = useQuery({
    queryKey: cleHistoriqueSante(projet.id),
    queryFn: () => lireHistoriqueSante(projet.id),
  });

  const sante = requeteSante.data;

  const points = useMemo(() => {
    const historique = requeteHistorique.data ?? [];
    if (!historique.length) return [];
    return [...historique].reverse().map((h) => h.score);
  }, [requeteHistorique.data]);

  const pastille: keyof typeof ICONE =
    sante?.badge === "VERT"
      ? "succes"
      : sante?.badge === "ORANGE"
        ? "avertissement"
        : sante?.badge === "ROUGE"
          ? "erreur"
          : "primaire";

  const mention = sante?.badge ? (
    <Badge variante={tonSante(sante.badge)}>
      {t(`sante.badge.${sante.badge}`)}
    </Badge>
  ) : (
    <Badge variante="neutre">{t("sante.nonCalcule")}</Badge>
  );

  const penalitePrincipale = sante ? principalePenalite(sante) : "aucune";
  const explication =
    penalitePrincipale === "delais"
      ? t("sante.explication", { penalite: t("sante.penaliteDelais") })
      : penalitePrincipale === "blocages"
        ? t("sante.explication", { penalite: t("sante.penaliteBlocages") })
        : penalitePrincipale === "reporting"
          ? t("sante.explication", { penalite: t("sante.penaliteReporting") })
          : t("sante.aucunePenalite");

  const estNonDemarre = sante?.etatCalcul === "NON_DEMARRE";
  const estFige = sante?.etatCalcul === "FIGE";

  return (
    <CarteCle
      icone={<Activity size={18} />}
      titre={t("sante.titre")}
      pastille={pastille}
      mention={mention}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-neutral-500">{t("sante.titre")}</span>
          <span
            className={cn(
              "text-xl font-bold tabular-nums @[17rem]:text-2xl",
              sante?.score !== null && sante?.score !== undefined
                ? sante.score < 50
                  ? "text-erreur"
                  : sante.score < 80
                    ? "text-avertissement"
                    : "text-neutral-900"
                : "text-neutral-400",
            )}
          >
            {sante?.score !== null && sante?.score !== undefined
              ? t("sante.score", { score: sante.score })
              : t("sante.nonCalcule")}
          </span>
        </div>
        {points.length >= 2 && <CourbeSante points={points} badge={sante?.badge} />}
      </div>

      {estNonDemarre ? (
        <p className="m-0 text-xs text-neutral-600">{t("sante.nonDemarre")}</p>
      ) : estFige ? (
        <p className="m-0 text-xs text-neutral-600">{t("sante.fige")}</p>
      ) : sante ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-neutral-500">{t("sante.delais")}</span>
                <span className="font-semibold tabular-nums text-neutral-800">
                  {t("sante.points", { points: Math.round(sante.penaliteDelais) })}
                </span>
              </div>
              <Jauge
                valeur={(sante.penaliteDelais / 40) * 100}
                className={sante.penaliteDelais > 0 ? "bg-erreur" : "bg-neutral-300"}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-neutral-500">{t("sante.blocages")}</span>
                <span className="font-semibold tabular-nums text-neutral-800">
                  {t("sante.points", { points: Math.round(sante.penaliteBlocages) })}
                </span>
              </div>
              <Jauge
                valeur={(sante.penaliteBlocages / 35) * 100}
                className={sante.penaliteBlocages > 0 ? "bg-erreur" : "bg-neutral-300"}
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-neutral-500">{t("sante.reporting")}</span>
                <span className="font-semibold tabular-nums text-neutral-800">
                  {t("sante.points", { points: Math.round(sante.penaliteReporting) })}
                </span>
              </div>
              <Jauge
                valeur={(sante.penaliteReporting / 25) * 100}
                className={sante.penaliteReporting > 0 ? "bg-erreur" : "bg-neutral-300"}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className={cn(FILET, "text-xs text-neutral-600")}>
        {sante?.score !== null && sante?.score !== undefined ? (
          <span>{explication}</span>
        ) : (
          <span>{t("sante.nonDemarre")}</span>
        )}
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
