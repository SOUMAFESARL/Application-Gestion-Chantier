/**
 * Clés de cache TanStack Query pour les rôles et les permissions.
 */

export const CLE_ROLES = ["roles"] as const;

export const CLE_MODULES_ENTREPRISE = ["roles", "modules"] as const;

export const cleRole = (id: string) => ["roles", id] as const;
