"use client";

import { Ban, Eye, Pencil, Plus, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge, Bouton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BORD_DROIT_TABLEAU, FiltreTableau, RechercheTableau, TableauListe } from "@/components/ui/tableau-liste";
import {
  STATUTS_DEMANDE,
  demandeACommander,
  demandeAnnulable,
  demandeModifiable,
  filtrerDemandes,
  statutsPresents,
} from "@/features/stocks";
import type { DemandeAppro, StatutDemande } from "@/features/stocks";
import { annulerDemande } from "@/features/stocks/adaptateur";
import { formaterDate, formaterDateHeure, formaterQuantite } from "@/lib/format";

import {
  CORPS_TIROIR,
  ENTETE_TIROIR,
  FICHE,
  FICHE_LIBELLE,
  FICHE_VALEUR,
  PIED_TIROIR,
  TON_COMMANDE,
  TON_DEMANDE,
} from "./classes";
import { ModaleMotif } from "./composants";
import { useEcriture, useStock } from "./contexte";
import type { Intention } from "./contexte";
import { TiroirCommande } from "./TiroirCommande";
import { TiroirDemande } from "./TiroirDemande";

const colonne = aideColonnes<DemandeAppro>();

/**
 * Les demandes d'approvisionnement (F9-2) — la file de la direction
 * (F9-US-05) et le suivi du terrain. La direction y répond par un BC, ou
 * n'y donne pas suite (motif obligatoire).
 */
export function OngletDemandes({ intention }: { intention: Intention | null }) {
  const t = useTranslations("stocks.demandes");
  const tc = useTranslations("stocks");
  const { donnees, gestes, gestesDe, libelleLot, libelleProjet, libelleMateriau, projets } = useStock();
  const ecrire = useEcriture();
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState<StatutDemande | "">("");
  const cible = intention ? donnees.demandes.find((d) => d.id === intention.cible) ?? null : null;
  const [nouvelle, setNouvelle] = useState(false);
  const [detail, setDetail] = useState<DemandeAppro | null>(intention?.type !== "COMMANDER" ? cible : null);
  const [modification, setModification] = useState<DemandeAppro | null>(null);
  const [commande, setCommande] = useState<DemandeAppro | null>(intention?.type === "COMMANDER" ? cible : null);
  const [annulation, setAnnulation] = useState<DemandeAppro | null>(null);

  const libelles = useMemo(
    () => ({ materiau: libelleMateriau, lot: libelleLot, projet: libelleProjet }),
    [libelleMateriau, libelleLot, libelleProjet],
  );
  const filtrees = useMemo(
    () => filtrerDemandes(donnees.demandes, { recherche, statut }, libelles),
    [donnees.demandes, recherche, statut, libelles],
  );
  const plusieurs = projets.length > 1;

  const exporter = useMemo<ExportTableau<DemandeAppro>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.fichier"),
      colonnes: [
        { entete: t("colonnes.reference"), valeur: (d) => d.reference },
        { entete: t("colonnes.chantier"), valeur: (d) => libelleProjet(d.projetId) },
        { entete: t("colonnes.lot"), valeur: (d) => libelleLot(d.lotId) },
        {
          entete: t("colonnes.articles"),
          valeur: (d) => d.lignes.map((l) => `${libelleMateriau(l.materiauId)} (${l.quantiteDemandee})`).join(" ; "),
        },
        { entete: t("colonnes.emetteur"), valeur: (d) => d.emetteur.nom },
        { entete: t("colonnes.emiseLe"), valeur: (d) => d.emiseLe.slice(0, 10) },
        { entete: t("colonnes.dateSouhaitee"), valeur: (d) => d.dateSouhaitee },
        { entete: t("colonnes.statut"), valeur: (d) => tc(`statutDemande.${d.statut}`) },
        { entete: t("colonnes.residuelleDe"), valeur: (d) => d.residuelleDe },
      ],
    }),
    [t, tc, libelleLot, libelleProjet, libelleMateriau],
  );

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("reference", {
          header: t("colonnes.reference"),
          cell: ({ row }) => (
            <button
              type="button"
              onClick={() => setDetail(row.original)}
              className="flex cursor-pointer flex-col items-start border-0 bg-transparent p-0 text-left"
            >
              <span className="font-semibold text-neutral-900 hover:text-primary-600 hover:underline">
                {row.original.reference}
              </span>
              {row.original.residuelleDe && (
                <span className="text-xs text-neutral-500">{t("residuelleDe", { reference: row.original.residuelleDe })}</span>
              )}
            </button>
          ),
        }),
        colonne.display({
          id: "lot",
          header: t("colonnes.lot"),
          cell: ({ row }) => (
            <span className="flex flex-col text-sm">
              <span className="text-neutral-800">{libelleLot(row.original.lotId)}</span>
              {plusieurs && <span className="text-xs text-neutral-500">{libelleProjet(row.original.projetId)}</span>}
            </span>
          ),
        }),
        colonne.display({
          id: "articles",
          header: t("colonnes.articles"),
          cell: ({ row }) => (
            <span className="text-sm text-neutral-700">
              {t("resumeArticles", {
                premier: libelleMateriau(row.original.lignes[0]?.materiauId ?? ""),
                autres: row.original.lignes.length - 1,
              })}
            </span>
          ),
        }),
        colonne.display({
          id: "emetteur",
          header: t("colonnes.emetteur"),
          meta: { classe: "text-neutral-700" },
          cell: ({ row }) => row.original.emetteur.nom,
        }),
        colonne.accessor("dateSouhaitee", {
          header: t("colonnes.dateSouhaitee"),
          meta: { classe: "tabular-nums text-neutral-600" },
          cell: ({ getValue }) => formaterDate(getValue()),
        }),
        colonne.accessor("statut", {
          header: t("colonnes.statut"),
          cell: ({ getValue }) => <Badge variante={TON_DEMANDE[getValue()]}>{tc(`statutDemande.${getValue()}`)}</Badge>,
        }),
        colonne.display({
          id: "actions",
          header: t("colonnes.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => {
            const d = row.original;
            const g = gestesDe(d.projetId);
            return (
              <span className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => setDetail(d)} aria-label={t("voir", { reference: d.reference })} title={t("voir", { reference: d.reference })}>
                  <Eye />
                </Button>
                {g.emettreDemande && demandeModifiable(d) && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setModification(d)} aria-label={t("modifier", { reference: d.reference })} title={t("modifier", { reference: d.reference })}>
                    <Pencil />
                  </Button>
                )}
                {g.emettreCommande && demandeACommander(d) && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setCommande(d)} aria-label={t("commander", { reference: d.reference })} title={t("commander", { reference: d.reference })} className="text-primary-600">
                    <ShoppingCart />
                  </Button>
                )}
                {g.emettreCommande && demandeAnnulable(d) && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setAnnulation(d)} aria-label={t("annuler", { reference: d.reference })} title={t("annuler", { reference: d.reference })} className="text-erreur hover:text-erreur">
                    <Ban />
                  </Button>
                )}
              </span>
            );
          },
        }),
      ]),
    [t, tc, libelleLot, libelleProjet, libelleMateriau, plusieurs, gestesDe],
  );

  return (
    <>
      <TableauListe
        colonnes={colonnes}
        donnees={filtrees}
        cleLigne={(d) => d.id}
        messageVide={donnees.demandes.length === 0 ? t("vide") : t("aucunResultat")}
        cleCriteres={`${recherche}|${statut}`}
        filtresActifs={Boolean(recherche || statut)}
        onReinitialiser={() => {
          setRecherche("");
          setStatut("");
        }}
        outils={
          <>
            <RechercheTableau valeur={recherche} onChangement={setRecherche} libelle={t("recherche")} placeholder={t("recherchePlaceholder")} />
            <FiltreTableau
              valeur={statut}
              onChangement={setStatut}
              libelle={t("filtreStatut")}
              libelleTous={t("tousStatuts")}
              options={statutsPresents(STATUTS_DEMANDE, donnees.demandes).map((s) => ({ valeur: s, libelle: tc(`statutDemande.${s}`) }))}
            />
          </>
        }
        exporter={exporter}
        actions={
          gestes.emettreDemande && (
            <Bouton
              variante="primaire"
              taille="sm"
              aria-label={t("nouvelle")}
              iconeGauche={<Plus size={16} aria-hidden="true" />}
              onClick={() => setNouvelle(true)}
              className="max-sm:gap-0 max-sm:px-3"
            >
              <span className="max-sm:hidden">{t("nouvelle")}</span>
            </Bouton>
          )
        }
      />

      {nouvelle && <TiroirDemande ouverte onFermer={() => setNouvelle(false)} />}
      {modification && <TiroirDemande ouverte demande={modification} onFermer={() => setModification(null)} />}
      {commande && <TiroirCommande ouverte demande={commande} onFermer={() => setCommande(null)} />}
      {detail && (
        <DetailDemande
          demande={donnees.demandes.find((d) => d.id === detail.id) ?? detail}
          onFermer={() => setDetail(null)}
          onModifier={(d) => {
            setDetail(null);
            setModification(d);
          }}
          onCommander={(d) => {
            setDetail(null);
            setCommande(d);
          }}
        />
      )}
      {annulation && (
        <ModaleMotif
          ouverte
          titre={t("annulationTitre", { reference: annulation.reference })}
          description={t("annulationDescription")}
          libelleAction={t("annulationAction")}
          danger
          onFermer={() => setAnnulation(null)}
          onConfirmer={async (motif) =>
            (await ecrire(() => annulerDemande(annulation.id, motif), t("annulationSucces", { reference: annulation.reference }))) !== null
          }
        />
      )}
    </>
  );
}

/** Le détail d'une DA : ses lignes, les BC qui en sont issus, son journal de modifications. */
function DetailDemande({
  demande,
  onFermer,
  onModifier,
  onCommander,
}: {
  demande: DemandeAppro;
  onFermer: () => void;
  onModifier: (demande: DemandeAppro) => void;
  onCommander: (demande: DemandeAppro) => void;
}) {
  const t = useTranslations("stocks.demandes");
  const tc = useTranslations("stocks");
  const { donnees, gestesDe, libelleLot, libelleProjet, libelleMateriau, materiau } = useStock();
  const g = gestesDe(demande.projetId);
  const issus = donnees.commandes.filter((c) => c.demandeId === demande.id);

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className={ENTETE_TIROIR}>
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg text-neutral-900">
            {demande.reference}
            <Badge variante={TON_DEMANDE[demande.statut]}>{tc(`statutDemande.${demande.statut}`)}</Badge>
          </SheetTitle>
          <SheetDescription>{t("detailSousTitre")}</SheetDescription>
        </SheetHeader>
        <div className={CORPS_TIROIR}>
          <dl className={FICHE}>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.chantier")}</dt>
              <dd className={FICHE_VALEUR}>{libelleProjet(demande.projetId)}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.lot")}</dt>
              <dd className={FICHE_VALEUR}>{libelleLot(demande.lotId)}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.emetteur")}</dt>
              <dd className={FICHE_VALEUR}>{demande.emetteur.nom}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.emiseLe")}</dt>
              <dd className={FICHE_VALEUR}>{formaterDateHeure(demande.emiseLe)}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.dateSouhaitee")}</dt>
              <dd className={FICHE_VALEUR}>{formaterDate(demande.dateSouhaitee)}</dd>
            </div>
            {demande.residuelleDe && (
              <div>
                <dt className={FICHE_LIBELLE}>{t("colonnes.residuelleDe")}</dt>
                <dd className={FICHE_VALEUR}>{demande.residuelleDe}</dd>
              </div>
            )}
          </dl>

          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("lignes")}</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-2 font-medium">{t("colonnes.article")}</th>
                  <th className="py-2 text-right font-medium">{t("demande")}</th>
                  <th className="py-2 text-right font-medium">{t("commande")}</th>
                </tr>
              </thead>
              <tbody>
                {demande.lignes.map((ligne) => (
                  <tr key={ligne.materiauId} className="border-b border-neutral-100">
                    <td className="py-2 text-neutral-900">{libelleMateriau(ligne.materiauId)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {tc("quantiteUnite", { quantite: formaterQuantite(ligne.quantiteDemandee), unite: materiau(ligne.materiauId)?.unite ?? "" })}
                    </td>
                    <td className="py-2 text-right tabular-nums text-neutral-600">{formaterQuantite(ligne.quantiteCommandee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {demande.observation && (
            <section className="flex flex-col gap-1">
              <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("observation")}</h3>
              <p className="m-0 text-sm whitespace-pre-line text-neutral-700">{demande.observation}</p>
            </section>
          )}

          {demande.annulation && (
            <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <p className="m-0 font-medium text-neutral-900">
                {t("annuleePar", { nom: demande.annulation.par.nom, date: formaterDateHeure(demande.annulation.le) })}
              </p>
              <p className="m-0 mt-1 text-neutral-700">{demande.annulation.motif}</p>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("commandesIssues")}</h3>
            {issus.length === 0 ? (
              <p className="m-0 text-sm text-neutral-500">{t("aucuneCommande")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {issus.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-neutral-900">{t("commandeDe", { reference: c.reference, fournisseur: c.fournisseur })}</span>
                    <Badge variante={TON_COMMANDE[c.statut]}>{tc(`statutCommande.${c.statut}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {demande.modifications.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("journal")}</h3>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-neutral-600">
                {demande.modifications.map((m) => (
                  <li key={m.le}>
                    {t("modification", {
                      date: formaterDateHeure(m.le),
                      nom: m.par.nom,
                      champs: m.champs.map((champ) => t(`champs.${champ}`)).join(", "),
                    })}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <SheetFooter className={PIED_TIROIR}>
          <Button type="button" variant="outline" onClick={onFermer}>
            {t("fermer")}
          </Button>
          {g.emettreDemande && demandeModifiable(demande) && (
            <Button type="button" variant="outline" onClick={() => onModifier(demande)}>
              <Pencil />
              {t("modifierCourt")}
            </Button>
          )}
          {g.emettreCommande && demandeACommander(demande) && (
            <Button type="button" onClick={() => onCommander(demande)}>
              <ShoppingCart />
              {t("commanderCourt")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
