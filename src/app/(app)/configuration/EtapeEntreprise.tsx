"use client";

import {
  CheckCircle,
  Circle,
  Eyedropper,
  Image as ImageIcone,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { Drapeau } from "@/components/metier/Drapeau";
import { SelecteurVille } from "@/components/metier/SelecteurVille";
import { Alerte, Bouton, Champ } from "@/components/ui";
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
import { nomDePays } from "@/lib/format";
import {
  appliquerCouleurPrimaire,
  COULEUR_TERRE_CUITE_DEFAUT,
  extraireCouleurDominante,
  PALETTE_OFFICIELLE,
} from "@/styles/theme";

import styles from "./page.module.css";

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
  /**
   * Le pays de l'entreprise — **hors du brouillon**, et chargé sans condition.
   *
   * Le brouillon garde ce que la personne a saisi, dans son navigateur ; le
   * pays vient du serveur et ne se modifie pas ici. L'avoir rangé avec les
   * autres champs l'avait rendu invisible : la lecture de l'entreprise ne se
   * déclenche que si le brouillon est vide, or un brouillon rempli hier ne
   * pouvait pas contenir un champ qui n'existait pas encore.
   */
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

  // Restauration et sauvegarde du brouillon — T-022 §7.1.
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
      // Le serveur répondrait `413` ; le refuser ici évite d'envoyer 5 Mo sur
      // une liaison 3G pour rien.
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
    // `logo` est calculé côté serveur depuis une clé de stockage : lui envoyer
    // une chaîne vide n'efface plus rien. L'intention se déclare.
    modifier("retirer_logo", true);
    modifier("couleur_primaire", COULEUR_TERRE_CUITE_DEFAUT);
    appliquerCouleurPrimaire(COULEUR_TERRE_CUITE_DEFAUT);
  }

  function choisirCouleur(hex: string) {
    modifier("couleur_primaire", hex);
    appliquerCouleurPrimaire(hex);
  }

  // La liste porte des CLÉS, pas des phrases : ce tableau vit hors du JSX, là
  // où la règle `no-literal-string` ne regarde pas — c'est exactement l'endroit
  // où un texte en dur se réinstalle sans que rien ne le signale.
  const controles = [
    { cle: "nom", satisfait: donnees.raison_sociale.trim().length > 1 },
    { cle: "adresse", satisfait: donnees.adresse.trim().length > 0 },
    { cle: "ville", satisfait: donnees.ville.trim().length > 0 },
    { cle: "telephone", satisfait: donnees.telephone_contact.trim().length > 0 },
    { cle: "email", satisfait: donnees.email_contact.trim().length > 0 },
  ];

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();

    const trouvees: Record<string, string> = {};
    if (donnees.raison_sociale.trim().length < 2)
      trouvees.raison_sociale = t("erreurNom");
    if (!donnees.adresse.trim()) trouvees.adresse = t("erreurAdresse");
    if (!donnees.ville.trim()) trouvees.ville = t("erreurVille");
    if (!donnees.telephone_contact.trim())
      trouvees.telephone_contact = t("erreurTelephone");
    // Le champ n'acceptait que « non vide ». Un numéro à trois chiffres
    // passait, et c'est le contact de l'entreprise : celui qu'on appelle
    // quand un chantier s'arrête.
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
      // Le détourage a échoué : le logo s'affichera sur son rectangle. Ce
      // n'est pas une erreur — l'étape passe — mais la personne doit
      // l'apprendre ici, et non en découvrant la barre trois écrans plus loin.
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
    <form className={styles.etape} onSubmit={soumettre} noValidate>
      <div className={styles.colonneFormulaire}>
        <h2 className={styles.etapeTitre}>{t("titre")}</h2>
        <p className={styles.etapeAccroche}>{t("accroche")}</p>

        {echec && (
          <Alerte type="erreur" titre={t("echecTitre")}>
            {echec}
          </Alerte>
        )}

        {/* --- Identité : logo à gauche, raison sociale et adresse à droite ----
            Maquette M9 desktop. Sous 1024 px les deux colonnes s'empilent —
            le cadre mobile de la maquette montre exactement cet ordre. */}
        <div className={styles.blocIdentite}>
        {/* --- Logo — facultatif, il ne bloque jamais l'étape ------------------ */}
        <div className={styles.champLogo}>
          <span className={styles.libelleBloc}>{t("logo")}</span>
          {logo ? (
            <div className={styles.logoChoisi}>
              {apercuLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={apercuLogo} alt="" className={styles.logoApercuImg} />
              ) : (
                <ImageIcone size={20} aria-hidden="true" />
              )}
              <span className={styles.logoNom}>{logo.nom}</span>
              <span className={styles.logoTaille}>
                {logo.taille > 0 ? t("logoTaille", { ko: Math.round(logo.taille / 1024) }) : ""}
              </span>
              <button
                type="button"
                className={styles.logoRetirer}
                onClick={retirerLogo}
                aria-label={t("logoRetirer")}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label className={styles.depot}>
              <input
                type="file"
                accept="image/png,image/jpeg"
                className={styles.depotEntree}
                onChange={choisirLogo}
              />
              <ImageIcone size={28} aria-hidden="true" />
              <span className={styles.depotTitre}>{t("logoChoisir")}</span>
              <span className={styles.depotAide}>{t("logoContrainte")}</span>
            </label>
          )}
          {erreurLogo && <p className={styles.messageErreur}>{erreurLogo}</p>}
          {fondNonDetoure && <p className={styles.messageAvis}>{t("logoFondNonDetoure")}</p>}

          {/* --- Personnalisation de la couleur de marque (White-Label) --- */}
          <div className={styles.champCouleur}>
            <div className={styles.champCouleurEntete}>
              <span className={styles.libelleBloc}>{t("couleurTitre")}</span>
              <span className={styles.aideSousTitre}>{t("couleurAccroche")}</span>
            </div>

            {/* 1. Pastille dédiée de la couleur détectée depuis le logo */}
            {couleurExtraite && (
              <div className={styles.blocCouleurDetectee}>
                <span className={styles.libelleDetectee}>
                  <Sparkle size={15} weight="fill" className={styles.iconeMagique} aria-hidden="true" />
                  {t("couleurDetectee")}
                </span>
                <button
                  type="button"
                  className={`${styles.pastilleDetecteeBouton} ${
                    (donnees.couleur_primaire || "").toLowerCase() === couleurExtraite.toLowerCase()
                      ? styles.pastilleDetecteeActive
                      : ""
                  }`}
                  onClick={() => choisirCouleur(couleurExtraite)}
                  title={t("couleurDetecteeAppliquer", { hex: couleurExtraite })}
                >
                  <span
                    className={styles.pastilleDetecteeCarre}
                    style={{ backgroundColor: couleurExtraite }}
                    aria-hidden="true"
                  />
                  <span className={styles.codeHexa}>{couleurExtraite}</span>
                  {(donnees.couleur_primaire || "").toLowerCase() === couleurExtraite.toLowerCase() && (
                    <span className={styles.badgeActif}>{t("couleurSelectionnee")}</span>
                  )}
                </button>
              </div>
            )}

            {/* 2. Ajustement : Palette officielle & Nuancier libre */}
            <div className={styles.sectionAjustement}>
              <span className={styles.libelleAjuster}>
                {couleurExtraite ? t("nuancierAjuster") : t("nuancierTitre")}
              </span>

              <div className={styles.paletteLigne}>
                {PALETTE_OFFICIELLE.map((teinte) => (
                  <button
                    key={teinte.id}
                    type="button"
                    className={`${styles.pastilleCouleur} ${
                      (donnees.couleur_primaire || COULEUR_TERRE_CUITE_DEFAUT).toLowerCase() ===
                      teinte.hex.toLowerCase()
                        ? styles.pastilleActive
                        : ""
                    }`}
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
                  className={styles.selecteurCouleurPerso}
                  title={t("nuancierLibreAide")}
                >
                  <input
                    type="color"
                    value={donnees.couleur_primaire || COULEUR_TERRE_CUITE_DEFAUT}
                    onChange={(e) => choisirCouleur(e.target.value)}
                    className={styles.inputCouleurInvisible}
                    aria-label={t("nuancierLibre")}
                  />
                  <span
                    className={styles.pastillePersoApercu}
                    style={{ backgroundColor: donnees.couleur_primaire || COULEUR_TERRE_CUITE_DEFAUT }}
                  >
                    <Eyedropper size={12} weight="bold" className={styles.iconePipette} aria-hidden="true" />
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.champsIdentite}>
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

        {/* Le pays ne se saisit pas : il vient de l'inscription. Il s'affiche
            quand même, parce que c'est lui qui explique la liste de villes
            juste en dessous — sans lui, une liste sénégalaise chez un client
            ivoirien ressemblerait à un défaut. */}
        {pays && (
          <div className={styles.paysFige}>
            <span className={styles.paysFigeLibelle}>{t("champPays")}</span>
            <span className={styles.paysFigeValeur}>
              <Drapeau code={pays} largeur={22} />
              {nomDePays(pays)}
            </span>
            <span className={styles.paysFigeAide}>{t("champPaysAide")}</span>
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

        <div className={styles.duo}>
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

        <div className={styles.duo}>
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

      {/* --- Contrôles — seulement les champs obligatoires (T-022 §3.4) ------- */}
      <aside className={styles.controles} aria-live="polite">
        <h3 className={styles.controlesTitre}>{t("aRenseigner")}</h3>
        <ul>
          {controles.map((controle) => (
            <li
              key={controle.cle}
              className={controle.satisfait ? styles.controleValide : styles.controle}
            >
              {controle.satisfait ? (
                <CheckCircle size={16} weight="fill" aria-hidden="true" />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              {t(`controle.${controle.cle}`)}
            </li>
          ))}
        </ul>
      </aside>

      <footer className={styles.actions}>
        <Bouton type="submit" taille="lg" enCours={envoi || enCours}>
          {t("continuer")}
        </Bouton>
      </footer>
    </form>
  );
}
