/**
 * Clés de cache TanStack Query du domaine Administration.
 */
export const CLES_ADMINISTRATION = {
  tous: ["administration"] as const,
  modules: () => [...CLES_ADMINISTRATION.tous, "modules"] as const,
  permissions: () => [...CLES_ADMINISTRATION.tous, "permissions"] as const,
};
