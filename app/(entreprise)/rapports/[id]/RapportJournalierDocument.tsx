"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MapPin } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Badge, EtatChargement, EtatErreur } from "@/components/ui";
import {
  activitesActives,
  activitesDuRapport,
  avancementActivite,
  cumulActivite,
  enAlerteStock,
  formatDocument,
  libelleModeLot,
  presenceSuffisante,
  retardPoints,
  stockFin,
  tailleKo,
  tauxPresence,
  totauxEffectifs,
  totauxEquipes,
} from "@/features/chantier";
import type { RapportJournalier } from "@/features/chantier";
import { lireRapport } from "@/features/chantier/adaptateur";
import { cleRapport } from "@/features/chantier/cles";
import { ErreurApi } from "@/lib/api/erreurs";
import { formaterDate, formaterDateHeure, formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { FOND_INDICATEUR } from "../../projets/classes";
import type { FondIndicateur } from "../../projets/classes";
import {
  TEINTE_CONDITIONS,
  TEINTE_METEO,
  teintesChiffresRapport,
  TON_BLOCAGE,
  TON_CONFORMITE,
  TON_EQUIPEMENT,
  TON_GRAVITE,
} from "../classes";
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
import { contenuRapportPdf } from "./contenuRapportPdf";
import { SignatureRapport } from "./SignatureRapport";

/**
 * Le rapport journalier officiel du chantier : pointage nominatif par équipe,
 * avancement des feuilles selon leurs trois modes de mesure (`QUANTITE`,
 * `POURCENTAGE`, `JALON`), stocks et livraisons consolidés, besoins urgents,
 * matériels, événements, blocages persistants, preuves photos et circuit de
 * signatures (`REDACTION` → `VALIDATION` → `APPROBATION`).
 */
export function RapportJournalierDocument({ id }: { id: string }) {
  const t = useTranslations("journal.rapport");
  const requete = useQuery({
    queryKey: cleRapport(id),
    queryFn: ({ signal }) => lireRapport(id, signal),
  });

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) {
    const introuvable = requete.error instanceof ErreurApi && requete.error.statut === 404;
    return (
      <EtatErreur
        message={introuvable ? t("introuvable") : t("erreurChargement")}
        onReessayer={introuvable ? undefined : () => void requete.refetch()}
      />
    );
  }

  return <Document rapport={requete.data} />;
}

function Document({ rapport }: { rapport: RapportJournalier }) {
  const t = useTranslations("journal.rapport");
  const tCircuit = useTranslations("journal.circuit");
  const tMode = useTranslations("projets.tiroirCreation.modeExecution");
  const tEnum = useTranslations("journal.enumerations");
  const format = useFormatter();

  const jour = format.dateTime(new Date(`${rapport.date}T00:00:00Z`), {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  const reference = rapport.reference ?? "";
  const retard = retardPoints(rapport);
  const totaux =
    rapport.equipes.length > 0
      ? totauxEquipes(rapport.equipes)
      : rapport.effectifs
        ? totauxEffectifs(rapport.effectifs)
        : null;
  const presence = totaux?.taux ?? tauxPresence(rapport.effectifPresent, rapport.effectifPrevu);
  const livraisonsPartielles = rapport.livraisons.filter(
    (livraison) => livraison.conformite !== "CONFORME",
  ).length;
  const incidentsMajeurs = rapport.listeIncidents.filter(
    (incident) => incident.gravite !== "" && incident.gravite !== "MINEUR",
  ).length;
  const teintes = teintesChiffresRapport({
    retard,
    presenceInsuffisante: presenceSuffisante(presence) === "INSUFFISANTE",
    livraisonsPartielles,
    incidents: rapport.listeIncidents.length,
    incidentsMajeurs,
    blocages: rapport.listeBlocages.length,
  });

  const activites = activitesDuRapport(rapport);
  const separateurNoms = t("separateurNoms");
  const sections = [
    "meteo",
    rapport.equipes.length > 0 ? "equipes" : rapport.effectifs ? "effectifs" : null,
    "avancement",
    "materiaux",
    "livraisons",
    rapport.besoins.length > 0 ? "besoins" : null,
    "equipements",
    "incidents",
    "blocages",
    "photos",
    "documents",
    "previsions",
    "note",
    "circuit",
  ].filter((cle): cle is string => cle !== null);
  const numero = (cle: string) => sections.indexOf(cle) + 1;
  const roles = {
    REDACTION: tCircuit("role.REDACTION"),
    VALIDATION: tCircuit("role.VALIDATION"),
    APPROBATION: tCircuit("role.APPROBATION"),
  };
  const tJournal = useTranslations("journal");
  const { pdf, indicateur } = useGenerationDocumentPdf(t("titre"), (source) =>
    contenuRapportPdf((cle, valeurs) => tJournal(cle, valeurs), {
      ...source,
      rapport,
      jour,
      modeExecution: (lot) => libelleModeLot(lot, tMode),
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <BarreDocument
        titre={t("titrePage", { chantier: rapport.chantier.projetNom, jour })}
        pdf={pdf}
        badges={
          <>
            <Badge variante="neutre">{t("lotsValeur", { n: rapport.lots.length })}</Badge>
            <BadgeSituation situation={rapport.situation} />
          </>
        }
      />

      <SignatureRapport rapport={rapport} />

      <article className={PAPIER}>
        <EnTeteDocument
          titre={t("titre")}
          sousTitre={t("sousTitre")}
          bandeau={
            rapport.arret ? (
              <BandeauDocument ton="avertissement">
                <span className="font-semibold">
                  {rapport.arret.precision
                    ? t("arretBandeauPrecision", {
                        motif: t(`motifsArret.${rapport.arret.motif}`),
                        precision: rapport.arret.precision,
                      })
                    : t("arretBandeau", { motif: t(`motifsArret.${rapport.arret.motif}`) })}
                </span>
              </BandeauDocument>
            ) : null
          }
        />

        <div className={CORPS_PAPIER}>
          <div className="grid gap-4 lg:grid-cols-2">
            <GrilleInfos
              titre={t("identification")}
              lignes={[
                [t("projet"), rapport.chantier.projetNom],
                [t("referenceProjet"), rapport.chantier.projetReference],
                [t("numero"), reference],
                [
                  t("localisation"),
                  <span key="loc" className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5 text-neutral-400" aria-hidden="true" />
                    {rapport.localisation}
                  </span>,
                ],
              ]}
            />
            <GrilleInfos
              titre={t("intervenants")}
              lignes={[
                [roles.REDACTION, rapport.intervenants.redacteur],
                [roles.VALIDATION, rapport.intervenants.validateurs],
                [roles.APPROBATION, rapport.intervenants.approbateurs],
                [
                  t("date"),
                  <span key="date" className="capitalize">
                    {jour}
                  </span>,
                ],
                [
                  t("horaires"),
                  rapport.heureDebut && rapport.heureFin
                    ? t("horairesValeur", { debut: rapport.heureDebut, fin: rapport.heureFin })
                    : t("sansObjet"),
                ],
                [t("statutLigne"), <BadgeSituation key="statut" situation={rapport.situation} />],
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            <ChiffreDocument
              fond={teintes.avancement}
              libelle={t("chiffres.avancement")}
              valeur={t("pourcent", { valeur: rapport.avancement ?? 0 })}
              alerte={retard !== null && retard >= 10}
            />
            <ChiffreDocument
              fond={teintes.effectifs}
              libelle={t("chiffres.effectifs")}
              valeur={t("fraction", {
                a: rapport.effectifPresent ?? 0,
                b: rapport.effectifPrevu ?? 0,
              })}
              alerte={presenceSuffisante(presence) === "INSUFFISANTE"}
            />
            <ChiffreDocument
              fond={teintes.heures}
              libelle={t("chiffres.heures")}
              valeur={
                totaux ? t("heures", { valeur: formaterQuantite(totaux.heures) }) : t("sansObjet")
              }
            />
            <ChiffreDocument
              fond={teintes.activites}
              libelle={t("chiffres.activites")}
              valeur={t("fraction", { a: activitesActives(activites), b: activites.length })}
            />
            <ChiffreDocument
              fond={teintes.livraisons}
              alerte={livraisonsPartielles > 0}
              libelle={t("chiffres.livraisons")}
              valeur={rapport.livraisons.length}
            />
            <ChiffreDocument
              fond={teintes.incidents}
              libelle={t("chiffres.incidents")}
              valeur={rapport.listeIncidents.length}
              alerte={incidentsMajeurs > 0}
            />
            <ChiffreDocument
              fond={teintes.blocages}
              libelle={t("chiffres.blocages")}
              valeur={rapport.listeBlocages.length}
              alerte={rapport.listeBlocages.length > 0}
            />
            <ChiffreDocument
              fond={teintes.photos}
              libelle={t("chiffres.photos")}
              valeur={rapport.listePhotos.length}
            />
          </div>

          <SectionDocument numero={numero("meteo")} titre={t("sections.meteo")}>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  [
                    t("meteo.matin"),
                    rapport.meteo.matin ? tEnum(`meteo.${rapport.meteo.matin}`) : t("neant"),
                    TEINTE_METEO.ciel,
                  ],
                  [
                    t("meteo.apresMidi"),
                    rapport.meteo.apresMidi
                      ? tEnum(`meteo.${rapport.meteo.apresMidi}`)
                      : t("neant"),
                    TEINTE_METEO.ciel,
                  ],
                  [
                    t("meteo.conditions"),
                    rapport.meteo.conditions
                      ? tEnum(`conditions.${rapport.meteo.conditions}`)
                      : t("neant"),
                    rapport.meteo.conditions
                      ? TEINTE_CONDITIONS[rapport.meteo.conditions]
                      : "neutre",
                  ],
                ] satisfies [string, string, FondIndicateur][]
              ).map(([libelle, valeur, teinte]) => (
                <div
                  key={libelle}
                  className={cn(
                    "rounded-lg border px-3 py-2 break-inside-avoid",
                    FOND_INDICATEUR[teinte],
                  )}
                >
                  <span className="block text-xs text-neutral-500">{libelle}</span>
                  <span className="text-sm font-semibold text-neutral-900">{valeur}</span>
                </div>
              ))}
            </div>
          </SectionDocument>

          {rapport.equipes.length > 0 && totaux && (
            <SectionDocument numero={numero("equipes")} titre={t("sections.equipes")}>
              <TableauDocument
                colonnes={[
                  { entete: t("equipes.nom") },
                  { entete: t("equipes.entreprise") },
                  { entete: t("equipes.presents"), nombre: true },
                  { entete: t("equipes.absents") },
                  { entete: t("equipes.retards") },
                  { entete: t("equipes.heures"), nombre: true },
                  { entete: t("equipes.qualite") },
                  { entete: t("equipes.observation") },
                ]}
                lignes={rapport.equipes.map((equipe) => ({
                  cle: equipe.equipeId || equipe.nom,
                  cellules: [
                    <span key="n" className="font-medium">
                      {equipe.nom}
                    </span>,
                    equipe.entreprise || t("neant"),
                    <div key="p" className="flex flex-col items-end gap-0.5">
                      <span className="font-semibold tabular-nums">
                        {t("fraction", { a: equipe.presents.length, b: equipe.membres })}
                      </span>
                      {equipe.presents.length > 0 && (
                        <span className="text-right text-xs text-neutral-500">
                          {equipe.presents.join(separateurNoms)}
                        </span>
                      )}
                    </div>,
                    equipe.absents.length > 0 ? (
                      <span key="ab" className="text-erreur">
                        {equipe.absents.join(separateurNoms)}
                      </span>
                    ) : (
                      t("neant")
                    ),
                    equipe.retards.length > 0 ? (
                      <span key="rt" className="text-avertissement">
                        {equipe.retards.join(separateurNoms)}
                      </span>
                    ) : (
                      t("neant")
                    ),
                    equipe.heures !== null
                      ? t("heures", { valeur: formaterQuantite(equipe.heures) })
                      : t("neant"),
                    equipe.qualite ? tEnum(`qualiteExecution.${equipe.qualite}`) : t("neant"),
                    equipe.observation || t("neant"),
                  ],
                }))}
                pied={[
                  t("total"),
                  "",
                  t("fraction", { a: totaux.presents, b: totaux.prevus }),
                  totaux.absents,
                  "",
                  t("heures", { valeur: formaterQuantite(totaux.heures) }),
                  t("pourcent", { valeur: totaux.taux ?? 0 }),
                  t(`effectifs.appreciation.${presenceSuffisante(totaux.taux) ?? "BONNE"}`),
                ]}
              />
            </SectionDocument>
          )}

          {rapport.equipes.length === 0 && rapport.effectifs && totaux && (
            <SectionDocument
              numero={numero("effectifs")}
              titre={t("sections.effectifs")}
              complement={tMode("REGIE_DIRECTE")}
            >
              <TableauDocument
                colonnes={[
                  { entete: t("effectifs.categorie") },
                  { entete: t("effectifs.prevus"), nombre: true },
                  { entete: t("effectifs.presents"), nombre: true },
                  { entete: t("effectifs.absents"), nombre: true },
                  { entete: t("effectifs.presence"), nombre: true },
                  { entete: t("effectifs.heures"), nombre: true },
                  { entete: t("effectifs.observation") },
                ]}
                lignes={rapport.effectifs.map((ligne) => {
                  const taux = tauxPresence(ligne.presents, ligne.prevus) ?? 0;
                  return {
                    cle: ligne.categorie,
                    cellules: [
                      <span key="c" className="font-medium">
                        {ligne.categorie}
                      </span>,
                      ligne.prevus,
                      ligne.presents,
                      <span
                        key="a"
                        className={
                          ligne.prevus - ligne.presents > 0
                            ? "font-semibold text-erreur"
                            : undefined
                        }
                      >
                        {ligne.prevus - ligne.presents}
                      </span>,
                      <span key="j" className="font-semibold tabular-nums">
                        {t("pourcent", { valeur: taux })}
                      </span>,
                      t("heures", { valeur: formaterQuantite(ligne.heures) }),
                      ligne.observation ?? t("neant"),
                    ],
                  };
                })}
                pied={[
                  t("total"),
                  totaux.prevus,
                  totaux.presents,
                  totaux.absents,
                  t("pourcent", { valeur: totaux.taux ?? 0 }),
                  t("heures", { valeur: formaterQuantite(totaux.heures) }),
                  t(`effectifs.appreciation.${presenceSuffisante(totaux.taux) ?? "BONNE"}`),
                ]}
              />
            </SectionDocument>
          )}

          <SectionDocument
            numero={numero("avancement")}
            titre={t("sections.avancement")}
            complement={t("avancement.global", {
              reel: rapport.avancement ?? 0,
              theorique: rapport.avancementTheorique ?? 0,
            })}
          >
            {rapport.travaux.length === 0 ? (
              <p className="m-0 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                {t("avancement.aucunLot")}
              </p>
            ) : (
              rapport.travaux.map((travaux) => (
                <div key={travaux.lot.id} className="flex flex-col gap-2 break-inside-avoid">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="m-0 text-sm font-semibold text-neutral-900">
                      {t("avancement.lot", { code: travaux.lot.code, nom: travaux.lot.nom })}
                    </h3>
                    <span className="text-xs text-neutral-500">
                      {t("avancement.lotDetail", {
                        mode: libelleModeLot(travaux.lot, tMode),
                        reel: travaux.avancement,
                        theorique: travaux.avancementTheorique,
                      })}
                    </span>
                  </div>
                  {travaux.observation && (
                    <p className="m-0 border-l-2 border-neutral-200 pl-2 text-sm text-neutral-600 italic">
                      {t("avancement.point", { texte: travaux.observation })}
                    </p>
                  )}
                  <TableauDocument
                    colonnes={[
                      { entete: t("avancement.activite") },
                      { entete: t("avancement.unite") },
                      { entete: t("avancement.prevue"), nombre: true },
                      { entete: t("avancement.veille"), nombre: true },
                      { entete: t("avancement.jour"), nombre: true },
                      { entete: t("avancement.cumul"), nombre: true },
                      { entete: t("avancement.avancement"), nombre: true },
                      { entete: t("avancement.observation") },
                    ]}
                    lignes={travaux.activites.map((ligne) => {
                      const avancement = avancementActivite(ligne);
                      const uniteAffichee =
                        ligne.unite ??
                        (ligne.modeMesure === "JALON"
                          ? t("avancement.uniteJalon")
                          : t("avancement.unitePourcent"));
                      const veilleAffichee =
                        ligne.modeMesure === "QUANTITE"
                          ? formaterQuantite(ligne.cumulVeille)
                          : ligne.modeMesure === "POURCENTAGE"
                            ? t("pourcent", { valeur: formaterQuantite(ligne.pourcentageVeille) })
                            : t("sansObjet");
                      const jourAffiche =
                        ligne.modeMesure === "QUANTITE"
                          ? formaterQuantite(ligne.quantiteJour)
                          : ligne.modeMesure === "POURCENTAGE"
                            ? ligne.pourcentageJour !== null
                              ? t("pourcent", { valeur: formaterQuantite(ligne.pourcentageJour) })
                              : t("neant")
                            : ligne.jalonAtteint
                              ? t("avancement.jalonAtteint")
                              : t("avancement.jalonEnCours");
                      return {
                        cle: ligne.activiteId || ligne.libelle,
                        cellules: [
                          <div key="l" className="flex flex-col gap-0.5">
                            <span className="font-medium">{ligne.libelle}</span>
                            {ligne.localisation && (
                              <span className="text-xs text-neutral-500">{ligne.localisation}</span>
                            )}
                            {ligne.equipesNoms.length > 0 && (
                              <span className="text-xs text-primary-700">
                                {ligne.equipesNoms.join(separateurNoms)}
                              </span>
                            )}
                          </div>,
                          uniteAffichee,
                          ligne.modeMesure === "QUANTITE"
                            ? formaterQuantite(ligne.quantitePrevue)
                            : t("sansObjet"),
                          veilleAffichee,
                          <span key="j" className="font-semibold text-primary-700">
                            {jourAffiche}
                          </span>,
                          ligne.modeMesure === "QUANTITE"
                            ? formaterQuantite(cumulActivite(ligne))
                            : t("sansObjet"),
                          <span key="g" className="font-semibold tabular-nums">
                            {t("pourcent", { valeur: avancement })}
                          </span>,
                          ligne.observation ?? t("neant"),
                        ],
                      };
                    })}
                  />
                </div>
              ))
            )}
          </SectionDocument>

          <SectionDocument numero={numero("materiaux")} titre={t("sections.materiaux")}>
            <TableauDocument
              colonnes={[
                { entete: t("materiaux.designation") },
                { entete: t("materiaux.unite") },
                { entete: t("materiaux.debut"), nombre: true },
                { entete: t("materiaux.livre"), nombre: true },
                { entete: t("materiaux.utilise"), nombre: true },
                { entete: t("materiaux.fin"), nombre: true },
                { entete: t("materiaux.seuil"), nombre: true },
                { entete: t("materiaux.statut") },
              ]}
              vide={t("materiaux.vide")}
              lignes={rapport.materiaux.map((ligne) => {
                const fin = stockFin(ligne);
                const alerte = enAlerteStock(fin, ligne.seuilAlerte);
                const quantite = (valeur: number | null) =>
                  valeur === null ? t("neant") : formaterQuantite(valeur);
                return {
                  cle: `${ligne.designation}-${ligne.unite}`,
                  cellules: [
                    <span key="d" className="font-medium">
                      {ligne.designation}
                    </span>,
                    ligne.unite,
                    quantite(ligne.stockDebut),
                    ligne.livre ? formaterQuantite(ligne.livre) : t("neant"),
                    formaterQuantite(ligne.utilise),
                    <span
                      key="f"
                      className={alerte ? "font-semibold text-erreur" : "font-semibold"}
                    >
                      {quantite(fin)}
                    </span>,
                    quantite(ligne.seuilAlerte),
                    fin === null ? (
                      <Badge key="s" variante="neutre">
                        {t("materiaux.horsStock")}
                      </Badge>
                    ) : (
                      <Badge key="s" variante={alerte ? "erreur" : "succes"}>
                        {alerte ? t("materiaux.alerte") : t("materiaux.ok")}
                      </Badge>
                    ),
                  ],
                };
              })}
            />
          </SectionDocument>

          <SectionDocument numero={numero("livraisons")} titre={t("sections.livraisons")}>
            <TableauDocument
              colonnes={[
                { entete: t("livraisons.fournisseur") },
                { entete: t("livraisons.designation") },
                { entete: t("livraisons.quantite"), nombre: true },
                { entete: t("livraisons.bon") },
                { entete: t("livraisons.heure") },
                { entete: t("livraisons.conformite") },
                { entete: t("livraisons.observation") },
              ]}
              vide={t("livraisons.vide")}
              lignes={rapport.livraisons.map((livraison, rang) => ({
                cle: `${livraison.bonLivraison}-${rang}`,
                cellules: [
                  <span key="f" className="font-medium">
                    {livraison.fournisseur}
                  </span>,
                  livraison.designation,
                  livraison.quantite !== null
                    ? livraison.unite
                      ? t("quantiteUnite", {
                          quantite: formaterQuantite(livraison.quantite),
                          unite: livraison.unite,
                        })
                      : formaterQuantite(livraison.quantite)
                    : t("neant"),
                  <span key="b" className="font-mono text-xs">
                    {livraison.bonLivraison || t("neant")}
                  </span>,
                  livraison.heure || t("neant"),
                  <Badge key="c" variante={TON_CONFORMITE[livraison.conformite]}>
                    {tEnum(`conformite.${livraison.conformite}`)}
                  </Badge>,
                  livraison.observation ?? t("neant"),
                ],
              }))}
            />
          </SectionDocument>

          {rapport.besoins.length > 0 && (
            <SectionDocument numero={numero("besoins")} titre={t("sections.besoins")}>
              <TableauDocument
                colonnes={[
                  { entete: t("besoins.nature") },
                  { entete: t("besoins.designation") },
                  { entete: t("besoins.quantite"), nombre: true },
                  { entete: t("besoins.observation") },
                ]}
                lignes={rapport.besoins.map((besoin, rang) => ({
                  cle: `${besoin.designation}-${rang}`,
                  cellules: [
                    <Badge
                      key="n"
                      variante={besoin.nature === "RUPTURE" ? "erreur" : "avertissement"}
                    >
                      {t(`besoins.natures.${besoin.nature}`)}
                    </Badge>,
                    <span key="d" className="font-medium">
                      {besoin.designation}
                    </span>,
                    besoin.quantite !== null
                      ? besoin.unite
                        ? t("quantiteUnite", {
                            quantite: formaterQuantite(besoin.quantite),
                            unite: besoin.unite,
                          })
                        : formaterQuantite(besoin.quantite)
                      : t("neant"),
                    besoin.observation ?? t("neant"),
                  ],
                }))}
              />
            </SectionDocument>
          )}

          <SectionDocument numero={numero("equipements")} titre={t("sections.equipements")}>
            <TableauDocument
              colonnes={[
                { entete: t("equipements.designation") },
                { entete: t("equipements.reference") },
                { entete: t("equipements.propriete") },
                { entete: t("equipements.utilisation"), nombre: true },
                { entete: t("equipements.operateur") },
                { entete: t("equipements.etat") },
                { entete: t("equipements.observation") },
              ]}
              vide={t("equipements.vide")}
              lignes={rapport.equipements.map((equipement, rang) => ({
                cle: equipement.cle || `${equipement.designation}-${rang}`,
                cellules: [
                  <div key="d" className="flex flex-col gap-0.5">
                    <span className="font-medium">{equipement.designation}</span>
                    {equipement.usage && (
                      <span className="text-xs text-neutral-500">{equipement.usage}</span>
                    )}
                  </div>,
                  <span key="r" className="font-mono text-xs">
                    {equipement.reference || t("neant")}
                  </span>,
                  equipement.propriete ? tEnum(`propriete.${equipement.propriete}`) : t("neant"),
                  equipement.heuresUtilisation !== null
                    ? t("heures", { valeur: formaterQuantite(equipement.heuresUtilisation) })
                    : equipement.dureeArret !== null
                      ? t("equipements.arretValeur", {
                          valeur: formaterQuantite(equipement.dureeArret),
                        })
                      : t("neant"),
                  equipement.operateur || t("neant"),
                  equipement.etat ? (
                    <Badge key="e" variante={TON_EQUIPEMENT[equipement.etat]}>
                      {tEnum(`etatEquipement.${equipement.etat}`)}
                    </Badge>
                  ) : (
                    t("neant")
                  ),
                  equipement.observation ?? t("neant"),
                ],
              }))}
            />
          </SectionDocument>

          <SectionDocument numero={numero("incidents")} titre={t("sections.incidents")}>
            <TableauDocument
              colonnes={[
                { entete: t("incidents.numero") },
                { entete: t("incidents.nature") },
                { entete: t("incidents.description") },
                { entete: t("incidents.gravite") },
                { entete: t("incidents.decidePar") },
                { entete: t("incidents.action") },
              ]}
              vide={t("incidents.vide")}
              lignes={rapport.listeIncidents.map((incident) => ({
                cle: incident.numero,
                cellules: [
                  <span key="n" className="font-mono text-xs font-semibold">
                    {incident.numero}
                  </span>,
                  tEnum(`natureEvenement.${incident.nature}`),
                  incident.description,
                  incident.gravite ? (
                    <Badge key="g" variante={TON_GRAVITE[incident.gravite]}>
                      {tEnum(`gravite.${incident.gravite}`)}
                    </Badge>
                  ) : (
                    t("neant")
                  ),
                  incident.decidePar ? tEnum(`decideur.${incident.decidePar}`) : t("neant"),
                  incident.action || t("neant"),
                ],
              }))}
            />
          </SectionDocument>

          <SectionDocument numero={numero("blocages")} titre={t("sections.blocages")}>
            {rapport.listeBlocages.length === 0 ? (
              <p className="m-0 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                <CheckCircle2 className="size-4 text-succes" aria-hidden="true" />
                {t("blocages.aucun")}
              </p>
            ) : (
              <TableauDocument
                colonnes={[
                  { entete: t("blocages.numero") },
                  { entete: t("blocages.nature") },
                  { entete: t("blocages.description") },
                  { entete: t("blocages.niveau") },
                  { entete: t("blocages.impact") },
                  { entete: t("blocages.escalade") },
                ]}
                lignes={rapport.listeBlocages.map((blocage) => ({
                  cle: blocage.cle || blocage.numero,
                  cellules: [
                    <span key="n" className="font-mono text-xs font-semibold">
                      {blocage.numero}
                    </span>,
                    blocage.nature ? tEnum(`natureBlocage.${blocage.nature}`) : t("neant"),
                    <div key="d" className="flex flex-col gap-0.5">
                      {blocage.titre && (
                        <span className="font-medium text-neutral-900">{blocage.titre}</span>
                      )}
                      {blocage.elementLibelle && (
                        <span className="text-xs text-primary-700">{blocage.elementLibelle}</span>
                      )}
                      <span>{blocage.description}</span>
                    </div>,
                    <Badge key="v" variante={TON_BLOCAGE[blocage.niveau]}>
                      {tEnum(`niveauBlocage.${blocage.niveau}`)}
                    </Badge>,
                    blocage.impact || t("neant"),
                    blocage.escalade ? tCircuit(`role.${blocage.escalade}`) : t("neant"),
                  ],
                }))}
              />
            )}
          </SectionDocument>

          <SectionDocument
            numero={numero("photos")}
            titre={t("sections.photos")}
            complement={t("photos.nombre", { n: rapport.listePhotos.length })}
          >
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
              {rapport.listePhotos.map((photo, rang) => (
                <li
                  key={`${photo.heure}-${rang}`}
                  className="overflow-hidden rounded-lg border border-neutral-200 break-inside-avoid"
                >
                  {photo.url ? (
                    // L'image servie par le stockage du rapport : `next/image` ne connaît pas son domaine.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt={photo.legende}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-neutral-100 text-neutral-400">
                      <MapPin className="size-6" aria-hidden="true" />
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5 px-3 py-2 text-xs">
                    <span className="font-semibold text-neutral-900">
                      {t("photos.titre", { rang: rang + 1, total: rapport.listePhotos.length })}
                    </span>
                    {photo.elementLibelle && (
                      <span className="font-medium text-primary-700">{photo.elementLibelle}</span>
                    )}
                    <span className="text-neutral-700">{photo.legende}</span>
                    <span className="text-neutral-500 tabular-nums">
                      {photo.latitude === null || photo.longitude === null
                        ? t("photos.metaSansPosition", { heure: photo.heure })
                        : t("photos.meta", {
                            heure: photo.heure,
                            latitude: Math.abs(photo.latitude).toFixed(4),
                            longitude: Math.abs(photo.longitude).toFixed(4),
                          })}
                    </span>
                    {photo.gpsConfirme && (
                      <span className="font-medium text-succes">{t("photos.gps")}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </SectionDocument>

          <SectionDocument numero={numero("documents")} titre={t("sections.documents")}>
            <TableauDocument
              colonnes={[
                { entete: t("documents.nom") },
                { entete: t("documents.type") },
                { entete: t("documents.taille"), nombre: true },
              ]}
              vide={t("documents.vide")}
              lignes={rapport.documents.map((piece, rang) => ({
                cle: `${piece.nom}-${rang}`,
                cellules: [
                  piece.url ? (
                    <a
                      key="n"
                      href={piece.url}
                      download={piece.nom}
                      className="font-medium text-primary underline"
                    >
                      {piece.nom}
                    </a>
                  ) : (
                    <span key="n" className="font-medium">
                      {piece.nom}
                    </span>
                  ),
                  tEnum(`formatDocument.${formatDocument(piece.nom)}`),
                  t("documents.tailleValeur", { valeur: formaterQuantite(tailleKo(piece.taille)) }),
                ],
              }))}
            />
          </SectionDocument>

          <SectionDocument numero={numero("previsions")} titre={t("sections.previsions")}>
            <TableauDocument
              colonnes={[
                { entete: t("previsions.activite") },
                { entete: t("previsions.equipe") },
                { entete: t("previsions.objectif") },
                { entete: t("previsions.prerequis") },
              ]}
              vide={t("previsions.vide")}
              lignes={rapport.previsions.map((prevision, rang) => ({
                cle: `${prevision.activite}-${rang}`,
                cellules: [
                  <span key="a" className="font-medium">
                    {prevision.activite}
                  </span>,
                  prevision.equipe || t("neant"),
                  prevision.objectif,
                  prevision.prerequis || t("neant"),
                ],
              }))}
            />
          </SectionDocument>

          <SectionDocument numero={numero("note")} titre={t("sections.note")}>
            <blockquote className="m-0 rounded-lg border-l-4 border-primary-500 bg-primary-50 px-4 py-3">
              <p className="m-0 text-xs font-medium text-neutral-600">
                {t("note.auteur", {
                  nom: rapport.intervenants.redacteur,
                  quand: rapport.soumisLe
                    ? formaterDateHeure(rapport.soumisLe)
                    : formaterDate(rapport.date),
                })}
              </p>
              <p className="m-0 mt-1.5 text-sm text-neutral-800">
                {rapport.noteRedacteur ?? t("note.vide")}
              </p>
            </blockquote>
          </SectionDocument>

          <SectionDocument numero={numero("circuit")} titre={t("sections.circuit")}>
            <CircuitSignatures circuit={rapport.circuit} />
          </SectionDocument>
        </div>

        <PiedDocument reference={reference} />
      </article>
      {indicateur}
    </div>
  );
}
