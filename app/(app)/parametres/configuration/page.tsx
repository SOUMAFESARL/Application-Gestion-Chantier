import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Wizard } from "./Wizard";

/**
 * Écran « Configuration initiale » — maquette M9.
 *
 * Motif d'interface : assistant en trois étapes.
 *
 * Parcours : `parcours_wizard_onboarding_CCD_Digital.md` (T-022).
 * Persistance : `contrat_wizard_CCD_Digital.md` (T-024).
 *
 * **La configuration appartient à l'entreprise, pas à la personne** : un
 * second administrateur qui se connecte après le premier ne la recommence
 * pas, il la reprend là où elle en est. C'est un état unique par schéma.
 *
 * Réservé à `AD`. La garde de route reste un **confort** : le serveur vérifie
 * les droits à chaque requête, et une route cachée n'est pas une route
 * protégée.
 *
 * **Déplacé sous `/parametres/configuration`** (plan de refonte) : l'écran
 * vit désormais dans la coquille applicative, sidebar comprise, au lieu
 * d'un mode plein écran séparé — `FormulaireConnexion` n'y redirige plus
 * que lorsque la configuration n'est pas terminée (`lireProgression().terminee_le`).
 *
 * **`BandeauSimulation` retiré à la demande du propriétaire du produit.** Le
 * guide frontend §8 impose ce bandeau sur tout écran non branché sur de vraies
 * données, et c'était le dernier écran à le porter : le composant n'a donc plus
 * d'appelant, mais il reste en place — le §8 exige le mécanisme, pas la
 * présence du bandeau sur cet écran-ci. À remettre si l'assistant est montré à
 * un prospect avant que ses endpoints de saisie n'existent.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("configuration");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  return (
    // `max-w-3xl` et non `5xl` : sans le rail latéral d'étapes, une colonne
    // unique de 1024 px étirerait les champs sur toute la largeur de l'écran
    // au lieu de les centrer.
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Wizard />
    </div>
  );
}
