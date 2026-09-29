/**
 * Les clés de cache des paramètres publics de la plateforme.
 *
 * Partagées par les deux espaces : le back-office invalide exactement ce que
 * la page de tarifs et la barre latérale ont lu.
 */
export const CLES_PLATEFORME = {
  tarifs: () => ["plateforme", "tarifs"] as const,
  identite: () => ["plateforme", "identite"] as const,
};
