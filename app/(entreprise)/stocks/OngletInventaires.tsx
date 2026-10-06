"use client";

import { ClipboardCheck, Eye, LoaderCircle, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge, Bouton, Modale } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BORD_DROIT_TABLEAU, FiltreTableau, RechercheTableau, TableauListe } from "@/components/ui/tableau-liste";
import {
  SEUIL_ECART_INVENTAIRE,
  dernierInventaire,
  ecartHorsSeuil,
  ecartLigne,
  filtrerInventaires,
  statutsPresents,
} from "@/features/stocks";
import type { SessionInventaire, StatutInventaire } from "@/features/stocks";
import { enregistrerComptage, ouvrirInventaire, validerInventaire } from "@/features/stocks/adaptateur";
import { lireQuantite } from "@/features/stocks/validations";
import { formaterDate, formaterDateHeure, formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CHAMP, CORPS_TIROIR, ENTETE_TIROIR, PIED_TIROIR, TON_INVENTAIRE } from "./classes";
import { useEcriture, useStock } from "./contexte";
import type { Intention } from "./contexte";

const STATUTS: readonly StatutInventaire[] = ["EN_COURS", "SOUMIS", "VALIDE"];
const colonne = aideColonnes<SessionInventaire>();

/**
 * L'inventaire physique (F9-6) : le magasinier ouvre une session sur un lot
 * et compte, article par article ; l'écart au stock théorique est calculé ;
 * au-delà de 5 %, CT et CP sont alertés. Le chef de projet valide : chaque
 * écart devient un mouvement INVENTAIRE — le seul qui corrige le stock sans
 * livraison ni consommation.
 */
export function OngletInventaires({ intention }: { intention: Intention | null }) {
  const t = useTranslations("stocks.inventaires");
  const tc = useTranslations("stocks");
  const { donnees, gestes, gestesDe, libelleLot, libelleProjet, libelleMateriau, projets } = useStock();
  const ecrire = useEcriture();
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState<StatutInventaire | "">("");
  const [lancement, setLancement] = useState<string | null>(intention?.type === "LANCER_INVENTAIRE" ? intention.cible : null);
  const [ouverte, setOuverte] = useState<string | null>(
    intention && intention.type !== "LANCER_INVENTAIRE" ? intention.cible : null,
  );

  const libelles = useMemo(
    () => ({ materiau: libelleMateriau, lot: libelleLot, projet: libelleProjet }),
    [libelleMateriau, libelleLot, libelleProjet],
  );
  const filtrees = useMemo(
    () => filtrerInventaires(donnees.inventaires, { recherche, statut }, libelles),
    [donnees.inventaires, recherche, statut, libelles],
  );
  const plusieurs = projets.length > 1;
  const session = ouverte ? donnees.inventaires.find((s) => s.id === ouverte) ?? null : null;

  const exporter = useMemo<ExportTableau<SessionInventaire>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.fichier"),
      colonnes: [
        { entete: t("colonnes.reference"), valeur: (s) => s.reference },
        { entete: t("colonnes.chantier"), valeur: (s) => libelleProjet(s.projetId) },
        { entete: t("colonnes.lot"), valeur: (s) => libelleLot(s.lotId) },
        { entete: t("colonnes.magasinier"), valeur: (s) => s.magasinier.nom },
        { entete: t("colonnes.ouverteLe"), valeur: (s) => s.ouverteLe.slice(0, 10) },
        { entete: t("colonnes.articles"), valeur: (s) => s.lignes.length },
        { entete: t("colonnes.ecarts"), valeur: (s) => s.lignes.filter(ecartHorsSeuil).length },
        { entete: t("colonnes.validePar"), valeur: (s) => s.validation?.par.nom },
        { entete: t("colonnes.statut"), valeur: (s) => tc(`statutInventaire.${s.statut}`) },
      ],
    }),
    [t, tc, libelleLot, libelleProjet],
  );

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.accessor("reference", {
          header: t("colonnes.reference"),
          cell: ({ row }) => (
            <button
              type="button"
              onClick={() => setOuverte(row.original.id)}
              className="cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-neutral-900 hover:text-primary-600 hover:underline"
            >
              {row.original.reference}
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
          id: "magasinier",
          header: t("colonnes.magasinier"),
          meta: { classe: "text-neutral-700" },
          cell: ({ row }) => row.original.magasinier.nom,
        }),
        colonne.accessor("ouverteLe", {
          header: t("colonnes.ouverteLe"),
          meta: { classe: "tabular-nums text-neutral-600" },
          cell: ({ getValue }) => formaterDate(getValue()),
        }),
        colonne.display({
          id: "ecarts",
          header: t("colonnes.ecarts"),
          cell: ({ row }) => {
            const horsSeuil = row.original.lignes.filter(ecartHorsSeuil).length;
            return horsSeuil > 0 ? (
              <Badge variante="erreur">{t("ecartsHorsSeuil", { n: horsSeuil })}</Badge>
            ) : (
              <span className="text-sm text-neutral-500">{t("articlesComptes", { n: row.original.lignes.length })}</span>
            );
          },
        }),
        colonne.accessor("statut", {
          header: t("colonnes.statut"),
          cell: ({ getValue }) => <Badge variante={TON_INVENTAIRE[getValue()]}>{tc(`statutInventaire.${getValue()}`)}</Badge>,
        }),
        colonne.display({
          id: "actions",
          header: t("colonnes.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => {
            const s = row.original;
            const g = gestesDe(s.projetId);
            const aFaire = (s.statut === "EN_COURS" && g.realiserInventaire) || (s.statut === "SOUMIS" && g.validerInventaire);
            return (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOuverte(s.id)}
                aria-label={t("ouvrir", { reference: s.reference })}
                title={t("ouvrir", { reference: s.reference })}
                className={cn(aFaire && "text-primary-600")}
              >
                {aFaire ? <ClipboardCheck /> : <Eye />}
              </Button>
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
        cleLigne={(s) => s.id}
        messageVide={donnees.inventaires.length === 0 ? t("vide") : t("aucunResultat")}
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
              options={statutsPresents(STATUTS, donnees.inventaires).map((s) => ({ valeur: s, libelle: tc(`statutInventaire.${s}`) }))}
            />
          </>
        }
        exporter={exporter}
        actions={
          gestes.realiserInventaire && (
            <Bouton
              variante="primaire"
              taille="sm"
              aria-label={t("lancer")}
              iconeGauche={<Play size={16} aria-hidden="true" />}
              onClick={() => setLancement("")}
              className="max-sm:gap-0 max-sm:px-3"
            >
              <span className="max-sm:hidden">{t("lancer")}</span>
            </Bouton>
          )
        }
      />

      {lancement !== null && (
        <ModaleLancement
          lotInitial={lancement}
          onFermer={() => setLancement(null)}
          onLancee={(id) => {
            setLancement(null);
            setOuverte(id);
          }}
        />
      )}
      {session && <TiroirInventaire key={`${session.id}-${session.statut}`} session={session} onFermer={() => setOuverte(null)} ecrire={ecrire} />}
    </>
  );
}

/** Le choix du lot à inventorier — ceux où le compte réalise les inventaires. */
function ModaleLancement({
  lotInitial,
  onFermer,
  onLancee,
}: {
  lotInitial: string;
  onFermer: () => void;
  onLancee: (sessionId: string) => void;
}) {
  const t = useTranslations("stocks.inventaires");
  const { donnees, gestesDe, libelleProjet } = useStock();
  const ecrire = useEcriture();
  const [lotId, setLotId] = useState(lotInitial);
  const [enCours, setEnCours] = useState(false);
  const lots = donnees.lots.filter((l) => gestesDe(l.projetId).realiserInventaire);
  const lot = lots.find((l) => l.id === lotId);
  const dernier = lot ? dernierInventaire(donnees.inventaires, lot.id) : null;

  async function lancer() {
    if (!lot) return;
    setEnCours(true);
    const session = await ecrire(() => ouvrirInventaire(lot.projetId, lot.id), t("lancee"));
    setEnCours(false);
    if (session) onLancee(session.id);
  }

  return (
    <Modale
      ouverte
      titre={t("lancerTitre")}
      onFermer={enCours ? undefined : onFermer}
      actions={
        <>
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button type="button" onClick={() => void lancer()} disabled={enCours || !lot} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {t("lancer")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p className="m-0 text-neutral-600">{t("lancerDescription")}</p>
        <label htmlFor="lot-inventaire" className="font-medium text-neutral-900">
          {t("lot")}
        </label>
        <Select value={lotId} onValueChange={setLotId}>
          <SelectTrigger id="lot-inventaire" className={cn(CHAMP, "w-full bg-card")}>
            <SelectValue placeholder={t("choisirLot")} />
          </SelectTrigger>
          <SelectContent>
            {lots.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {t("lotDe", { lot: `${l.code} — ${l.nom}`, projet: libelleProjet(l.projetId) })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {lot && (
          <p className="m-0 text-xs text-neutral-500">
            {dernier?.validation ? t("dernier", { date: formaterDate(dernier.validation.le) }) : t("jamais")}
          </p>
        )}
      </div>
    </Modale>
  );
}

/**
 * La session d'inventaire : saisie du compté par le magasinier (enregistrer,
 * puis soumettre), écarts calculés à la volée, validation par le chef de projet.
 */
function TiroirInventaire({
  session,
  onFermer,
  ecrire,
}: {
  session: SessionInventaire;
  onFermer: () => void;
  ecrire: ReturnType<typeof useEcriture>;
}) {
  const t = useTranslations("stocks.inventaires");
  const tc = useTranslations("stocks");
  const { gestesDe, libelleLot, libelleProjet, libelleMateriau, materiau } = useStock();
  const g = gestesDe(session.projetId);
  const saisissable = session.statut === "EN_COURS" && g.realiserInventaire;
  const validable = session.statut === "SOUMIS" && g.validerInventaire;
  const [comptes, setComptes] = useState<Record<string, string>>(() =>
    Object.fromEntries(session.lignes.map((l) => [l.materiauId, l.stockCompte === null ? "" : String(l.stockCompte)])),
  );
  const [enCours, setEnCours] = useState(false);

  // Les lignes telles qu'elles seraient avec la saisie en cours : l'écart se lit en comptant.
  const lignes = session.lignes.map((l) =>
    saisissable ? { ...l, stockCompte: comptes[l.materiauId] === "" ? null : lireQuantite(comptes[l.materiauId] ?? "") } : l,
  );
  const invalide = saisissable && Object.values(comptes).some((v) => v !== "" && lireQuantite(v) === null);
  const complet = lignes.every((l) => l.stockCompte !== null);

  async function enregistrer(soumettre: boolean) {
    setEnCours(true);
    const valeurs = Object.fromEntries(
      session.lignes.map((l) => [l.materiauId, comptes[l.materiauId] === "" ? null : lireQuantite(comptes[l.materiauId] ?? "")]),
    );
    const fait = await ecrire(
      () => enregistrerComptage(session.id, valeurs, soumettre),
      soumettre ? t("soumise", { reference: session.reference }) : t("enregistree"),
    );
    setEnCours(false);
    if (fait && soumettre) onFermer();
  }

  async function valider() {
    setEnCours(true);
    const fait = await ecrire(() => validerInventaire(session.id), t("validee", { reference: session.reference }));
    setEnCours(false);
    if (fait) onFermer();
  }

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className={ENTETE_TIROIR}>
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg text-neutral-900">
            {session.reference}
            <Badge variante={TON_INVENTAIRE[session.statut]}>{tc(`statutInventaire.${session.statut}`)}</Badge>
          </SheetTitle>
          <SheetDescription>
            {tc("projetEtLot", { projet: libelleProjet(session.projetId), lot: libelleLot(session.lotId) })}
          </SheetDescription>
        </SheetHeader>
        <div className={CORPS_TIROIR}>
          <p className="m-0 text-xs text-neutral-500">
            {t("ouvertePar", { nom: session.magasinier.nom, date: formaterDateHeure(session.ouverteLe) })}
            {session.validation && ` ${t("valideePar", { nom: session.validation.par.nom, date: formaterDateHeure(session.validation.le) })}`}
          </p>
          {saisissable && <p className="m-0 rounded-md bg-information-fond px-3 py-2 text-xs text-neutral-700">{t("consigneComptage")}</p>}
          {validable && (
            <p className="m-0 rounded-md bg-avertissement-fond px-3 py-2 text-xs text-neutral-800">
              {t("consigneValidation", { seuil: SEUIL_ECART_INVENTAIRE })}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-2 font-medium">{t("article")}</th>
                  <th className="py-2 text-right font-medium">{t("theorique")}</th>
                  <th className="py-2 text-right font-medium">{t("compte")}</th>
                  <th className="py-2 text-right font-medium">{t("ecart")}</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => {
                  const ecart = ecartLigne(ligne);
                  const hors = ecartHorsSeuil(ligne);
                  const unite = materiau(ligne.materiauId)?.unite ?? "";
                  return (
                    <tr key={ligne.materiauId} className={cn("border-b border-neutral-100", hors && "bg-erreur-fond")}>
                      <td className="py-2 pr-2 text-neutral-900">{libelleMateriau(ligne.materiauId)}</td>
                      <td className="py-2 text-right tabular-nums text-neutral-600">
                        {tc("quantiteUnite", { quantite: formaterQuantite(ligne.stockTheorique), unite })}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {saisissable ? (
                          <Input
                            value={comptes[ligne.materiauId] ?? ""}
                            onChange={(e) => setComptes((c) => ({ ...c, [ligne.materiauId]: e.target.value }))}
                            inputMode="decimal"
                            aria-label={t("compteDe", { article: libelleMateriau(ligne.materiauId) })}
                            className={cn(CHAMP, "ml-auto w-24 text-right tabular-nums")}
                            disabled={enCours}
                          />
                        ) : ligne.stockCompte === null ? (
                          <span className="text-neutral-400">{tc("absent")}</span>
                        ) : (
                          formaterQuantite(ligne.stockCompte)
                        )}
                      </td>
                      <td className={cn("py-2 text-right tabular-nums", hors ? "font-semibold text-erreur" : "text-neutral-700")}>
                        {ecart === null
                          ? tc("absent")
                          : t("ecartValeur", {
                              signe: ecart.ecart > 0 ? "+" : "",
                              ecart: formaterQuantite(ecart.ecart),
                              pourcent: formaterQuantite(ecart.pourcent),
                            })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <SheetFooter className={cn(PIED_TIROIR, "flex-wrap")}>
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("fermer")}
          </Button>
          {saisissable && (
            <>
              <Button type="button" variant="outline" onClick={() => void enregistrer(false)} disabled={enCours || invalide}>
                {t("enregistrer")}
              </Button>
              <Button type="button" onClick={() => void enregistrer(true)} disabled={enCours || invalide || !complet}>
                {enCours && <LoaderCircle className="animate-spin" />}
                {t("soumettre")}
              </Button>
            </>
          )}
          {validable && (
            <Button type="button" onClick={() => void valider()} disabled={enCours}>
              {enCours && <LoaderCircle className="animate-spin" />}
              {t("valider")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
