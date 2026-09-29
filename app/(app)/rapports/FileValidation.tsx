"use client";

import { Eye, Info, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge, EtatVide } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  DELAI_VALIDATION_CT_HEURES,
  rapportsRejetes,
  tauxPresence,
  validationsEnAttente,
} from "@/features/chantier";
import type { EntreeJournal, Journal, ValidationEnAttente } from "@/features/chantier";
import { formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BLOC, BLOC_CORPS, BLOC_ENTETE, BLOC_SOUS_TITRE, BLOC_TITRE } from "./classes";
import { BadgeSituation, BoutonRelance, CircuitCompact, horodatageCourt } from "./composants";

/**
 * L'onglet « Circuit de validation » — ce que la maquette appelait la file du
 * CT, retournée pour le DG : il ne signe pas, il **voit où ça coince**.
 *
 * Un rapport non approuvé ne compte ni dans l'avancement ni dans les bons de
 * paiement : un circuit qui traîne fausse les deux. La file est donc rangée
 * par urgence (hors délai d'abord), et chaque ligne nomme celui qu'on attend
 * — que le DG peut relancer.
 */
export function FileValidation({ journal, maintenant }: { journal: Journal; maintenant: Date }) {
  const t = useTranslations("journal.validations");
  const file = validationsEnAttente(journal.entrees, maintenant);
  const rejetes = rapportsRejetes(journal.entrees).slice(0, 5);
  const enAttenteCt = file.filter((ligne) => ligne.etape.role === "CT").length;
  const horsDelai = file.filter((ligne) => ligne.horsDelai).length;

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 text-sm text-neutral-600">
        {t("resume", { total: file.length, ct: enAttenteCt, cp: file.length - enAttenteCt, horsDelai })}
      </p>

      {file.length === 0 ? (
        <EtatVide
          icone={<ShieldCheck className="size-8" aria-hidden="true" />}
          titre={t("videTitre")}
          description={t("videDescription")}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {file.map((ligne) => (
            <LigneValidation key={ligne.entree.id} ligne={ligne} aujourdhui={journal.aujourdhui} />
          ))}
        </ul>
      )}

      {rejetes.length > 0 && (
        <section className={BLOC} aria-labelledby="titre-rejetes">
          <header className={BLOC_ENTETE}>
            <div>
              <h2 id="titre-rejetes" className={cn(BLOC_TITRE, "m-0")}>
                {t("rejetesTitre")}
              </h2>
              <p className={cn(BLOC_SOUS_TITRE, "m-0")}>{t("rejetesSousTitre")}</p>
            </div>
          </header>
          <ul className={cn(BLOC_CORPS, "m-0 flex list-none flex-col")}>
            {rejetes.map((entree) => (
              <LigneRejet key={entree.id} entree={entree} />
            ))}
          </ul>
        </section>
      )}

      <p className="m-0 flex items-start gap-2 rounded-lg border border-information/20 bg-information-fond px-4 py-3 text-sm text-neutral-700">
        <Info className="mt-0.5 size-4 shrink-0 text-information" aria-hidden="true" />
        <span>{t("explication", { heures: DELAI_VALIDATION_CT_HEURES })}</span>
      </p>
    </div>
  );
}

function LigneValidation({ ligne, aujourdhui }: { ligne: ValidationEnAttente; aujourdhui: string }) {
  const t = useTranslations("journal.validations");
  const tCircuit = useTranslations("journal.circuit");
  const { entree, etape, horsDelai } = ligne;
  const presence = tauxPresence(entree.effectifPresent, entree.effectifPrevu);

  return (
    <li
      className={cn(
        BLOC,
        "flex-col gap-2 px-4 py-3 md:flex-row md:items-start md:justify-between",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-sm font-semibold text-neutral-900">
            {t("titre", { code: entree.lot.code, lot: entree.lot.nom, chantier: entree.lot.projetNom })}
          </h3>
          <BadgeSituation situation={entree.situation} />
          {horsDelai && <Badge variante="erreur">{t("horsDelai")}</Badge>}
        </div>
        <p className="m-0 text-xs text-neutral-600">
          {t("details", {
            date: formaterDate(entree.date),
            chef: entree.lot.chefChantier,
            presents: entree.effectifPresent ?? 0,
            prevus: entree.effectifPrevu ?? 0,
            taux: presence ?? 0,
            avancement: entree.avancementLot ?? 0,
            incidents: entree.incidents ?? 0,
            blocages: entree.blocages ?? 0,
          })}
        </p>
        {entree.noteChefChantier && (
          <p className="m-0 line-clamp-2 text-xs text-neutral-600 italic">
            {t("note", { note: entree.noteChefChantier })}
          </p>
        )}
        <CircuitCompact circuit={entree.circuit} aujourdhui={aujourdhui} />
      </div>

      <div className="flex shrink-0 flex-col gap-2 md:items-end">
        <span className={cn("text-xs font-medium", horsDelai ? "text-erreur" : "text-neutral-600")}>
          {t("attendu", {
            role: tCircuit(`role.${etape.role}`),
            nom: etape.signataire,
          })}
          {etape.echeance && (
            <>
              {" "}
              {t(horsDelai ? "echeanceDepassee" : "echeance", { quand: horodatageCourt(etape.echeance, aujourdhui) })}
            </>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <BoutonRelance
            entree={entree}
            libelle={t("relancer", { role: tCircuit(`court.${etape.role}`) })}
            aujourdhui={aujourdhui}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/rapports/${entree.id}`}>
              <Eye aria-hidden="true" />
              {t("voir")}
            </Link>
          </Button>
        </div>
      </div>
    </li>
  );
}

function LigneRejet({ entree }: { entree: EntreeJournal }) {
  const t = useTranslations("journal.validations");
  const rejet = entree.circuit.find((etape) => etape.etat === "REJETE");
  return (
    <li className="flex flex-col gap-1 border-b border-neutral-100 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="m-0 text-sm font-medium text-neutral-900">
          {t("titre", { code: entree.lot.code, lot: entree.lot.nom, chantier: entree.lot.projetNom })}
          <span className="ml-2 text-xs font-normal text-neutral-500">{formaterDate(entree.date)}</span>
        </p>
        {rejet?.commentaire && (
          <p className="m-0 mt-0.5 text-xs text-neutral-600">
            {t("motif", { nom: rejet.signataire, motif: rejet.commentaire })}
          </p>
        )}
      </div>
      <Link href={`/rapports/${entree.id}`} className="shrink-0 text-sm font-medium text-primary-600 no-underline hover:underline">
        {t("voir")}
      </Link>
    </li>
  );
}
