"use client";

import { Check, CircleDashed, Eye, FileCheck2, Printer, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BORD_DROIT_TABLEAU, FiltreTableau, RechercheTableau, TableauListe } from "@/components/ui/tableau-liste";
import { Textarea } from "@/components/ui/textarea";
import { ZoneDepotFichiers } from "@/components/ui/zone-depot-fichiers";
import { STATUTS_LIVRAISON, etapeAttendue, filtrerLivraisons, justificatifManquant, statutsPresents } from "@/features/stocks";
import type { Livraison, StatutLivraison } from "@/features/stocks";
import { deposerJustificatif, rejeterLivraison, validerLivraison } from "@/features/stocks/adaptateur";
import { lireQuantite, refusJustificatif } from "@/features/stocks/validations";
import { formaterDateHeure, formaterQuantite, formaterTailleFichier } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useGenerationDocumentPdf } from "../rapports/GenerationDocumentPdf";
import { contenuBrv } from "./brvPdf";
import {
  CHAMP,
  CORPS_TIROIR,
  ENTETE_TIROIR,
  FICHE,
  FICHE_LIBELLE,
  FICHE_VALEUR,
  PIED_TIROIR,
  TON_LIVRAISON,
} from "./classes";
import { ModaleMotif } from "./composants";
import { useEcriture, useStock } from "./contexte";
import type { Intention } from "./contexte";

const colonne = aideColonnes<Livraison>();

/**
 * Les réceptions (F9-4) — la fonction centrale du module. Une livraison
 * n'entre en stock qu'avec **deux** conditions réunies (RG-STK-01) : l'écran
 * dit toujours laquelle manque.
 */
export function OngletReceptions({ intention }: { intention: Intention | null }) {
  const t = useTranslations("stocks.receptions");
  const tc = useTranslations("stocks");
  const { donnees, gestesDe, libelleLot, libelleProjet, libelleMateriau, projets } = useStock();
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState<StatutLivraison | "">("");
  const [detail, setDetail] = useState<string | null>(intention?.cible ?? null);

  const libelles = useMemo(
    () => ({ materiau: libelleMateriau, lot: libelleLot, projet: libelleProjet }),
    [libelleMateriau, libelleLot, libelleProjet],
  );
  const filtrees = useMemo(
    () => filtrerLivraisons(donnees.livraisons, { recherche, statut }, libelles),
    [donnees.livraisons, recherche, statut, libelles],
  );
  const plusieurs = projets.length > 1;
  const ouverte = detail ? donnees.livraisons.find((l) => l.id === detail) ?? null : null;

  const exporter = useMemo<ExportTableau<Livraison>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.fichier"),
      colonnes: [
        { entete: t("colonnes.reference"), valeur: (l) => l.reference },
        { entete: t("colonnes.commande"), valeur: (l) => l.bonCommandeReference },
        { entete: t("colonnes.chantier"), valeur: (l) => libelleProjet(l.projetId) },
        { entete: t("colonnes.lot"), valeur: (l) => libelleLot(l.lotId) },
        { entete: t("colonnes.nature"), valeur: (l) => tc(`nature.${l.nature}`) },
        {
          entete: t("colonnes.articles"),
          valeur: (l) => l.lignes.map((ligne) => `${libelleMateriau(ligne.materiauId)} (${ligne.quantiteRecue})`).join(" ; "),
        },
        { entete: t("colonnes.magasinier"), valeur: (l) => l.magasinier.nom },
        { entete: t("colonnes.recueLe"), valeur: (l) => l.recueLe.slice(0, 16).replace("T", " ") },
        { entete: t("colonnes.validationCT"), valeur: (l) => l.validationCT?.le.slice(0, 16).replace("T", " ") },
        { entete: t("colonnes.validationCP"), valeur: (l) => l.validationCP?.le.slice(0, 16).replace("T", " ") },
        { entete: t("colonnes.justificatif"), valeur: (l) => l.justificatif?.hash },
        { entete: t("colonnes.brv"), valeur: (l) => l.numeroBrv },
        { entete: t("colonnes.statut"), valeur: (l) => tc(`statutLivraison.${l.statut}`) },
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
              onClick={() => setDetail(row.original.id)}
              className="flex cursor-pointer flex-col items-start border-0 bg-transparent p-0 text-left"
            >
              <span className="font-semibold text-neutral-900 hover:text-primary-600 hover:underline">{row.original.reference}</span>
              <span className="text-xs text-neutral-500">{row.original.bonCommandeReference}</span>
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
        colonne.accessor("nature", {
          header: t("colonnes.nature"),
          cell: ({ getValue }) => (
            <Badge variante={getValue() === "EQUIPEMENT" ? "secondaire" : "neutre"}>{tc(`nature.${getValue()}`)}</Badge>
          ),
        }),
        colonne.accessor("recueLe", {
          header: t("colonnes.recueLe"),
          meta: { classe: "tabular-nums text-neutral-600" },
          cell: ({ getValue }) => formaterDateHeure(getValue()),
        }),
        colonne.display({
          id: "conditions",
          header: t("colonnes.conditions"),
          cell: ({ row }) => <Conditions livraison={row.original} compact />,
        }),
        colonne.accessor("statut", {
          header: t("colonnes.statut"),
          cell: ({ row }) => (
            <span className="flex flex-col items-start gap-1">
              <Badge variante={TON_LIVRAISON[row.original.statut]}>{tc(`statutLivraison.${row.original.statut}`)}</Badge>
              {row.original.numeroBrv && <span className="text-xs text-neutral-500">{row.original.numeroBrv}</span>}
            </span>
          ),
        }),
        colonne.display({
          id: "actions",
          header: t("colonnes.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => {
            const l = row.original;
            const g = gestesDe(l.projetId);
            const etape = etapeAttendue(l);
            const aValider = (etape === "CT" && g.validerCT) || (etape === "CP" && g.validerCP);
            return (
              <span className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDetail(l.id)}
                  aria-label={t("voir", { reference: l.reference })}
                  title={t("voir", { reference: l.reference })}
                  className={cn(aValider && "text-primary-600")}
                >
                  {aValider ? <FileCheck2 /> : <Eye />}
                </Button>
                {g.deposerJustificatif && justificatifManquant(l) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDetail(l.id)}
                    aria-label={t("deposer", { reference: l.reference })}
                    title={t("deposer", { reference: l.reference })}
                    className="text-avertissement hover:text-avertissement"
                  >
                    <Upload />
                  </Button>
                )}
                {l.numeroBrv && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDetail(l.id)}
                    aria-label={t("brv", { numero: l.numeroBrv })}
                    title={t("brv", { numero: l.numeroBrv })}
                  >
                    <Printer />
                  </Button>
                )}
              </span>
            );
          },
        }),
      ]),
    [t, tc, libelleLot, libelleProjet, plusieurs, gestesDe],
  );

  return (
    <>
      <TableauListe
        colonnes={colonnes}
        donnees={filtrees}
        cleLigne={(l) => l.id}
        messageVide={donnees.livraisons.length === 0 ? t("vide") : t("aucunResultat")}
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
              options={statutsPresents(STATUTS_LIVRAISON, donnees.livraisons).map((s) => ({ valeur: s, libelle: tc(`statutLivraison.${s}`) }))}
            />
          </>
        }
        exporter={exporter}
      />
      {ouverte && <DetailLivraison key={`${ouverte.id}-${ouverte.statut}`} livraison={ouverte} onFermer={() => setDetail(null)} />}
    </>
  );
}

/** Les deux conditions de RG-STK-01, chacune cochée ou non. */
function Conditions({ livraison, compact = false }: { livraison: Livraison; compact?: boolean }) {
  const t = useTranslations("stocks.receptions.conditions");
  const items = [
    { cle: "workflow", ok: livraison.workflowValide },
    { cle: "justificatif", ok: livraison.justificatif !== null },
  ] as const;
  return (
    <ul className={cn("m-0 flex list-none gap-1 p-0", compact ? "flex-col" : "flex-col gap-2")}>
      {items.map((item) => (
        <li key={item.cle} className={cn("flex items-center gap-1.5", compact ? "text-xs" : "text-sm")}>
          {item.ok ? (
            <Check className="size-4 shrink-0 text-succes" aria-hidden="true" />
          ) : (
            <CircleDashed className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          )}
          <span className={item.ok ? "text-neutral-800" : "text-neutral-500"}>
            {t(`${item.cle}.${item.ok ? "ok" : "manque"}`)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Une étape du circuit : magasinier → CT → (CP) → BRV. */
function Etape({ libelle, detail, etat }: { libelle: string; detail: string; etat: "fait" | "attendu" | "avenir" | "rejet" }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          etat === "fait" && "bg-succes-fond text-succes",
          etat === "attendu" && "bg-primary-50 text-primary-700 ring-1 ring-primary-200",
          etat === "avenir" && "bg-neutral-100 text-neutral-500",
          etat === "rejet" && "bg-erreur-fond text-erreur",
        )}
      >
        {etat === "fait" ? <Check className="size-3.5" aria-hidden="true" /> : etat === "rejet" ? <X className="size-3.5" aria-hidden="true" /> : <CircleDashed className="size-3.5" aria-hidden="true" />}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-neutral-900">{libelle}</span>
        <span className="text-xs text-neutral-500">{detail}</span>
      </span>
    </li>
  );
}

/**
 * Le détail d'une livraison : le circuit, les deux conditions, les lignes, le
 * justificatif et son empreinte, et les gestes que le compte peut y faire —
 * valider ou rejeter à son étape, déposer le BL, imprimer le BRV.
 */
function DetailLivraison({ livraison, onFermer }: { livraison: Livraison; onFermer: () => void }) {
  const t = useTranslations("stocks.receptions");
  const tc = useTranslations("stocks");
  const { gestesDe, libelleLot, libelleProjet, libelleMateriau, materiau, quantite } = useStock();
  const ecrire = useEcriture();
  const g = gestesDe(livraison.projetId);
  const etape = etapeAttendue(livraison);
  const peutValider = (etape === "CT" && g.validerCT) || (etape === "CP" && g.validerCP);
  const [quantites, setQuantites] = useState<Record<string, string>>(() =>
    Object.fromEntries(livraison.lignes.map((l) => [l.materiauId, String(l.conforme ? l.quantiteRecue : 0)])),
  );
  const [commentaire, setCommentaire] = useState("");
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [rejet, setRejet] = useState(false);
  const tPdf = useTranslations("stocks.receptions.pdf");
  const { pdf, indicateur } = useGenerationDocumentPdf(t("imprimerBrv"), (source) =>
    contenuBrv((cle, valeurs) => tPdf(cle, valeurs), {
      ...source,
      livraison,
      projet: libelleProjet(livraison.projetId),
      lot: libelleLot(livraison.lotId),
      libelleMateriau,
      unite: (id) => materiau(id)?.unite ?? "",
      nature: tc(`nature.${livraison.nature}`),
    }),
  );

  const quantitesInvalides =
    etape === "CT" &&
    livraison.lignes.some((l) => {
      const valeur = lireQuantite(quantites[l.materiauId] ?? "");
      return valeur === null || valeur > l.quantiteRecue;
    });

  async function valider() {
    if (!etape) return;
    setEnCours(true);
    await ecrire(
      () =>
        validerLivraison({
          livraisonId: livraison.id,
          etape,
          commentaire: commentaire.trim(),
          quantitesValidees:
            etape === "CT"
              ? Object.fromEntries(livraison.lignes.map((l) => [l.materiauId, lireQuantite(quantites[l.materiauId] ?? "") ?? 0]))
              : undefined,
        }),
      livraison.justificatif ? t("valideEnStock") : t("valideSansBl"),
    );
    setEnCours(false);
  }

  async function deposer() {
    const fichier = fichiers[0];
    if (!fichier) return;
    setEnCours(true);
    await ecrire(
      () => deposerJustificatif(livraison.id, fichier),
      livraison.workflowValide ? t("depotEnStock") : t("depotEnAttente"),
    );
    setEnCours(false);
  }

  const etatCT = livraison.validationCT ? "fait" : livraison.rejet && !livraison.validationCT ? "rejet" : etape === "CT" ? "attendu" : "avenir";
  const etatCP = livraison.validationCP ? "fait" : livraison.rejet && livraison.validationCT ? "rejet" : etape === "CP" ? "attendu" : "avenir";

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className={ENTETE_TIROIR}>
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg text-neutral-900">
            {livraison.reference}
            <Badge variante={TON_LIVRAISON[livraison.statut]}>{tc(`statutLivraison.${livraison.statut}`)}</Badge>
            <Badge variante={livraison.nature === "EQUIPEMENT" ? "secondaire" : "neutre"}>{tc(`nature.${livraison.nature}`)}</Badge>
          </SheetTitle>
          <SheetDescription>{t(`aide.${livraison.statut}`)}</SheetDescription>
        </SheetHeader>
        <div className={CORPS_TIROIR}>
          <dl className={FICHE}>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.commande")}</dt>
              <dd className={FICHE_VALEUR}>{livraison.bonCommandeReference}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.brv")}</dt>
              <dd className={FICHE_VALEUR}>{livraison.numeroBrv ?? t("brvAVenir")}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.chantier")}</dt>
              <dd className={FICHE_VALEUR}>{libelleProjet(livraison.projetId)}</dd>
            </div>
            <div>
              <dt className={FICHE_LIBELLE}>{t("colonnes.lot")}</dt>
              <dd className={FICHE_VALEUR}>{libelleLot(livraison.lotId)}</dd>
            </div>
          </dl>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("circuit")}</h3>
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                <Etape
                  libelle={t("etapes.magasinier")}
                  detail={t("parLe", { nom: livraison.magasinier.nom, date: formaterDateHeure(livraison.recueLe) })}
                  etat="fait"
                />
                <Etape
                  libelle={t("etapes.ct")}
                  detail={
                    livraison.validationCT
                      ? t("parLe", { nom: livraison.validationCT.par.nom, date: formaterDateHeure(livraison.validationCT.le) })
                      : t("enAttente")
                  }
                  etat={etatCT}
                />
                {livraison.nature === "EQUIPEMENT" && (
                  <Etape
                    libelle={t("etapes.cp")}
                    detail={
                      livraison.validationCP
                        ? t("parLe", { nom: livraison.validationCP.par.nom, date: formaterDateHeure(livraison.validationCP.le) })
                        : t("apresCt")
                    }
                    etat={etatCP}
                  />
                )}
                <Etape
                  libelle={t("etapes.brv")}
                  detail={livraison.numeroBrv ?? t("deuxConditions")}
                  etat={livraison.numeroBrv ? "fait" : livraison.rejet ? "rejet" : "avenir"}
                />
              </ol>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("conditionsTitre")}</h3>
              <Conditions livraison={livraison} />
            </div>
          </section>

          {livraison.rejet && (
            <section className="rounded-lg border border-erreur/30 bg-erreur-fond p-3 text-sm">
              <p className="m-0 font-medium text-erreur">
                {t("rejetePar", { nom: livraison.rejet.par.nom, date: formaterDateHeure(livraison.rejet.le), bon: livraison.rejet.bonRetour })}
              </p>
              <p className="m-0 mt-1 text-neutral-800">{livraison.rejet.motif}</p>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("lignes")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                    <th className="py-2 font-medium">{t("colonnes.article")}</th>
                    <th className="py-2 text-right font-medium">{t("attendu")}</th>
                    <th className="py-2 text-right font-medium">{t("recu")}</th>
                    <th className="py-2 text-right font-medium">{t("valide")}</th>
                  </tr>
                </thead>
                <tbody>
                  {livraison.lignes.map((ligne) => (
                    <tr key={ligne.materiauId} className="border-b border-neutral-100 align-top">
                      <td className="py-2">
                        <span className="block text-neutral-900">{libelleMateriau(ligne.materiauId)}</span>
                        {!ligne.conforme && (
                          <span className="mt-0.5 block text-xs text-erreur">{t("nonConforme", { motif: ligne.motif })}</span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums text-neutral-600">{formaterQuantite(ligne.quantiteAttendue)}</td>
                      <td className="py-2 text-right tabular-nums">{quantite(ligne.quantiteRecue, ligne.materiauId)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {peutValider && etape === "CT" ? (
                          <Input
                            value={quantites[ligne.materiauId] ?? ""}
                            onChange={(e) => setQuantites((q) => ({ ...q, [ligne.materiauId]: e.target.value }))}
                            inputMode="decimal"
                            aria-label={t("quantiteValidee", { article: libelleMateriau(ligne.materiauId) })}
                            className={cn(CHAMP, "ml-auto w-24 text-right tabular-nums")}
                            disabled={enCours}
                          />
                        ) : ligne.quantiteValidee === null ? (
                          <span className="text-neutral-400">{tc("absent")}</span>
                        ) : (
                          formaterQuantite(ligne.quantiteValidee)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {livraison.observation && <p className="m-0 text-sm text-neutral-700">{livraison.observation}</p>}
          </section>

          {livraison.photos.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("photos")}</h3>
              <div className="flex flex-wrap gap-2">
                {livraison.photos.map((photo, rang) =>
                  photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- aperçu local (data URL), hors de portée de next/image
                    <img key={rang} src={photo.url} alt={photo.nom} className="size-20 rounded-md border border-neutral-200 object-cover" />
                  ) : (
                    <span key={rang} className="flex size-20 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 p-1 text-center text-xs text-neutral-500">
                      {photo.nom}
                    </span>
                  ),
                )}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold text-neutral-900">{t("justificatifTitre")}</h3>
            {livraison.justificatif ? (
              <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-3 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  {livraison.justificatif.url ? (
                    <a href={livraison.justificatif.url} target="_blank" rel="noreferrer" download={livraison.justificatif.nom} className="font-medium text-primary-600 hover:underline">
                      {livraison.justificatif.nom}
                    </a>
                  ) : (
                    <span className="font-medium text-neutral-900">{livraison.justificatif.nom}</span>
                  )}
                  <span className="text-xs text-neutral-500">{formaterTailleFichier(livraison.justificatif.taille)}</span>
                </span>
                <span className="text-xs text-neutral-500">
                  {t("deposePar", { nom: livraison.justificatif.deposePar.nom, date: formaterDateHeure(livraison.justificatif.deposeLe) })}
                </span>
                <span className="text-xs text-neutral-500">{t("empreinte")}</span>
                <code className="block rounded bg-neutral-50 px-2 py-1 font-mono text-xs break-all text-neutral-800">
                  {livraison.justificatif.hash}
                </code>
              </div>
            ) : g.deposerJustificatif && !livraison.rejet ? (
              <div className="flex flex-col gap-2">
                <p className="m-0 text-xs text-neutral-500">{t("justificatifAide")}</p>
                <ZoneDepotFichiers
                  fichiers={fichiers}
                  onChange={setFichiers}
                  refuser={refusJustificatif}
                  consigne={t("consigneJustificatif")}
                  accept="image/*,application/pdf"
                  capture="environment"
                  disabled={enCours}
                />
                <Button type="button" variant="outline" onClick={() => void deposer()} disabled={enCours || fichiers.length === 0} className="self-start">
                  <Upload />
                  {t("deposerCourt")}
                </Button>
              </div>
            ) : (
              <p className="m-0 text-sm text-avertissement">{livraison.rejet ? t("sansObjet") : t("justificatifManquant")}</p>
            )}
          </section>

          {peutValider && (
            <section className="flex flex-col gap-2">
              <label htmlFor="commentaire-validation" className="text-sm font-medium text-neutral-900">
                {t("commentaire")}
              </label>
              <Textarea
                id="commentaire-validation"
                rows={2}
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                disabled={enCours}
              />
            </section>
          )}
        </div>

        <SheetFooter className={cn(PIED_TIROIR, "flex-wrap")}>
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("fermer")}
          </Button>
          {livraison.numeroBrv && (
            <Button type="button" variant="outline" onClick={pdf.imprimer} disabled={pdf.enCours}>
              <Printer />
              {t("imprimerBrv")}
            </Button>
          )}
          {peutValider && (
            <>
              <Button type="button" variant="destructive" onClick={() => setRejet(true)} disabled={enCours}>
                <X />
                {t("rejeter")}
              </Button>
              <Button type="button" onClick={() => void valider()} disabled={enCours || quantitesInvalides}>
                <Check />
                {etape === "CT" ? t("validerCT") : t("validerCP")}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
      {indicateur}
      {rejet && etape && (
        <ModaleMotif
          ouverte
          titre={t("rejetTitre", { reference: livraison.reference })}
          description={t("rejetDescription")}
          libelleAction={t("rejeter")}
          danger
          onFermer={() => setRejet(false)}
          onConfirmer={async (motif) =>
            (await ecrire(() => rejeterLivraison(livraison.id, etape, motif), t("rejetSucces", { reference: livraison.reference }))) !== null
          }
        />
      )}
    </Sheet>
  );
}

