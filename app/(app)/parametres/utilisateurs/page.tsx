"use client";

import { CheckCircle2, Clock, UserPlus } from "lucide-react";
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
import { cn } from "@/lib/utils";


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

/**
 * Les tons de l'ecran, rassembles ici plutot que repetes dans le JSX.
 *
 * Les trois badges d'etat tiraient leur fond, leur encre et leur filet de
 * valeurs hexadecimales ecrites a la main — un vert emeraude, un ambre et un
 * rouge qui n'appartenaient a aucune palette du produit. Ils passent aux
 * jetons semantiques de la charte, seule source de valeurs (regle 4 du plan
 * de refonte).
 */
const BOUTON_FILTRE =
  "cursor-pointer rounded-md border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 text-sm text-neutral-700 transition-all hover:bg-neutral-100";
const BOUTON_FILTRE_ACTIF =
  "border-primary-600 bg-primary-600 text-neutral-0 hover:bg-primary-700";

const BADGE = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";
const BADGE_ROLE = "border border-neutral-200 bg-neutral-100 text-neutral-800";
const BADGE_ACTIF = "border border-succes/30 bg-succes-fond text-succes";
const BADGE_ATTENTE = "border border-avertissement/30 bg-avertissement-fond text-avertissement";
const BADGE_EXPIRE = "border border-erreur/30 bg-erreur-fond text-erreur";

const CHAMP_MODALE =
  "rounded-md border border-neutral-300 bg-neutral-0 px-3 py-2.5 text-sm focus:border-primary-500 focus:shadow-[0_0_0_2px_--alpha(var(--color-primary-500)/20%)] focus:outline-none";

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
      <main className="mx-auto flex max-w-[1200px] flex-col gap-8 p-8">
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
    <main className="mx-auto flex max-w-[1200px] flex-col gap-8 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-neutral-900">{t("titre")}</h1>
          <p className="text-sm text-neutral-600">{t("sousTitre")}</p>
        </div>
        <Bouton
          variante="primaire"
          iconeGauche={<UserPlus size={18} />}
          onClick={() => setModaleOuverte(true)}
        >
          {t("boutonInviter")}
        </Bouton>
      </header>

      {succesMsg && (
        <Alerte type="succes">
          <CheckCircle2 size={20} />
          {succesMsg}
        </Alerte>
      )}

      {erreurMsg && <Alerte type="erreur">{erreurMsg}</Alerte>}

      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            className={cn(BOUTON_FILTRE, filtre === "TOUS" && BOUTON_FILTRE_ACTIF)}
            onClick={() => setFiltre("TOUS")}
          >
            {t("filtreTous")} ({lignes.length})
          </button>
          <button
            type="button"
            className={cn(BOUTON_FILTRE, filtre === "ACTIFS" && BOUTON_FILTRE_ACTIF)}
            onClick={() => setFiltre("ACTIFS")}
          >
            {t("filtreActifs")} ({lignes.filter((l) => l.statut === "ACTIF").length})
          </button>
          <button
            type="button"
            className={cn(BOUTON_FILTRE, filtre === "INVITES" && BOUTON_FILTRE_ACTIF)}
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
          className="min-w-[260px] rounded-md border border-neutral-300 px-3.5 py-2 text-sm"
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-[0_1px_3px_rgb(0_0_0/0.05)]">
        <table className="w-full border-collapse text-left [&_td]:border-b [&_td]:border-neutral-100 [&_td]:px-4 [&_td]:py-3.5 [&_td]:text-sm [&_td]:text-neutral-800 [&_th]:border-b [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-[0.05em] [&_th]:text-neutral-500 [&_th]:uppercase [&_tr:last-child_td]:border-b-0">
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
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-100 text-[13px] font-bold text-primary-700">{initiales || "U"}</div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-neutral-900">{l.nom}</span>
                          <span className="text-xs text-neutral-500">{l.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={cn(BADGE, BADGE_ROLE)}>
                        {l.role}
                      </span>
                    </td>
                    <td>
                      {l.statut === "ACTIF" && (
                        <span className={cn(BADGE, BADGE_ACTIF)}>
                          <CheckCircle2 size={14} />
                          {t("statutActif")}
                        </span>
                      )}
                      {l.statut === "INVITE" && (
                        <span className={cn(BADGE, BADGE_ATTENTE)}>
                          <Clock size={14} />
                          {t("statutInvite")}
                        </span>
                      )}
                      {l.statut === "EXPIREE" && (
                        <span className={cn(BADGE, BADGE_EXPIRE)}>
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
          <div className="flex justify-end gap-3">
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
          className="flex flex-col gap-4 py-2"
        >
          <p style={{ margin: 0, fontSize: "14px", color: "var(--color-neutral-600)" }}>
            {t("inviterSousTitre")}
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-800">
              {t("champEmail")} <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="email"
              required
              placeholder={t("placeholderEmail")}
              value={emailInvite}
              onChange={(e) => setEmailInvite(e.target.value)}
              className={CHAMP_MODALE}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-800">{t("champNom")}</label>
            <input
              type="text"
              placeholder={t("placeholderNom")}
              value={nomInvite}
              onChange={(e) => setNomInvite(e.target.value)}
              className={CHAMP_MODALE}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-800">{t("champRole")}</label>
            <select
              value={roleInvite}
              onChange={(e) => setRoleInvite(e.target.value)}
              className={CHAMP_MODALE}
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
