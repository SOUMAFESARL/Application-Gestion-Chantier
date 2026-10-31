"use client";

import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCheck,
  Gauge,
  Pencil,
  Plus,
  PowerOff,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EquipesDeLaCase } from "@/features/equipes/components/EquipesDeLaCase";
import { BoutonPermis, useDroits } from "@/features/habilitations";
import type { Projet } from "@/features/projets/types";
import { ABSENT, formaterDate, formaterMontant, formaterQuantite } from "@/lib/format";

import { gestesPossibles, PERMISSION_DU_GESTE, type GesteCase } from "../regles";
import type { CaseArbre } from "../types";
import { Derive, Ecart, Montant, MONTANT_MASQUE, Periode, Physique, Statut } from "./CellulesCase";

const ICONE_GESTE: Record<GesteCase, ReactNode> = {
  ajouter: <Plus />,
  modifier: <Pencil />,
  planifier: <CalendarPlus />,
  reprogrammer: <CalendarClock />,
  mesurer: <Gauge />,
  cloturer: <CheckCheck />,
  desactiver: <PowerOff />,
  reactiver: <RotateCcw />,
};

/**
 * Le tiroir d'une case (décision P6) : ce qu'elle est, où elle en est, ses dates, ses montants,
 * son exécution et ses équipes, puis les gestes qui ont un sens sur elle.
 *
 * Un geste que le rôle ne permet pas reste visible et grisé, la permission en infobulle (P7).
 * Sur téléphone, le tiroir se lit sans gestes (P16) : ils sont masqués sous 640 px.
 */
export function TiroirCase({
  projet,
  cible,
  onFermer,
  onGeste,
}: {
  projet: Projet;
  cible: CaseArbre | null;
  onFermer: () => void;
  onGeste: (geste: GesteCase, cible: CaseArbre) => void;
}) {
  const t = useTranslations("decoupage.tiroir");
  const tGestes = useTranslations("decoupage.gestes.boutons");
  const tUnite = useTranslations("decoupage.unites");
  const tMode = useTranslations("decoupage.modesMesure");
  const { peutSurProjet, voitMontants } = useDroits();

  return (
    <Sheet open={cible !== null} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {cible && (
          <>
            <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
              <SheetTitle className="flex flex-wrap items-center gap-2 text-lg text-neutral-900">
                <span className="font-mono text-sm text-neutral-500">{cible.numero}</span>
                {cible.libelle}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                {cible.niveau.libelle && <Badge variante="neutre">{cible.niveau.libelle}</Badge>}
                {cible.code && <Badge variante="primaire">{cible.code}</Badge>}
                <Statut une={cible} />
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-6 py-5">
              {cible.acces !== "COMPLET" ? (
                <Alert variant="information">
                  <AlertDescription>{t("horsPerimetre")}</AlertDescription>
                </Alert>
              ) : (
                <>
                  {cible.aCompleter && (
                    <Alert variant="avertissement">
                      <TriangleAlert />
                      <AlertDescription>{t("aCompleter")}</AlertDescription>
                    </Alert>
                  )}
                  {cible.depasseEnveloppe && voitMontants && (
                    <Alert variant="erreur">
                      <TriangleAlert />
                      <AlertDescription>{t("depasseEnveloppe")}</AlertDescription>
                    </Alert>
                  )}
                  {!cible.estActif && cible.motif && (
                    <Alert variant="information">
                      <AlertDescription>{t("motifDesactivation", { motif: cible.motif })}</AlertDescription>
                    </Alert>
                  )}

                  <Section titre={t("avancement")}>
                    <Ligne libelle={t("physique")}>
                      <Physique une={cible} />
                    </Ligne>
                    <Ligne libelle={t("ecart")}>
                      <Ecart valeur={cible.ecart} />
                    </Ligne>
                    {cible.estFeuille && (
                      <>
                        <Ligne libelle={t("modeMesure")}>{cible.modeMesure ? tMode(cible.modeMesure) : ABSENT}</Ligne>
                        {cible.modeMesure === "QUANTITE" && (
                          <Ligne libelle={t("quantites")}>
                            {t("quantitesValeur", {
                              realise: formaterQuantite(cible.quantiteRealisee),
                              prevu: formaterQuantite(cible.quantitePrevue),
                              unite: cible.unite ? tUnite(cible.unite) : "",
                            })}
                          </Ligne>
                        )}
                        {cible.modeMesure === "POURCENTAGE" && (
                          <Ligne libelle={t("pourcentageDeclare")}>
                            {cible.pourcentageDeclare === null ? ABSENT : `${cible.pourcentageDeclare} %`}
                          </Ligne>
                        )}
                      </>
                    )}
                    {!cible.estFeuille && cible.tachesEnDepassement !== null && cible.tachesEnDepassement > 0 && (
                      <Ligne libelle={t("tachesEnDepassement")}>{cible.tachesEnDepassement}</Ligne>
                    )}
                  </Section>

                  <Section titre={t("dates")}>
                    <Ligne libelle={t("prevues")}>
                      <Periode debut={cible.dateDebutPrevue} fin={cible.dateFinPrevue} />
                    </Ligne>
                    <Ligne libelle={t("origine")}>
                      <Periode debut={cible.dateDebutBaseline} fin={cible.dateFinBaseline} />
                    </Ligne>
                    <Ligne libelle={t("finContractuelle")}>{formaterDate(cible.dateFinContractuelle)}</Ligne>
                    <Ligne libelle={t("derive")}>
                      <Derive
                        finPrevue={cible.dateFinPrevue}
                        finOrigine={cible.dateFinBaseline}
                        joursAccordes={cible.joursAccordes}
                      />
                    </Ligne>
                    {(cible.dateDebutReelle || cible.dateFinReelle) && (
                      <Ligne libelle={t("reelles")}>
                        <Periode debut={cible.dateDebutReelle} fin={cible.dateFinReelle} />
                      </Ligne>
                    )}
                  </Section>

                  <Section titre={t("montants")}>
                    <Ligne libelle={cible.estFeuille ? t("montant") : t("poids")}>
                      <Montant une={cible} voitMontants={voitMontants} />
                    </Ligne>
                    {!cible.estFeuille && (
                      <Ligne libelle={t("enveloppe")}>
                        {voitMontants ? formaterMontant(cible.enveloppe) : MONTANT_MASQUE}
                      </Ligne>
                    )}
                  </Section>

                  <Section titre={t("execution")}>
                    <Ligne libelle={t("modeExecution")}>{cible.modeExecutionEffectif || ABSENT}</Ligne>
                    <Ligne libelle={t("equipes")}>
                      <EquipesDeLaCase
                        projet={projet}
                        caseId={cible.id}
                        equipes={cible.equipes}
                        heriteesDe={cible.equipesHeriteesDe}
                      />
                    </Ligne>
                  </Section>
                </>
              )}

              {gestesPossibles(cible).length > 0 && (
                <section className="flex flex-col gap-2 max-sm:hidden">
                  <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("gestes")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {gestesPossibles(cible).map((geste) => (
                      <BoutonPermis
                        key={geste}
                        size="sm"
                        variant={geste === "desactiver" ? "outline" : "secondary"}
                        permis={peutSurProjet(PERMISSION_DU_GESTE[geste], projet)}
                        permission={PERMISSION_DU_GESTE[geste]}
                        onClick={() => onGeste(geste, cible)}
                      >
                        {ICONE_GESTE[geste]}
                        {tGestes(geste)}
                      </BoutonPermis>
                    ))}
                  </div>
                  {cible.dateDebutPrevue && cible.dateFinPrevue && (
                    <p className="m-0 flex items-center gap-1.5 text-xs text-neutral-500">
                      <CalendarCheck size={14} aria-hidden="true" />
                      {t("dejaPlanifiee")}
                    </p>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold text-neutral-900">{titre}</h3>
      <dl className="m-0 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">{children}</dl>
    </section>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-neutral-500">{libelle}</dt>
      <dd className="m-0 text-neutral-900">{children}</dd>
    </>
  );
}
