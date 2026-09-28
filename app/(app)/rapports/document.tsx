"use client";

import { ArrowLeft, Check, Clock, PenLine, Printer, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EtapeCircuit } from "@/features/chantier";
import { formaterDateHeure } from "@/lib/format";
import { cn } from "@/lib/utils";

import { JAUGE, JAUGE_REMPLIE, PASTILLE_ETAPE } from "./classes";

/**
 * Les pièces des deux documents du journal — le rapport journalier et la
 * synthèse périodique. Ils reprennent la mise en page des PDF transmis par
 * le client (en-tête, bandeau de statut, identification, chiffres, sections
 * numérotées, circuit de signatures) : l'écran **est** le document, et
 * « Imprimer / PDF » le sort tel quel par le navigateur.
 */

/** La barre du haut : retour au journal, et impression. Elle ne s'imprime pas. */
export function BarreDocument({ titre, reference }: { titre: string; reference: string }) {
  const t = useTranslations("journal.document");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary-800 px-4 py-3 text-neutral-0 print:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/rapports"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-secondary-100 no-underline hover:bg-secondary-700 hover:text-neutral-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("retour")}
        </Link>
        <span className="hidden h-5 w-px bg-secondary-600 sm:block" aria-hidden="true" />
        <span className="min-w-0 truncate text-sm">
          <span className="font-semibold">{titre}</span>
          <span className="ml-2 text-secondary-200">{reference}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md border-0 bg-primary-500 px-3 py-1.5 text-sm font-semibold text-neutral-0 hover:bg-primary-600"
      >
        <Printer className="size-4" aria-hidden="true" />
        {t("imprimer")}
      </button>
    </div>
  );
}

/** Le cartouche du document : son titre à gauche, sa référence à droite. */
export function EnTeteDocument({
  titre,
  sousTitre,
  reference,
  bandeau,
}: {
  titre: string;
  sousTitre: string;
  reference: string;
  bandeau: ReactNode;
}) {
  const t = useTranslations("journal.document");
  return (
    <header className="overflow-hidden rounded-t-xl">
      <div className="flex flex-wrap items-start justify-between gap-4 bg-secondary-900 px-5 py-5 text-neutral-0 sm:px-8">
        <div className="min-w-0">
          <p className="m-0 text-xs font-medium tracking-wide text-primary-300 uppercase">{t("marque")}</p>
          <h1 className="m-0 mt-1 text-h3 font-bold !text-neutral-0">{titre}</h1>
          <p className="m-0 mt-1 text-sm text-secondary-200">{sousTitre}</p>
        </div>
        <span className="rounded-md bg-neutral-0/10 px-3 py-1.5 font-mono text-sm font-semibold tracking-wide">
          {reference}
        </span>
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

/** Une case de la rangée de chiffres. */
export function ChiffreDocument({
  libelle,
  valeur,
  detail,
  alerte = false,
  accent = false,
}: {
  libelle: string;
  valeur: ReactNode;
  detail: ReactNode;
  alerte?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 break-inside-avoid",
        accent ? "border-primary-200 bg-primary-50" : "border-neutral-200 bg-neutral-0",
      )}
    >
      <span className="text-xs text-neutral-500">{libelle}</span>
      <span className={cn("text-xl font-bold tabular-nums", alerte ? "text-erreur" : "text-neutral-900")}>{valeur}</span>
      <span className={cn("text-xs", alerte ? "text-erreur" : "text-neutral-500")}>{detail}</span>
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

/** Un tableau de document : pas de tri, pas de pagination — il s'imprime entier. */
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
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <Table className="text-xs sm:text-sm">
        <TableHeader>
          <TableRow className="bg-neutral-50 hover:bg-neutral-50">
            {colonnes.map((colonne, rang) => (
              <TableHead key={colonne.entete} className={cn("h-9 px-3 text-xs font-semibold text-neutral-600", aligner(rang))}>
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
                  <TableCell key={rang} className={cn("px-3 py-2 whitespace-normal", aligner(rang))}>
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
                <TableCell key={rang} className={cn("px-3 py-2 whitespace-normal", aligner(rang))}>
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
export function PiedDocument({ mention, reference }: { mention: string; reference: string }) {
  const t = useTranslations("journal.document");
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3 text-xs text-neutral-500 sm:px-8">
      <span>{t("pied")}</span>
      <span>{mention}</span>
      <span className="font-mono">{reference}</span>
    </footer>
  );
}

/** Le corps d'un document : le papier blanc sous le cartouche. */
export const PAPIER =
  "flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 shadow-sm print:rounded-none print:border-0 print:shadow-none";
export const CORPS_PAPIER = "flex flex-col gap-7 px-5 py-6 sm:px-8";
