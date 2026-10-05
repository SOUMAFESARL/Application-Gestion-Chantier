"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronRight, ClipboardList, FileCheck2, FilePen, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Badge, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import type { VarianteBadge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import { jourSaisissable, joursSaisissables, rapportsEnAttente } from "@/features/chantier";
import type { StatutRapport } from "@/features/chantier";
import { lireRapportsProjet } from "@/features/chantier/adaptateur";
import { cleRapportsProjet } from "@/features/chantier/cles";
import { AccesNonAutorise, peutRedigerJournal, useDroits, useProjetsVisibles } from "@/features/habilitations";
import type { Projet } from "@/features/projets/types";
import { cn } from "@/lib/utils";

import { CHAMP } from "./elementsSaisie";

type EtatRapport = "A_REDIGER" | StatutRapport;

const TON_ETAT: Record<EtatRapport, VarianteBadge> = {
  A_REDIGER: "erreur",
  BROUILLON: "avertissement",
  REJETE: "erreur",
  SOUMIS: "information",
  VALIDE_CT: "succes",
  APPROUVE_CP: "succes",
};

/** Les rapports en attente affichés d'un coup ; un chantier ancien en a beaucoup. */
const PAR_PAGE = 10;

/**
 * Le point d'entrée du chef de chantier : **quels rapports me reste-t-il à
 * rédiger sur ce chantier ?** Un rapport couvre un chantier sur un jour,
 * tous ses lots en cours réunis.
 *
 * Le bandeau de tête choisit le jour et le chantier ; les deux vivent dans
 * l'URL (`?date=…&projet=…`), pour qu'un rechargement ou un retour depuis le
 * formulaire retombe sur le même choix. Sous le bandeau : le rapport du jour
 * choisi, puis tous les autres rapports attendus et pas encore remis, chacun
 * avec le jour qu'il couvre.
 */
export function ChoixRapportSaisie({ date: demandee, projet: projetDemande }: { date: string | null; projet: string | null }) {
  const t = useTranslations("journal.saisie");
  const router = useRouter();
  const { droits } = useDroits();
  const [affiches, setAffiches] = useState(PAR_PAGE);

  const projets = useProjetsVisibles();
  // Le projet choisi : celui de l'URL s'il est visible, sinon le premier.
  const projet = projets.data?.find((candidat) => candidat.id === projetDemande) ?? projets.data?.[0] ?? null;

  const rapports = useQuery({
    queryKey: cleRapportsProjet(projet?.id ?? ""),
    queryFn: ({ signal }) => lireRapportsProjet(projet?.id ?? "", signal),
    enabled: !!projet,
  });

  if (!peutRedigerJournal(droits)) return <AccesNonAutorise />;
  if (projets.isPending) return <EtatChargement />;
  if (projets.isError) return <EtatErreur message={t("erreurChargement")} onReessayer={() => void projets.refetch()} />;
  if (!projet) {
    return (
      <div className="flex w-full max-w-3xl flex-col gap-5">
        <EnTetePage titre={t("choix.titre")} />
        <EtatVide
          icone={<ClipboardList className="size-8" aria-hidden="true" />}
          titre={t("choix.aucunProjet")}
          description={t("choix.aucunProjetDescription")}
        />
      </div>
    );
  }

  const aujourdhui = rapports.data?.aujourdhui ?? null;
  const jour = aujourdhui && demandee && jourSaisissable(demandee, aujourdhui) ? demandee : aujourdhui;
  const enAttente = aujourdhui
    ? rapportsEnAttente(projet.dateDebutReelle ?? projet.dateDebutPrevue, aujourdhui, rapports.data?.rapports ?? [])
    : [];
  const autres = enAttente.filter((rapport) => rapport.date !== jour);
  const duJour = rapports.data?.rapports.find((rapport) => rapport.date === jour) ?? null;

  const naviguer = (changement: { date?: string; projet?: string }) => {
    const parametres = new URLSearchParams();
    const date = changement.date ?? (changement.projet ? null : jour);
    if (date) parametres.set("date", date);
    parametres.set("projet", changement.projet ?? projet.id);
    setAffiches(PAR_PAGE);
    router.replace(`/rapports/saisie?${parametres.toString()}`);
  };
  const lienSaisie = (date: string) => `/rapports/saisie/${projet.id}?date=${date}`;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <EnTetePage
        titre={t("choix.titre")}
        description={
          rapports.isSuccess
            ? enAttente.length > 0
              ? t("choix.restants", { n: enAttente.length })
              : t("choix.aJour")
            : undefined
        }
      />

      {/* Le bandeau : le jour, puis le chantier dont on rédige le journal. */}
      <div className="grid gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="saisie-jour" className="text-sm font-semibold text-primary-800">
            {t("choix.jour")}
          </label>
          <SelecteurDate
            id="saisie-jour"
            valeur={jour ?? ""}
            onChange={(choisi) => choisi && naviguer({ date: choisi })}
            placeholder={t("choix.jourPlaceholder")}
            auPlusTot={aujourdhui ? joursSaisissables(aujourdhui).at(-1) : undefined}
            auPlusTard={aujourdhui ?? undefined}
            disabled={!aujourdhui}
            className={CHAMP}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="saisie-projet" className="text-sm font-semibold text-primary-800">
            {t("choix.projet")}
          </label>
          <Select value={projet.id} onValueChange={(choisi) => naviguer({ projet: choisi })}>
            <SelectTrigger id="saisie-projet" className={cn(CHAMP, "w-full bg-card")}>
              <SelectValue placeholder={t("choix.projetPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {(projets.data ?? []).map((candidat) => (
                <SelectItem key={candidat.id} value={candidat.id}>
                  {t("choix.projetValeur", { reference: candidat.reference, nom: candidat.nom })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rapports.isPending ? (
        <EtatChargement />
      ) : rapports.isError || !jour ? (
        <EtatErreur message={t("erreurChargement")} onReessayer={() => void rapports.refetch()} />
      ) : (
        <>
          <section aria-labelledby="rapport-du-jour" className="flex flex-col gap-2">
            <h2 id="rapport-du-jour" className="m-0 text-sm font-semibold text-neutral-700">
              {t("choix.rapportDuJour")}
            </h2>
            <LigneRapport
              projet={projet}
              date={jour}
              etat={duJour?.statut ?? "A_REDIGER"}
              enregistreLe={duJour?.enregistreLe ?? null}
              lien={
                duJour && duJour.statut !== "BROUILLON" && duJour.statut !== "REJETE"
                  ? `/rapports/${duJour.id}`
                  : lienSaisie(jour)
              }
              enAvant
            />
          </section>

          <section aria-labelledby="rapports-en-attente" className="flex flex-col gap-2">
            <h2 id="rapports-en-attente" className="m-0 text-sm font-semibold text-neutral-700">
              {t("choix.enAttente", { n: autres.length })}
            </h2>
            {autres.length === 0 ? (
              <p className="m-0 rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
                {t("choix.aucunEnAttente")}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {autres.slice(0, affiches).map((rapport) => (
                  <li key={rapport.date}>
                    <LigneRapport
                      projet={projet}
                      date={rapport.date}
                      etat={rapport.etat}
                      enregistreLe={rapport.enregistreLe}
                      lien={rapport.redigeable ? lienSaisie(rapport.date) : null}
                    />
                  </li>
                ))}
              </ul>
            )}
            {autres.length > affiches && (
              <Button type="button" variant="outline" className="self-center" onClick={() => setAffiches((n) => n + PAR_PAGE)}>
                {t("choix.afficherPlus", { n: Math.min(PAR_PAGE, autres.length - affiches) })}
              </Button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Un rapport du chantier : titré par le chantier, daté du jour qu'il couvre.
 * Sans `lien`, il est hors délai — au-delà de J-2, seul le conducteur de
 * travaux peut établir un rapport de substitution.
 */
function LigneRapport({
  projet,
  date,
  etat,
  enregistreLe,
  lien,
  enAvant = false,
}: {
  projet: Projet;
  date: string;
  etat: EtatRapport;
  enregistreLe: string | null;
  lien: string | null;
  enAvant?: boolean;
}) {
  const t = useTranslations("journal.saisie");
  const format = useFormatter();
  const fini = etat === "SOUMIS" || etat === "VALIDE_CT" || etat === "APPROUVE_CP";
  const horsDelai = lien === null;
  const Icone = horsDelai ? CalendarClock : fini ? FileCheck2 : etat === "REJETE" ? Undo2 : FilePen;
  const jour = format.dateTime(new Date(`${date}T00:00:00Z`), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const contenu = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          horsDelai
            ? "bg-neutral-100 text-neutral-500"
            : fini
              ? "bg-succes-fond text-succes"
              : etat === "REJETE"
                ? "bg-erreur-fond text-erreur"
                : "bg-primary-50 text-primary-700",
        )}
      >
        <Icone className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-neutral-900">{projet.nom}</span>
        <span className="text-xs text-neutral-600">{t("choix.prevuLe", { jour })}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {horsDelai ? (
            <Badge variante="neutre">{t("choix.horsDelai")}</Badge>
          ) : (
            <Badge variante={TON_ETAT[etat]}>{t(`etatsLot.${etat}`)}</Badge>
          )}
          {!horsDelai && etat === "BROUILLON" && enregistreLe && (
            <span>
              {t("choix.enregistreA", {
                heure: format.dateTime(new Date(enregistreLe), { hour: "2-digit", minute: "2-digit" }),
              })}
            </span>
          )}
          {horsDelai && <span>{t("choix.horsDelaiDetail")}</span>}
        </span>
      </span>
      {!horsDelai && <ChevronRight className="size-5 shrink-0 text-neutral-400" aria-hidden="true" />}
    </>
  );

  const classe = cn(
    "flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 no-underline",
    enAvant ? "border-primary-300" : etat === "REJETE" && !horsDelai ? "border-erreur" : "border-neutral-200",
  );

  return lien ? (
    <Link href={lien} className={cn(classe, "transition-colors hover:bg-neutral-50")}>
      {contenu}
    </Link>
  ) : (
    <div className={cn(classe, "opacity-80")}>{contenu}</div>
  );
}
