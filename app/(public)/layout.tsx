import type { ReactNode } from "react";

import { FournisseurEspace } from "@/i18n/FournisseurEspace";

/** Les messages des pages publiques — inscription et liens de partage. */
export default function LayoutPublic({ children }: Readonly<{ children: ReactNode }>) {
  return <FournisseurEspace espace="public">{children}</FournisseurEspace>;
}
