"use client";

import { Plus, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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

import { Alerte, Bouton, Champ, EtatErreur, EtatVide } from "./_ui";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("titre")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("accroche", { maximum: MAXIMUM })}</p>
        </div>

        {echec && (
          <Alerte type="erreur" titre={t("echecTitre")}>
            {echec}
          </Alerte>
        )}

        {notificationRole && <Alerte type="information">{notificationRole}</Alerte>}

        {/* --- La liste, ou l'état vide (guide frontend §7) -------------------- */}
        {liste.length === 0 ? (
          <EtatVide titre={t("videTitre")} description={t("videDescription")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {liste.map((collaborateur) => (
              <li
                key={collaborateur.email}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700"
                  aria-hidden="true"
                >
                  {collaborateur.nom
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((mot) => mot[0]?.toUpperCase() ?? "")
                    .join("")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{collaborateur.nom}</span>
                  <span className="truncate text-xs text-muted-foreground">{collaborateur.email}</span>
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {roles.find((r) => r.code === collaborateur.role_propose)?.libelle ??
                    collaborateur.role_propose}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-erreur"
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
          <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Users size={16} aria-hidden="true" /> {t("plafond", { maximum: MAXIMUM })}
          </p>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
            <h3 className="flex items-center justify-between text-sm font-semibold text-foreground">
              {t("ajouterTitre")}
              <span className="text-xs font-normal text-muted-foreground">{t("restantes", { restantes })}</span>
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

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1 text-sm font-medium text-foreground" htmlFor="role">
                {t("champRole")}
                <span className="text-erreur" aria-hidden="true">*</span>
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
                <div className="flex items-center gap-2">
                  <select
                    id="role"
                    className="h-[var(--input-height)] flex-1 rounded-md border border-input bg-card px-[var(--input-padding-x)] text-base text-neutral-900 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
                    value={role}
                    aria-invalid={Boolean(erreurs.role) || undefined}
                    disabled={envoi || enCours || (roles.length === 0 && enumerations.isPending)}
                    onChange={(e) => setRole(e.target.value)}
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
                      taille="lg"
                      className="shrink-0 whitespace-nowrap"
                      onClick={() => setModalNouveauOuverte(true)}
                      iconeGauche={<Plus size={16} />}
                    >
                      {t("boutonNouveauRole")}
                    </Bouton>
                  )}
                </div>
              )}
              {erreurs.role && <p className="text-xs font-medium text-erreur">{erreurs.role}</p>}
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

      <aside className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("facultativeTitre")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t.rich("facultativeCorps", { fort: (morceaux) => <strong className="text-foreground">{morceaux}</strong> })}
        </p>
      </aside>

      <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
