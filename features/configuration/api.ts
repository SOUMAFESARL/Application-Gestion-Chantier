/**
 * Configuration de l'entreprise.
 *
 * **Le wizard d'onboarding a été retiré.** Ce module ne portait pas que
 * l'entreprise : il enchaînait aussi un « premier projet » et une invitation
 * d'équipe, franchis pas à pas et suivis par une ressource `/configuration/`
 * dédiée (progression, étapes, récapitulatif). Le produit n'impose plus ce
 * parcours forcé à la première connexion — la configuration de l'entreprise
 * est un écran de paramètres ordinaire, accessible à tout moment, qui relit
 * et réécrit directement `/entreprise/`. Le premier projet et l'invitation
 * de l'équipe se font depuis leurs propres écrans (Projets, Paramètres →
 * Collaborateurs).
 */

import { api } from "@/lib/api";
import { SIMULATION_ACTIVE, simulationConfiguration } from "@/lib/api/simulation";

/**
 * Émis quand le profil de l'entreprise change — logo, nom.
 *
 * **La barre d'application chargeait l'entreprise une seule fois, au montage.**
 * Elle reste montée pendant toute la navigation dans `(app)` : un logo téléversé
 * depuis l'écran de configuration n'y apparaissait donc **qu'après un
 * rechargement complet de la page**. La personne voyait son logo accepté d'un
 * côté de l'écran et l'icône générique de l'autre, sans comprendre lequel des
 * deux disait vrai.
 *
 * Même mécanisme que `EVENEMENT_SESSION_EXPIREE` : la couche qui écrit
 * **signale**, et l'écran décide. Pas de magasin d'état global à introduire
 * pour un seul rafraîchissement.
 */
export const EVENEMENT_ENTREPRISE_MODIFIEE = "ccd:entreprise-modifiee";

function signalerEntrepriseModifiee(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENEMENT_ENTREPRISE_MODIFIEE));
  }
}

export interface DonneesEntreprise {
  raison_sociale: string;
  nom_commercial?: string;
  /**
   * Le pays, **en lecture seule** : choisi à l'inscription, il gouverne la
   * liste des villes de cet écran et l'indicatif proposé par les champs
   * téléphone. Le serveur le renvoie et refuse de le modifier — changer de
   * pays après avoir saisi des chantiers laisserait leurs villes derrière.
   */
  pays?: string;
  adresse: string;
  ville: string;
  rccm: string;
  nif: string;
  telephone_contact: string;
  email_contact: string;
  /**
   * Les trois variantes du logo, en **URL absolues**, en lecture seule.
   *
   * `logo_1x` et `logo` sont la même marque taillée pour les deux densités
   * d'écran de la barre — **32 px de haut, largeur libre**. La forme du logo
   * est conservée : pressé dans un carré, un logo qui porte un nom devient
   * illisible. `logo_original` est le master recadré, pour les documents.
   */
  logo?: string;
  logo_1x?: string;
  logo_original?: string;
  /**
   * Encore renvoyée par le serveur, **ignorée** : la couleur de marque par
   * entreprise est supprimée. Déclarée seulement pour être retirée de ce que
   * l'écran de configuration renvoie.
   */
  couleur_primaire?: string;
  statut?: string;
  /**
   * Efface le logo. `logo: ""` ne le fait plus : le champ est calculé côté
   * serveur depuis une clé de stockage, il n'est plus inscriptible.
   */
  retirer_logo?: boolean;
}

/** La réponse du `PATCH`. `fond_retire` n'accompagne qu'un envoi de fichier. */
export interface ReponseEntreprise extends DonneesEntreprise {
  /**
   * Le détourage a-t-il eu lieu. Il ne s'applique qu'à un fond **uniforme** :
   * un dégradé, une photo ou un cadre le font échouer, légitimement. Ce qui ne
   * l'était pas, c'est que l'échec soit muet — le logo partait alors en barre
   * avec son rectangle, et l'écran qui l'avait envoyé n'en savait rien.
   */
  fond_retire?: boolean;
}

export function lireEntreprise(): Promise<DonneesEntreprise> {
  if (SIMULATION_ACTIVE)
    return simulationConfiguration.lireEntreprise() as unknown as Promise<DonneesEntreprise>;
  return api.lire<DonneesEntreprise>("/entreprise/");
}

/**
 * Le pays de l'entreprise, mémorisé pour la durée de l'onglet.
 *
 * Il est demandé par tous les écrans qui proposent une ville ou un indicatif —
 * la configuration de l'entreprise, la création de chantier depuis le tableau
 * de bord. Sans mémoire, chacun rappellerait `/entreprise/` pour un code de
 * deux lettres qui ne change jamais : le pays est **en lecture seule** côté
 * serveur, il n'y a donc rien à invalider.
 */
let paysMemorise: Promise<string> | null = null;

export function paysEntreprise(): Promise<string> {
  if (!paysMemorise) {
    paysMemorise = lireEntreprise()
      .then((entreprise) => entreprise.pays || "")
      .catch(() => {
        // Un échec ne se garde pas en mémoire : l'écran affichera sa saisie
        // libre cette fois-ci, et le prochain qui demande retentera.
        paysMemorise = null;
        return "";
      });
  }
  return paysMemorise;
}

export function enregistrerEntreprise(
  donnees: DonneesEntreprise,
  fichierLogo?: File | null,
): Promise<ReponseEntreprise> {
  if (SIMULATION_ACTIVE)
    return simulationConfiguration
      .enregistrerEntreprise({ ...donnees })
      .then(() => ({ ...donnees }));

  if (fichierLogo) {
    const formData = new FormData();
    formData.append("fichier_logo", fichierLogo);
    for (const [cle, valeur] of Object.entries(donnees)) {
      if (valeur !== undefined && valeur !== null && valeur !== "") {
        formData.append(cle, String(valeur));
      }
    }
    return api.modifier<ReponseEntreprise>("/entreprise/", formData).then((r) => {
      signalerEntrepriseModifiee();
      return r;
    });
  }

  return api.modifier<ReponseEntreprise>("/entreprise/", donnees).then((r) => {
    signalerEntrepriseModifiee();
    return r;
  });
}
