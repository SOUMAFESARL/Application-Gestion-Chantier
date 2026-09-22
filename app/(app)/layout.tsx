"use client";

import {
  Bell,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Contact,
  FileText,
  Handshake,
  HardHat,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { LogoCCD } from "@/components/layout/MarqueCCD";
import { FilAriane } from "@/components/layout/FilAriane";
import { BadgeEssai } from "@/components/metier/BadgeEssai";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { seDeconnecter } from "@/features/auth/api";
import { EVENEMENT_SESSION_EXPIREE, sessionOuverte } from "@/lib/api";
import { lireAbonnement } from "@/features/abonnement/api";
import type { Abonnement } from "@/features/abonnement/api";
import { obtenirProfilMoi } from "@/features/auth/api";
import type { ProfilUtilisateur } from "@/features/auth/api";
import { EVENEMENT_ENTREPRISE_MODIFIEE, lireEntreprise } from "@/features/configuration/api";
import type { DonneesEntreprise } from "@/features/configuration/api";
import { obtenirMeteo } from "@/features/projets/adaptateur";
import type { MeteoProjet } from "@/features/projets/types";
import { appliquerCouleurPrimaire } from "@/styles/theme";

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

/**
 * Le relevé de repli quand le service météo ne répond pas.
 *
 * Il dit « indisponible », jamais « beau temps » : sur un chantier, une météo
 * fausse se paie en coulage de béton sous la pluie.
 */
const METEO_INDISPONIBLE: MeteoProjet = {
  disponible: false,
  ville: "",
  temperature: null,
  portee: "ENTREPRISE",
  condition: null,
  codeWmo: null,
  praticable: true,
  alerte: null,
  releveLe: null,
  raison: "SERVICE_INDISPONIBLE",
  description: "",
  alerteIntemperies: null,
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
    return <Cloud size={16} className="text-neutral-400" />;
  }

  const cond = condition || "";
  if (cond === "ORAGE") {
    return <CloudLightning size={16} className="fill-erreur/20 text-erreur" />;
  }
  if (cond === "PLUIE" || cond === "AVERSES" || cond === "BRUINE") {
    return <CloudRain size={16} className="fill-information/20 text-information" />;
  }
  if (cond === "NUAGEUX" || cond === "COUVERT" || cond === "BROUILLARD" || cond === "VARIABLE") {
    return <CloudSun size={16} className="fill-avertissement/20 text-avertissement" />;
  }
  if (cond === "ECLAIRCIES") {
    return <CloudSun size={16} className="fill-avertissement/20 text-avertissement" />;
  }
  if (cond === "DEGAGE") {
    return <Sun size={16} className="fill-avertissement/20 text-avertissement" />;
  }

  // Repli sur l'ancienne description textuelle si condition est absent
  const d = (description || "").toLowerCase();
  if (d.includes("orage")) {
    return <CloudLightning size={16} className="fill-erreur/20 text-erreur" />;
  }
  if (d.includes("pluie") || d.includes("averse") || d.includes("bruine")) {
    return <CloudRain size={16} className="fill-information/20 text-information" />;
  }
  // eslint-disable-next-line no-restricted-syntax -- comparaison sur source météo externe
  if (d.includes("nuag") || d.includes("couvert") || d.includes("éclaircie") || d.includes("eclaircie")) {
    return <CloudSun size={16} className="fill-avertissement/20 text-avertissement" />;
  }
  return <Sun size={16} className="fill-avertissement/20 text-avertissement" />;
}

/**
 * La coquille applicative — sidebar shadcn responsive (plan de refonte),
 * calquée sur `docs/interface.jpg`.
 *
 * **Toute la logique de données ci-dessous est reprise à l'identique de
 * l'ancien `layout.tsx`** (CSS Modules + Phosphor, retiré) : garde de
 * session, abonnement, profil, entreprise, météo, couleur white-label. Seul
 * l'habillage change — sidebar repliable en icônes sur desktop, tiroir
 * (`Sheet`) sous 768px, plus de trois implémentations de nav parallèles.
 *
 * `estSurConfiguration` a disparu : la configuration vit maintenant sous
 * `/parametres/configuration`, comme un écran de paramètres normal — elle
 * n'a plus besoin d'un mode plein écran qui masque la coquille.
 */
export default function LayoutApp({ children }: LayoutAppProps) {
  const t = useTranslations("tableauDeBord.navigation");
  const tMarque = useTranslations("marque");
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

  useEffect(() => {
    window.addEventListener(EVENEMENT_ENTREPRISE_MODIFIEE, chargerEntreprise);
    return () => window.removeEventListener(EVENEMENT_ENTREPRISE_MODIFIEE, chargerEntreprise);
  }, [chargerEntreprise]);

  const estDirecteurGeneral = Boolean(profil?.is_dg || profil?.role_global === "DG");

  useEffect(() => {
    let vivant = true;

    const params = !estDirecteurGeneral && projetIdDansUrl
      ? { projetId: projetIdDansUrl }
      : undefined;

    obtenirMeteo(params)
      .then((res) => {
        if (vivant) setMeteo(res);
      })
      .catch(() => {
        if (vivant) {
          setMeteo(METEO_INDISPONIBLE);
        }
      });

    return () => {
      vivant = false;
    };
  }, [projetIdDansUrl, estDirecteurGeneral]);

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
  const estSurConfigurationEntreprise = pathname.startsWith("/parametres/configuration");
  const estSurParametres =
    pathname.startsWith("/parametres") &&
    !estSurCollaborateurs &&
    !estSurRoles &&
    !estSurConfigurationEntreprise;

  const roleLibelle = profil
    ? profil.is_dg
      ? t("roleDirecteurGeneral")
      : profil.role_libelle || profil.role_global || ""
    : "";

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

  async function deconnexion() {
    await seDeconnecter();
    router.replace("/connexion");
  }

  if (estAuthentifie === false) {
    return null;
  }

  const initiales =
    `${profil?.prenom?.[0] || ""}${profil?.nom?.[0] || ""}`.toUpperCase() ||
    profil?.email[0]?.toUpperCase() ||
    "?";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/tableau-de-bord">
                  <LogoCCD taille={28} />
                  {/* Le nom de marque est le seul texte encre de la barre —
                      comme sur `docs/interface.jpg`, où le signe porte la
                      couleur et le mot reste noir. */}
                  <span className="truncate text-base leading-tight font-bold tracking-tight text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
                    {tMarque("nom")}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurTableauDeBord} tooltip={t("accueil")}>
                    <Link href="/tableau-de-bord">
                      <LayoutDashboard />
                      <span>{t("accueil")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurProjets} tooltip={t("projets")}>
                    <Link href="/projets">
                      <Building2 />
                      <span>{t("projets")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurChantier} tooltip={t("chantier")}>
                    <Link href="/rapports">
                      <HardHat />
                      <span>{t("chantier")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurPlanning} tooltip={t("planning")}>
                    <Link href="/planning">
                      <CalendarDays />
                      <span>{t("planning")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurFinance} tooltip={t("finance")}>
                    <Link href="/finance">
                      <CircleDollarSign />
                      <span>{t("finance")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurAchats} tooltip={t("achats")}>
                    <Link href="/achats">
                      <ShoppingCart />
                      <span>{t("achats")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>{t("plusDeModules")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurStocks} tooltip={t("stocks")}>
                    <Link href="/stocks">
                      <Package />
                      <span>{t("stocks")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurRh} tooltip={t("rh")}>
                    <Link href="/rh">
                      <Users />
                      <span>{t("rh")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurEquipements} tooltip={t("equipements")}>
                    <Link href="/equipements">
                      <Truck />
                      <span>{t("equipements")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurQhse} tooltip={t("qhse")}>
                    <Link href="/qhse">
                      <ShieldCheck />
                      <span>{t("qhse")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurContrats} tooltip={t("contrats")}>
                    <Link href="/contrats">
                      <Handshake />
                      <span>{t("contrats")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurDocuments} tooltip={t("documents")}>
                    <Link href="/documents">
                      <FileText />
                      <span>{t("documents")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurTiers} tooltip={t("tiers")}>
                    <Link href="/tiers">
                      <Contact />
                      <span>{t("tiers")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>{t("parametres")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurParametres} tooltip={t("parametres")}>
                    <Link href="/parametres">
                      <Settings />
                      <span>{t("parametres")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurCollaborateurs} tooltip={t("collaborateurs")}>
                    <Link href="/parametres/utilisateurs">
                      <Users />
                      <span>{t("collaborateurs")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={estSurRoles} tooltip={t("roles")}>
                    <Link href="/parametres/roles">
                      <ShieldCheck />
                      <span>{t("roles")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={estSurConfigurationEntreprise}
                    tooltip={t("configuration")}
                  >
                    <Link href="/parametres/configuration">
                      <Building2 />
                      <span>{t("configuration")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {/* Pastille blanche posée sur la barre, comme sur
                      `docs/interface.jpg` : pas de filet, une ombre courte
                      suffit à la décoller du béton clair du fond. */}
                  <SidebarMenuButton size="lg" className="bg-sidebar-accent shadow-sm">
                    <Avatar className="size-7 rounded-md">
                      <AvatarFallback className="rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                        {initiales}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col text-left leading-tight">
                      {profil ? (
                        <span className="truncate text-sm font-semibold">
                          {`${profil.prenom} ${profil.nom}`.trim() || profil.email}
                        </span>
                      ) : (
                        <Skeleton className="h-4 w-24" />
                      )}
                      <span className="truncate text-xs text-muted-foreground">{roleLibelle}</span>
                    </span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-56">
                  <DropdownMenuLabel className="font-normal">
                    <span className="flex flex-col">
                      <span className="truncate text-sm font-medium">
                        {profil ? `${profil.prenom} ${profil.nom}`.trim() || profil.email : ""}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{profil?.email}</span>
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={deconnexion}>
                    <LogOut />
                    {t("deconnexion")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <SidebarTrigger />
          <FilAriane />

          <div className="ml-auto flex items-center gap-2">
            {/* Compteur d'essai — dans la barre du haut, et non plus dans le
                pied de la barre latérale : replier celle-ci en icônes le
                faisait disparaître, alors que c'est la seule chose de l'écran
                qui annonce une échéance. Masqué sous 480 px, où la barre n'a
                déjà plus la place du relevé météo. */}
            <span className="hidden sm:inline-flex">
              <BadgeEssai
                joursRestants={abonnement?.jours_essai_restants ?? 14}
                estExpire={abonnement?.est_expire ?? false}
              />
            </span>

            {/* Météo locale dynamique issue de l'API temps réel */}
            <div
              className="hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex"
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

            {/* Le logo et le nom de l'entreprise connectée */}
            {entreprise ? (
              <Link
                href="/parametres"
                className="hidden items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-foreground hover:bg-accent md:flex"
                title={entreprise.nom_commercial || entreprise.raison_sociale}
              >
                {entreprise.logo && urlLogoEnEchec !== entreprise.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entreprise.logo_1x || entreprise.logo}
                    srcSet={
                      entreprise.logo_1x
                        ? `${entreprise.logo_1x} 1x, ${entreprise.logo} 2x`
                        : undefined
                    }
                    alt=""
                    decoding="async"
                    className="size-5 rounded-sm object-contain"
                    onError={() => setUrlLogoEnEchec(entreprise.logo ?? null)}
                  />
                ) : (
                  <Building2 size={16} className="text-muted-foreground" />
                )}
                <span className="max-w-32 truncate">
                  {entreprise.nom_commercial || entreprise.raison_sociale}
                </span>
              </Link>
            ) : (
              <div className="hidden h-7 w-24 animate-pulse rounded-full bg-muted md:block" aria-hidden="true" />
            )}

            <Button type="button" variant="ghost" size="icon" aria-label={t("notifications")} asChild>
              <Link href="/notifications">
                <Bell />
              </Link>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
