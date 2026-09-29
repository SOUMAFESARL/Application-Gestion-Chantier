import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConfigurationEntreprise } from "./ConfigurationEntreprise";

/**
 * Écran « Configuration de l'entreprise ».
 *
 * **Le wizard en trois étapes a été retiré.** Il enchaînait l'entreprise, un
 * premier projet et une invitation d'équipe, forcé à la première connexion.
 * Ce n'est plus le produit : cet écran ne porte plus que l'entreprise, et se
 * consulte à tout moment depuis Paramètres — pas seulement au premier
 * lancement. Le premier projet se crée depuis Projets, l'équipe s'invite
 * depuis Paramètres → Collaborateurs.
 *
 * **La configuration appartient à l'entreprise, pas à la personne** : elle
 * est relue depuis le serveur à chaque visite, pas depuis un brouillon local
 * — un second administrateur qui l'ouvre voit ce qui a été enregistré, pas
 * une saisie oubliée par le premier.
 *
 * Réservé à `AD`. La garde de route reste un **confort** : le serveur vérifie
 * les droits à chaque requête, et une route cachée n'est pas une route
 * protégée.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("configuration");
  return { title: t("titre"), description: t("metaDescription") };
}

export default function Page() {
  // Centré, contrairement aux écrans de liste : c'est une fiche qu'on remplit,
  // pas un tableau de bord — `ConfigurationEntreprise` porte sa largeur.
  return <ConfigurationEntreprise />;
}
