"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EtatChargement, EtatErreur, EtatVide, Tableau } from "@/components/ui";
import type { Colonne } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { alerteClient, trierParUrgence } from "@/features/administration";
import type { ClientPlateforme } from "@/features/administration";
import { listerClients } from "@/features/administration/adaptateur";
import { nomDePays } from "@/lib/format";

import { CLES_ADMINISTRATION } from "../cles";
import { BADGE, TON_ALERTE, TON_STATUT_ABONNEMENT, TON_STATUT_CLIENT } from "../tons";

/**
 * Le texte sur lequel porte la recherche.
 *
 * Le sous-domaine en fait partie : c'est souvent la seule chose qu'un client
 * sait citer au telephone — il la lit dans la barre d'adresse.
 */
function texteRecherchable(client: ClientPlateforme): string {
  return [client.raisonSociale, client.nomCommercial, client.ville, client.slug]
    .join(" ")
    .toLowerCase();
}

/**
 * La liste des entreprises clientes.
 *
 * Elle est **triee par urgence**, et non par ordre alphabetique : l'ecran sert
 * d'abord a voir ce qui ne va pas. Le tri alphabetique n'intervient qu'entre
 * deux clients de meme gravite, pour que l'ordre reste stable d'un
 * rafraichissement a l'autre.
 */
export function ListeClients() {
  const t = useTranslations("administration");
  const router = useRouter();
  const [recherche, setRecherche] = useState("");

  const requete = useQuery({
    queryKey: CLES_ADMINISTRATION.clients(),
    queryFn: ({ signal }) => listerClients(signal),
  });

  const clients = useMemo(() => {
    if (!requete.data) return [];
    const terme = recherche.trim().toLowerCase();
    const filtres = terme
      ? requete.data.filter((client) => texteRecherchable(client).includes(terme))
      : requete.data;
    return trierParUrgence(filtres);
  }, [requete.data, recherche]);

  const colonnes: Colonne<ClientPlateforme>[] = [
    {
      cle: "client",
      entete: t("clients.colonneClient"),
      figee: true,
      largeurMinimale: "220px",
      rendu: (client) => (
        <span className="flex flex-col">
          <span className="font-medium text-neutral-900">{client.nomCommercial}</span>
          <span className="text-xs text-neutral-500">{client.slug}</span>
        </span>
      ),
    },
    {
      cle: "pays",
      entete: t("clients.colonnePays"),
      secondaire: true,
      rendu: (client) =>
        t("clients.villePays", { ville: client.ville, pays: nomDePays(client.pays) }),
    },
    {
      cle: "statut",
      entete: t("clients.colonneStatut"),
      rendu: (client) => (
        <span className={`${BADGE} ${TON_STATUT_CLIENT[client.statut]}`}>
          {t(`statutClient.${client.statut}`)}
        </span>
      ),
    },
    {
      cle: "plan",
      entete: t("clients.colonnePlan"),
      secondaire: true,
      rendu: (client) => (
        <span className="flex flex-col gap-1">
          <span>{t(`plan.${client.abonnement.plan}`)}</span>
          <span
            className={`${BADGE} ${TON_STATUT_ABONNEMENT[client.abonnement.statut]} self-start`}
          >
            {t(`statutAbonnement.${client.abonnement.statut}`)}
          </span>
        </span>
      ),
    },
    {
      cle: "utilisateurs",
      entete: t("clients.colonneUtilisateurs"),
      aligneADroite: true,
      secondaire: true,
      rendu: (client) => String(client.nbUtilisateurs),
    },
    {
      cle: "projets",
      entete: t("clients.colonneProjets"),
      aligneADroite: true,
      secondaire: true,
      rendu: (client) => String(client.nbProjets),
    },
    {
      cle: "alerte",
      entete: t("clients.colonneAlerte"),
      rendu: (client) => {
        const alerte = alerteClient(client);
        if (!alerte) {
          return <span className="text-neutral-400">{t("alerte.aucune")}</span>;
        }
        return (
          <span className={`${BADGE} ${TON_ALERTE[alerte]}`}>{t(`alerte.${alerte}`)}</span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-h2 font-bold text-neutral-900">{t("clients.titre")}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {t("clients.sousTitre", { nombre: requete.data?.length ?? 0 })}
          </p>
        </div>

        <div className="relative sm:w-80">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-500"
          />
          <Input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label={t("clients.recherche")}
            placeholder={t("clients.rechercheePlaceholder")}
            className="pl-9"
          />
        </div>
      </div>

      {requete.isPending && <EtatChargement />}

      {requete.isError && (
        <EtatErreur
          message={t("erreurs.chargement")}
          onReessayer={() => void requete.refetch()}
        />
      )}

      {requete.isSuccess &&
        (clients.length === 0 ? (
          <EtatVide titre={t("clients.aucunTitre")} description={t("clients.aucun")} />
        ) : (
          <Tableau
            colonnes={colonnes}
            lignes={clients}
            cleLigne={(client) => client.id}
            onLigneCliquee={(client) => router.push(`/admin/clients/${client.id}`)}
            legende={t("clients.titre")}
            tailleDePage={10}
          />
        ))}
    </div>
  );
}
