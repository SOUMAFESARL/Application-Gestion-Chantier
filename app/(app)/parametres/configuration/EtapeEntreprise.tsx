"use client";

import { ImageIcon, Pipette, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { Drapeau } from "@/components/metier/Drapeau";
import { SelecteurVille } from "@/components/metier/SelecteurVille";
import {
  enregistrerEntreprise,
  lireEntreprise,
  paysEntreprise,
} from "@/features/configuration/api";
import type { DonneesEntreprise } from "@/features/configuration/api";
import { brouillonNonVide, useBrouillon } from "@/features/configuration/brouillon";
import { schemaCourant, utilisateurCourant } from "@/features/configuration/session";
import { telephoneValide } from "@/features/referentiels/telephone";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { nomDePays } from "@/lib/format";
import {
  appliquerCouleurPrimaire,
  COULEUR_TERRE_CUITE_DEFAUT,
  extraireCouleurDominante,
  PALETTE_OFFICIELLE,
} from "@/styles/theme";

import { Alerte, Bouton, Champ } from "./_ui";

/** M9 : « PNG ou JPG · Max 2 Mo ». */
const TAILLE_MAX_LOGO = 2 * 1024 * 1024;
const FORMATS_LOGO = ["image/png", "image/jpeg"];

const VIDE: DonneesEntreprise = {
  raison_sociale: "",
  adresse: "",
  ville: "",
  rccm: "",
  nif: "",
  telephone_contact: "",
  email_contact: "",
};

interface Props {
  enCours: boolean;
  onSaisie: (enCours: boolean) => void;
  onValide: () => void;
}

/**
 * Étape 1 — l'entreprise.
 *
 * **Elle écrit dans `public`, et c'est le seul cas du wizard.**
 * `entreprise_cliente` est la table de la plateforme : c'est elle qui porte le
 * `schema_name` que le middleware lit à chaque requête, elle ne peut pas
 * vivre dans le schéma qu'elle nomme (T-022 §3.2). US-015 dit l'inverse ;
 * c'est US-015 qui se trompe.
 */
export function EtapeEntreprise({ enCours, onSaisie, onValide }: Props) {
  const t = useTranslations("configuration.entreprise");
  const [logo, setLogo] = useState<{ nom: string; taille: number } | null>(null);
  const [fichierLogo, setFichierLogo] = useState<File | null>(null);
  const [apercuLogo, setApercuLogo] = useState<string | null>(null);
  const [couleurExtraite, setCouleurExtraite] = useState<string | null>(null);
  const [erreurLogo, setErreurLogo] = useState<string | null>(null);
  const [fondNonDetoure, setFondNonDetoure] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [pays, setPays] = useState("");

  const schema = schemaCourant();
  const utilisateur = utilisateurCourant();

  useEffect(() => {
    let vivant = true;
    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const [donnees, enregistrer, oublier] = useBrouillon<DonneesEntreprise>(
    schema,
    utilisateur,
    "ENTREPRISE",
    VIDE,
  );

  useEffect(() => {
    if (!donnees.raison_sociale) {
      lireEntreprise()
        .then((ent) => {
          if (ent && ent.raison_sociale) {
            enregistrer({
              raison_sociale: ent.raison_sociale || "",
              adresse: ent.adresse || "",
              ville: ent.ville || "",
              rccm: ent.rccm || "",
              nif: ent.nif || "",
              telephone_contact: ent.telephone_contact || "",
              email_contact: ent.email_contact || "",
              logo: ent.logo || "",
              couleur_primaire: ent.couleur_primaire || COULEUR_TERRE_CUITE_DEFAUT,
            });
            if (ent.couleur_primaire) {
              appliquerCouleurPrimaire(ent.couleur_primaire);
            }
            if (ent.logo) {
              setApercuLogo(ent.logo);
              setLogo({ nom: t("logoActuel"), taille: 0 });
            }
          }
        })
        .catch(() => {
          // Hors-ligne ou erreur : on garde l'état actuel
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function modifier(champ: keyof DonneesEntreprise, valeur: string | boolean) {
    const suite = { ...donnees, [champ]: valeur };
    enregistrer(suite);
    onSaisie(brouillonNonVide(suite));
    if (champ in erreurs) {
      const reste = { ...erreurs };
      delete reste[champ];
      setErreurs(reste);
    }
  }

  function choisirLogo(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    if (!fichier) return;

    if (!FORMATS_LOGO.includes(fichier.type)) {
      setErreurLogo(t("logoFormatInvalide"));
      setFichierLogo(null);
      setApercuLogo(null);
      setLogo(null);
      return;
    }
    if (fichier.size > TAILLE_MAX_LOGO) {
      setErreurLogo(t("logoTropLourd"));
      setFichierLogo(null);
      setApercuLogo(null);
      setLogo(null);
      return;
    }
    setErreurLogo(null);
    modifier("retirer_logo", false);
    setFichierLogo(fichier);
    setLogo({ nom: fichier.name, taille: fichier.size });
    const url = URL.createObjectURL(fichier);
    setApercuLogo(url);

    extraireCouleurDominante(fichier).then((hex) => {
      setCouleurExtraite(hex);
      modifier("couleur_primaire", hex);
      appliquerCouleurPrimaire(hex);
    });
  }

  function retirerLogo() {
    if (apercuLogo && apercuLogo.startsWith("blob:")) {
      URL.revokeObjectURL(apercuLogo);
    }
    setFichierLogo(null);
    setApercuLogo(null);
    setLogo(null);
    setCouleurExtraite(null);
    modifier("retirer_logo", true);
    modifier("couleur_primaire", COULEUR_TERRE_CUITE_DEFAUT);
    appliquerCouleurPrimaire(COULEUR_TERRE_CUITE_DEFAUT);
  }

  function choisirCouleur(hex: string) {
    modifier("couleur_primaire", hex);
    appliquerCouleurPrimaire(hex);
  }

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();

    const trouvees: Record<string, string> = {};
    if (donnees.raison_sociale.trim().length < 2)
      trouvees.raison_sociale = t("erreurNom");
    if (!donnees.adresse.trim()) trouvees.adresse = t("erreurAdresse");
    if (!donnees.ville.trim()) trouvees.ville = t("erreurVille");
    if (!donnees.telephone_contact.trim())
      trouvees.telephone_contact = t("erreurTelephone");
    else if (!telephoneValide(donnees.telephone_contact, pays))
      trouvees.telephone_contact = t("erreurTelephoneIncomplet");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donnees.email_contact))
      trouvees.email_contact = t("erreurEmail");

    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) return;

    setEnvoi(true);
    setEchec(null);
    try {
      const reponse = await enregistrerEntreprise(donnees, fichierLogo);
      setFondNonDetoure(reponse.fond_retire === false);
      oublier();
      onSaisie(false);
      onValide();
    } catch (cause) {
      setEchec((cause as ErreurApi).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={soumettre} noValidate>
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("titre")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("accroche")}</p>
        </div>

        {echec && (
          <Alerte type="erreur" titre={t("echecTitre")}>
            {echec}
          </Alerte>
        )}

        {/* --- Identité : logo à gauche, raison sociale et adresse à droite ----
            Maquette M9 desktop. Sous 1024 px les deux colonnes s'empilent. */}
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* --- Logo — facultatif, il ne bloque jamais l'étape ------------------ */}
          <div className="flex flex-col gap-4">
            <span className="text-sm font-medium text-foreground">{t("logo")}</span>
            {logo ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-4">
                {apercuLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apercuLogo} alt="" className="h-16 w-full object-contain" />
                ) : (
                  <ImageIcon className="text-muted-foreground" aria-hidden="true" />
                )}
                <span className="w-full truncate text-center text-xs font-medium text-foreground">
                  {logo.nom}
                </span>
                <span className="text-xs text-muted-foreground">
                  {logo.taille > 0 ? t("logoTaille", { ko: Math.round(logo.taille / 1024) }) : ""}
                </span>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-medium text-erreur hover:underline"
                  onClick={retirerLogo}
                  aria-label={t("logoRetirer")}
                >
                  <X size={14} aria-hidden="true" />
                  {t("logoRetirer")}
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center hover:bg-accent">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={choisirLogo}
                />
                <ImageIcon className="size-7 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">{t("logoChoisir")}</span>
                <span className="text-xs text-muted-foreground">{t("logoContrainte")}</span>
              </label>
            )}
            {erreurLogo && <p className="text-xs font-medium text-erreur">{erreurLogo}</p>}
            {fondNonDetoure && (
              <p className="text-xs font-medium text-avertissement">{t("logoFondNonDetoure")}</p>
            )}

            {/* --- Personnalisation de la couleur de marque (White-Label) --- */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div>
                <span className="text-sm font-medium text-foreground">{t("couleurTitre")}</span>
                <p className="text-xs text-muted-foreground">{t("couleurAccroche")}</p>
              </div>

              {couleurExtraite && (
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1 text-xs font-medium text-primary-600">
                    <Sparkles size={13} aria-hidden="true" />
                    {t("couleurDetectee")}
                  </span>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left",
                      (donnees.couleur_primaire || "").toLowerCase() === couleurExtraite.toLowerCase()
                        ? "border-primary bg-primary-50"
                        : "border-border hover:bg-accent",
                    )}
                    onClick={() => choisirCouleur(couleurExtraite)}
                    title={t("couleurDetecteeAppliquer", { hex: couleurExtraite })}
                  >
                    <span
                      className="size-5 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: couleurExtraite }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs">{couleurExtraite}</span>
                    {(donnees.couleur_primaire || "").toLowerCase() === couleurExtraite.toLowerCase() && (
                      <span className="ml-auto text-xs font-medium text-primary-600">
                        {t("couleurSelectionnee")}
                      </span>
                    )}
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {couleurExtraite ? t("nuancierAjuster") : t("nuancierTitre")}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {PALETTE_OFFICIELLE.map((teinte) => (
                    <button
                      key={teinte.id}
                      type="button"
                      className={cn(
                        "size-7 shrink-0 rounded-full border-2 transition-transform",
                        (donnees.couleur_primaire || COULEUR_TERRE_CUITE_DEFAUT).toLowerCase() ===
                          teinte.hex.toLowerCase()
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105",
                      )}
                      style={{ backgroundColor: teinte.hex }}
                      title={t("teinteBulle", {
                        nom: t(`palette.${teinte.id}.nom`),
                        description: t(`palette.${teinte.id}.description`),
                        hex: teinte.hex,
                      })}
                      onClick={() => choisirCouleur(teinte.hex)}
                      aria-label={t("teinteEtiquette", {
                        nom: t(`palette.${teinte.id}.nom`),
                        hex: teinte.hex,
                      })}
                    />
                  ))}

                  <label
                    className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-border"
                    title={t("nuancierLibreAide")}
                  >
                    <input
                      type="color"
                      value={donnees.couleur_primaire || COULEUR_TERRE_CUITE_DEFAUT}
                      onChange={(e) => choisirCouleur(e.target.value)}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                      aria-label={t("nuancierLibre")}
                    />
                    <span
                      className="pointer-events-none flex size-full items-center justify-center rounded-full"
                      style={{ backgroundColor: donnees.couleur_primaire || COULEUR_TERRE_CUITE_DEFAUT }}
                    >
                      <Pipette size={12} className="text-neutral-0 mix-blend-difference" aria-hidden="true" />
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Champ
              libelle={t("champRaisonSociale")}
              required
              value={donnees.raison_sociale}
              erreur={erreurs.raison_sociale}
              disabled={envoi || enCours}
              onChange={(e) => modifier("raison_sociale", e.target.value)}
            />

            <Champ
              libelle={t("champAdresse")}
              required
              placeholder={t("champAdresseExemple")}
              value={donnees.adresse}
              erreur={erreurs.adresse}
              disabled={envoi || enCours}
              onChange={(e) => modifier("adresse", e.target.value)}
            />

            {pays && (
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">{t("champPays")}</span>
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Drapeau code={pays} largeur={22} />
                  {nomDePays(pays)}
                </span>
                <span className="text-xs text-muted-foreground">{t("champPaysAide")}</span>
              </div>
            )}

            <SelecteurVille
              pays={pays}
              libelle={t("champVille")}
              required
              valeur={donnees.ville}
              erreur={erreurs.ville}
              disabled={envoi || enCours}
              onChange={(ville) => modifier("ville", ville)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            libelle={t("champRccm")}
            aide={t("champRccmAide")}
            value={donnees.rccm}
            disabled={envoi || enCours}
            onChange={(e) => modifier("rccm", e.target.value)}
          />
          <Champ
            libelle={t("champNif")}
            value={donnees.nif}
            disabled={envoi || enCours}
            onChange={(e) => modifier("nif", e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ChampTelephone
            libelle={t("champTelephone")}
            paysDefaut={pays}
            required
            valeur={donnees.telephone_contact}
            erreur={erreurs.telephone_contact}
            disabled={envoi || enCours}
            onChange={(numero) => modifier("telephone_contact", numero)}
          />
          <Champ
            libelle={t("champEmail")}
            type="email"
            required
            value={donnees.email_contact}
            erreur={erreurs.email_contact}
            disabled={envoi || enCours}
            onChange={(e) => modifier("email_contact", e.target.value)}
          />
        </div>
      </div>

      <footer className="flex justify-end">
        <Bouton type="submit" taille="lg" enCours={envoi || enCours}>
          {t("continuer")}
        </Bouton>
      </footer>
    </form>
  );
}
