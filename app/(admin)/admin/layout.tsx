"use client";

import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

import { LogoPlateforme } from "@/components/layout/LogoPlateforme";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSousMenu,
  SidebarMenuSousMenuLien,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  lireProfilLocal,
  obtenirProfil,
  seDeconnecter,
} from "@/features/administration/adaptateur";
import type { ProfilAdministrateur } from "@/features/administration";
import { useIdentitePlateforme } from "@/features/plateforme/hooks";
import { EVENEMENT_SESSION_ADMIN_EXPIREE, sessionOuverte } from "@/lib/api";
import { SurveillantSessionAdmin } from "@/lib/auth/SurveillantSessionAdmin";

import { CLES_ADMINISTRATION } from "./cles";
import { FournisseurAdministrateur } from "./ContexteAdministrateur";

const ECRAN_CONNEXION = "/admin/connexion";

/**
 * Le sous-menu « Paramétrage » : une entrée, une page chacune.
 *
 * Trois pages et non trois onglets d'une même page : chaque section a sa propre
 * adresse, son propre titre d'onglet, et s'atteint en un geste depuis n'importe
 * quel écran du back-office — sans passer par une page d'accueil de rubrique
 * qui n'aurait rien à montrer.
 */
const SOUS_MENU_PARAMETRAGE = [
  { href: "/admin/parametres/comptes", cle: "parametrageComptes" },
  { href: "/admin/parametres/tarifs", cle: "parametrageTarifs" },
  { href: "/admin/parametres/identite", cle: "parametrageIdentite" },
] as const;

const abonnementSession = (rappel: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENEMENT_SESSION_ADMIN_EXPIREE, rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener(EVENEMENT_SESSION_ADMIN_EXPIREE, rappel);
    window.removeEventListener("storage", rappel);
  };
};

/**
 * La coquille du back-office de la plateforme.
 *
 * **Elle ne partage rien avec `app/(app)/layout.tsx`, et c'est voulu.** Celle
 * de l'espace entreprise charge l'abonnement, la fiche de l'entreprise, la
 * meteo du chantier et applique la couleur de marque du client : un
 * administrateur de la plateforme n'a ni entreprise, ni abonnement, ni
 * chantier. Une seule coquille avec des conditions partout aurait fait porter
 * a chaque appel metier un « sauf si c'est un administrateur » — et il aurait
 * suffi d'en oublier un.
 *
 * Elle est volontairement sobre : fond ardoise, pas de couleur de marque.
 * L'espace ou l'on suspend l'acces d'une entreprise entiere ne doit pas
 * ressembler a celui ou l'on saisit un rapport de chantier.
 *
 * **La garde ci-dessous n'est pas une barriere de securite.** Tant que la
 * session vit dans `localStorage` (decision A4 non encore livree), elle ne
 * fait qu'eviter d'afficher une coquille vide : la vraie barriere est Django,
 * qui refuse `/administration/*` a tout jeton qui n'est pas celui d'un
 * administrateur.
 */
export default function LayoutAdministration({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("administration");
  const router = useRouter();
  const pathname = usePathname();

  const estAuthentifie = useSyncExternalStore(
    abonnementSession,
    () => sessionOuverte("administration"),
    () => null,
  );

  useEffect(() => {
    if (estAuthentifie === false) router.replace(ECRAN_CONNEXION);
  }, [estAuthentifie, router]);

  /**
   * Le profil, charge une fois pour les trois ecrans.
   *
   * `initialData` sert le profil garde en local, pour que l'en-tete affiche un
   * nom des le premier rendu plutot qu'un squelette a chaque navigation ;
   * `initialDataUpdatedAt: 0` le declare **perime d'emblee**, faute de quoi le
   * `staleTime` de 30 s du QueryClient le tiendrait pour frais et le serveur ne
   * serait jamais interroge.
   *
   * Un echec n'invente aucune identite : `obtenirProfil()` retombe sur le meme
   * cache, et si le serveur refuse vraiment la session c'est
   * `SurveillantSessionAdmin` qui renvoie vers la connexion — lui seul.
   */
  const requeteProfil = useQuery({
    queryKey: CLES_ADMINISTRATION.moi(),
    queryFn: obtenirProfil,
    enabled: estAuthentifie === true,
    initialData: () => lireProfilLocal() ?? undefined,
    initialDataUpdatedAt: 0,
  });

  const profil: ProfilAdministrateur | null = requeteProfil.data ?? null;
  const identite = useIdentitePlateforme().data;

  if (estAuthentifie !== true) return null;

  const initiales =
    `${profil?.prenom?.[0] ?? ""}${profil?.nom?.[0] ?? ""}`.toUpperCase() ||
    profil?.email[0]?.toUpperCase() ||
    "?";

  const entrees = [
    { href: "/admin", icone: LayoutDashboard, libelle: t("navigation.tableauDeBord") },
    { href: "/admin/clients", icone: Building2, libelle: t("navigation.clients") },
    { href: "/admin/abonnements", icone: CreditCard, libelle: t("navigation.abonnements") },
  ];

  const estSurParametrage = pathname.startsWith("/admin/parametres");

  const estActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  async function deconnexion() {
    await seDeconnecter();
    router.replace(ECRAN_CONNEXION);
  }

  return (
    <FournisseurAdministrateur value={profil}>
      <SurveillantSessionAdmin />
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <Link href="/admin">
                    {/* Le logo paramétré s'il y en a un ; sinon le bouclier,
                        plus sobre que le signe de l'espace entreprise. */}
                    {identite?.logo ? (
                      <LogoPlateforme logo={identite.logo} taille={28} />
                    ) : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary-800 text-neutral-0">
                        <ShieldCheck size={16} aria-hidden="true" />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-base font-bold tracking-tight">
                        {identite?.nom || t("marque")}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t("espaceCourt")}
                      </span>
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
                  {entrees.map(({ href, icone: Icone, libelle }) => (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton asChild isActive={estActive(href)} tooltip={libelle}>
                        <Link href={href}>
                          <Icone />
                          <span>{libelle}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {/* Panneau volant au survol, comme « Projets » côté
                      entreprise : pas d'infobulle, elle doublerait le panneau. */}
                  <SidebarMenuSousMenu
                    libelle={t("navigation.parametrage")}
                    declencheur={
                      <SidebarMenuButton asChild isActive={estSurParametrage} sousMenu>
                        <Link href={SOUS_MENU_PARAMETRAGE[0].href}>
                          <Settings />
                          <span>{t("navigation.parametrage")}</span>
                        </Link>
                      </SidebarMenuButton>
                    }
                  >
                    {SOUS_MENU_PARAMETRAGE.map(({ href, cle }) => (
                      <SidebarMenuSousMenuLien key={href} isActive={pathname.startsWith(href)}>
                        <Link href={href}>{t(`navigation.${cle}`)}</Link>
                      </SidebarMenuSousMenuLien>
                    ))}
                  </SidebarMenuSousMenu>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
            <SidebarTrigger />
            <span className="text-sm font-semibold text-neutral-800">{t("espace")}</span>

            <div className="ml-auto flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border-0 bg-transparent px-2 py-1 hover:bg-accent"
                  >
                    <Avatar className="size-8 rounded-full">
                      {profil?.photo && (
                        <AvatarImage
                          src={profil.photo}
                          alt=""
                          className="rounded-full object-cover"
                        />
                      )}
                      <AvatarFallback className="rounded-full bg-secondary-800 text-xs font-semibold text-neutral-0">
                        {initiales}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col text-left leading-tight">
                      {profil ? (
                        <span className="truncate text-sm font-semibold">
                          {profil.nomComplet}
                        </span>
                      ) : (
                        <Skeleton className="h-4 w-24" />
                      )}
                      <span className="truncate text-xs text-muted-foreground">
                        {profil ? t(`role.${profil.role}`) : ""}
                      </span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" className="min-w-56">
                  <DropdownMenuLabel className="font-normal">
                    <span className="flex flex-col">
                      <span className="truncate text-sm font-medium">
                        {profil?.nomComplet}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {profil?.email}
                      </span>
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin/profil">
                      <UserRound />
                      {t("navigation.profil")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={deconnexion}>
                    <LogOut />
                    {t("navigation.deconnexion")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </FournisseurAdministrateur>
  );
}
