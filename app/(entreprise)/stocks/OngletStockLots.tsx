"use client";

import { ArrowLeftRight, ClipboardPlus, Gauge, MinusCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge, Bouton } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { BORD_DROIT_TABLEAU, FiltreTableau, RechercheTableau, TableauListe } from "@/components/ui/tableau-liste";
import {
  filtrerLignesStock,
  lignesStock,
  valeursOuvertes,
  valeursPresentes,
} from "@/features/stocks";
import type { EtatStock, LigneStock } from "@/features/stocks";
import { reglerSeuil } from "@/features/stocks/adaptateur";
import { CATEGORIES_ARTICLE } from "@/features/stocks/validations";
import { formaterDate, formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { TON_ETAT_STOCK } from "./classes";
import { ModaleSeuil, useLibellesArticle } from "./composants";
import { useEcriture, useStock } from "./contexte";
import type { Intention } from "./contexte";
import { TiroirDemande } from "./TiroirDemande";
import { TiroirMouvement, TiroirTransfert } from "./TiroirMouvement";

const ETATS: readonly EtatStock[] = ["RUPTURE", "ALERTE", "OK"];
const colonne = aideColonnes<LigneStock>();

/**
 * Le stock, lot par lot — le cumul des mouvements, jamais une saisie (F9-5).
 * Le seuil est celui du lot, ou celui du référentiel **proposé** tant que
 * personne ne l'a accepté (RG-STK-09).
 */
export function OngletStockLots({ intention }: { intention: Intention | null }) {
  const t = useTranslations("stocks.stock");
  const tc = useTranslations("stocks");
  const libellesArticle = useLibellesArticle();
  const { donnees, gestes, gestesDe, libelleLot, libelleProjet, libelleMateriau, projets } = useStock();
  const ecrire = useEcriture();
  const [recherche, setRecherche] = useState("");
  const [etat, setEtat] = useState<EtatStock | "">("");
  const [categorie, setCategorie] = useState("");

  const lignes = useMemo(() => lignesStock(donnees), [donnees]);
  const cibleInitiale = intention?.cible ? lignes.find((l) => `${l.lotId}|${l.materiau.id}` === intention.cible) : undefined;
  const [seuilOuvert, setSeuilOuvert] = useState<LigneStock | null>(
    intention?.type === "REGLER_SEUIL" ? (cibleInitiale ?? null) : null,
  );
  const [demande, setDemande] = useState<LigneStock | null>(
    intention?.type === "REAPPROVISIONNER" ? (cibleInitiale ?? null) : null,
  );
  const [mouvement, setMouvement] = useState<LigneStock | "nouveau" | null>(null);
  const [transfert, setTransfert] = useState(false);

  const libelles = useMemo(
    () => ({ materiau: libelleMateriau, lot: libelleLot, projet: libelleProjet }),
    [libelleMateriau, libelleLot, libelleProjet],
  );
  const filtrees = useMemo(
    () => filtrerLignesStock(lignes, { recherche, statut: etat, categorie }, libelles),
    [lignes, recherche, etat, categorie, libelles],
  );
  const plusieurs = projets.length > 1;

  const exporter = useMemo<ExportTableau<LigneStock>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.fichier"),
      colonnes: [
        { entete: t("colonnes.chantier"), valeur: (l) => libelleProjet(l.projetId) },
        { entete: t("colonnes.lot"), valeur: (l) => libelleLot(l.lotId) },
        { entete: t("colonnes.code"), valeur: (l) => l.materiau.code },
        { entete: t("colonnes.article"), valeur: (l) => l.materiau.designation },
        { entete: t("colonnes.categorie"), valeur: (l) => libellesArticle.categorie(l.materiau.categorie) },
        { entete: t("colonnes.unite"), valeur: (l) => l.materiau.unite },
        { entete: t("colonnes.stock"), valeur: (l) => l.stock },
        { entete: t("colonnes.seuil"), valeur: (l) => l.seuil },
        { entete: t("colonnes.seuilPropose"), valeur: (l) => (l.seuilPropose ? tc("oui") : tc("non")) },
        { entete: t("colonnes.etat"), valeur: (l) => tc(`etatStock.${l.etat}`) },
        { entete: t("colonnes.dernierMouvement"), valeur: (l) => l.dernierMouvement?.slice(0, 10) },
      ],
    }),
    [t, tc, libelleLot, libelleProjet, libellesArticle],
  );

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.display({
          id: "article",
          header: t("colonnes.article"),
          cell: ({ row }) => (
            <span className="flex flex-col">
              <span className="font-semibold text-neutral-900">{row.original.materiau.designation}</span>
              <span className="text-xs text-neutral-500">
                {tc("codeEtCategorie", {
                  code: row.original.materiau.code,
                  categorie: libellesArticle.categorie(row.original.materiau.categorie),
                })}
              </span>
            </span>
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
        colonne.accessor("stock", {
          header: t("colonnes.stock"),
          cell: ({ row }) => (
            <span
              className={cn(
                "font-semibold tabular-nums",
                row.original.etat === "RUPTURE"
                  ? "text-erreur"
                  : row.original.etat === "ALERTE"
                    ? "text-avertissement"
                    : "text-neutral-900",
              )}
            >
              {tc("quantiteUnite", { quantite: formaterQuantite(row.original.stock), unite: row.original.materiau.unite })}
            </span>
          ),
        }),
        colonne.accessor("seuil", {
          header: t("colonnes.seuil"),
          cell: ({ row }) => (
            <span className="flex items-center gap-2 tabular-nums">
              {formaterQuantite(row.original.seuil)}
              {row.original.seuilPropose && <Badge variante="neutre">{t("propose")}</Badge>}
            </span>
          ),
        }),
        colonne.accessor("etat", {
          header: t("colonnes.etat"),
          cell: ({ getValue }) => <Badge variante={TON_ETAT_STOCK[getValue()]}>{tc(`etatStock.${getValue()}`)}</Badge>,
        }),
        colonne.accessor("dernierMouvement", {
          header: t("colonnes.dernierMouvement"),
          meta: { classe: "text-neutral-600 tabular-nums" },
          cell: ({ getValue }) => formaterDate(getValue()),
        }),
        colonne.display({
          id: "actions",
          header: t("colonnes.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => {
            const g = gestesDe(row.original.projetId);
            const nom = row.original.materiau.designation;
            return (
              <span className="flex items-center justify-end gap-1">
                {g.reglerSeuil && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSeuilOuvert(row.original)}
                    aria-label={t("actionSeuil", { nom })}
                    title={t("actionSeuil", { nom })}
                  >
                    <Gauge />
                  </Button>
                )}
                {g.emettreDemande && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDemande(row.original)}
                    aria-label={t("actionDemander", { nom })}
                    title={t("actionDemander", { nom })}
                  >
                    <ClipboardPlus />
                  </Button>
                )}
                {g.mouvementManuel && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setMouvement(row.original)}
                    aria-label={t("actionMouvement", { nom })}
                    title={t("actionMouvement", { nom })}
                  >
                    <MinusCircle />
                  </Button>
                )}
              </span>
            );
          },
        }),
      ]),
    [t, tc, libelleLot, libelleProjet, plusieurs, gestesDe, libellesArticle],
  );

  const peutTransferer = gestes.transfertInterLots || gestes.transfertInterChantiers;

  return (
    <>
      <TableauListe
        colonnes={colonnes}
        donnees={filtrees}
        cleLigne={(l) => `${l.lotId}|${l.materiau.id}`}
        messageVide={lignes.length === 0 ? t("vide") : t("aucunResultat")}
        cleCriteres={`${recherche}|${etat}|${categorie}`}
        filtresActifs={Boolean(recherche || etat || categorie)}
        onReinitialiser={() => {
          setRecherche("");
          setEtat("");
          setCategorie("");
        }}
        outils={
          <>
            <RechercheTableau
              valeur={recherche}
              onChangement={setRecherche}
              libelle={t("recherche")}
              placeholder={t("recherchePlaceholder")}
            />
            <FiltreTableau
              valeur={etat}
              onChangement={setEtat}
              libelle={t("filtreEtat")}
              libelleTous={t("tousEtats")}
              options={valeursPresentes(ETATS, lignes.map((l) => l.etat)).map((e) => ({ valeur: e, libelle: tc(`etatStock.${e}`) }))}
            />
            <FiltreTableau
              valeur={categorie}
              onChangement={setCategorie}
              libelle={t("filtreCategorie")}
              libelleTous={t("toutesCategories")}
              options={valeursOuvertes(CATEGORIES_ARTICLE, lignes.map((l) => l.materiau.categorie), true).map((c) => ({
                valeur: c,
                libelle: libellesArticle.categorie(c),
              }))}
            />
          </>
        }
        exporter={exporter}
        actions={
          <>
            {peutTransferer && (
              <Bouton
                variante="secondaire"
                taille="sm"
                aria-label={t("transfert")}
                iconeGauche={<ArrowLeftRight size={16} aria-hidden="true" />}
                onClick={() => setTransfert(true)}
                className="max-sm:gap-0 max-sm:px-3"
              >
                <span className="max-sm:hidden">{t("transfert")}</span>
              </Bouton>
            )}
            {gestes.mouvementManuel && (
              <Bouton
                variante="primaire"
                taille="sm"
                aria-label={t("mouvementManuel")}
                iconeGauche={<MinusCircle size={16} aria-hidden="true" />}
                onClick={() => setMouvement("nouveau")}
                className="max-sm:gap-0 max-sm:px-3"
              >
                <span className="max-sm:hidden">{t("mouvementManuel")}</span>
              </Bouton>
            )}
          </>
        }
      />

      {seuilOuvert && (
        <ModaleSeuil
          ouverte
          titre={t("titreSeuil", { nom: seuilOuvert.materiau.designation, lot: libelleLot(seuilOuvert.lotId) })}
          seuilPropose={seuilOuvert.seuil}
          unite={seuilOuvert.materiau.unite}
          onFermer={() => setSeuilOuvert(null)}
          onEnregistrer={async (seuil) =>
            (await ecrire(
              () => reglerSeuil(seuilOuvert.projetId, seuilOuvert.lotId, seuilOuvert.materiau.id, seuil),
              t("succesSeuil", { nom: seuilOuvert.materiau.designation }),
            )) !== null
          }
        />
      )}
      {demande && (
        <TiroirDemande
          ouverte
          onFermer={() => setDemande(null)}
          prerempli={{ projetId: demande.projetId, lotId: demande.lotId, materiauId: demande.materiau.id }}
        />
      )}
      {mouvement && (
        <TiroirMouvement
          ouverte
          onFermer={() => setMouvement(null)}
          ligne={mouvement === "nouveau" ? null : mouvement}
        />
      )}
      {transfert && <TiroirTransfert ouverte onFermer={() => setTransfert(false)} />}
    </>
  );
}
