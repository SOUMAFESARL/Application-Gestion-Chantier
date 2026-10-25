import type { ReactNode } from "react";

import { FournisseurEspace } from "@/i18n/FournisseurEspace";

/** Les messages du back-office. Sa coquille (`admin/layout.tsx`) est un composant client : ce layout de groupe les lui fournit. */
export default function LayoutAdministration({ children }: Readonly<{ children: ReactNode }>) {
  return <FournisseurEspace espace="administration">{children}</FournisseurEspace>;
}
