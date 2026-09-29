"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Clock, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge, Bouton } from "@/components/ui";
import { jourDe } from "@/features/chantier";
import type { EntreeJournal, EtapeCircuit, SituationRapport } from "@/features/chantier";
import { relancer } from "@/features/chantier/adaptateur";
import { CLE_JOURNAL } from "@/features/chantier/cles";
import { formaterHeure, formaterJourMoisNumerique } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PASTILLE_ETAPE, TON_SITUATION } from "./classes";

/**
 * Les pièces que les onglets du journal et les documents partagent : le
 * badge d'un statut, le circuit de signatures, la relance.
 */

export function BadgeSituation({ situation }: { situation: SituationRapport }) {
  const t = useTranslations("journal.situation");
  return <Badge variante={TON_SITUATION[situation]}>{t(situation)}</Badge>;
}

/** « 28/09 17:15 » — le jour n'est omis que pour aujourd'hui. */
export function horodatageCourt(valeur: string, aujourdhui: string): string {
  const jour = jourDe(new Date(valeur));
  const heure = formaterHeure(valeur);
  return jour === aujourdhui ? heure : `${formaterJourMoisNumerique(jour)} ${heure}`;
}

const ICONE_ETAPE = {
  SIGNE: Check,
  REJETE: X,
  EN_ATTENTE: Clock,
  A_VENIR: null,
} as const;

/**
 * Le circuit CC → CT → CP en pastilles : qui a signé, qui est attendu. Le
 * rôle est toujours écrit en toutes lettres à côté de la couleur (charte §8.4).
 */
export function CircuitCompact({ circuit, aujourdhui }: { circuit: EtapeCircuit[]; aujourdhui: string }) {
  const t = useTranslations("journal.circuit");
  return (
    <ol aria-label={t("aria")} className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
      {circuit.map((etape, rang) => {
        const Icone = ICONE_ETAPE[etape.etat];
        const quand = etape.signeLe ?? (etape.etat === "EN_ATTENTE" ? etape.echeance : null);
        return (
          <li key={etape.role} className="flex items-center gap-1">
            {rang > 0 && <span aria-hidden="true" className="h-px w-2 bg-neutral-300" />}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                PASTILLE_ETAPE[etape.etat],
              )}
              title={t(`etat.${etape.etat}`, { role: t(`role.${etape.role}`), nom: etape.signataire })}
            >
              {Icone && <Icone className="size-3" aria-hidden="true" />}
              {t(`court.${etape.role}`)}
              {quand && (
                <span className="font-normal tabular-nums">
                  {etape.etat === "EN_ATTENTE"
                    ? t("avant", { quand: horodatageCourt(quand, aujourdhui) })
                    : horodatageCourt(quand, aujourdhui)}
                </span>
              )}
              <span className="sr-only">{t(`etat.${etape.etat}`, { role: t(`role.${etape.role}`), nom: etape.signataire })}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** La relance partagée : une écriture, puis tout le journal relu. */
export function useRelance() {
  const clientRequetes = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => relancer(id),
    onSuccess: () => void clientRequetes.invalidateQueries({ queryKey: CLE_JOURNAL }),
  });
}

/**
 * Relancer la personne qui bloque une ligne. Une relance déjà envoyée se
 * dit, avec son heure, plutôt que de se renvoyer d'un clic distrait.
 */
export function BoutonRelance({
  entree,
  libelle,
  aujourdhui,
}: {
  entree: EntreeJournal;
  libelle: string;
  aujourdhui: string;
}) {
  const t = useTranslations("journal.relance");
  const relance = useRelance();
  const enCours = relance.isPending && relance.variables === entree.id;

  if (entree.relanceLe) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-succes">
        <Check className="size-3.5" aria-hidden="true" />
        {t("envoyee", { quand: horodatageCourt(entree.relanceLe, aujourdhui) })}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Bouton
        variante="secondaire"
        taille="sm"
        iconeGauche={<BellRing className="size-4" aria-hidden="true" />}
        onClick={() => relance.mutate(entree.id)}
        disabled={enCours}
      >
        {enCours ? t("envoi") : libelle}
      </Bouton>
      {relance.isError && relance.variables === entree.id && (
        <span role="alert" className="text-xs text-erreur">
          {t("echec")}
        </span>
      )}
    </span>
  );
}
