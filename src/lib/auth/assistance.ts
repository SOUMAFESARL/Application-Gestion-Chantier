/**
 * Gestion du mode assistance Super Admin (Impersonification) côté client.
 *
 * Mémorise la session originale du Super Admin pour permettre une restitution
 * transparente lors de la sortie d'assistance, et applique la règle R-128
 * (session limitée à 1h, non renouvelable, lecture seule).
 */

import {
  ecrireJetonAcces,
  ecrireJetonRenouvellement,
  lireJetonAcces,
  lireJetonRenouvellement,
} from "@/lib/api/jetons";
import { ecrireProfilLocal, lireProfilLocal, ProfilUtilisateur } from "@/features/auth/api";
import { ReponseSessionAssistance, SessionAssistanceLocale } from "@/features/super-admin/types";

const CLE_SESSION_ASSISTANCE = "ccd.session_assistance";
const CLE_SAUVEGARDE_ADMIN = "ccd.super_admin_session_sauvegardee";

export const EVENEMENT_ASSISTANCE_CHANGEE = "ccd:assistance-changee";

interface SauvegardeSuperAdmin {
  jetonAcces: string | null;
  jetonRenouvellement: string | null;
  profil: ProfilUtilisateur | null;
}

export function lireSessionAssistance(): SessionAssistanceLocale | null {
  if (typeof window === "undefined") return null;
  const brut = window.sessionStorage.getItem(CLE_SESSION_ASSISTANCE);
  if (!brut) return null;
  try {
    const session = JSON.parse(brut) as SessionAssistanceLocale;
    // Si la session est expirée (> 1h), on la nettoie automatiquement
    if (Date.now() >= session.expireA) {
      desactiverSessionAssistance();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function estEnModeAssistance(): boolean {
  return lireSessionAssistance() !== null;
}

export function tempsRestantAssistanceSecondes(): number {
  const session = lireSessionAssistance();
  if (!session) return 0;
  return Math.max(0, Math.floor((session.expireA - Date.now()) / 1000));
}

export function activerSessionAssistance(reponse: ReponseSessionAssistance): void {
  if (typeof window === "undefined") return;

  // 1. Sauvegarde préalable de la session Super Admin pour le retour
  const sauvegarde: SauvegardeSuperAdmin = {
    jetonAcces: lireJetonAcces(),
    jetonRenouvellement: lireJetonRenouvellement(),
    profil: lireProfilLocal(),
  };
  window.sessionStorage.setItem(CLE_SAUVEGARDE_ADMIN, JSON.stringify(sauvegarde));

  // 2. Écriture du jeton d'accès d'assistance (1h, pas de renouvellement)
  ecrireJetonAcces(reponse.access);
  ecrireJetonRenouvellement(null); // non renouvelable

  // 3. Pose du profil de l'utilisateur client assisté
  const profilClient: ProfilUtilisateur = {
    id: reponse.utilisateur.id,
    email: reponse.utilisateur.email,
    nom: reponse.utilisateur.nom,
    prenom: reponse.utilisateur.prenom,
    role_global: reponse.utilisateur.role_global,
    role_libelle: reponse.utilisateur.role_libelle,
    is_dg: reponse.utilisateur.is_dg,
    is_owner: reponse.utilisateur.is_owner,
    langue: reponse.utilisateur.langue || "fr",
    doit_changer_mot_de_passe: false,
  };
  ecrireProfilLocal(profilClient);

  // 4. Mémorisation locale de la session d'assistance
  const maintenant = Date.now();
  const sessionLocale: SessionAssistanceLocale = {
    actif: true,
    debut: maintenant,
    expireA: maintenant + reponse.expire_dans * 1000,
    entrepriseId: reponse.impersonation.entreprise.id,
    entrepriseNom:
      reponse.impersonation.entreprise.nom_commercial ||
      reponse.impersonation.entreprise.raison_sociale,
    utilisateurId: reponse.impersonation.utilisateur.id,
    utilisateurNom:
      `${reponse.impersonation.utilisateur.nom} ${reponse.impersonation.utilisateur.prenom}`.trim(),
    utilisateurEmail: reponse.impersonation.utilisateur.email,
    motif: reponse.impersonation.motif,
  };
  window.sessionStorage.setItem(CLE_SESSION_ASSISTANCE, JSON.stringify(sessionLocale));

  // Notification d'événement global pour mise à jour immédiate des composants UI
  window.dispatchEvent(new Event(EVENEMENT_ASSISTANCE_CHANGEE));
}

export function desactiverSessionAssistance(): void {
  if (typeof window === "undefined") return;

  // 1. Restauration de la session Super Admin si elle existe
  const brut = window.sessionStorage.getItem(CLE_SAUVEGARDE_ADMIN);
  if (brut) {
    try {
      const sauvegarde = JSON.parse(brut) as SauvegardeSuperAdmin;
      ecrireJetonAcces(sauvegarde.jetonAcces);
      ecrireJetonRenouvellement(sauvegarde.jetonRenouvellement);
      ecrireProfilLocal(sauvegarde.profil);
    } catch {
      // Tolérance
    }
  }

  // 2. Nettoyage des clés d'assistance
  window.sessionStorage.removeItem(CLE_SESSION_ASSISTANCE);
  window.sessionStorage.removeItem(CLE_SAUVEGARDE_ADMIN);

  // Notification
  window.dispatchEvent(new Event(EVENEMENT_ASSISTANCE_CHANGEE));
}
