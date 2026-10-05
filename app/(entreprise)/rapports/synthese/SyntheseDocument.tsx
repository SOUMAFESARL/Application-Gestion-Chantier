"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge, EtatChargement, EtatErreur } from "@/components/ui";
import {
  CIBLE_PRESENCE,
  ecartObjectif,
  enAlerteStock,
  estManquant,
  etapeEnAttente,
  incidentsResolus,
  numeroSemaine,
  periodeValide,
  rapportsManquants,
  tauxPresence,
} from "@/features/chantier";
import type { DemandeSynthese, SynthesePeriodique, TypePeriode } from "@/features/chantier";
import { lireSynthese } from "@/features/chantier/adaptateur";
import { cleSynthese } from "@/features/chantier/cles";
import { jourDe } from "@/features/chantier/regles";
import { ABSENT, formaterDate, formaterDateHeure, formaterJourMoisNumerique, formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { teintesChiffresSynthese, TON_GRAVITE } from "../classes";
import { BadgeSituation } from "../composants";
import {
  BandeauDocument,
  BarreDocument,
  ChiffreDocument,
  CircuitSignatures,
  CORPS_PAPIER,
  EnTeteDocument,
  GrilleInfos,
  PAPIER,
  PiedDocument,
  SectionDocument,
  TableauDocument,
} from "../document";
import { useGenerationDocumentPdf } from "../GenerationDocumentPdf";
import { contenuSynthesePdf, signe } from "./contenuSynthesePdf";

const TYPES: TypePeriode[] = ["HEBDOMADAIRE", "MENSUELLE", "PERSONNALISEE"];

/**
 * La synthèse périodique — la maquette « Journal de chantier synthétique »
 * du client. Elle n'est pas saisie : elle s'agrège des rapports journaliers
 * de la période, et la section 1 montre **exactement** lesquels, absences
 * comprises. Elle se signe CT → CP ; le chef de chantier a déjà signé chaque
 * rapport qui la compose.
 */
export function SyntheseDocument({
  projetId,
  type,
  debut,
  fin,
}: {
  projetId: string;
  type: string;
  debut: string;
  fin: string;
}) {
  const t = useTranslations("journal.synthese");
  const typeValide = TYPES.find((candidat) => candidat === type) ?? "PERSONNALISEE";
  const demande: DemandeSynthese = { projetId, type: typeValide, debut, fin };
  const valide = Boolean(projetId) && periodeValide(debut, fin, jourDe(new Date()));

  const requete = useQuery({
    queryKey: cleSynthese(demande),
    queryFn: ({ signal }) => lireSynthese(demande, signal),
    enabled: valide,
  });

  if (!valide) {
    return (
      <div className="flex flex-col items-center gap-3">
        <EtatErreur message={t("demandeInvalide")} />
        <Link href="/rapports" className="text-sm font-medium text-primary-600">
          {t("retour")}
        </Link>
      </div>
    );
  }
  if (requete.isPending) return <EtatChargement message={t("agregation")} />;
  if (requete.isError) {
    return <EtatErreur message={t("erreurChargement")} onReessayer={() => void requete.refetch()} />;
  }
  return <Document synthese={requete.data} />;
}

function Document({ synthese }: { synthese: SynthesePeriodique }) {
  const t = useTranslations("journal.synthese");
  const tRapport = useTranslations("journal.rapport");
  const tCircuit = useTranslations("journal.circuit");
  const tMode = useTranslations("projets.tiroirCreation.modeExecution");
  const tEnum = useTranslations("journal.enumerations");

  const { chiffres, progression } = synthese;
  const manquants = rapportsManquants(synthese);
  const presence = tauxPresence(chiffres.effectifsPresents, chiffres.effectifsPrevus);
  const tauxRemise = chiffres.rapportsAttendus
    ? Math.round((chiffres.rapportsRecus / chiffres.rapportsAttendus) * 100)
    : null;
  const ecart = ecartObjectif(progression.gain, progression.objectif);
  const retardCumule = progression.theorique - progression.fin;
  const attente = etapeEnAttente(synthese.circuit);
  const approuvee = synthese.circuit.every((etape) => etape.etat === "SIGNE");

  const libellePeriode =
    synthese.type === "HEBDOMADAIRE"
      ? t("periode.semaine", {
          numero: numeroSemaine(synthese.debut),
          debut: formaterDate(synthese.debut),
          fin: formaterDate(synthese.fin),
        })
      : t("periode.intervalle", { debut: formaterDate(synthese.debut), fin: formaterDate(synthese.fin) });

  const totalAbsences = synthese.effectifs.reduce((total, ligne) => total + ligne.absences, 0);
  const totalHeures = synthese.effectifs.reduce((total, ligne) => total + ligne.heures, 0);
  const totalPrevu = synthese.effectifs.reduce((total, ligne) => total + ligne.prevuParJour, 0);
  const totalMoyen = synthese.effectifs.reduce((total, ligne) => total + ligne.presenceMoyenne, 0);
  const tauxEffectifs = totalPrevu ? Math.round((totalMoyen / totalPrevu) * 100) : null;
  const resolus = incidentsResolus(synthese.incidents);
  const separateur = t("separateur");
  const lotsCouverts = synthese.lots.map((lot) => t("lotCouvert", { code: lot.code, nom: lot.nom })).join(separateur);
  const listeManquants = manquants
    .map((entree) => t("manquant", { code: entree.lot.code, date: formaterJourMoisNumerique(entree.date) }))
    .join(separateur);
  const roles = { CT: tCircuit("role.CT"), CP: tCircuit("role.CP") };
  const teintes = teintesChiffresSynthese({
    presenceInsuffisante: presence !== null && presence < CIBLE_PRESENCE - 7,
    livraisonsPartielles: chiffres.livraisonsPartielles,
    incidents: chiffres.incidents,
    incidentsMajeurs: chiffres.incidentsMajeurs,
    blocages: chiffres.blocages,
    manquants: manquants.length,
  });
  const statutStock = {
    alerte: tRapport("materiaux.alerte"),
    ok: tRapport("materiaux.ok"),
    horsStock: tRapport("materiaux.horsStock"),
  };
  const tJournal = useTranslations("journal");
  const { pdf, indicateur } = useGenerationDocumentPdf(t(`type.${synthese.type}`), (source) =>
    contenuSynthesePdf((cle, valeurs) => tJournal(cle, valeurs), {
      ...source,
      synthese,
      periode: libellePeriode,
      modeExecution: (mode) => tMode(mode),
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <BarreDocument
        titre={t(`type.${synthese.type}`)}
        pdf={pdf}
        badges={
          <>
            <Badge variante="neutre">{synthese.projetNom}</Badge>
            <Badge variante="neutre">{libellePeriode}</Badge>
          </>
        }
      />

      <article className={PAPIER}>
        <EnTeteDocument
          titre={t("titre")}
          sousTitre={t("sousTitre")}
          bandeau={
            !attente &&
            !approuvee && (
              <BandeauDocument ton="avertissement">
                <span className="font-semibold">{t("periodeEnCours")}</span>
              </BandeauDocument>
            )
          }
        />

        <div className={CORPS_PAPIER}>
          <div className="grid gap-4 lg:grid-cols-3">
            <GrilleInfos
              titre={t("identification")}
              lignes={[
                [t("projet"), synthese.projetNom],
                [t("lots"), lotsCouverts],
                [t("joursOuvres"), t("joursOuvresValeur", { n: chiffres.joursOuvres })],
                [t("rapportsAttendus"), chiffres.rapportsAttendus],
                [
                  t("rapportsRecus"),
                  t("rapportsRecusValeur", {
                    recus: chiffres.rapportsRecus,
                    attendus: chiffres.rapportsAttendus,
                    taux: tauxRemise ?? 0,
                  }),
                ],
                [
                  t("manquants"),
                  manquants.length === 0 ? (
                    t("aucunManquant")
                  ) : (
                    <span key="m" className="text-erreur">
                      {listeManquants}
                    </span>
                  ),
                ],
              ]}
            />
            <GrilleInfos
              titre={t("intervenants")}
              lignes={[
                [roles.CP, synthese.chefProjet],
                [roles.CT, synthese.conducteurTravaux],
                ...synthese.lots.map(
                  (lot) => [t("chefChantierLot", { code: lot.code }), lot.chefChantier] as [string, string],
                ),
              ]}
            />
            <GrilleInfos
              titre={t("progression")}
              lignes={[
                [t("avancementDebut"), tRapport("pourcent", { valeur: progression.debut })],
                [t("avancementFin"), tRapport("pourcent", { valeur: progression.fin })],
                [t("gain"), t("points", { valeur: signe(progression.gain) })],
                [t("objectif"), t("points", { valeur: signe(progression.objectif) })],
                [
                  t("ecart"),
                  <span key="e" className={cn("font-semibold", ecart < 0 ? "text-erreur" : "text-succes")}>
                    {t("points", { valeur: signe(ecart) })}
                  </span>,
                ],
                [t("theorique"), tRapport("pourcent", { valeur: progression.theorique })],
                [
                  t("retardCumule"),
                  <span key="r" className={retardCumule > 0 ? "font-semibold text-erreur" : undefined}>
                    {t("points", { valeur: Math.max(0, retardCumule) })}
                  </span>,
                ],
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <ChiffreDocument
              fond={teintes.presence}
              libelle={t("chiffres.presence")}
              valeur={presence === null ? ABSENT : tRapport("pourcent", { valeur: presence })}
              detail={tRapport("fraction", { a: chiffres.effectifsPresents, b: chiffres.effectifsPrevus })}
              alerte={presence !== null && presence < CIBLE_PRESENCE - 7}
            />
            <ChiffreDocument
              fond={teintes.heures}
              libelle={t("chiffres.heures")}
              valeur={synthese.effectifs.length ? tRapport("heures", { valeur: formaterQuantite(chiffres.heures) }) : ABSENT}
              detail={synthese.effectifs.length ? t("chiffres.heuresDetail") : t("chiffres.heuresSousTraitants")}
            />
            <ChiffreDocument
              fond={teintes.livraisons}
              alerte={chiffres.livraisonsPartielles > 0}
              libelle={t("chiffres.livraisons")}
              valeur={chiffres.livraisons}
              detail={t("chiffres.livraisonsDetail", { n: chiffres.livraisonsPartielles })}
            />
            <ChiffreDocument
              fond={teintes.incidents}
              libelle={t("chiffres.incidents")}
              valeur={chiffres.incidents}
              detail={t("chiffres.incidentsDetail", { n: chiffres.incidentsMajeurs })}
              alerte={chiffres.incidentsMajeurs > 0}
            />
            <ChiffreDocument
              fond={teintes.blocages}
              libelle={t("chiffres.blocages")}
              valeur={chiffres.blocages}
              detail={chiffres.blocages ? t("chiffres.blocagesDetail") : t("chiffres.aucunBlocage")}
              alerte={chiffres.blocages > 0}
            />
            <ChiffreDocument
              fond={teintes.remise}
              libelle={t("chiffres.remise")}
              valeur={tauxRemise === null ? ABSENT : tRapport("pourcent", { valeur: tauxRemise })}
              detail={t("chiffres.remiseDetail", { n: manquants.length })}
              alerte={manquants.length > 0}
            />
          </div>

          <SectionDocument
            numero={1}
            titre={t("sections.recapitulatif")}
            complement={t("recapitulatif.complement", { valides: chiffres.rapportsValides, attendus: chiffres.rapportsAttendus })}
          >
            <TableauDocument
              colonnes={[
                { entete: t("recapitulatif.date") },
                { entete: t("recapitulatif.lot") },
                { entete: t("recapitulatif.chef") },
                { entete: t("recapitulatif.statut") },
                { entete: t("recapitulatif.effectifs"), nombre: true },
                { entete: t("recapitulatif.avancement"), nombre: true },
                { entete: t("recapitulatif.incidents"), nombre: true },
                { entete: t("recapitulatif.blocages"), nombre: true },
              ]}
              vide={t("recapitulatif.vide")}
              lignes={synthese.recapitulatif.map((entree) => {
                const absent = estManquant(entree.situation);
                return {
                  cle: entree.id,
                  cellules: [
                    absent ? (
                      <span key="d" className="tabular-nums">{formaterJourMoisNumerique(entree.date)}</span>
                    ) : (
                      <Link
                        key="d"
                        href={`/rapports/${entree.id}`}
                        className="font-medium text-primary-600 tabular-nums print:text-inherit"
                      >
                        {formaterJourMoisNumerique(entree.date)}
                      </Link>
                    ),
                    entree.lot.code,
                    entree.lot.chefChantier,
                    <BadgeSituation key="s" situation={entree.situation} />,
                    absent || entree.effectifPresent === null
                      ? ABSENT
                      : tRapport("fraction", { a: entree.effectifPresent, b: entree.effectifPrevu ?? 0 }),
                    absent || entree.avancementLot === null ? (
                      <span key="a" className="text-neutral-500 italic">{t("recapitulatif.nonDisponible")}</span>
                    ) : (
                      <span key="a" className="font-semibold">{tRapport("pourcent", { valeur: entree.avancementLot })}</span>
                    ),
                    absent ? ABSENT : (entree.incidents ?? 0),
                    absent ? ABSENT : (entree.blocages ?? 0),
                  ],
                };
              })}
              pied={[
                t("recapitulatif.total"),
                "",
                "",
                t("recapitulatif.totalValides", { valides: chiffres.rapportsValides, attendus: chiffres.rapportsAttendus }),
                tRapport("fraction", { a: chiffres.effectifsPresents, b: chiffres.effectifsPrevus }),
                presence === null ? "" : t("recapitulatif.totalPresence", { taux: presence }),
                chiffres.incidents,
                chiffres.blocages,
              ]}
            />
          </SectionDocument>

          <SectionDocument numero={2} titre={t("sections.avancement")}>
            <TableauDocument
              colonnes={[
                { entete: t("avancement.activite") },
                { entete: t("avancement.unite") },
                { entete: t("avancement.prevue"), nombre: true },
                { entete: t("avancement.debut"), nombre: true },
                { entete: t("avancement.fin"), nombre: true },
                { entete: t("avancement.gain"), nombre: true },
                { entete: t("avancement.objectif"), nombre: true },
                { entete: t("avancement.ecart"), nombre: true },
                { entete: t("avancement.avancement"), nombre: true },
              ]}
              lignes={synthese.avancement.flatMap(({ lot, activites }) => [
                {
                  cle: lot.id,
                  accent: true,
                  cellules: [
                    <span key="l" className="text-neutral-900">
                      {t("avancement.lot", { code: lot.code, nom: lot.nom, mode: tMode(lot.modeExecution) })}
                    </span>,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                  ],
                },
                ...(activites.length === 0
                  ? [
                      {
                        cle: `${lot.id}-vide`,
                        cellules: [
                          <span key="v" className="pl-4 text-neutral-500 italic">{t("avancement.aucunRapport")}</span>,
                          "",
                          "",
                          "",
                          "",
                          "",
                          "",
                          "",
                          "",
                        ],
                      },
                    ]
                  : activites.map((activite) => {
                      const gain = activite.avancementFin - activite.avancementDebut;
                      const ecartActivite = ecartObjectif(gain, activite.objectifGain);
                      return {
                        cle: `${lot.id}-${activite.libelle}`,
                        cellules: [
                          <span key="a" className="pl-4">{activite.libelle}</span>,
                          activite.unite,
                          formaterQuantite(activite.quantitePrevue),
                          tRapport("pourcent", { valeur: activite.avancementDebut }),
                          tRapport("pourcent", { valeur: activite.avancementFin }),
                          <span key="g" className="font-semibold text-primary-700">{t("pointsCourts", { valeur: signe(gain) })}</span>,
                          t("pointsCourts", { valeur: signe(activite.objectifGain) }),
                          <span key="e" className={cn("font-semibold", ecartActivite < 0 ? "text-erreur" : "text-succes")}>
                            {t("pointsCourts", { valeur: signe(ecartActivite) })}
                          </span>,
                          <span key="j" className="font-semibold">{tRapport("pourcent", { valeur: activite.avancementFin })}</span>,
                        ],
                      };
                    })),
              ])}
            />
          </SectionDocument>

          <SectionDocument numero={3} titre={t("sections.effectifs")}>
            {synthese.effectifs.length === 0 ? (
              <p className="m-0 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{t("effectifs.sousTraitance")}</p>
            ) : (
              <TableauDocument
                colonnes={[
                  { entete: t("effectifs.categorie") },
                  { entete: t("effectifs.prevu"), nombre: true },
                  { entete: t("effectifs.moyenne"), nombre: true },
                  { entete: t("effectifs.taux"), nombre: true },
                  { entete: t("effectifs.heures"), nombre: true },
                  { entete: t("effectifs.absences"), nombre: true },
                  { entete: t("effectifs.observation") },
                ]}
                lignes={synthese.effectifs.map((ligne) => {
                  const taux = ligne.prevuParJour ? Math.round((ligne.presenceMoyenne / ligne.prevuParJour) * 100) : 0;
                  return {
                    cle: ligne.categorie,
                    cellules: [
                      <span key="c" className="font-medium">{ligne.categorie}</span>,
                      ligne.prevuParJour,
                      formaterQuantite(ligne.presenceMoyenne),
                      <span key="t" className={taux < 85 ? "font-semibold text-erreur" : undefined}>
                        {tRapport("pourcent", { valeur: taux })}
                      </span>,
                      tRapport("heures", { valeur: formaterQuantite(ligne.heures) }),
                      <span key="a" className={ligne.absences > 0 ? "font-semibold text-erreur" : undefined}>{ligne.absences}</span>,
                      ligne.observation ?? tRapport("neant"),
                    ],
                  };
                })}
                pied={[
                  t("effectifs.total"),
                  totalPrevu,
                  formaterQuantite(Math.round(totalMoyen * 10) / 10),
                  tauxEffectifs === null ? "" : tRapport("pourcent", { valeur: tauxEffectifs }),
                  tRapport("heures", { valeur: formaterQuantite(totalHeures) }),
                  totalAbsences,
                  t("effectifs.cible", { cible: CIBLE_PRESENCE }),
                ]}
              />
            )}
          </SectionDocument>

          <SectionDocument numero={4} titre={t("sections.materiaux")}>
            <TableauDocument
              colonnes={[
                { entete: t("materiaux.designation") },
                { entete: t("materiaux.unite") },
                { entete: t("materiaux.debut"), nombre: true },
                { entete: t("materiaux.consomme"), nombre: true },
                { entete: t("materiaux.livre"), nombre: true },
                { entete: t("materiaux.fin"), nombre: true },
                { entete: t("materiaux.seuil"), nombre: true },
                { entete: t("materiaux.statut") },
              ]}
              vide={t("materiaux.vide")}
              lignes={synthese.materiaux.map((ligne) => {
                const alerte = enAlerteStock(ligne.stockFin, ligne.seuilAlerte);
                const quantite = (valeur: number | null) => (valeur === null ? tRapport("neant") : formaterQuantite(valeur));
                return {
                  cle: ligne.designation,
                  cellules: [
                    <span key="d" className="font-medium">{ligne.designation}</span>,
                    ligne.unite,
                    quantite(ligne.stockDebut),
                    formaterQuantite(ligne.consomme),
                    formaterQuantite(ligne.livre),
                    <span key="f" className={alerte ? "font-semibold text-erreur" : "font-semibold"}>{quantite(ligne.stockFin)}</span>,
                    quantite(ligne.seuilAlerte),
                    ligne.stockFin === null ? (
                      <Badge key="s" variante="neutre">{statutStock.horsStock}</Badge>
                    ) : (
                      <Badge key="s" variante={alerte ? "erreur" : "succes"}>
                        {alerte ? statutStock.alerte : statutStock.ok}
                      </Badge>
                    ),
                  ],
                };
              })}
            />
          </SectionDocument>

          <SectionDocument numero={5} titre={t("sections.incidents")}>
            <TableauDocument
              colonnes={[
                { entete: t("incidents.date") },
                { entete: t("incidents.lot") },
                { entete: t("incidents.type") },
                { entete: t("incidents.description") },
                { entete: t("incidents.gravite") },
                { entete: t("incidents.resolution") },
              ]}
              vide={t("incidents.vide")}
              lignes={synthese.incidents.map((incident, rang) => ({
                cle: `${incident.date}-${incident.lotCode}-${incident.numero}-${rang}`,
                cellules: [
                  <span key="d" className="tabular-nums">{formaterJourMoisNumerique(incident.date)}</span>,
                  <span key="l" className="whitespace-nowrap">{incident.lotCode}</span>,
                  tEnum(`typeIncident.${incident.type}`),
                  incident.description,
                  <Badge key="g" variante={TON_GRAVITE[incident.gravite]}>{tEnum(`gravite.${incident.gravite}`)}</Badge>,
                  <span key="r" className={incident.resolu ? "text-succes" : "text-avertissement"}>
                    {incident.resolu ? t("incidents.resolu", { action: incident.action }) : t("incidents.enCours", { action: incident.action })}
                  </span>,
                ],
              }))}
              pied={
                synthese.incidents.length
                  ? [
                      t("incidents.total", { n: synthese.incidents.length }),
                      "",
                      "",
                      "",
                      t("incidents.totalGravite", { majeurs: chiffres.incidentsMajeurs }),
                      t("incidents.totalResolution", { resolus, enCours: synthese.incidents.length - resolus }),
                    ]
                  : undefined
              }
            />
          </SectionDocument>

          <SectionDocument numero={6} titre={t("sections.appreciation")}>
            {synthese.appreciation ? (
              <blockquote className="m-0 rounded-lg border-l-4 border-secondary-700 bg-secondary-50 px-4 py-3">
                <p className="m-0 text-xs font-medium text-neutral-600">
                  {t("appreciation.auteur", {
                    nom: synthese.appreciation.auteur,
                    quand: formaterDateHeure(synthese.appreciation.redigeeLe),
                  })}
                </p>
                <p className="m-0 mt-1.5 text-sm text-neutral-800">{synthese.appreciation.texte}</p>
              </blockquote>
            ) : (
              <p className="m-0 flex items-start gap-2 rounded-lg bg-avertissement-fond px-3 py-2 text-sm text-avertissement">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t("appreciation.enAttente")}
              </p>
            )}
          </SectionDocument>

          <SectionDocument numero={7} titre={t("sections.objectifs")}>
            <TableauDocument
              colonnes={[
                { entete: t("objectifs.lot") },
                { entete: t("objectifs.activite") },
                { entete: t("objectifs.objectif") },
                { entete: t("objectifs.cible"), nombre: true },
                { entete: t("objectifs.prerequis") },
              ]}
              vide={t("objectifs.vide")}
              lignes={synthese.objectifs.map((objectif) => ({
                cle: `${objectif.lotCode}-${objectif.activite}`,
                cellules: [
                  objectif.lotCode,
                  <span key="a" className="font-medium">{objectif.activite}</span>,
                  objectif.objectif,
                  tRapport("pourcent", { valeur: objectif.cible }),
                  objectif.prerequis,
                ],
              }))}
            />
          </SectionDocument>

          <SectionDocument numero={8} titre={t("sections.circuit")}>
            <CircuitSignatures circuit={synthese.circuit} />
            {approuvee && (
              <p className="m-0 flex items-center gap-2 text-sm text-succes">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t("immuable")}
              </p>
            )}
          </SectionDocument>
        </div>

        <PiedDocument mention={t("mention", { n: chiffres.rapportsRecus })} />
      </article>
      {indicateur}
    </div>
  );
}
