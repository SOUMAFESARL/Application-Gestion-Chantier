"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Boxes, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui";
import { useDroits, useProjetsVisibles } from "@/features/habilitations";
import {
  chiffresStock,
  demandeACommander,
  filtrerParProjet,
  indexer,
  restreindreStock,
} from "@/features/stocks";
import { lireStock } from "@/features/stocks/adaptateur";
import { CLE_STOCK } from "@/features/stocks/cles";
import { formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BLOC, BLOC_CORPS, BLOC_ENTETE, BLOC_SOUS_TITRE, BLOC_TITRE, BLOC_VIDE, LIGNE_LISTE } from "./classes";

/** Cinq DA suffisent au tableau de bord : la file entière est dans « Stock ». */
const DEMANDES_AFFICHEES = 5;

/**
 * Ce que le stock (F9 → F4, §7) met sur le tableau de bord :
 *
 * - **la file des DA en attente** pour qui émet les BC — la direction (DO, DG) ;
 * - **l'état du stock de ses chantiers** pour l'encadrement : articles en
 *   alerte, livraisons attendues, BRV en attente de validation.
 *
 * Rien pour qui n'a ni l'un ni l'autre : le bloc ne se lit même pas.
 */
export function BlocsStock() {
  const { estDirection, peut } = useDroits();
  const commande = peut("achats", "validation");
  const encadrement = !estDirection && peut("stocks");
  if (!commande && !encadrement) return null;
  return <Contenu commande={commande} encadrement={encadrement} />;
}

function Contenu({ commande, encadrement }: { commande: boolean; encadrement: boolean }) {
  const t = useTranslations("stocks.tableauDeBord");
  const projets = useProjetsVisibles();
  const requete = useQuery({ queryKey: CLE_STOCK, queryFn: ({ signal }) => lireStock(signal) });

  const donnees = useMemo(
    () => (requete.data && projets.data ? restreindreStock(requete.data, new Set(projets.data.map((p) => p.id))) : null),
    [requete.data, projets.data],
  );
  if (!donnees || !projets.data) return null;
  const lots = indexer(donnees.lots);
  const materiaux = indexer(donnees.materiaux);
  const file = donnees.demandes
    .filter(demandeACommander)
    .sort((a, b) => a.dateSouhaitee.localeCompare(b.dateSouhaitee));
  const aujourdhui = donnees.luLe.slice(0, 10);

  return (
    <div className={cn("grid items-start gap-6", commande && encadrement && "lg:grid-cols-2")}>
      {commande && (
        <section className={BLOC} aria-labelledby="titre-file-da">
          <div className={BLOC_ENTETE}>
            <div>
              <h2 id="titre-file-da" className={BLOC_TITRE}>
                {t("fileTitre")}
              </h2>
              <p className={BLOC_SOUS_TITRE}>{t("fileSousTitre", { n: file.length })}</p>
            </div>
            <ShoppingCart className="size-5 text-primary-500" aria-hidden="true" />
          </div>
          <div className={BLOC_CORPS}>
            {file.length === 0 ? (
              <p className={BLOC_VIDE}>{t("fileVide")}</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {file.slice(0, DEMANDES_AFFICHEES).map((demande) => {
                  const lot = lots.get(demande.lotId);
                  const urgente = demande.dateSouhaitee <= aujourdhui;
                  return (
                    <li key={demande.id} className={LIGNE_LISTE}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium text-neutral-900">
                          {t("demande", {
                            reference: demande.reference,
                            article: materiaux.get(demande.lignes[0]?.materiauId ?? "")?.designation ?? "",
                            autres: demande.lignes.length - 1,
                          })}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {t("demandeDetail", {
                            projet: lot?.projetNom ?? "",
                            lot: lot?.nom ?? "",
                            emetteur: demande.emetteur.nom,
                          })}
                        </span>
                      </span>
                      <Badge variante={urgente ? "erreur" : "information"}>
                        {t("pour", { date: formaterDate(demande.dateSouhaitee) })}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href="/stocks?onglet=demandes"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600 no-underline hover:underline"
            >
              {t("voirFile")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {encadrement && (
        <section className={BLOC} aria-labelledby="titre-etat-stock">
          <div className={BLOC_ENTETE}>
            <div>
              <h2 id="titre-etat-stock" className={BLOC_TITRE}>
                {t("etatTitre")}
              </h2>
              <p className={BLOC_SOUS_TITRE}>{t("etatSousTitre")}</p>
            </div>
            <Boxes className="size-5 text-primary-500" aria-hidden="true" />
          </div>
          <div className={BLOC_CORPS}>
            {projets.data.length === 0 ? (
              <p className={BLOC_VIDE}>{t("etatVide")}</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {projets.data.map((projet) => {
                  const c = chiffresStock(filtrerParProjet(donnees, projet.id));
                  const alerte = c.enAlerte + c.enRupture;
                  return (
                    <li key={projet.id} className={LIGNE_LISTE}>
                      <Link href={`/stocks?projet=${projet.id}`} className="group flex w-full flex-col gap-1 no-underline">
                        <span className="text-sm font-medium text-neutral-900 group-hover:text-primary-600">{projet.nom}</span>
                        <span className="flex flex-wrap gap-1.5">
                          <Badge variante={c.enRupture > 0 ? "erreur" : alerte > 0 ? "avertissement" : "succes"}>
                            {t("enAlerte", { n: alerte })}
                          </Badge>
                          <Badge variante="information">{t("attendues", { n: c.livraisonsAttendues })}</Badge>
                          <Badge variante={c.enValidation > 0 ? "primaire" : "neutre"}>{t("aValider", { n: c.enValidation })}</Badge>
                          {c.sansJustificatif > 0 && <Badge variante="avertissement">{t("sansBl", { n: c.sansJustificatif })}</Badge>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
