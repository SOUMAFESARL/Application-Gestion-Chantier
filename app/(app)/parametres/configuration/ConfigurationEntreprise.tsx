"use client";

import { Building2, Check, ImageIcon, MapPin, Upload, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { Drapeau } from "@/components/metier/Drapeau";
import { SelecteurVille } from "@/components/metier/SelecteurVille";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  enregistrerEntreprise,
  lireEntreprise,
  paysEntreprise,
} from "@/features/configuration/api";
import type { DonneesEntreprise } from "@/features/configuration/api";
import { telephoneValide } from "@/features/referentiels/telephone";
import { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { nomDePays } from "@/lib/format";

import { Alerte, Bouton, Champ, EtatChargement } from "./_ui";

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

/**
 * Une section du formulaire : une carte avec son pictogramme, son titre et
 * une phrase qui dit à quoi servent les champs qu'elle regroupe.
 */
function SectionCarte({
  icone: Icone,
  titre,
  aide,
  className,
  children,
}: {
  icone: LucideIcon;
  titre: string;
  aide: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("gap-5", className)}>
      <CardHeader className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Icone className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base text-neutral-900">{titre}</CardTitle>
          <CardDescription>{aide}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

/**
 * Configuration de l'entreprise — écran de paramètres, accessible à tout
 * moment (le wizard d'onboarding qui l'enchaînait avec un premier projet et
 * une invitation d'équipe a été retiré).
 *
 * **Toujours relue au montage, jamais mise en cache locale.** L'ancienne
 * version gardait une saisie en cours dans `sessionStorage` et ne rappelait
 * `/entreprise/` que si ce brouillon était vide — ce qui pouvait laisser voir
 * une saisie partielle et périmée d'une visite précédente au lieu de l'état
 * réellement enregistré. Cet écran affiche systématiquement ce que le
 * serveur porte, et n'écrit qu'au clic sur « Enregistrer ».
 *
 * **La couleur de marque par entreprise est supprimée.** L'écran ne lit ni
 * n'envoie `couleur_primaire` : l'espace entreprise affiche l'orange des
 * jetons, comme l'administration.
 *
 * **Elle écrit dans `public`.** `entreprise_cliente` est la table de la
 * plateforme : c'est elle qui porte le `schema_name` que le middleware lit à
 * chaque requête, elle ne peut pas vivre dans le schéma qu'elle nomme
 * (T-022 §3.2).
 */
export function ConfigurationEntreprise() {
  const t = useTranslations("configuration.entreprise");
  const [chargement, setChargement] = useState(true);
  const [donnees, setDonnees] = useState<DonneesEntreprise>(VIDE);
  const [logo, setLogo] = useState<{ nom: string; taille: number } | null>(null);
  const [fichierLogo, setFichierLogo] = useState<File | null>(null);
  const [apercuLogo, setApercuLogo] = useState<string | null>(null);
  const [erreurLogo, setErreurLogo] = useState<string | null>(null);
  const [fondNonDetoure, setFondNonDetoure] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [pays, setPays] = useState("");

  useEffect(() => {
    let vivant = true;
    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });
    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    let vivant = true;
    lireEntreprise()
      .then((ent) => {
        if (!vivant) return;
        setDonnees({
          raison_sociale: ent.raison_sociale || "",
          adresse: ent.adresse || "",
          ville: ent.ville || "",
          rccm: ent.rccm || "",
          nif: ent.nif || "",
          telephone_contact: ent.telephone_contact || "",
          email_contact: ent.email_contact || "",
        });
        if (ent.logo) {
          setApercuLogo(ent.logo);
          setLogo({ nom: t("logoActuel"), taille: 0 });
        }
      })
      .catch(() => {
        // Hors-ligne ou erreur : le formulaire reste vide, modifiable quand même.
      })
      .finally(() => {
        if (vivant) setChargement(false);
      });
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function modifier(champ: keyof DonneesEntreprise, valeur: string | boolean) {
    setDonnees((precedent) => ({ ...precedent, [champ]: valeur }));
    setSucces(false);
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
    setApercuLogo(URL.createObjectURL(fichier));
  }

  function retirerLogo() {
    if (apercuLogo && apercuLogo.startsWith("blob:")) {
      URL.revokeObjectURL(apercuLogo);
    }
    setFichierLogo(null);
    setApercuLogo(null);
    setLogo(null);
    modifier("retirer_logo", true);
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
    // Facultatif : on ne contrôle le format que d'un email réellement saisi.
    const email = donnees.email_contact.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      trouvees.email_contact = t("erreurEmail");

    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) return;

    setEnvoi(true);
    setEchec(null);
    setSucces(false);
    try {
      const reponse = await enregistrerEntreprise(donnees, fichierLogo);
      setFondNonDetoure(reponse.fond_retire === false);
      // `couleur_primaire` n'est pas reprise : l'écran ne doit pas la renvoyer.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { couleur_primaire, ...sansCouleur } = reponse;
      setDonnees((precedent) => ({ ...precedent, ...sansCouleur, retirer_logo: undefined }));
      if (reponse.logo) {
        setApercuLogo(reponse.logo);
        setLogo({ nom: t("logoActuel"), taille: 0 });
      }
      setFichierLogo(null);
      setSucces(true);
    } catch (cause) {
      setEchec((cause as ErreurApi).message);
    } finally {
      setEnvoi(false);
    }
  }

  const enTete = (
    <div className="flex flex-col items-center gap-4">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-8 ring-primary-50/50">
        <Building2 className="size-7" aria-hidden="true" />
      </span>
      <EnTetePage
        titre={t("titre")}
        description={t("accroche")}
        className="justify-center text-center"
      />
    </div>
  );

  if (chargement) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        {enTete}
        <Card>
          <CardContent>
            <EtatChargement message={t("chargement")} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {enTete}

      <form className="flex flex-col gap-6" onSubmit={soumettre} noValidate aria-live="polite">
        {echec && (
          <Alerte type="erreur" titre={t("echecTitre")}>
            {echec}
          </Alerte>
        )}

        {succes && (
          <Alerte type="succes" titre={t("succesTitre")}>
            {t("succes")}
          </Alerte>
        )}

        {/* --- Identité : logo à gauche, champs sur deux colonnes à droite --- */}
        <SectionCarte icone={Building2} titre={t("sectionIdentite")} aide={t("sectionIdentiteAide")}>
          <div className="grid gap-6 md:grid-cols-[200px_1fr]">
            {/* Logo — facultatif, il ne bloque jamais l'enregistrement. */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">{t("logo")}</span>
              {logo ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-neutral-50 p-3">
                  <div className="flex h-20 w-full items-center justify-center rounded-lg bg-neutral-0 p-2">
                    {apercuLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={apercuLogo} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <ImageIcon className="size-7 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex w-full min-w-0 flex-col items-center">
                    <span className="w-full truncate text-center text-xs font-medium text-foreground">
                      {logo.nom}
                    </span>
                    {logo.taille > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {t("logoTaille", { ko: Math.round(logo.taille / 1024) })}
                      </span>
                    )}
                  </div>
                  <Bouton
                    variante="ghost"
                    taille="sm"
                    className="text-erreur hover:bg-erreur-fond hover:text-erreur"
                    onClick={retirerLogo}
                    iconeGauche={<X aria-hidden="true" />}
                  >
                    {t("logoRetirer")}
                  </Bouton>
                </div>
              ) : (
                <label className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-neutral-50 px-4 py-6 text-center transition-colors hover:border-primary-300 hover:bg-primary-50 focus-within:border-primary focus-within:bg-primary-50">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    onChange={choisirLogo}
                  />
                  <span className="flex size-11 items-center justify-center rounded-full bg-neutral-0 text-primary-600 shadow-sm transition-transform group-hover:scale-105">
                    <Upload className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{t("logoChoisir")}</span>
                  <span className="text-xs text-muted-foreground">{t("logoContrainte")}</span>
                </label>
              )}
              {erreurLogo && <p className="text-xs font-medium text-erreur">{erreurLogo}</p>}
              {fondNonDetoure && (
                <p className="text-xs font-medium text-avertissement">{t("logoFondNonDetoure")}</p>
              )}
            </div>

            <div className="grid content-start gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Champ
                  libelle={t("champRaisonSociale")}
                  required
                  value={donnees.raison_sociale}
                  erreur={erreurs.raison_sociale}
                  disabled={envoi}
                  onChange={(e) => modifier("raison_sociale", e.target.value)}
                />
              </div>
              <Champ
                libelle={t("champRccm")}
                aide={t("champRccmAide")}
                value={donnees.rccm}
                disabled={envoi}
                onChange={(e) => modifier("rccm", e.target.value)}
              />
              <Champ
                libelle={t("champNif")}
                value={donnees.nif}
                disabled={envoi}
                onChange={(e) => modifier("nif", e.target.value)}
              />
            </div>
          </div>
        </SectionCarte>

        {/* --- Coordonnées, sur deux colonnes ------------------------------ */}
        <SectionCarte
          icone={MapPin}
          titre={t("sectionCoordonnees")}
          aide={t("sectionCoordonneesAide")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {pays && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">{t("champPays")}</span>
                <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted px-3 text-sm font-medium text-foreground">
                  <Drapeau code={pays} largeur={20} />
                  {nomDePays(pays)}
                </div>
                <p className="text-xs text-muted-foreground">{t("champPaysAide")}</p>
              </div>
            )}
            <SelecteurVille
              pays={pays}
              libelle={t("champVille")}
              required
              valeur={donnees.ville}
              erreur={erreurs.ville}
              disabled={envoi}
              onChange={(ville) => modifier("ville", ville)}
            />
            <div className="sm:col-span-2">
              <Champ
                libelle={t("champAdresse")}
                required
                placeholder={t("champAdresseExemple")}
                value={donnees.adresse}
                erreur={erreurs.adresse}
                disabled={envoi}
                onChange={(e) => modifier("adresse", e.target.value)}
              />
            </div>
            <ChampTelephone
              libelle={t("champTelephone")}
              paysDefaut={pays}
              required
              valeur={donnees.telephone_contact}
              erreur={erreurs.telephone_contact}
              disabled={envoi}
              onChange={(numero) => modifier("telephone_contact", numero)}
            />
            <Champ
              libelle={t("champEmail")}
              type="email"
              value={donnees.email_contact}
              erreur={erreurs.email_contact}
              disabled={envoi}
              onChange={(e) => modifier("email_contact", e.target.value)}
            />
          </div>
        </SectionCarte>

        <footer className="flex flex-col-reverse items-stretch gap-3 rounded-xl border border-primary-100 bg-primary-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{t("champsObligatoires")}</p>
          <Bouton type="submit" taille="lg" enCours={envoi} iconeGauche={<Check aria-hidden="true" />}>
            {t("enregistrer")}
          </Bouton>
        </footer>
      </form>
    </div>
  );
}
