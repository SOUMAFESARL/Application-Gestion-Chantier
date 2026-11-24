/**
 * Clés de cache TanStack Query du domaine Tiers.
 */
import type { RoleTiers } from "./types";

export const CLES_TIERS = {
  tous: ["tiers"] as const,
  liste: (inclureInactifs = true) =>
    ["tiers", "catalogue", inclureInactifs ? "tous" : "actifs"] as const,
  parRole: (role?: RoleTiers) => ["tiers", role ?? "tous"] as const,
  detail: (id: string) => ["tiers", "detail", id] as const,
};
