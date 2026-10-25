import type { ReactNode } from "react";

import { FournisseurEspace } from "@/i18n/FournisseurEspace";

/** Les messages de la connexion au back-office : elle lit `administration`, que la racine n'embarque plus. */
export default function LayoutConnexionAdministration({ children }: Readonly<{ children: ReactNode }>) {
  return <FournisseurEspace espace="administrationConnexion">{children}</FournisseurEspace>;
}
