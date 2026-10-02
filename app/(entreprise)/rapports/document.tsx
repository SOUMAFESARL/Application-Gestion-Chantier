"use client";

import { ArrowLeft, Check, ChevronDown, Clock, FileDown, PenLine, Printer, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReactNode } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EtapeCircuit } from "@/features/chantier";
import { formaterDateHeure } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BARRE_PROJET, BARRE_PROJET_COLLEE, CHIFFRE_ALERTE, FOND_INDICATEUR } from "../projets/classes";
import type { FondIndicateur } from "../projets/classes";
import { useEstColle } from "../projets/EnteteChantier";
import { JAUGE, JAUGE_REMPLIE, PASTILLE_ETAPE } from "./classes";

/**
 * Les pièces des deux documents du journal — le rapport journalier et la
 * synthèse périodique. Ils reprennent la mise en page des PDF transmis par
 * le client (en-tête, bandeau de statut, identification, chiffres, sections
 * numérotées, circuit de signatures) : l'écran **est** le document, et
 * « Imprimer / PDF » le sort tel quel par le navigateur.
 */

/**
 * L'en-tête de l'écran, calqué sur celui de la fiche projet : le retour au
 * journal, le titre et ses badges, les actions regroupées derrière un seul
 * bouton. Il reste collé sous l'en-tête de l'application, et ne s'imprime
 * pas — le cartouche du document, dessous, porte déjà tout ce que le papier
 * doit dire.
 *
 * Le conteneur est en `contents` : un élément `sticky` ne colle qu'à
 * l'intérieur de son parent, et une boîte qui n'enveloppait que le lien retour
 * et la barre la décollait dès le premier défilement. Sans boîte, la barre
 * colle sur toute la hauteur de l'écran.
 */
export function BarreDocument({
  titre,
  badges,
  pdf,
}: {
  titre: string;
  badges: ReactNode;
  /**
   * Le document généré en PDF (en-tête et pied de la fiche projet). Présent,
   * il se télécharge, et c'est lui qui s'imprime ; absent, « Imprimer »
   * imprime l'écran.
   */
  pdf?: { telecharger: () => void; imprimer: () => void; enCours: boolean };
}) {
  const t = useTranslations("journal.document");
  const [entete, setEntete] = useState<HTMLDivElement | null>(null);
  const colle = useEstColle(entete);

  return (
    <div className="contents print:hidden">
      <nav className="mb-2">
        <Link
          href="/rapports"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 no-underline transition-colors hover:text-primary-600 hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{t("retour")}</span>
        </Link>
      </nav>

      <div ref={setEntete} className={cn(BARRE_PROJET, colle && BARRE_PROJET_COLLEE)}>
        <EnTetePage
          className={cn(
            "max-sm:flex-col max-sm:gap-3",
            "max-sm:[&_h1]:text-xl!",
            "max-sm:[&_h1]:leading-snug!",
            "max-sm:[&>div:last-child]:justify-start max-sm:[&>div:last-child]:gap-2",
            !colle && "border-0 border-b border-solid border-neutral-200 pb-4",
          )}
          titre={titre}
          description={<span className="mt-1 flex flex-wrap items-center gap-2">{badges}</span>}
          actions={
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  {t("actions")}
                  <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" className="min-w-48">
                {pdf && (
                  <DropdownMenuItem disabled={pdf.enCours} onSelect={pdf.telecharger}>
                    <FileDown aria-hidden="true" />
                    {t("telecharger")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled={pdf?.enCours} onSelect={pdf ? pdf.imprimer : () => window.print()}>
                  <Printer aria-hidden="true" />
                  {t("imprimer")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </div>
    </div>
  );
}

/**
 * Le cartouche du document : son titre à gauche, sa référence à droite. Le
 * bandeau de statut dessous est facultatif — le rapport journalier n'en a
 * pas, son circuit de signatures dit déjà où en est la validation.
 */
export function EnTeteDocument({
  titre,
  sousTitre,
  reference,
  bandeau,
}: {
  titre: string;
  sousTitre: string;
  reference?: string;
  bandeau?: ReactNode;
}) {
  return (
    <header className="overflow-hidden rounded-t-xl">
      <div className="flex flex-wrap items-start justify-between gap-4 bg-secondary-900 px-5 py-5 text-neutral-0 sm:px-8">
        <div className="min-w-0">
          <h1 className="m-0 text-h3 font-bold !text-neutral-0">{titre}</h1>
          <p className="m-0 mt-1 text-sm text-secondary-200">{sousTitre}</p>
        </div>
        {reference && (
          <span className="rounded-md bg-neutral-0/10 px-3 py-1.5 font-mono text-sm font-semibold tracking-wide">
            {reference}
          </span>
        )}
      </div>
      {bandeau}
    </header>
  );
}

/** Le bandeau sous le cartouche : le statut du document, et ce qu'on attend. */
export function BandeauDocument({ ton, children }: { ton: "succes" | "information" | "avertissement" | "erreur"; children: ReactNode }) {
  const tons = {
    succes: "bg-succes-fond text-succes",
    information: "bg-information-fond text-information",
    avertissement: "bg-avertissement-fond text-avertissement",
    erreur: "bg-erreur-fond text-erreur",
  } as const;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2.5 text-sm sm:px-8", tons[ton])}>
      {children}
    </div>
  );
}

/** Une grille libellé / valeur : l'identification, les intervenants, la météo. */
export function GrilleInfos({ titre, lignes }: { titre: string; lignes: [string, ReactNode][] }) {
  return (
    <section className="min-w-0 rounded-lg border border-neutral-200 break-inside-avoid">
      <h3 className="m-0 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold tracking-wide text-neutral-600 uppercase">
        {titre}
      </h3>
      <dl className="m-0 divide-y divide-neutral-100">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-4 py-2 text-sm">
            <dt className="text-neutral-500">{libelle}</dt>
            <dd className="m-0 font-medium text-neutral-900">{valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Une case de la rangée de chiffres. Avec `fond`, elle prend la teinte des
 * tuiles d'indicateur de la fiche projet (`FOND_INDICATEUR`) ; sans, elle
 * reste blanche, ou primaire avec `accent`.
 */
export function ChiffreDocument({
  libelle,
  valeur,
  detail,
  alerte = false,
  accent = false,
  fond,
}: {
  libelle: string;
  valeur: ReactNode;
  detail: ReactNode;
  alerte?: boolean;
  accent?: boolean;
  fond?: FondIndicateur;
}) {
  const encreAlerte = (fond && CHIFFRE_ALERTE[fond]) ?? "text-erreur";
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 break-inside-avoid",
        fond ? FOND_INDICATEUR[fond] : accent ? "border-primary-200 bg-primary-50" : "border-neutral-200 bg-neutral-0",
      )}
    >
      <span className="text-xs text-neutral-500">{libelle}</span>
      <span className={cn("text-xl font-bold tabular-nums", alerte ? encreAlerte : "text-neutral-900")}>{valeur}</span>
      <span className={cn("text-xs", alerte ? encreAlerte : "text-neutral-500")}>{detail}</span>
    </div>
  );
}

/** Une section numérotée du document. */
export function SectionDocument({
  numero,
  titre,
  children,
  complement,
}: {
  numero: number;
  titre: string;
  children: ReactNode;
  complement?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 break-inside-avoid-page">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-primary-500 pb-1.5">
        <h2 className="m-0 flex items-baseline gap-2 text-base font-semibold text-neutral-900">
          <span className="text-primary-600 tabular-nums">{numero}.</span>
          {titre}
        </h2>
        {complement && <span className="text-xs text-neutral-500">{complement}</span>}
      </header>
      {children}
    </section>
  );
}

export interface ColonneDocument {
  entete: string;
  /** Les nombres s'alignent à droite, pour que les unités se lisent en colonne. */
  nombre?: boolean;
}

/**
 * Un tableau de document : pas de tri, pas de pagination — il s'imprime entier.
 *
 * Entier aussi en largeur : les en-têtes passent à la ligne (la primitive les
 * garde sur une seule), sans quoi un tableau de huit colonnes dépassait la
 * largeur de la page et le navigateur rognait les dernières à l'impression.
 */
export function TableauDocument({
  colonnes,
  lignes,
  pied,
  vide,
}: {
  colonnes: ColonneDocument[];
  lignes: { cle: string; cellules: ReactNode[]; accent?: boolean }[];
  pied?: ReactNode[];
  vide?: string;
}) {
  const aligner = (rang: number) => (colonnes[rang]?.nombre ? "text-right tabular-nums" : "");
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 print:overflow-visible">
      <Table className="text-xs sm:text-sm print:text-xs">
        <TableHeader>
          <TableRow className="bg-neutral-50 hover:bg-neutral-50">
            {colonnes.map((colonne, rang) => (
              <TableHead key={colonne.entete} className={cn("h-9 px-3 text-xs font-semibold whitespace-normal text-neutral-600 print:px-2", aligner(rang))}>
                {colonne.entete}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignes.length === 0 && vide ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colonnes.length} className="py-5 text-center text-neutral-500 italic">
                {vide}
              </TableCell>
            </TableRow>
          ) : (
            lignes.map((ligne) => (
              <TableRow key={ligne.cle} className={cn("border-b border-neutral-100", ligne.accent && "bg-neutral-50 font-semibold")}>
                {ligne.cellules.map((cellule, rang) => (
                  <TableCell key={rang} className={cn("px-3 py-2 whitespace-normal print:px-2", aligner(rang))}>
                    {cellule}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
        {pied && (
          <TableFooter>
            <TableRow className="bg-neutral-100 font-semibold hover:bg-neutral-100">
              {pied.map((cellule, rang) => (
                <TableCell key={rang} className={cn("px-3 py-2 whitespace-normal print:px-2", aligner(rang))}>
                  {cellule}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}

/** Une jauge d'avancement et son pourcentage. */
export function Jauge({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className={JAUGE} aria-hidden="true">
        <span className={JAUGE_REMPLIE} style={{ width: `${Math.max(0, Math.min(100, valeur))}%` }} />
      </span>
      <span className="w-9 text-right font-semibold tabular-nums">{libelle}</span>
    </span>
  );
}

const ICONE_ETAPE = { SIGNE: Check, REJETE: X, EN_ATTENTE: Clock, A_VENIR: PenLine } as const;

/**
 * Le circuit de signatures en pied de document : une colonne par signataire.
 * Chaque étape débloque la suivante ; après la dernière, le document est
 * immuable.
 */
export function CircuitSignatures({ circuit }: { circuit: EtapeCircuit[] }) {
  const t = useTranslations("journal.circuit");
  return (
    <ol
      className={cn(
        "m-0 grid list-none gap-3 p-0",
        circuit.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {circuit.map((etape) => {
        const Icone = ICONE_ETAPE[etape.etat];
        return (
          <li key={etape.role} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 break-inside-avoid">
            <span className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {t(`role.${etape.role}`)}
            </span>
            <span
              className={cn(
                "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                PASTILLE_ETAPE[etape.etat],
              )}
            >
              <Icone className="size-3.5" aria-hidden="true" />
              {t(`statut.${etape.etat}`)}
            </span>
            <span className="text-sm font-semibold text-neutral-900">{etape.signataire}</span>
            <span className="text-xs text-neutral-600">
              {etape.signeLe
                ? t("signeLe", { quand: formaterDateHeure(etape.signeLe) })
                : etape.echeance
                  ? t("delai", { quand: formaterDateHeure(etape.echeance) })
                  : t("enAttentePrecedente")}
            </span>
            {etape.commentaire && (
              <span className="rounded-md bg-erreur-fond px-2 py-1.5 text-xs text-erreur">{etape.commentaire}</span>
            )}
            <span className="mt-auto border-t border-dashed border-neutral-300 pt-2 text-xs text-neutral-400">
              {etape.signeLe ? t("signatureNumerique") : t("signatureAttendue")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Le pied du document. */
export function PiedDocument({ mention, reference }: { mention?: string; reference?: string }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3 text-xs text-neutral-500 sm:px-8">
      {mention && <span>{mention}</span>}
      {reference && <span className="font-mono">{reference}</span>}
    </footer>
  );
}

/** Le corps d'un document : le papier blanc sous le cartouche. */
export const PAPIER =
  "flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm print:rounded-none print:border-0 print:shadow-none";
export const CORPS_PAPIER = "flex flex-col gap-7 px-5 py-6 sm:px-8";
