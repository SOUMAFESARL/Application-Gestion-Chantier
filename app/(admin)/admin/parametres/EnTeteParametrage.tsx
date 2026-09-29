"use client";

import { useTranslations } from "next-intl";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Alerte } from "@/components/ui";
import { peutParametrerPlateforme } from "@/features/administration";

import { useAdministrateur } from "../ContexteAdministrateur";

export type SectionParametrage = "comptes" | "tarifs" | "identite";

/**
 * L'en-tête d'une page du paramétrage : son titre, et l'avis de lecture seule.
 *
 * Posé par la page elle-même, hors de l'écran, pour rester visible pendant le
 * chargement comme en cas d'erreur. L'avis est le même sur les trois pages : un
 * agent de support voit le paramétrage mais ne le modifie pas, et il doit le
 * lire avant de chercher pourquoi les boutons sont grisés.
 */
export function EnTeteParametrage({ section }: { section: SectionParametrage }) {
  const t = useTranslations("administration.parametres");
  const profil = useAdministrateur();

  return (
    <>
      <EnTetePage
        titre={t(`${section}.titre`)}
        description={
          t.has(`${section}.description`) ? t(`${section}.description`) : undefined
        }
      />
      {profil && !peutParametrerPlateforme(profil) && (
        <Alerte type="information">{t("lectureSeule")}</Alerte>
      )}
    </>
  );
}
