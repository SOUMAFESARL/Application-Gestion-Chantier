import type { ReactNode } from "react";

import { FournisseurEspace } from "@/i18n/FournisseurEspace";

import CoquilleEntreprise from "./CoquilleEntreprise";

/** Les messages de l'espace entreprise, autour de sa coquille — un composant client, qui ne peut pas lire le catalogue lui-même. */
export default function LayoutEntreprise({ children }: Readonly<{ children: ReactNode }>) {
  return <FournisseurEspace espace="entreprise"><CoquilleEntreprise>{children}</CoquilleEntreprise></FournisseurEspace>;
}
