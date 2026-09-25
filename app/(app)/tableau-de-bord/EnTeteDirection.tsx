"use client";

import { ChevronDown, Download, FileSpreadsheet, Plus, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Bouton } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { lireProfilLocal } from "@/features/auth/api";
import {
  chantiersSuivis,
  syntheseDirection,
  trierParCriticite,
  valeursExportPortefeuille,
} from "@/features/tableauDeBord";
import type { TableauDeBord } from "@/features/tableauDeBord";
import { telechargerCsv, versCsv } from "@/lib/export/csv";

/** L'ordre des colonnes exportées — celui de `valeursExportPortefeuille`. */
const COLONNES_EXPORT = [
  "reference",
  "nom",
  "client",
  "ville",
  "chefProjet",
  "statut",
  "avancementReel",
  "avancementTheorique",
  "budgetInitial",
  "budgetConsomme",
  "montantMarche",
  "marge",
  "dateFin",
  "indiceSante",
] as const;

/** Le profil local ne change pas pendant que l'écran est ouvert. */
const sansAbonnement = () => () => {};
const lirePrenom = () => lireProfilLocal()?.prenom?.trim() || null;

interface Props {
  donnees: TableauDeBord;
  onNouveauProjet: () => void;
}

/**
 * L'en-tête du DG : qui il est, et l'état de l'entreprise en une phrase.
 *
 * C'est la promesse du CDC (§1.3) — savoir en trente secondes où en sont
 * tous les chantiers. La phrase dit les trois nombres qui décident de la
 * matinée : combien tournent, combien brûlent, combien attendent une
 * signature.
 *
 * **Le prénom vient du profil déjà obtenu du serveur**, jamais d'un repli
 * inventé : sans profil, la salutation reste anonyme.
 */
export function EnTeteDirection({ donnees, onNouveauProjet }: Props) {
  const t = useTranslations("tableauDeBord");
  // Le stockage local n'existe pas au rendu serveur : `null` côté serveur,
  // le prénom une fois hydraté, sans divergence d'hydratation.
  const prenom = useSyncExternalStore(sansAbonnement, lirePrenom, () => null);

  const synthese = syntheseDirection(donnees);

  function exporterPortefeuille() {
    const lignes = trierParCriticite(chantiersSuivis(donnees.chantiers));
    const contenu = versCsv([
      COLONNES_EXPORT.map((colonne) => t(`export.${colonne}`)),
      ...lignes.map(valeursExportPortefeuille),
    ]);
    telechargerCsv(
      contenu,
      t("actions.nomFichier", { date: new Date().toISOString().slice(0, 10) }),
    );
  }

  return (
    <EnTetePage
      // La phrase de synthèse est longue : sur téléphone, les actions passent
      // dessous plutôt que de la réduire à une colonne de trois mots.
      className="max-md:flex-col max-md:[&>div:last-child]:justify-start"
      titre={prenom ? t("salutation", { prenom }) : t("salutationAnonyme")}
      description={t("synthese", {
        actifs: synthese.actifs,
        critiques: synthese.critiques,
        aValider: synthese.aValider,
      })}
      actions={
        <>
          <Bouton
            variante="secondaire"
            iconeGauche={<Plus className="size-4" aria-hidden="true" />}
            onClick={onNouveauProjet}
          >
            {t("actions.nouveauProjet")}
          </Bouton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Bouton
                variante="primaire"
                iconeGauche={<Download className="size-4" aria-hidden="true" />}
                iconeDroite={<ChevronDown className="size-4" aria-hidden="true" />}
              >
                {t("actions.exporter")}
              </Bouton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={exporterPortefeuille}>
                <FileSpreadsheet className="size-4" aria-hidden="true" />
                {t("actions.exporterExcel")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.print()}>
                <Printer className="size-4" aria-hidden="true" />
                {t("actions.imprimer")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
  );
}
