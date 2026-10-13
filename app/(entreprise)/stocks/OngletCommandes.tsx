"use client";

import { Ban, Eye, Lock, PackageCheck, Send, Siren } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { Badge, Bouton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BORD_DROIT_TABLEAU, FiltreTableau, RechercheTableau, TableauListe } from "@/components/ui/tableau-liste";
import {
  STATUTS_COMMANDE,
  commandeAnnulable,
  commandeCloturable,
  commandeReceptionnable,
  commandeTransmissible,
  filtrerCommandes,
  reliquat,
  statutsPresents,
  valeursPresentes,
} from "@/features/stocks";
import type { BonCommande, OrigineCommande, StatutCommande } from "@/features/stocks";
import { annulerCommande, cloturerCommande, transmettreCommande } from "@/features/stocks/adaptateur";
import { formaterDate, formaterDateHeure, formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  CORPS_TIROIR,
  ENTETE_TIROIR,
  FICHE,
  FICHE_LIBELLE,
  FICHE_VALEUR,
  PIED_TIROIR,
  TON_COMMANDE,
  TON_LIVRAISON,
} from "./classes";
import { ModaleMotif } from "./composants";
import { useEcriture, useStock } from "./contexte";
import type { Intention } from "./contexte";
import { TiroirCommande } from "./TiroirCommande";
import { TiroirReception } from "./TiroirReception";

const ORIGINES: readonly OrigineCommande[] = ["DEMANDE", "COMMANDE_DIRECTE"];
const colonne = aideColonnes<BonCommande>();

/**
 * Les bons de commande (F9-3) — en lecture pour tous, émis par la direction.
 * Le magasinier y ouvre le BC quand le camion arrive ; le CP ou le
 * magasinier clôture un BC partiellement livré (DA résiduelle automatique).
 */
export function OngletCommandes({ intention }: { intention: Intention | null }) {
  const t = useTranslations("stocks.commandes");
  const tc = useTranslations("stocks");
  const { donnees, gestes, gestesDe, libelleLot, libelleProjet, libelleMateriau, projets } = useStock();
  const ecrire = useEcriture();
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState<StatutCommande | "">("");
  const [origine, setOrigine] = useState<OrigineCommande | "">("");
  const cible = intention ? donnees.commandes.find((c) => c.id === intention.cible) ?? null : null;
  const [directe, setDirecte] = useState(false);
  const [detail, setDetail] = useState<BonCommande | null>(intention?.type === "TRANSMETTRE" ? cible : null);
  const [reception, setReception] = useState<BonCommande | null>(intention?.type === "RECEPTIONNER" ? cible : null);
  const [cloture, setCloture] = useState<BonCommande | null>(intention?.type === "CLOTURER" ? cible : null);
  const [annulation, setAnnulation] = useState<BonCommande | null>(null);
  const aujourdhui = donnees.luLe.slice(0, 10);

  const libelles = useMemo(
    () => ({ materiau: libelleMateriau, lot: libelleLot, projet: libelleProjet }),
    [libelleMateriau, libelleLot, libelleProjet],
  );
  const filtrees = useMemo(
    () => filtrerCommandes(donnees.commandes, { recherche, statut, origine }, libelles),
    [donnees.commandes, recherche, statut, origine, libelles],
  );
  const plusieurs = projets.length > 1;

  const transmettre = useCallback(
    async (commande: BonCommande) => {
      await ecrire(() => transmettreCommande(commande.id), t("transmisSucces", { reference: commande.reference }));
    },
    [ecrire, t],
  );

  const exporter = useMemo<ExportTableau<BonCommande>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.fichier"),
      colonnes: [
        { entete: t("colonnes.reference"), valeur: (c) => c.reference },
        { entete: t("colonnes.origine"), valeur: (c) => tc(`origine.${c.origine}`) },
        { entete: t("colonnes.demande"), valeur: (c) => c.demandeReference },
        { entete: t("colonnes.chantier"), valeur: (c) => libelleProjet(c.projetId) },
        { entete: t("colonnes.lot"), valeur: (c) => libelleLot(c.lotId) },
        { entete: t("colonnes.fournisseur"), valeur: (c) => c.fournisseur },
        {
          entete: t("colonnes.articles"),
          valeur: (c) =>
            c.lignes.map((l) => `${libelleMateriau(l.materiauId)} (${l.quantiteLivree}/${l.quantiteCommandee})`).join(" ; "),
        },
        { entete: t("colonnes.emetteur"), valeur: (c) => c.emetteur.nom },
        { entete: t("colonnes.emisLe"), valeur: (c) => c.emisLe.slice(0, 10) },
        { entete: t("colonnes.livraisonPrevue"), valeur: (c) => c.dateLivraisonPrevue },
        { entete: t("colonnes.statut"), valeur: (c) => tc(`statutCommande.${c.statut}`) },
        { entete: t("colonnes.cloture"), valeur: (c) => c.cloture?.motif },
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
              <span className="font-semibold text-neutral-900 hover:text-primary-600 hover:underline">{row.original.reference}</span>
              <span className="text-xs text-neutral-500">
                {row.original.demandeReference ?? tc(`origine.${row.original.origine}`)}
              </span>
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
        colonne.accessor("fournisseur", {
          header: t("colonnes.fournisseur"),
          meta: { classe: "text-neutral-700" },
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
        colonne.accessor("dateLivraisonPrevue", {
          header: t("colonnes.livraisonPrevue"),
          cell: ({ row }) => {
            const enRetard =
              row.original.dateLivraisonPrevue < aujourdhui &&
              (row.original.statut === "EMIS" || row.original.statut === "EN_ATTENTE_LIVRAISON");
            return (
              <span className={cn("tabular-nums", enRetard ? "font-semibold text-erreur" : "text-neutral-600")}>
                {formaterDate(row.original.dateLivraisonPrevue)}
              </span>
            );
          },
        }),
        colonne.accessor("statut", {
          header: t("colonnes.statut"),
          cell: ({ row }) => (
            <span className="flex flex-wrap items-center gap-1">
              <Badge variante={TON_COMMANDE[row.original.statut]}>{tc(`statutCommande.${row.original.statut}`)}</Badge>
              {row.original.cloture && <Badge variante="neutre">{t("cloturee")}</Badge>}
              {row.original.origine === "COMMANDE_DIRECTE" && (
                <Badge variante="avertissement" icone={<Siren size={12} aria-hidden="true" />}>
                  {t("directe")}
                </Badge>
              )}
            </span>
          ),
        }),
        colonne.display({
          id: "actions",
          header: t("colonnes.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => {
            const c = row.original;
            const g = gestesDe(c.projetId);
            return (
              <span className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => setDetail(c)} aria-label={t("voir", { reference: c.reference })} title={t("voir", { reference: c.reference })}>
                  <Eye />
                </Button>
                {g.emettreCommande && commandeTransmissible(c) && (
                  <Button variant="ghost" size="icon-sm" onClick={() => void transmettre(c)} aria-label={t("transmettre", { reference: c.reference })} title={t("transmettre", { reference: c.reference })} className="text-primary-600">
                    <Send />
                  </Button>
                )}
                {g.saisirReception && commandeReceptionnable(c, donnees.livraisons) && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setReception(c)} aria-label={t("receptionner", { reference: c.reference })} title={t("receptionner", { reference: c.reference })} className="text-succes hover:text-succes">
                    <PackageCheck />
                  </Button>
                )}
                {g.cloturerCommande && commandeCloturable(c, donnees.livraisons) && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setCloture(c)} aria-label={t("cloturer", { reference: c.reference })} title={t("cloturer", { reference: c.reference })}>
                    <Lock />
                  </Button>
                )}
                {g.emettreCommande && commandeAnnulable(c, donnees.livraisons) && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setAnnulation(c)} aria-label={t("annuler", { reference: c.reference })} title={t("annuler", { reference: c.reference })} className="text-erreur hover:text-erreur">
                    <Ban />
                  </Button>
                )}
              </span>
            );
          },
        }),
      ]),
    [t, tc, libelleLot, libelleProjet, libelleMateriau, plusieurs, gestesDe, donnees.livraisons, aujourdhui, transmettre],
  );

  return (
    <>
      <TableauListe
        colonnes={colonnes}
        donnees={filtrees}
        cleLigne={(c) => c.id}
        messageVide={donnees.commandes.length === 0 ? t("vide") : t("aucunResultat")}
        cleCriteres={`${recherche}|${statut}|${origine}`}
        filtresActifs={Boolean(recherche || statut || origine)}
        onReinitialiser={() => {
          setRecherche("");
          setStatut("");
          setOrigine("");
        }}
        outils={
          <>
            <RechercheTableau valeur={recherche} onChangement={setRecherche} libelle={t("recherche")} placeholder={t("recherchePlaceholder")} />
            <FiltreTableau
              valeur={statut}
              onChangement={setStatut}
              libelle={t("filtreStatut")}
              libelleTous={t("tousStatuts")}
              options={statutsPresents(STATUTS_COMMANDE, donnees.commandes).map((s) => ({ valeur: s, libelle: tc(`statutCommande.${s}`) }))}
            />
            <FiltreTableau
              valeur={origine}
              onChangement={setOrigine}
              libelle={t("filtreOrigine")}
              libelleTous={t("toutesOrigines")}
              options={valeursPresentes(ORIGINES, donnees.commandes.map((c) => c.origine)).map((o) => ({ valeur: o, libelle: tc(`origine.${o}`) }))}
            />
          </>
        }
        exporter={exporter}
        actions={
          gestes.emettreCommande && (
            <Bouton
              variante="primaire"
              taille="sm"
              aria-label={t("commandeDirecte")}
              iconeGauche={<Siren size={16} aria-hidden="true" />}
              onClick={() => setDirecte(true)}
              className="max-sm:gap-0 max-sm:px-3"
            >
              <span className="max-sm:hidden">{t("commandeDirecte")}</span>
            </Bouton>
          )
        }
      />

      {directe && <TiroirCommande ouverte onFermer={() => setDirecte(false)} />}
      {reception && <TiroirReception commande={reception} onFermer={() => setReception(null)} />}
      {detail && (
        <DetailCommande
          commande={donnees.commandes.find((c) => c.id === detail.id) ?? detail}
          onFermer={() => setDetail(null)}
          onTransmettre={transmettre}
          onReceptionner={(c) => {
            setDetail(null);
            setReception(c);
          }}
        />
      )}
      {cloture && (
        <ModaleMotif
          ouverte
          titre={t("clotureTitre", { reference: cloture.reference })}
          description={t("clotureDescription", {
            reliquat: reliquat(cloture)
              .map((l) => `${libelleMateriau(l.materiauId)} (${formaterQuantite(l.quantite)})`)
              .join(", "),
          })}
          libelleAction={t("clotureAction")}
          onFermer={() => setCloture(null)}
          onConfirmer={async (motif) => {
            const residuelle = await ecrire(() => cloturerCommande(cloture.id, motif), t("clotureSucces", { reference: cloture.reference }));
            return residuelle !== null;
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
            (await ecrire(() => annulerCommande(annulation.id, motif), t("annulationSucces", { reference: annulation.reference }))) !== null
          }
        />
      )}
    </>
  );
}

/** Le détail d'un BC : ses lignes (livré / commandé), ses livraisons, sa clôture. */
function DetailCommande({
  commande,
  onFermer,
  onTransmettre,
  onReceptionner,
}: {
  commande: BonCommande;
  onFermer: () => void;
  onTransmettre: (commande: BonCommande) => Promise<void>;
  onReceptionner: (commande: BonCommande) => void;
}) {
  const t = useTranslations("stocks.commandes");
  const tc = useTranslations("stocks");
  const { donnees, gestesDe, libelleLot, libelleProjet, libelleMateriau, quantite } = useStock();
  const g = gestesDe(commande.projetId);
  const livraisons = donnees.livraisons.filter((l) => l.bonCommandeId === commande.id);

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className={ENTETE_TIROIR}>
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg text-neutral-900">
            {commande.reference}
            <Badge variante={TON_COMMANDE[commande.statut]}>{tc(`statutCommande.${commande.statut}`)}</Badge>
            {commande.cloture && <Badge variante="neutre">{t("cloturee")}</Badge>}
          </SheetTitle>
          <SheetDescription>{tc(`origine.${commande.origine}`)}</SheetDescription>
        </SheetHeader>
        <div className={CORPS_TIROIR}>
          <dl className={FICHE}>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.chantier")}</dt>
              <dd className={FICHE_VALEUR}>{libelleProjet(commande.projetId)}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.lot")}</dt>
              <dd className={FICHE_VALEUR}>{libelleLot(commande.lotId)}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.fournisseur")}</dt>
              <dd className={FICHE_VALEUR}>{commande.fournisseur}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.demande")}</dt>
              <dd className={FICHE_VALEUR}>{commande.demandeReference ?? tc(`origine.${commande.origine}`)}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.emetteur")}</dt>
              <dd className={FICHE_VALEUR}>{t("emisPar", { nom: commande.emetteur.nom, date: formaterDateHeure(commande.emisLe) })}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.livraisonPrevue")}</dt>
              <dd className={FICHE_VALEUR}>{formaterDate(commande.dateLivraisonPrevue)}</dd>
            </div>
            <div className="col-span-full">
              <dt className={FICHE_LIBELLE}>{t("transmission")}</dt>
              <dd className={FICHE_VALEUR}>
                {commande.transmisLe ? t("transmisLe", { date: formaterDateHeure(commande.transmisLe) }) : t("nonTransmis")}
              </dd>
            </div>
          </dl>

          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("lignes")}</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-2 font-medium">{t("colonnes.article")}</th>
                  <th className="py-2 text-right font-medium">{t("commande")}</th>
                  <th className="py-2 text-right font-medium">{t("livre")}</th>
                </tr>
              </thead>
              <tbody>
                {commande.lignes.map((ligne) => (
                  <tr key={ligne.materiauId} className="border-b border-neutral-100">
                    <td className="py-2 text-neutral-900">{libelleMateriau(ligne.materiauId)}</td>
                    <td className="py-2 text-right tabular-nums">{quantite(ligne.quantiteCommandee, ligne.materiauId)}</td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums",
                        ligne.quantiteLivree >= ligne.quantiteCommandee ? "text-succes" : "text-neutral-600",
                      )}
                    >
                      {formaterQuantite(ligne.quantiteLivree)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("livraisons")}</h3>
            {livraisons.length === 0 ? (
              <p className="m-0 text-sm text-neutral-500">{t("aucuneLivraison")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {livraisons.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-neutral-900">
                      {t("livraisonDu", { reference: l.reference, date: formaterDate(l.recueLe) })}
                    </span>
                    <Badge variante={TON_LIVRAISON[l.statut]}>{tc(`statutLivraison.${l.statut}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(commande.cloture ?? commande.annulation) && (
            <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <p className="m-0 font-medium text-neutral-900">
                {commande.cloture
                  ? t("clotureePar", {
                      nom: commande.cloture.par.nom,
                      date: formaterDateHeure(commande.cloture.le),
                      demande: commande.cloture.demandeResiduelle,
                    })
                  : t("annuleePar", {
                      nom: commande.annulation?.par.nom ?? "",
                      date: formaterDateHeure(commande.annulation?.le),
                    })}
              </p>
              <p className="m-0 mt-1 text-neutral-700">{commande.cloture?.motif ?? commande.annulation?.motif}</p>
            </section>
          )}
        </div>
        <SheetFooter className={PIED_TIROIR}>
          <Button type="button" variant="outline" onClick={onFermer}>
            {t("fermer")}
          </Button>
          {g.emettreCommande && commandeTransmissible(commande) && (
            <Button type="button" onClick={() => void onTransmettre(commande)}>
              <Send />
              {t("transmettreCourt")}
            </Button>
          )}
          {g.saisirReception && commandeReceptionnable(commande, donnees.livraisons) && (
            <Button type="button" onClick={() => onReceptionner(commande)}>
              <PackageCheck />
              {t("receptionnerCourt")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
