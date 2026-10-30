import { RegistreMainOeuvre } from "./RegistreMainOeuvre";

/**
 * Écran « Main-d'œuvre » (décision P11) : le registre des personnes de l'entreprise et de ses
 * partenaires, où l'on prend les membres des équipes. Lecture `projets.lire`, écriture
 * `projets.main_oeuvre_gerer`. Sous Projets et non dans Paramètres : le chef de projet n'entre
 * pas forcément dans ces derniers.
 */
export default function Page() {
  return <RegistreMainOeuvre />;
}
