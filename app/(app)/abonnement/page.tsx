import { redirect } from "next/navigation";

/**
 * Hub du module Abonnement. Redirige par défaut vers les tarifs — l'écran
 * qu'on ouvre pour changer de forfait, le cas le plus courant.
 */
export default function AbonnementPage() {
  redirect("/abonnement/tarifs");
}
