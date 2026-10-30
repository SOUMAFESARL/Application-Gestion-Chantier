"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, LoaderCircle, Pause, Pencil, Play, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import { AccesNonAutorise, projetVisible, useDroits } from "@/features/habilitations";
import { lireProjet } from "@/features/projets/adaptateur";
import { cleProjet } from "@/features/projets/cles";
import { useGestionProjet } from "@/features/projets/components/GestionProjet";
import { REFERENTIEL_TYPES_PROJET, useReferentiel } from "@/features/projets/referentiels";
import { peutReprendre, peutSuspendre, projetModifiable } from "@/features/projets/regles";
import { cn } from "@/lib/utils";

import { BARRE_PROJET, BARRE_PROJET_COLLEE, TON_STATUT } from "../classes";
import { useEstColle } from "../EnteteChantier";
import { useGenerationFicheProjet } from "./GenerationFicheProjet";
import { OngletsProjet } from "./OngletsProjet";

/**
 * Le cadre de la fiche d'un projet, commun à ses onglets (décision P5) : le lien de retour,
 * l'en-tête collant (nom, type, statut, actions du projet), puis la barre d'onglets.
 *
 * Le chargement, l'erreur et le refus d'accès se décident ici, une fois : un onglet ne s'affiche
 * qu'une fois le projet lu et visible, et lit ensuite le même cache (`cleProjet`).
 */
export function CadreFicheProjet({ projetId, children }: { projetId: string; children: ReactNode }) {
  const t = useTranslations("ficheProjet");
  const tProjets = useTranslations("projets");
  const { libelle: libelleType } = useReferentiel(REFERENTIEL_TYPES_PROJET);

  const requete = useQuery({
    queryKey: cleProjet(projetId),
    queryFn: () => lireProjet(projetId),
  });

  /**
   * L'en-tête reste collé sous celui de l'application, comme le sélecteur
   * des écrans de chantier : on sait toujours de quel projet on lit la fiche.
   */
  const [entete, setEntete] = useState<HTMLDivElement | null>(null);
  const colle = useEstColle(entete);
  const router = useRouter();
  // Un projet supprimé n'a plus de fiche : on revient au portefeuille.
  const { modifier, basculerSuspension, supprimer, modaux } = useGestionProjet(() =>
    router.replace("/projets"),
  );
  const fichePdf = useGenerationFicheProjet(requete.data);
  const { droits, peutSurProjet } = useDroits();

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

  // Hors direction, un chantier dont on n'est pas n'a pas de fiche à montrer.
  if (!projetVisible(projet, droits)) {
    return (
      <div className="flex flex-col gap-6">
        {retour}
        <AccesNonAutorise />
      </div>
    );
  }

  const peutModifierProjet = peutSurProjet("projets.ecrire", projet);
  const peutChangerStatutProjet = peutSurProjet("projets.changer_statut", projet);
  const peutResilierProjet = peutSurProjet("projets.resilier_archiver", projet);

  return (
    <div className="flex w-full flex-col gap-6">
      {retour}

      <div ref={setEntete} className={cn(BARRE_PROJET, colle && BARRE_PROJET_COLLEE)}>
        {/*
         * Sur téléphone, le nom d'un chantier est long : collé à droite, les
         * badges et boutons l'écrasaient sur trois lignes, et la
         * barre collante mangeait la moitié de l'écran. En dessous de `sm`,
         * les actions passent sous le titre, calées à gauche, et le titre
         * descend à `text-xl` (`!` : `.text-h3` est une classe globale hors
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
              {projet.typeProjet && <Badge variante="neutre">{libelleType(projet.typeProjet)}</Badge>}
              <Badge variante={TON_STATUT[projet.statut]}>{tProjets(`statut.${projet.statut}`)}</Badge>
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
                {peutModifierProjet && projetModifiable(projet) && (
                  <DropdownMenuItem onSelect={() => modifier(projet)}>
                    <Pencil aria-hidden="true" />
                    {t("modifier")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={fichePdf.generer} disabled={fichePdf.enCours}>
                  <Printer aria-hidden="true" />
                  {t("exporterPdf")}
                </DropdownMenuItem>
                {peutChangerStatutProjet && (peutSuspendre(projet) || peutReprendre(projet)) && (
                  <DropdownMenuSeparator />
                )}
                {peutChangerStatutProjet && peutSuspendre(projet) && (
                  <DropdownMenuItem
                    onSelect={() => basculerSuspension(projet)}
                    className="text-avertissement focus:text-avertissement"
                  >
                    <Pause className="text-avertissement" aria-hidden="true" />
                    {t("suspendre")}
                  </DropdownMenuItem>
                )}
                {peutChangerStatutProjet && peutReprendre(projet) && (
                  <DropdownMenuItem
                    onSelect={() => basculerSuspension(projet)}
                    className="text-succes focus:text-succes"
                  >
                    <Play className="text-succes" aria-hidden="true" />
                    {t("reprendre")}
                  </DropdownMenuItem>
                )}
                {peutResilierProjet && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => supprimer(projet)}
                      className="text-erreur focus:text-erreur"
                    >
                      <Trash2 className="text-erreur" aria-hidden="true" />
                      {t("supprimer")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </div>

      <OngletsProjet projetId={projet.id} />

      {children}

      {modaux}
      {fichePdf.indicateur}
    </div>
  );
}
