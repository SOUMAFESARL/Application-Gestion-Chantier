"use client";

import { Construction } from "lucide-react";
import { useTranslations } from "next-intl";

import { EtatVide } from "@/components/ui";

/**
 * Un onglet de la fiche projet dont l'écran n'est pas encore livré (plan du découpage, lots 8,
 * 9 et 12). Il le dit, au lieu d'afficher un contenu vide qui se lirait comme « rien à voir ».
 */
export function OngletAVenir({ onglet }: { onglet: "avancement" }) {
  const t = useTranslations("ficheProjet.onglets");
  return (
    <EtatVide
      icone={<Construction size={40} strokeWidth={1.5} />}
      titre={t("aVenirTitre", { onglet: t(onglet) })}
      description={t("aVenirDescription")}
    />
  );
}
