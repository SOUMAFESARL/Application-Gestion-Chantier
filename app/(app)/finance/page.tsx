import { redirect } from "next/navigation";

/**
 * Hub du module Finance (Module 3 du CDC).
 * Redirige par défaut vers la vue des budgets de chantier.
 */
export default function FinancePage() {
  redirect("/finance/budgets");
}
