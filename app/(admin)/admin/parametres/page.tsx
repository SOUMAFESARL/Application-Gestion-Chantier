import { redirect } from "next/navigation";

/**
 * L'adresse de la rubrique elle-même mène à sa première page : chaque entrée
 * du sous-menu a la sienne, et il n'y a rien à montrer au-dessus d'elles.
 */
export default function PageParametres() {
  redirect("/admin/parametres/comptes");
}
