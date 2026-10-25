import type { ReactNode } from "react";

import { FournisseurEspace } from "@/i18n/FournisseurEspace";

/** Les messages du catalogue de composants. */
export default function LayoutDesignSystem({ children }: Readonly<{ children: ReactNode }>) {
  return <FournisseurEspace espace="designSystem">{children}</FournisseurEspace>;
}
