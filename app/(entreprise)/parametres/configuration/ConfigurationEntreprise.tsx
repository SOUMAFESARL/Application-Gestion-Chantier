"use client";

import { Building2, Check, MapPin, Plus, Trash2, Upload, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { Drapeau } from "@/components/metier/Drapeau";
import { ComboboxVille } from "@/components/metier/ComboboxVille";
import { Badge, Bouton as BoutonCharte } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  enregistrerEntreprise,
  lireEntreprise,
  paysEntreprise,
} from "@/features/configuration/api";
import type {
  DonneesEntreprise,
  LibelleTelephone,
  TelephoneEntreprise,
} from "@/features/configuration/api";
import {
  TELEPHONES_MAX,
  LIBELLES_TELEPHONE,
  telephonesInitiaux,
  peutAjouterTelephone,
  retirerTelephone,
  definirPrincipal,
  erreursTelephones,
  erreursTelephonesServeur,
} from "@/features/configuration/regles";
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
  telephones: [],
  email_contact: "",
};

/**
 * Le fond d'un champ qui affiche une donnée enregistrée — celui du champ
 * « Pays ». `hover:` : le déclencheur du combobox repasse sinon en blanc au
 * survol.
 */
const FOND_ENREGISTRE = "bg-[var(--input-fond-pre-rempli)] hover:bg-[var(--input-fond-pre-rempli)]";

/** Ce qui est comparé pour savoir si le formulaire a changé. */
function normaliser(donnees: DonneesEntreprise) {
  return {
    ...donnees,
    telephones: undefined,
    retirer_logo: undefined,
  };
}

function normaliserTelephones(telephones?: TelephoneEntreprise[]) {
  return (telephones ?? []).map((t) => ({
    libelle: t.libelle,
    nom: t.nom.trim(),
    numero: t.numero,
    principal: t.principal,
  }));
}

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
 * M8 & M9.
 */
export function ConfigurationEntreprise() {
  const t = useTranslations("configuration.entreprise");
  const tTel = useTranslations("configuration.telephones");
  const idVille = useId();

  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  const [donnees, setDonnees] = useState<DonneesEntreprise>(VIDE);
  // Ce qui était en base à l'arrivée — sert à colorer les champs qui n'ont
  // pas bougé et à savoir si « Enregistrer » doit être cliquable.
  const [reference, setReference] = useState<DonneesEntreprise>(VIDE);
  const [pays, setPays] = useState<string>("");

  const [fichierLogo, setFichierLogo] = useState<File | null>(null);
  const [apercuLogo, setApercuLogo] = useState<string | null>(null);
  const [logo, setLogo] = useState<{ nom: string; taille: number } | null>(null);
  const [erreurLogo, setErreurLogo] = useState<string | null>(null);
  const [fondNonDetoure, setFondNonDetoure] = useState(false);

  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  // Une clé stable par ligne de téléphone, parallèle à `donnees.telephones` : avec
  // l'index pour clé, retirer une ligne ferait hériter sa voisine de l'état du
  // sélecteur d'indicatif de la ligne retirée.
  const compteurCles = useRef(0);
  const [clesTelephones, setClesTelephones] = useState<number[]>([]);
  // L'index de la ligne qui doit prendre le focus à son prochain rendu.
  const indexAFocaliser = useRef<number | null>(null);

  function genererCles(nombre: number): number[] {
    return Array.from({ length: nombre }, () => compteurCles.current++);
  }

  useEffect(() => {
    let vivant = true;
    paysEntreprise().then((p) => {
      if (vivant) setPays(p);
    });
    lireEntreprise()
      .then((entreprise) => {
        if (!vivant) return;
        const initialises = {
          ...entreprise,
          telephones: telephonesInitiaux(entreprise),
        };
        setDonnees(initialises);
        setReference(initialises);
        setClesTelephones(genererCles(initialises.telephones.length));
        if (entreprise.logo) {
          setApercuLogo(entreprise.logo);
          setLogo({ nom: t("logoActuel"), taille: 0 });
        }
      })
      .catch((cause) => {
        if (vivant) setEchec((cause as ErreurApi).message);
      })
      .finally(() => {
        if (vivant) setChargement(false);
      });
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function modifier(champ: keyof DonneesEntreprise, valeur: string | string[] | boolean) {
    setDonnees((precedent) => ({ ...precedent, [champ]: valeur }));
    effacerErreur(champ);
  }

  function effacerErreur(cle: string) {
    if (cle in erreurs) {
      const reste = { ...erreurs };
      delete reste[cle];
      setErreurs(reste);
    }
  }

  function modifierTelephone(index: number, modifs: Partial<TelephoneEntreprise>) {
    setDonnees((prec) => {
      const copie = [...(prec.telephones ?? [])];
      if (copie[index]) {
        copie[index] = { ...copie[index], ...modifs };
      }
      return { ...prec, telephones: copie };
    });
    if ("numero" in modifs) {
      effacerErreur(`telephones.${index}.numero`);
    }
    effacerErreur("telephones");
  }

  function ajouterTelephone() {
    const actuels = donnees.telephones ?? [];
    if (!peutAjouterTelephone(actuels)) return;
    indexAFocaliser.current = actuels.length;
    const nouvelleCle = genererCles(1);
    setClesTelephones((prec) => [...prec, ...nouvelleCle]);
    setDonnees((prec) => ({
      ...prec,
      telephones: [
        ...(prec.telephones ?? []),
        {
          id: null,
          libelle: "MOBILE",
          nom: "",
          numero: "",
          principal: (prec.telephones ?? []).length === 0,
        },
      ],
    }));
  }

  function estEnregistre(valeur: string | undefined, enregistree: string | undefined) {
    return Boolean(valeur) && valeur === enregistree;
  }

  function classeEnregistre(valeur: string | undefined, enregistree: string | undefined) {
    return estEnregistre(valeur, enregistree) ? FOND_ENREGISTRE : undefined;
  }

  const modifie =
    fichierLogo !== null ||
    donnees.retirer_logo === true ||
    JSON.stringify(normaliser(donnees)) !== JSON.stringify(normaliser(reference)) ||
    JSON.stringify(normaliserTelephones(donnees.telephones)) !==
      JSON.stringify(normaliserTelephones(reference.telephones));

  function choisirLogo(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    if (!fichier) return;

    if (!FORMATS_LOGO.includes(fichier.type)) {
      setErreurLogo(t("logoFormatInvalide"));
      return;
    }
    if (fichier.size > TAILLE_MAX_LOGO) {
      setErreurLogo(t("logoTropLourd"));
      return;
    }

    setErreurLogo(null);
    setFichierLogo(fichier);
    setLogo({ nom: fichier.name, taille: fichier.size });
    modifier("retirer_logo", false);

    if (apercuLogo && apercuLogo.startsWith("blob:")) {
      URL.revokeObjectURL(apercuLogo);
    }
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
    if (donnees.raison_sociale.trim().length < 2) trouvees.raison_sociale = t("erreurNom");
    if (!donnees.adresse.trim()) trouvees.adresse = t("erreurAdresse");
    if (!donnees.ville.trim()) trouvees.ville = t("erreurVille");

    const email = donnees.email_contact.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      trouvees.email_contact = t("erreurEmail");

    // Contrôles des téléphones
    const erreursTel = erreursTelephones(donnees.telephones ?? [], pays);
    Object.assign(trouvees, erreursTel);

    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) return;

    setEnvoi(true);
    setEchec(null);
    try {
      const reponse = await enregistrerEntreprise(donnees, fichierLogo);
      setFondNonDetoure(reponse.fond_retire === false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { couleur_primaire, ...sansCouleur } = reponse;
      const enregistrees: DonneesEntreprise = {
        ...donnees,
        ...sansCouleur,
        telephones: reponse.telephones ?? donnees.telephones,
        retirer_logo: undefined,
      };
      setDonnees(enregistrees);
      setReference(enregistrees);
      setClesTelephones(genererCles((enregistrees.telephones ?? []).length));
      if (reponse.logo) {
        setApercuLogo(reponse.logo);
        setLogo({ nom: t("logoActuel"), taille: 0 });
      }
      setFichierLogo(null);
      toast.success(t("succesTitre"), { description: t("succes") });
    } catch (cause) {
      if (cause instanceof ErreurApi && cause.details) {
        const erreursServ = erreursTelephonesServeur(cause.details);
        if (Object.keys(erreursServ).length > 0) {
          setErreurs((prec) => ({ ...prec, ...erreursServ }));
        }
      }
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

  const listeTelephones = donnees.telephones ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {enTete}

      <form className="flex flex-col gap-6" onSubmit={soumettre} noValidate aria-live="polite">
        {echec && (
          <Alerte type="erreur" titre={t("echecTitre")}>
            {echec}
          </Alerte>
        )}

        {/* --- Identité : logo à gauche, champs sur deux colonnes à droite --- */}
        <SectionCarte
          icone={Building2}
          titre={t("sectionIdentite")}
          aide={t("sectionIdentiteAide")}
        >
          <div className="grid gap-6 md:grid-cols-[200px_1fr]">
            {/* Colonne logo */}
            <div className="flex flex-col gap-2">
              <Label>{t("logo")}</Label>
              {apercuLogo ? (
                <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={apercuLogo}
                    alt={logo?.nom ?? t("logo")}
                    className="size-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={retirerLogo}
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-neutral-0/90 text-neutral-600 shadow-sm transition-colors hover:bg-neutral-0 hover:text-erreur"
                    aria-label={t("logoRetirer")}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <label className="group flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-4 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/50">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    onChange={choisirLogo}
                    disabled={envoi}
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
                <Alerte type="avertissement">{t("logoFondNonDetoure")}</Alerte>
              )}
            </div>

            {/* Colonne champs d'identification */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Champ
                  libelle={t("champRaisonSociale")}
                  required
                  value={donnees.raison_sociale}
                  data-pre-rempli={estEnregistre(
                    donnees.raison_sociale,
                    reference.raison_sociale,
                  )}
                  erreur={erreurs.raison_sociale}
                  disabled={envoi}
                  onChange={(e) => modifier("raison_sociale", e.target.value)}
                />
              </div>
              <Champ
                libelle={t("champRccm")}
                aide={t("champRccmAide")}
                value={donnees.rccm}
                data-pre-rempli={estEnregistre(donnees.rccm, reference.rccm)}
                disabled={envoi}
                onChange={(e) => modifier("rccm", e.target.value)}
              />
              <Champ
                libelle={t("champNif")}
                value={donnees.nif}
                data-pre-rempli={estEnregistre(donnees.nif, reference.nif)}
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
                <Label>{t("champPays")}</Label>
                <div className="flex h-[var(--input-height)] items-center gap-2 rounded-md border border-input bg-[var(--input-fond-pre-rempli)] px-[var(--input-padding-x)] text-base text-foreground">
                  <Drapeau code={pays} largeur={20} />
                  {nomDePays(pays)}
                </div>
                <p className="text-xs text-muted-foreground">{t("champPaysAide")}</p>
              </div>
            )}
            {/* Même combobox que « Type de projet » et la ville d'un projet. */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={idVille}>
                {t("champVille")}
                <span className="text-erreur" aria-hidden="true">
                  *
                </span>
              </Label>
              <ComboboxVille
                id={idVille}
                pays={pays}
                valeur={donnees.ville}
                className={classeEnregistre(donnees.ville, reference.ville)}
                disabled={envoi}
                aria-invalid={Boolean(erreurs.ville) || undefined}
                aria-describedby={erreurs.ville ? `${idVille}-erreur` : undefined}
                onChange={(ville) => modifier("ville", ville)}
              />
              {erreurs.ville && (
                <p id={`${idVille}-erreur`} className="text-xs font-medium text-erreur">
                  {erreurs.ville}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Champ
                libelle={t("champAdresse")}
                required
                placeholder={t("champAdresseExemple")}
                value={donnees.adresse}
                data-pre-rempli={estEnregistre(donnees.adresse, reference.adresse)}
                erreur={erreurs.adresse}
                disabled={envoi}
                onChange={(e) => modifier("adresse", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Champ
                libelle={t("champEmail")}
                type="email"
                value={donnees.email_contact}
                data-pre-rempli={estEnregistre(donnees.email_contact, reference.email_contact)}
                erreur={erreurs.email_contact}
                disabled={envoi}
                onChange={(e) => modifier("email_contact", e.target.value)}
              />
            </div>

            {/* Bloc Numéros de contact */}
            <div className="flex flex-col gap-3 sm:col-span-2">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-semibold text-foreground">
                    {tTel("titre")}
                  </Label>
                  <span className="text-erreur" aria-hidden="true">
                    *
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{tTel("aide")}</p>
              </div>

              <div className="flex flex-col gap-3">
                {listeTelephones.map((tel, index) => (
                  <div
                    key={clesTelephones[index] ?? `ligne-${index}`}
                    className="flex flex-col gap-2 rounded-lg border border-border/40 p-3 sm:grid sm:grid-cols-[10rem_1fr] sm:items-start lg:grid-cols-[10rem_12rem_1fr_auto] lg:border-0 lg:p-0"
                  >
                    <div className="w-full">
                      <Select
                        value={tel.libelle}
                        onValueChange={(val) =>
                          modifierTelephone(index, { libelle: val as LibelleTelephone })
                        }
                        disabled={envoi}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={tTel("libelle")} />
                        </SelectTrigger>
                        <SelectContent>
                          {LIBELLES_TELEPHONE.map((code) => (
                            <SelectItem key={code} value={code}>
                              {tTel(`libelles.${code}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {erreurs[`telephones.${index}.libelle`] && (
                        <p className="mt-1 text-xs font-medium text-erreur">
                          {erreurs[`telephones.${index}.libelle`]}
                        </p>
                      )}
                    </div>

                    <div className="min-w-0">
                      <Input
                        value={tel.nom}
                        maxLength={60}
                        placeholder={tTel("nomPlaceholder")}
                        aria-label={tTel("nom")}
                        aria-invalid={Boolean(erreurs[`telephones.${index}.nom`])}
                        className={classeEnregistre(tel.nom, reference.telephones?.[index]?.nom)}
                        disabled={envoi}
                        onChange={(e) => modifierTelephone(index, { nom: e.target.value })}
                      />
                      {erreurs[`telephones.${index}.nom`] && (
                        <p className="mt-1 text-xs font-medium text-erreur">
                          {erreurs[`telephones.${index}.nom`]}
                        </p>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 sm:col-span-2 lg:col-span-1">
                      <ChampTelephone
                        paysDefaut={pays}
                        international
                        valeur={tel.numero}
                        className={classeEnregistre(
                          tel.numero,
                          reference.telephones?.[index]?.numero,
                        )}
                        erreur={erreurs[`telephones.${index}.numero`]}
                        disabled={envoi}
                        refChamp={(champ) => {
                          if (champ && indexAFocaliser.current === index) {
                            indexAFocaliser.current = null;
                            champ.focus();
                          }
                        }}
                        onChange={(valeur) => modifierTelephone(index, { numero: valeur })}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 sm:col-span-2 lg:col-span-1 lg:pt-0">
                      {tel.principal ? (
                        <Badge variante="primaire">{tTel("principal")}</Badge>
                      ) : (
                        <Bouton
                          type="button"
                          variante="ghost"
                          taille="sm"
                          disabled={envoi}
                          onClick={() => {
                            setDonnees((prec) => ({
                              ...prec,
                              telephones: definirPrincipal(prec.telephones ?? [], index),
                            }));
                            effacerErreur("telephones");
                          }}
                        >
                          {tTel("definirPrincipal")}
                        </Bouton>
                      )}
                      <Bouton
                        type="button"
                        variante="ghost"
                        className="text-erreur hover:bg-erreur-fond hover:text-erreur"
                        aria-label={tTel("retirer")}
                        disabled={envoi || listeTelephones.length <= 1}
                        onClick={() => {
                          setClesTelephones((prec) => prec.filter((_, i) => i !== index));
                          setDonnees((prec) => ({
                            ...prec,
                            telephones: retirerTelephone(prec.telephones ?? [], index),
                          }));
                          setErreurs((precedentes) =>
                            Object.fromEntries(
                              Object.entries(precedentes).filter(
                                ([cle]) => !cle.startsWith("telephones."),
                              ),
                            ),
                          );
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Bouton>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center gap-3">
                  <BoutonCharte
                    type="button"
                    variante="secondaire"
                    taille="sm"
                    disabled={envoi || !peutAjouterTelephone(listeTelephones)}
                    onClick={ajouterTelephone}
                    iconeGauche={<Plus className="size-4" aria-hidden="true" />}
                  >
                    {tTel("ajouter")}
                  </BoutonCharte>
                  {listeTelephones.length >= TELEPHONES_MAX && (
                    <span className="text-xs text-muted-foreground">{tTel("maximum")}</span>
                  )}
                </div>
                {erreurs.telephones && (
                  <p className="text-xs font-medium text-erreur">{erreurs.telephones}</p>
                )}
              </div>
            </div>
          </div>
        </SectionCarte>

        <footer className="flex flex-col-reverse items-stretch gap-3 rounded-xl border border-primary-100 bg-primary-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{t("champsObligatoires")}</p>
          <Bouton
            type="submit"
            taille="lg"
            enCours={envoi}
            disabled={!modifie}
            iconeGauche={<Check aria-hidden="true" />}
          >
            {t("enregistrer")}
          </Bouton>
        </footer>
      </form>
    </div>
  );
}
