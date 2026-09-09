"use client";

import { CheckCircle, Clock, UserPlus } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alerte, Bouton, EtatChargement, Modale } from "@/components/ui";
import { obtenirProfilMoi } from "@/features/auth/api";
import type { ProfilUtilisateur } from "@/features/auth/api";
import {
  creerInvitation,
  listerInvitations,
} from "@/features/invitations/api";
import type { InvitationDetail } from "@/features/invitations/api";
import { ErreurApi } from "@/lib/api";

import styles from "./page.module.css";

const FORM_INVITER_ID = "form-inviter-collab";

/**
 * Les rôles proposés à l'invitation, **par leur code seul**.
 *
 * Les libellés étaient dans ce tableau, en français. C'est l'angle mort que
 * la configuration ESLint nomme — la règle `no-literal-string` ne lit que le
 * JSX, pas un littéral d'objet. Ils sont dans `messages/fr.json`, sous
 * `gestionCollaborateurs.roleOptions.<code>` (Socle Commun §1.1).
 */
const CODES_ROLES = [
  "AD",
  "DP",
  "CT",
  "CC",
  "IT",
  "RF",
  "RA",
  "MAG",
  "RH",
  "ST",
  "FRN",
  "MOA",
  "VI",
] as const;

export default function PageUtilisateurs() {
  const t = useTranslations("gestionCollaborateurs");

  const [moi, setMoi] = useState<ProfilUtilisateur | null>(null);
  const [invitations, setInvitations] = useState<InvitationDetail[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState<"TOUS" | "ACTIFS" | "INVITES">("TOUS");
  const [recherche, setRecherche] = useState("");

  // Modale d'invitation
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [emailInvite, setEmailInvite] = useState("");
  const [nomInvite, setNomInvite] = useState("");
  const [roleInvite, setRoleInvite] = useState("CT");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [succesMsg, setSuccesMsg] = useState<string | null>(null);
  const [erreurMsg, setErreurMsg] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;

    Promise.all([obtenirProfilMoi(), listerInvitations()])
      .then(([profil, listeInv]) => {
        if (vivant) {
          setMoi(profil);
          setInvitations(listeInv);
          setChargement(false);
        }
      })
      .catch(() => {
        if (vivant) setChargement(false);
      });

    return () => {
      vivant = false;
    };
  }, []);

  async function handleEnvoyerInvitation(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInvite || envoiEnCours) return;

    setEnvoiEnCours(true);
    setErreurMsg(null);

    try {
      const nouvelle = await creerInvitation({
        email: emailInvite.trim().toLowerCase(),
        nom: nomInvite.trim(),
        role_propose: roleInvite,
      });

      setInvitations((prev) => [nouvelle, ...prev]);
      setSuccesMsg(t("succesEnvoi", { email: emailInvite }));
      setModaleOuverte(false);
      setEmailInvite("");
      setNomInvite("");
      setRoleInvite("CP");
    } catch (err) {
      const cause = err as ErreurApi;
      setErreurMsg(cause.message || t("erreurEnvoi"));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (chargement) {
    return (
      <main className={styles.page}>
        <EtatChargement message={t("chargement")} />
      </main>
    );
  }

  // Construction de la liste mixte : Utilisateur courant + Invitations
  type Ligne = {
    id: string;
    nom: string;
    email: string;
    role: string;
    statut: "ACTIF" | "INVITE" | "EXPIREE";
    date: string;
  };

  const lignes: Ligne[] = [];

  if (moi) {
    lignes.push({
      id: moi.id,
      nom: `${moi.prenom} ${moi.nom}`.trim() || moi.email,
      email: moi.email,
      role: moi.role_global === "AD" ? "Administrateur" : moi.role_global,
      statut: "ACTIF",
      date: t("comptePrincipal"),
    });
  }

  for (const inv of invitations) {
    lignes.push({
      id: inv.id,
      nom: inv.nom || t("collaborateurInvite"),
      email: inv.email,
      role: t.has(`roleOptions.${inv.role_propose}`)
        ? t(`roleOptions.${inv.role_propose}`)
        : inv.role_propose,
      statut:
        inv.statut === "ACCEPTEE"
          ? "ACTIF"
          : inv.est_expiree || inv.statut === "EXPIREE"
            ? "EXPIREE"
            : "INVITE",
      date: new Date(inv.cree_le).toLocaleDateString("fr-FR"),
    });
  }

  const lignesFiltrees = lignes.filter((l) => {
    if (filtre === "ACTIFS" && l.statut !== "ACTIF") return false;
    if (filtre === "INVITES" && l.statut !== "INVITE") return false;
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      return l.nom.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <main className={styles.page}>
      <header className={styles.entete}>
        <div className={styles.titreBloc}>
          <h1 className={styles.titre}>{t("titre")}</h1>
          <p className={styles.sousTitre}>{t("sousTitre")}</p>
        </div>
        <Bouton
          variante="primaire"
          iconeGauche={<UserPlus size={18} weight="bold" />}
          onClick={() => setModaleOuverte(true)}
        >
          {t("boutonInviter")}
        </Bouton>
      </header>

      {succesMsg && (
        <Alerte type="succes">
          <CheckCircle size={20} weight="fill" />
          {succesMsg}
        </Alerte>
      )}

      {erreurMsg && <Alerte type="erreur">{erreurMsg}</Alerte>}

      <section className={styles.barreOutils}>
        <div className={styles.filtres}>
          <button
            type="button"
            className={`${styles.boutonFiltre} ${filtre === "TOUS" ? styles.boutonFiltreActif : ""}`}
            onClick={() => setFiltre("TOUS")}
          >
            {t("filtreTous")} ({lignes.length})
          </button>
          <button
            type="button"
            className={`${styles.boutonFiltre} ${filtre === "ACTIFS" ? styles.boutonFiltreActif : ""}`}
            onClick={() => setFiltre("ACTIFS")}
          >
            {t("filtreActifs")} ({lignes.filter((l) => l.statut === "ACTIF").length})
          </button>
          <button
            type="button"
            className={`${styles.boutonFiltre} ${filtre === "INVITES" ? styles.boutonFiltreActif : ""}`}
            onClick={() => setFiltre("INVITES")}
          >
            {t("filtreInvites")} ({lignes.filter((l) => l.statut === "INVITE").length})
          </button>
        </div>

        <input
          type="search"
          placeholder={t("recherchePlaceholder")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className={styles.rechercheInput}
        />
      </section>

      <section className={styles.tableauConteneur}>
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("colonneNom")}</th>
              <th>{t("colonneRole")}</th>
              <th>{t("colonneStatut")}</th>
              <th>{t("colonneDate")}</th>
            </tr>
          </thead>
          <tbody>
            {lignesFiltrees.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "32px" }}>
                  {t("aucunResultat")}
                </td>
              </tr>
            ) : (
              lignesFiltrees.map((l) => {
                const initiales = l.nom
                  .split(" ")
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <tr key={l.id}>
                    <td>
                      <div className={styles.celluleMembre}>
                        <div className={styles.avatar}>{initiales || "U"}</div>
                        <div className={styles.detailsMembre}>
                          <span className={styles.nomMembre}>{l.nom}</span>
                          <span className={styles.emailMembre}>{l.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles.badgeRole}`}>
                        {l.role}
                      </span>
                    </td>
                    <td>
                      {l.statut === "ACTIF" && (
                        <span className={`${styles.badge} ${styles.badgeActif}`}>
                          <CheckCircle size={14} weight="fill" />
                          {t("statutActif")}
                        </span>
                      )}
                      {l.statut === "INVITE" && (
                        <span className={`${styles.badge} ${styles.badgeAttente}`}>
                          <Clock size={14} weight="fill" />
                          {t("statutInvite")}
                        </span>
                      )}
                      {l.statut === "EXPIREE" && (
                        <span className={`${styles.badge} ${styles.badgeExpire}`}>
                          {t("statutExpire")}
                        </span>
                      )}
                    </td>
                    <td>{l.date}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Modale d'invitation */}
      <Modale
        ouverte={modaleOuverte}
        onFermer={() => setModaleOuverte(false)}
        titre={t("inviterTitre")}
        actions={
          <div className={styles.modaleActions}>
            <Bouton
              variante="secondaire"
              onClick={() => setModaleOuverte(false)}
              disabled={envoiEnCours}
            >
              {t("boutonAnnuler")}
            </Bouton>
            <Bouton
              variante="primaire"
              type="submit"
              form={FORM_INVITER_ID}
              disabled={envoiEnCours || !emailInvite}
            >
              {envoiEnCours ? t("envoiEnCours") : t("boutonEnvoyer")}
            </Bouton>
          </div>
        }
      >
        <form
          id={FORM_INVITER_ID}
          onSubmit={handleEnvoyerInvitation}
          className={styles.modaleCorps}
        >
          <p style={{ margin: 0, fontSize: "14px", color: "var(--color-neutral-600)" }}>
            {t("inviterSousTitre")}
          </p>

          <div className={styles.champGroupe}>
            <label className={styles.champLabel}>
              {t("champEmail")} <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="email"
              required
              placeholder={t("placeholderEmail")}
              value={emailInvite}
              onChange={(e) => setEmailInvite(e.target.value)}
              className={styles.champInput}
            />
          </div>

          <div className={styles.champGroupe}>
            <label className={styles.champLabel}>{t("champNom")}</label>
            <input
              type="text"
              placeholder={t("placeholderNom")}
              value={nomInvite}
              onChange={(e) => setNomInvite(e.target.value)}
              className={styles.champInput}
            />
          </div>

          <div className={styles.champGroupe}>
            <label className={styles.champLabel}>{t("champRole")}</label>
            <select
              value={roleInvite}
              onChange={(e) => setRoleInvite(e.target.value)}
              className={styles.champSelect}
            >
              {CODES_ROLES.filter(
                (code) => code !== "AD" || Boolean(moi?.is_dg || moi?.role_global === "DG"),
              ).map((code) => (
                <option key={code} value={code}>
                  {t(`roleOptions.${code}`)}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modale>
    </main>
  );
}
