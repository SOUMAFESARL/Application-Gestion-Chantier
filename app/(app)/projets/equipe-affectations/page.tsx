import { EquipesAffectations } from "./EquipesAffectations";

/**
 * Écran « Équipes et affectations »
 *
 * Motif d'interface : Liste filtrable
 *
 * Les équipes constituées sur un chantier, et les activités auxquelles
 * chacune est affectée. La page ne porte que le gabarit : tout ce qui dépend
 * des données vit dans `EquipesAffectations`, lu côté navigateur.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [cle: string]: string | string[] | undefined }>;
}) {
  // `?projet=` : le chantier d'où l'on revient (la fiche d'une équipe), pour
  // ne pas retomber sur celui qui s'ouvre d'office.
  const { projet } = await searchParams;
  return <EquipesAffectations projetInitial={typeof projet === "string" ? projet : undefined} />;
}
