"use client";

import {
  Bell,
  Buildings,
  Calendar,
  CaretDown,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  CurrencyCircleDollar,
  DotsThreeCircle,
  Folder,
  Gear,
  Handshake,
  HardHat,
  IdentificationCard,
  Package,
  ShieldCheck,
  ShoppingCart,
  SquaresFour,
  Sun,
  Truck,
  Users,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { MarqueCCD } from "@/components/layout/MarqueCCD";
import { BadgeEssai } from "@/components/metier/BadgeEssai";
import { EVENEMENT_SESSION_EXPIREE, sessionOuverte } from "@/lib/api";
import { lireAbonnement } from "@/features/abonnement/api";
import type { Abonnement } from "@/features/abonnement/api";
import { obtenirProfilMoi } from "@/features/auth/api";
import type { ProfilUtilisateur } from "@/features/auth/api";
import { EVENEMENT_ENTREPRISE_MODIFIEE, lireEntreprise } from "@/features/configuration/api";
import type { DonneesEntreprise } from "@/features/configuration/api";
import { obtenirMeteo } from "@/features/projets/api";
import type { MeteoProjet } from "@/features/projets/api";
import { appliquerCouleurPrimaire } from "@/styles/theme";

import styles from "./layout.module.css";

interface LayoutAppProps {
  children: React.ReactNode;
}

const abonnementSession = (rappel: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENEMENT_SESSION_EXPIREE, rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener(EVENEMENT_SESSION_EXPIREE, rappel);
    window.removeEventListener("storage", rappel);
  };
};

function IconeMeteo({
  condition,
  description,
  disponible,
}: {
  condition?: string | null;
  description?: string | null;
  disponible?: boolean;
}) {
  if (!disponible) {
    return <Cloud size={16} weight="regular" style={{ color: "var(--color-neutral-400, #A8A29E)" }} />;
  }

  const cond = condition || "";
  if (cond === "ORAGE") {
    return <CloudLightning size={16} weight="fill" style={{ color: "var(--color-danger-500, #DC2626)" }} />;
  }
  if (cond === "PLUIE" || cond === "AVERSES" || cond === "BRUINE") {
    return <CloudRain size={16} weight="fill" style={{ color: "var(--color-info-500, #2563EB)" }} />;
  }
  if (cond === "NUAGEUX" || cond === "COUVERT" || cond === "BROUILLARD" || cond === "VARIABLE") {
    return <CloudSun size={16} weight="fill" style={{ color: "var(--color-warning-500, #D97706)" }} />;
  }
  if (cond === "ECLAIRCIES") {
    return <CloudSun size={16} weight="fill" style={{ color: "var(--color-warning-500, #D97706)" }} />;
  }
  if (cond === "DEGAGE") {
    return <Sun size={16} weight="fill" style={{ color: "var(--color-warning-500, #D97706)" }} />;
  }

  // Repli sur l'ancienne description textuelle si condition est absent
  const d = (description || "").toLowerCase();
  if (d.includes("orage")) {
    return <CloudLightning size={16} weight="fill" style={{ color: "var(--color-danger-500, #DC2626)" }} />;
  }
  if (d.includes("pluie") || d.includes("averse") || d.includes("bruine")) {
    return <CloudRain size={16} weight="fill" style={{ color: "var(--color-info-500, #2563EB)" }} />;
  }
  // eslint-disable-next-line no-restricted-syntax -- comparaison sur source météo externe
  if (d.includes("nuag") || d.includes("couvert") || d.includes("éclaircie") || d.includes("eclaircie")) {
    return <CloudSun size={16} weight="fill" style={{ color: "var(--color-warning-500, #D97706)" }} />;
  }
  return <Sun size={16} weight="fill" style={{ color: "var(--color-warning-500, #D97706)" }} />;
}

export default function LayoutApp({ children }: LayoutAppProps) {
  const t = useTranslations("tableauDeBord.navigation");
  const router = useRouter();
  const pathname = usePathname();
  const estAuthentifie = useSyncExternalStore(
    abonnementSession,
    () => sessionOuverte(),
    () => null
  );
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [profil, setProfil] = useState<ProfilUtilisateur | null>(null);
  const [entreprise, setEntreprise] = useState<DonneesEntreprise | null>(null);
  const [meteo, setMeteo] = useState<MeteoProjet | null>(null);
  // L'URL du logo qui a échoué, pas un simple booléen.
  //
  // Le drapeau était remis à zéro par un effet à chaque changement de logo —
  // un `setState` dans un effet, que la règle `set-state-in-effect` refuse à
  // juste titre : l'état se **déduit** de l'URL courante, il n'a pas à être
  // resynchronisé après coup.
  const [urlLogoEnEchec, setUrlLogoEnEchec] = useState<string | null>(null);

  // Application dynamique de la couleur de marque (White-Label)
  useEffect(() => {
    if (entreprise?.couleur_primaire) {
      appliquerCouleurPrimaire(entreprise.couleur_primaire);
    }
  }, [entreprise?.couleur_primaire]);

  // Garde de session : redirection immédiate vers la connexion si aucune session
  useEffect(() => {
    if (estAuthentifie === false) {
      if (typeof window !== "undefined" && !window.location.search.includes("session=expiree")) {
        router.replace("/connexion");
      }
    }
  }, [estAuthentifie, router, pathname]);

  // Détection d'un projetId dans l'URL (ex: /projets/[id])
  const segments = pathname.split("/").filter(Boolean);
  const projetIdDansUrl =
    segments[0] === "projets" &&
    segments[1] &&
    segments[1] !== "page" &&
    !segments[1].startsWith("creer")
      ? segments[1]
      : undefined;

  const chargerEntreprise = useCallback(() => {
    lireEntreprise()
      .then(setEntreprise)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sessionOuverte()) return;
    let vivant = true;

    lireAbonnement()
      .then((data) => {
        if (vivant) setAbonnement(data);
      })
      .catch(() => {});

    obtenirProfilMoi()
      .then((data) => {
        if (vivant) setProfil(data);
      })
      .catch(() => {});

    chargerEntreprise();

    return () => {
      vivant = false;
    };
  }, [chargerEntreprise]);

  // La barre se remet à jour quand le profil de l'entreprise change.
  //
  // *Sans cela, un logo téléversé à l'étape 1 du wizard n'apparaissait qu'après
  // un rechargement complet : la page du wizard change, la barre non — elle
  // appartient au gabarit, qui reste monté pendant toute la navigation.*
  useEffect(() => {
    window.addEventListener(EVENEMENT_ENTREPRISE_MODIFIEE, chargerEntreprise);
    return () => window.removeEventListener(EVENEMENT_ENTREPRISE_MODIFIEE, chargerEntreprise);
  }, [chargerEntreprise]);

  const estDirecteurGeneral = Boolean(profil?.is_dg || profil?.role_global === "DG");

  useEffect(() => {
    let vivant = true;

    // Pour le Directeur Général et la direction du siège, la barre d'en-tête
    // affiche exclusivement la météo du siège (ville de l'entreprise), même
    // lors de la navigation sur la fiche d'un chantier particulier.
    const params = !estDirecteurGeneral && projetIdDansUrl
      ? { projet_id: projetIdDansUrl }
      : undefined;

    obtenirMeteo(params)
      .then((res) => {
        if (vivant) setMeteo(res);
      })
      .catch(() => {
        if (vivant) {
          setMeteo({
            disponible: false,
            ville: "",
            temperature: null,
            portee: "ENTREPRISE",
            praticable: true,
            raison: "SERVICE_INDISPONIBLE",
          });
        }
      });

    return () => {
      vivant = false;
    };
  }, [projetIdDansUrl, estDirecteurGeneral]);

  const [menuPlusOuvert, setMenuPlusOuvert] = useState(false);
  const refMenuPlus = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickEnDehors(event: MouseEvent) {
      if (refMenuPlus.current && !refMenuPlus.current.contains(event.target as Node)) {
        setMenuPlusOuvert(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuPlusOuvert(false);
      }
    }

    if (menuPlusOuvert) {
      document.addEventListener("mousedown", handleClickEnDehors);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickEnDehors);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuPlusOuvert]);

  const estSurConfiguration = pathname.startsWith("/configuration");
  const estSurTableauDeBord = pathname.startsWith("/tableau-de-bord");
  const estSurProjets = pathname.startsWith("/projets");
  const estSurChantier = pathname.startsWith("/rapports");
  const estSurPlanning = pathname.startsWith("/planning");
  const estSurFinance = pathname.startsWith("/finance");
  const estSurAchats = pathname.startsWith("/achats");
  const estSurStocks = pathname.startsWith("/stocks");
  const estSurRh = pathname.startsWith("/rh");
  const estSurEquipements = pathname.startsWith("/equipements");
  const estSurQhse = pathname.startsWith("/qhse");
  const estSurContrats = pathname.startsWith("/contrats");
  const estSurDocuments = pathname.startsWith("/documents");
  const estSurTiers = pathname.startsWith("/tiers");
  const estSurCollaborateurs = pathname.startsWith("/parametres/utilisateurs");
  const estSurRoles = pathname.startsWith("/parametres/roles");
  const estSurParametres = pathname.startsWith("/parametres") && !estSurCollaborateurs && !estSurRoles;
  const estSurPlusMenu =
    estSurStocks ||
    estSurRh ||
    estSurEquipements ||
    estSurQhse ||
    estSurContrats ||
    estSurDocuments ||
    estSurTiers;
  const estSurPlus = estSurPlusMenu || estSurCollaborateurs || estSurRoles || estSurParametres;

  // Libellé rôle
  // Le libellé du rôle vient du serveur.
  //
  // *Une cascade de six comparaisons vivait ici, pour treize rôles.* Les sept
  // autres — Responsable Financier, Magasinier, Ingénieur, Sous-traitant… —
  // s'affichaient par leur code : « RF », « MAG ». Et tout rôle ajouté plus
  // tard aurait hérité du même sort, sans que rien ne le signale.
  //
  // Le fondateur garde sa mention : `is_dg` est vrai pour lui même quand son
  // rôle est `AD`, et c'est cette qualité-là que la barre doit montrer.
  const roleLibelle = profil
    ? profil.is_dg
      ? t("roleDirecteurGeneral")
      : profil.role_libelle || profil.role_global || ""
    : "";

  // Détermination du libellé et de la bulle d'aide contextuelle pour chaque situation météo
  const { texteMeteo, bulleMeteo } = (() => {
    if (!meteo) {
      const msg = t("meteo.chargement");
      return { texteMeteo: msg, bulleMeteo: msg };
    }

    if (!meteo.disponible || meteo.temperature === null) {
      const raisonBrute = meteo.raison || "SERVICE_INDISPONIBLE";
      const cleRaison = [
        "VILLE_ABSENTE",
        "PAYS_NON_COUVERT",
        "VILLE_INCONNUE",
        "SERVICE_INDISPONIBLE",
      ].includes(raisonBrute)
        ? (raisonBrute as "VILLE_ABSENTE" | "PAYS_NON_COUVERT" | "VILLE_INCONNUE" | "SERVICE_INDISPONIBLE")
        : "SERVICE_INDISPONIBLE";

      const texte = t(`meteo.indisponible.${cleRaison}`);
      const bulle = t(`meteo.bulleIndisponible.${cleRaison}`, {
        ville: meteo.ville || entreprise?.ville || "",
      });
      return { texteMeteo: texte, bulleMeteo: bulle };
    }

    // Météo disponible
    const conditionBrute = meteo.condition || "VARIABLE";
    const conditionCle = [
      "DEGAGE",
      "ECLAIRCIES",
      "NUAGEUX",
      "COUVERT",
      "BROUILLARD",
      "BRUINE",
      "PLUIE",
      "AVERSES",
      "ORAGE",
      "VARIABLE",
    ].includes(conditionBrute)
      ? (conditionBrute as
          | "DEGAGE"
          | "ECLAIRCIES"
          | "NUAGEUX"
          | "COUVERT"
          | "BROUILLARD"
          | "BRUINE"
          | "PLUIE"
          | "AVERSES"
          | "ORAGE"
          | "VARIABLE")
      : "VARIABLE";

    const conditionLibelle = t(`meteo.condition.${conditionCle}`);

    // Situation 1 : Directeur Général / Direction siège (Portée ENTREPRISE)
    // La barre horizontale affiche uniquement la température de la ville de l'entreprise
    if (meteo.portee === "ENTREPRISE" || estDirecteurGeneral) {
      const texte = t("meteo.releveEntreprise", {
        ville: meteo.ville,
        temperature: meteo.temperature,
      });
      const bulle = t("meteo.bulleEntreprise", {
        condition: conditionLibelle,
        ville: meteo.ville,
      });
      return { texteMeteo: texte, bulleMeteo: bulle };
    }

    // Situation 2 : Rôles opérationnels de chantier (Portée CHANTIER) avec statut de praticabilité
    let statutCle: "PRATICABLE" | "VIGILANCE_PLUIE" | "INTEMPERIES" | "ORAGE" = "PRATICABLE";
    if (meteo.alerte && ["VIGILANCE_PLUIE", "INTEMPERIES", "ORAGE"].includes(meteo.alerte)) {
      statutCle = meteo.alerte as "VIGILANCE_PLUIE" | "INTEMPERIES" | "ORAGE";
    } else if (!meteo.praticable) {
      statutCle = "INTEMPERIES";
    }

    const statutLibelle = t(`meteo.statut.${statutCle}`);
    const texte = t("meteo.releveChantier", {
      ville: meteo.ville,
      temperature: meteo.temperature,
      statut: statutLibelle,
    });
    const bulle = t(`meteo.bulleChantier.${statutCle}`, {
      condition: conditionLibelle,
      ville: meteo.ville,
    });

    return { texteMeteo: texte, bulleMeteo: bulle };
  })();

  if (estAuthentifie === false) {
    return null;
  }

  return (
    <div className={styles.layout}>
      {/* Barre d'application. La marque est le tracé de `public/icon.svg`, le
          même que l'onglet du navigateur — plus la lettre « C » d'une police
          système, qui n'était un logo que par ressemblance. */}
      <header className={styles.topbar}>
        <Link href="/tableau-de-bord" className={styles.logoLien}>
          <MarqueCCD taille={36} compacteSurMobile />
        </Link>

        <div className={styles.droite}>
          {/* Badge du compte à rebours 14 jours */}
          <Link href="/abonnement" style={{ textDecoration: "none" }} title="Gérer mon abonnement et forfaits">
            <BadgeEssai
              joursRestants={abonnement?.jours_essai_restants ?? 14}
              estExpire={abonnement?.est_expire ?? false}
            />
          </Link>

          {/* Météo locale dynamique issue de l'API temps réel */}
          <div
            className={styles.meteoPill}
            title={bulleMeteo}
            aria-label={bulleMeteo}
          >
            <IconeMeteo
              condition={meteo?.condition}
              description={meteo?.description}
              disponible={meteo?.disponible}
            />
            <span>{texteMeteo}</span>
          </div>

          {/* Le logo et le nom de l'entreprise connectée.
              Les URL arrivent absolues et prêtes à l'emploi : c'est le serveur
              qui dit où sont ses fichiers, la barre ne les reconstruit plus.
              `srcset` sert le 24 px sur écran ordinaire et le 48 px sur écran
              dense — les deux vignettes que le serveur taille en lumière
              linéaire, et dont une seule était adressable. */}
          {entreprise ? (
            <Link
              href="/parametres"
              className={styles.entrepriseBadge}
              title={entreprise.nom_commercial || entreprise.raison_sociale}
            >
              {entreprise.logo && urlLogoEnEchec !== entreprise.logo ? (
                <span className={styles.entrepriseLogoCadre}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    // Le repli est la variante 1x, par convention : c'est
                    // elle que sert un client qui ignore `srcset`.
                    src={entreprise.logo_1x || entreprise.logo}
                    srcSet={
                      entreprise.logo_1x
                        ? `${entreprise.logo_1x} 1x, ${entreprise.logo} 2x`
                        : undefined
                    }
                    alt=""
                    decoding="async"
                    className={styles.entrepriseLogoImage}
                    onError={() => setUrlLogoEnEchec(entreprise.logo ?? null)}
                  />
                </span>
              ) : (
                <Buildings size={18} weight="duotone" className={styles.entrepriseIcone} />
              )}
              <span className={styles.nomEntreprise}>
                {entreprise.nom_commercial || entreprise.raison_sociale}
              </span>
            </Link>
          ) : (
            <div className={styles.entrepriseBadgeSkeleton} aria-hidden="true" />
          )}

          <button type="button" className={styles.btnCloche} aria-label={t("notifications")}>
            <Bell size={18} weight="regular" />
          </button>

          {/* Profil utilisateur connecté réel */}
          {profil ? (
            <div className={styles.userProfil}>
              <div className={styles.avatar}>
                {`${profil.prenom?.[0] || ""}${profil.nom?.[0] || ""}`.toUpperCase() ||
                  profil.email[0].toUpperCase()}
              </div>
              <div className={styles.userInfos}>
                <span className={styles.userName}>
                  {`${profil.prenom} ${profil.nom}`.trim() || profil.email}
                </span>
                <div className={styles.userRole}>{roleLibelle}</div>
              </div>
            </div>
          ) : (
            <div className={styles.userProfilSkeleton} aria-hidden="true">
              <div className={styles.avatarSkeleton} />
              <div className={styles.userInfosSkeleton}>
                <div className={styles.userNameSkeleton} />
                <div className={styles.userRoleSkeleton} />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Règle 1 : Menu Horizontal sur Grand Écran (Desktop > 1024px) */}
      {!estSurConfiguration && (
        <nav className={styles.subnav} aria-label={t("accueil")}>
          <Link
            href="/tableau-de-bord"
            className={`${styles.subnavLien} ${estSurTableauDeBord ? styles.subnavActif : ""}`}
          >
            <SquaresFour size={16} weight={estSurTableauDeBord ? "fill" : "regular"} />
            <span>{t("accueil")}</span>
          </Link>
          <Link
            href="/projets"
            className={`${styles.subnavLien} ${estSurProjets ? styles.subnavActif : ""}`}
          >
            <Buildings size={16} weight={estSurProjets ? "fill" : "regular"} />
            <span>{t("projets")}</span>
          </Link>
          <Link
            href="/rapports"
            className={`${styles.subnavLien} ${estSurChantier ? styles.subnavActif : ""}`}
          >
            <HardHat size={16} weight={estSurChantier ? "fill" : "regular"} />
            <span>{t("chantier")}</span>
          </Link>
          <Link
            href="/planning"
            className={`${styles.subnavLien} ${estSurPlanning ? styles.subnavActif : ""}`}
          >
            <Calendar size={16} weight={estSurPlanning ? "fill" : "regular"} />
            <span>{t("planning")}</span>
          </Link>
          <Link
            href="/finance"
            className={`${styles.subnavLien} ${estSurFinance ? styles.subnavActif : ""}`}
          >
            <CurrencyCircleDollar size={16} weight={estSurFinance ? "fill" : "regular"} />
            <span>{t("finance")}</span>
          </Link>
          <Link
            href="/achats"
            className={`${styles.subnavLien} ${estSurAchats ? styles.subnavActif : ""}`}
          >
            <ShoppingCart size={16} weight={estSurAchats ? "fill" : "regular"} />
            <span>{t("achats")}</span>
          </Link>

          {/* Menu déroulant « Plus ▾ » pour les modules secondaires */}
          <div className={styles.menuPlusConteneur} ref={refMenuPlus}>
            <button
              type="button"
              className={`${styles.btnPlus} ${estSurPlusMenu ? styles.btnPlusActif : ""}`}
              onClick={() => setMenuPlusOuvert((prev) => !prev)}
              aria-expanded={menuPlusOuvert}
              aria-haspopup="true"
            >
              <span>{t("plus")}</span>
              <CaretDown size={12} weight="bold" />
            </button>

            {menuPlusOuvert && (
              <div className={styles.dropdownPlus} role="menu">
                <Link
                  href="/stocks"
                  role="menuitem"
                  className={`${styles.dropdownLien} ${estSurStocks ? styles.dropdownLienActif : ""}`}
                  onClick={() => setMenuPlusOuvert(false)}
                >
                  <Package size={20} weight={estSurStocks ? "fill" : "regular"} className={styles.dropdownIcone} />
                  <div className={styles.dropdownTexte}>
                    <span className={styles.dropdownTitre}>{t("stocks")}</span>
                    <span className={styles.dropdownDesc}>{t("descStocks")}</span>
                  </div>
                </Link>

                <Link
                  href="/rh"
                  role="menuitem"
                  className={`${styles.dropdownLien} ${estSurRh ? styles.dropdownLienActif : ""}`}
                  onClick={() => setMenuPlusOuvert(false)}
                >
                  <Users size={20} weight={estSurRh ? "fill" : "regular"} className={styles.dropdownIcone} />
                  <div className={styles.dropdownTexte}>
                    <span className={styles.dropdownTitre}>{t("rh")}</span>
                    <span className={styles.dropdownDesc}>{t("descRh")}</span>
                  </div>
                </Link>

                <Link
                  href="/equipements"
                  role="menuitem"
                  className={`${styles.dropdownLien} ${estSurEquipements ? styles.dropdownLienActif : ""}`}
                  onClick={() => setMenuPlusOuvert(false)}
                >
                  <Truck size={20} weight={estSurEquipements ? "fill" : "regular"} className={styles.dropdownIcone} />
                  <div className={styles.dropdownTexte}>
                    <span className={styles.dropdownTitre}>{t("equipements")}</span>
                    <span className={styles.dropdownDesc}>{t("descEquipements")}</span>
                  </div>
                </Link>

                <Link
                  href="/qhse"
                  role="menuitem"
                  className={`${styles.dropdownLien} ${estSurQhse ? styles.dropdownLienActif : ""}`}
                  onClick={() => setMenuPlusOuvert(false)}
                >
                  <ShieldCheck size={20} weight={estSurQhse ? "fill" : "regular"} className={styles.dropdownIcone} />
                  <div className={styles.dropdownTexte}>
                    <span className={styles.dropdownTitre}>{t("qhse")}</span>
                    <span className={styles.dropdownDesc}>{t("descQhse")}</span>
                  </div>
                </Link>

                <Link
                  href="/contrats"
                  role="menuitem"
                  className={`${styles.dropdownLien} ${estSurContrats ? styles.dropdownLienActif : ""}`}
                  onClick={() => setMenuPlusOuvert(false)}
                >
                  <Handshake size={20} weight={estSurContrats ? "fill" : "regular"} className={styles.dropdownIcone} />
                  <div className={styles.dropdownTexte}>
                    <span className={styles.dropdownTitre}>{t("contrats")}</span>
                    <span className={styles.dropdownDesc}>{t("descContrats")}</span>
                  </div>
                </Link>

                <Link
                  href="/documents"
                  role="menuitem"
                  className={`${styles.dropdownLien} ${estSurDocuments ? styles.dropdownLienActif : ""}`}
                  onClick={() => setMenuPlusOuvert(false)}
                >
                  <Folder size={20} weight={estSurDocuments ? "fill" : "regular"} className={styles.dropdownIcone} />
                  <div className={styles.dropdownTexte}>
                    <span className={styles.dropdownTitre}>{t("documents")}</span>
                    <span className={styles.dropdownDesc}>{t("descDocuments")}</span>
                  </div>
                </Link>

                <Link
                  href="/tiers"
                  role="menuitem"
                  className={`${styles.dropdownLien} ${estSurTiers ? styles.dropdownLienActif : ""}`}
                  onClick={() => setMenuPlusOuvert(false)}
                >
                  <IdentificationCard size={20} weight={estSurTiers ? "fill" : "regular"} className={styles.dropdownIcone} />
                  <div className={styles.dropdownTexte}>
                    <span className={styles.dropdownTitre}>{t("tiers")}</span>
                    <span className={styles.dropdownDesc}>{t("descTiers")}</span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/parametres"
            className={`${styles.subnavLien} ${estSurParametres || estSurCollaborateurs || estSurRoles ? styles.subnavActif : ""}`}
          >
            <Gear size={16} weight={estSurParametres || estSurCollaborateurs || estSurRoles ? "fill" : "regular"} />
            <span>{t("parametres")}</span>
          </Link>
        </nav>
      )}

      <div className={styles.corpsApp}>
        {/* Règle 2 : Menu Vertical (Sidebar) sur Dimension Tablette (768px - 1024px) */}
        {!estSurConfiguration && (
          <aside className={styles.tabSidebar} aria-label={t("accueil")}>
            <nav className={styles.tabSideNav}>
              <Link
                href="/tableau-de-bord"
                className={`${styles.tabSideLien} ${estSurTableauDeBord ? styles.tabSideActif : ""}`}
              >
                <SquaresFour size={18} weight={estSurTableauDeBord ? "fill" : "regular"} />
                <span>{t("accueil")}</span>
              </Link>
              <Link
                href="/projets"
                className={`${styles.tabSideLien} ${estSurProjets ? styles.tabSideActif : ""}`}
              >
                <Buildings size={18} weight={estSurProjets ? "fill" : "regular"} />
                <span>{t("projets")}</span>
              </Link>
              <Link
                href="/rapports"
                className={`${styles.tabSideLien} ${estSurChantier ? styles.tabSideActif : ""}`}
              >
                <HardHat size={18} weight={estSurChantier ? "fill" : "regular"} />
                <span>{t("chantier")}</span>
              </Link>
              <Link
                href="/planning"
                className={`${styles.tabSideLien} ${estSurPlanning ? styles.tabSideActif : ""}`}
              >
                <Calendar size={18} weight={estSurPlanning ? "fill" : "regular"} />
                <span>{t("planning")}</span>
              </Link>
              <Link
                href="/finance"
                className={`${styles.tabSideLien} ${estSurFinance ? styles.tabSideActif : ""}`}
              >
                <CurrencyCircleDollar size={18} weight={estSurFinance ? "fill" : "regular"} />
                <span>{t("finance")}</span>
              </Link>
              <Link
                href="/achats"
                className={`${styles.tabSideLien} ${estSurAchats ? styles.tabSideActif : ""}`}
              >
                <ShoppingCart size={18} weight={estSurAchats ? "fill" : "regular"} />
                <span>{t("achats")}</span>
              </Link>
              <Link
                href="/stocks"
                className={`${styles.tabSideLien} ${estSurStocks ? styles.tabSideActif : ""}`}
              >
                <Package size={18} weight={estSurStocks ? "fill" : "regular"} />
                <span>{t("stocks")}</span>
              </Link>
              <Link
                href="/rh"
                className={`${styles.tabSideLien} ${estSurRh ? styles.tabSideActif : ""}`}
              >
                <Users size={18} weight={estSurRh ? "fill" : "regular"} />
                <span>{t("rh")}</span>
              </Link>
              <Link
                href="/equipements"
                className={`${styles.tabSideLien} ${estSurEquipements ? styles.tabSideActif : ""}`}
              >
                <Truck size={18} weight={estSurEquipements ? "fill" : "regular"} />
                <span>{t("equipements")}</span>
              </Link>
              <Link
                href="/qhse"
                className={`${styles.tabSideLien} ${estSurQhse ? styles.tabSideActif : ""}`}
              >
                <ShieldCheck size={18} weight={estSurQhse ? "fill" : "regular"} />
                <span>{t("qhse")}</span>
              </Link>
              <Link
                href="/contrats"
                className={`${styles.tabSideLien} ${estSurContrats ? styles.tabSideActif : ""}`}
              >
                <Handshake size={18} weight={estSurContrats ? "fill" : "regular"} />
                <span>{t("contrats")}</span>
              </Link>
              <Link
                href="/documents"
                className={`${styles.tabSideLien} ${estSurDocuments ? styles.tabSideActif : ""}`}
              >
                <Folder size={18} weight={estSurDocuments ? "fill" : "regular"} />
                <span>{t("documents")}</span>
              </Link>
              <Link
                href="/tiers"
                className={`${styles.tabSideLien} ${estSurTiers ? styles.tabSideActif : ""}`}
              >
                <IdentificationCard size={18} weight={estSurTiers ? "fill" : "regular"} />
                <span>{t("tiers")}</span>
              </Link>
              <Link
                href="/parametres"
                className={`${styles.tabSideLien} ${estSurParametres || estSurCollaborateurs || estSurRoles ? styles.tabSideActif : ""}`}
              >
                <Gear size={18} weight={estSurParametres || estSurCollaborateurs || estSurRoles ? "fill" : "regular"} />
                <span>{t("parametres")}</span>
              </Link>
            </nav>
          </aside>
        )}

        {/* Contenu principal de chaque page */}
        <main className={`${styles.main} ${estSurConfiguration ? styles.mainSansNav : ""}`}>{children}</main>
      </div>

      {/* Règle 3 : Navigation basse Mobile (< 768px) */}
      {!estSurConfiguration && (
        <nav className={styles.mobBottomNav} aria-label={t("accueil")}>
          <Link
            href="/tableau-de-bord"
            className={`${styles.mobNavItem} ${estSurTableauDeBord ? styles.mobNavActif : ""}`}
          >
            <SquaresFour size={18} weight={estSurTableauDeBord ? "fill" : "regular"} />
            <span>{t("accueil")}</span>
          </Link>
          <Link
            href="/projets"
            className={`${styles.mobNavItem} ${estSurProjets ? styles.mobNavActif : ""}`}
          >
            <Buildings size={18} weight={estSurProjets ? "fill" : "regular"} />
            <span>{t("projets")}</span>
          </Link>
          <Link
            href="/rapports"
            className={`${styles.mobNavItem} ${estSurChantier ? styles.mobNavActif : ""}`}
          >
            <HardHat size={18} weight={estSurChantier ? "fill" : "regular"} />
            <span>{t("chantier")}</span>
          </Link>
          <Link
            href="/finance"
            className={`${styles.mobNavItem} ${estSurFinance ? styles.mobNavActif : ""}`}
          >
            <CurrencyCircleDollar size={18} weight={estSurFinance ? "fill" : "regular"} />
            <span>{t("finance")}</span>
          </Link>
          <Link
            href="/parametres"
            className={`${styles.mobNavItem} ${estSurPlus ? styles.mobNavActif : ""}`}
          >
            <DotsThreeCircle size={18} weight={estSurPlus ? "fill" : "regular"} />
            <span>{t("plus")}</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
