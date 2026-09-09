import { redirect } from "next/navigation";

/**
 * Racine du site (localhost:3000).
 *
 * Oriente directement vers la page de connexion.
 */
export default function Page() {
  redirect("/connexion");
}
