"use client";

import { Plus, UsersThree, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alerte, Bouton, Champ, EtatErreur, EtatVide } from "@/components/ui";
import { obtenirProfilMoi } from "@/features/auth/api";
import type { ProfilUtilisateur } from "@/features/auth/api";
import { inviterCollaborateurs } from "@/features/configuration/api";
import type { Collaborateur } from "@/features/configuration/api";
import { useBrouillon } from "@/features/configuration/brouillon";
import { schemaCourant, utilisateurCourant } from "@/features/configuration/session";
import {
  creerRole,
  listerRoles,
  ModalNouveauRole,
} from "@/features/roles";
import type { NiveauAcces, RoleItem } from "@/features/roles";
import { ErreurApi } from "@/lib/api";
import { useEnumerations } from "@/lib/api/enumerations";

import styles from "./page.module.css";

/** M9 : « Invitez jusqu'à 3 collaborateurs ». Le chiffre n'a pas de source
 *  ailleurs — question Q3 de T-022, ouverte. */
const MAXIMUM = 3;

/** Rôles exclus de l'attribution : DG est unique et immuable, CP est supprimé/remplacé par CT. */
const ROLES_EXCLUS_BASE = ["DG", "CP"];

interface Props {
  enCours: boolean;
  onSaisie: (enCours: boolean) => void;
  onRetour: () => void;
  onValide: () => void;
  onPasser: () => void;
}

/**
 * Étape 3 — l'équipe. **Facultative** (T-022 §5.1).
 *
 * Un directeur qui s'inscrit un dimanche soir n'a pas les adresses de son
 * équipe sous la main. Lui imposer une invitation pour terminer produirait
 * exactement ce qu'on veut éviter : une adresse inventée, ou un abandon.
 * *Passer* est une validation, pas un abandon — le wizard atteint 100 %.
 *
 * La liste des rôles est servie dynamiquement par l'API rôles du tenant
 * (ou le référentiel des énumérations en repli). Le DG peut créer des rôles
 * personnalisés à la volée ou supprimer un rôle personnalisé avec réaffectation
 * obligatoire (*D-DEMO-01*, *D-DEMO-08*).
 */
export function EtapeEquipe({ enCours, onSaisie, onRetour, onValide, onPasser }: Props) {
  const t = useTranslations("configuration.equipe");
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [profil, setProfil] = useState<ProfilUtilisateur | null>(null);

  // Gestion dynamique des rôles (Sprint 1)
  const [rolesListe, setRolesListe] = useState<RoleItem[]>([]);
  const [modalNouveauOuverte, setModalNouveauOuverte] = useState(false);
  const [actionRoleEnCours, setActionRoleEnCours] = useState(false);
  const [notificationRole, setNotificationRole] = useState<string | null>(null);

  const enumerations = useEnumerations();
  const schema = schemaCourant();
  const utilisateur = utilisateurCourant();

  async function chargerRoles() {
    try {
      const data = await listerRoles();
      setRolesListe(data);
    } catch {
      // Repli fluide sur useEnumerations si indisponible
    }
  }

  useEffect(() => {
    let vivant = true;
    obtenirProfilMoi()
      .then((p) => {
        if (vivant) setProfil(p);
      })
      .catch(() => {});
    listerRoles()
      .then((data) => {
        if (vivant) setRolesListe(data);
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);

  const [liste, enregistrer, oublier] = useBrouillon<Collaborateur[]>(
    schema,
    utilisateur,
    "EQUIPE",
    [],
  );

  const estDG = Boolean(profil?.is_dg || profil?.role_global === "DG");

  // Rôles disponibles : priorité à la table dynamique tenant, repli sur référentiel
  const roles = rolesListe.length > 0
    ? rolesListe
        .filter((r) => !ROLES_EXCLUS_BASE.includes(r.code) && (estDG || (r.code !== "AD" && r.code !== "ADMIN")))
        .map((r) => ({ code: r.code, libelle: r.libelle, est_systeme: r.est_systeme, id: r.id }))
    : (enumerations.data?.role_global ?? [])
        .filter((r) => !ROLES_EXCLUS_BASE.includes(r.code) && (estDG || (r.code !== "AD" && r.code !== "ADMIN")))
        .map((r) => ({ code: r.code, libelle: r.libelle, est_systeme: true, id: r.code }));

  function enregistrerListe(suite: Collaborateur[]) {
    enregistrer(suite);
    onSaisie(suite.length > 0);
  }

  function ajouter() {
    const trouvees: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) trouvees.email = t("erreurEmail");
    else if (liste.some((c) => c.email === email.trim().toLowerCase()))
      trouvees.email = t("erreurEmailDoublon");
    if (!nom.trim()) trouvees.nom = t("erreurNom");
    if (!role) trouvees.role = t("erreurRole");

    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) return;

    enregistrerListe([
      ...liste,
      { email: email.trim().toLowerCase(), nom: nom.trim(), role_propose: role },
    ]);
    setEmail("");
    setNom("");
    setRole("");
  }

  function retirer(adresse: string) {
    enregistrerListe(liste.filter((c) => c.email !== adresse));
  }

  async function handleCreerRole(payload: {
    code: string;
    libelle: string;
    description: string;
    permissions_modules: Record<string, NiveauAcces>;
  }) {
    setActionRoleEnCours(true);
    try {
      const nouveau = await creerRole(payload);
      await chargerRoles();
      setRole(nouveau.code);
      setModalNouveauOuverte(false);
      setNotificationRole(t("roleCree", { libelle: nouveau.libelle }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t("erreurCreationRole"));
    } finally {
      setActionRoleEnCours(false);
    }
  }

  async function envoyer() {
    setEnvoi(true);
    setEchec(null);
    try {
      // Rien n'est envoyé avant cet instant : une personne ajoutée puis
      // retirée aurait déjà reçu son invitation, qu'il faudrait révoquer
      // depuis un écran que le wizard n'a pas (T-022 §5.3).
      await inviterCollaborateurs(liste);
      oublier();
      onSaisie(false);
      onValide();
    } catch (cause) {
      setEchec((cause as ErreurApi).message);
    } finally {
      setEnvoi(false);
    }
  }

  function passer() {
    oublier();
    onSaisie(false);
    onPasser();
  }

  const complet = liste.length >= MAXIMUM;
  const restantes = MAXIMUM - liste.length;

  return (
    <div className={styles.etape}>
      <div className={styles.colonneFormulaire}>
        <h2 className={styles.etapeTitre}>{t("titre")}</h2>
        <p className={styles.etapeAccroche}>{t("accroche", { maximum: MAXIMUM })}</p>

        {echec && (
          <Alerte type="erreur" titre={t("echecTitre")}>
            {echec}
          </Alerte>
        )}

        {notificationRole && (
          <Alerte type="information">
            {notificationRole}
          </Alerte>
        )}

        {/* --- La liste, ou l'état vide (guide frontend §7) -------------------- */}
        {liste.length === 0 ? (
          <EtatVide
            titre={t("videTitre")}
            description={t("videDescription")}
          />
        ) : (
          <ul className={styles.equipe}>
            {liste.map((collaborateur) => (
              <li key={collaborateur.email} className={styles.membre}>
                <span className={styles.initiales} aria-hidden="true">
                  {collaborateur.nom
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((mot) => mot[0]?.toUpperCase() ?? "")
                    .join("")}
                </span>
                <span className={styles.membreInfo}>
                  <span className={styles.membreNom}>{collaborateur.nom}</span>
                  <span className={styles.membreEmail}>{collaborateur.email}</span>
                </span>
                <span className={styles.membreRole}>
                  {roles.find((r) => r.code === collaborateur.role_propose)?.libelle ??
                    collaborateur.role_propose}
                </span>
                <button
                  type="button"
                  className={styles.membreRetirer}
                  onClick={() => retirer(collaborateur.email)}
                  aria-label={t("retirer", { nom: collaborateur.nom })}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* --- Formulaire d'ajout --------------------------------------------- */}
        {complet ? (
          <p className={styles.plafond}>
            <UsersThree size={16} aria-hidden="true" /> {t("plafond", { maximum: MAXIMUM })}
          </p>
        ) : (
          <div className={styles.ajout}>
            <h3 className={styles.ajoutTitre}>
              {t("ajouterTitre")}
              <span className={styles.ajoutRestantes}>{t("restantes", { restantes })}</span>
            </h3>

            <Champ
              libelle={t("champEmail")}
              type="email"
              required
              placeholder={t("champEmailExemple")}
              value={email}
              erreur={erreurs.email}
              disabled={envoi || enCours}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Champ
              libelle={t("champNom")}
              required
              placeholder={t("champNomExemple")}
              value={nom}
              erreur={erreurs.nom}
              disabled={envoi || enCours}
              onChange={(e) => setNom(e.target.value)}
            />

            <div className={styles.groupeSelect}>
              <label className={styles.libelleBloc} htmlFor="role">
                {t("champRole")}
                <span className={styles.obligatoire} aria-hidden="true">
                  *
                </span>
              </label>

              {roles.length === 0 && enumerations.isError ? (
                <EtatErreur
                  message={t("rolesIndisponibles")}
                  onReessayer={() => {
                    chargerRoles();
                    enumerations.refetch();
                  }}
                />
              ) : (
                <div style={{ display: "flex", gap: "var(--space-2, 8px)", alignItems: "center" }}>
                  <select
                    id="role"
                    className={[styles.select, erreurs.role ? styles.selectErreur : ""]
                      .filter(Boolean)
                      .join(" ")}
                    value={role}
                    disabled={envoi || enCours || (roles.length === 0 && enumerations.isPending)}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">
                      {roles.length === 0 && enumerations.isPending
                        ? t("rolesChargement")
                        : t("rolesChoisir")}
                    </option>
                    {roles.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.libelle}
                      </option>
                    ))}
                  </select>

                  {/* Bouton unique pour ajouter un rôle — Spécification Étape 3 */}
                  {estDG && (
                    <Bouton
                      type="button"
                      variante="secondaire"
                      onClick={() => setModalNouveauOuverte(true)}
                      iconeGauche={<Plus size={16} weight="bold" />}
                      style={{
                        height: "var(--input-height, 48px)",
                        whiteSpace: "nowrap",
                        padding: "0 18px",
                        fontWeight: 600,
                        borderColor: "var(--color-primary-500, #c45d3e)",
                        color: "var(--color-primary-600, #b85522)",
                        borderRadius: "var(--input-radius, var(--radius-md))",
                        backgroundColor: "var(--color-neutral-0, #fff)",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                        flexShrink: 0,
                      }}
                    >
                      {t("boutonNouveauRole")}
                    </Bouton>
                  )}
                </div>
              )}
              {erreurs.role && <p className={styles.messageErreur}>{erreurs.role}</p>}
            </div>

            <Bouton
              variante="secondaire"
              onClick={ajouter}
              disabled={envoi || enCours}
              iconeGauche={<Plus size={16} />}
            >
              {t("ajouterAction")}
            </Bouton>
          </div>
        )}
      </div>

      <aside className={styles.controles}>
        <h3 className={styles.controlesTitre}>{t("facultativeTitre")}</h3>
        <p className={styles.controlesNote}>
          {t.rich("facultativeCorps", { fort: (morceaux) => <strong>{morceaux}</strong> })}
        </p>
      </aside>

      <footer className={styles.actions}>
        <Bouton variante="secondaire" taille="lg" onClick={onRetour} disabled={envoi}>
          {t("precedent")}
        </Bouton>
        <Bouton variante="ghost" taille="lg" onClick={passer} disabled={envoi || enCours}>
          {t("passer")}
        </Bouton>
        <Bouton
          taille="lg"
          onClick={envoyer}
          enCours={envoi || enCours}
          disabled={liste.length === 0}
        >
          {t("envoyer", { nombre: liste.length })}
        </Bouton>
      </footer>

      {/* Modale de création d'un nouveau rôle (Sprint 1) */}
      <ModalNouveauRole
        ouverte={modalNouveauOuverte}
        rolesExistant={rolesListe}
        onEnregistrer={handleCreerRole}
        onFermer={() => setModalNouveauOuverte(false)}
        enCours={actionRoleEnCours}
      />
    </div>
  );
}
