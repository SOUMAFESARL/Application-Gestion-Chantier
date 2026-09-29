"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, TriangleAlert, UserCog, UserMinus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Badge, Bouton, EtatChargement, EtatErreur, EtatVide } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { listerEquipes, listerProjets } from "@/features/projets/adaptateur";
import { CLE_LISTE_PROJETS, cleEquipes, cleLots } from "@/features/projets/cles";
import { ModaleAjoutMembre } from "@/features/projets/components/ModaleAjoutMembre";
import { ModaleRetraitMembre } from "@/features/projets/components/ModaleRetraitMembre";
import { ModaleRoleMembre } from "@/features/projets/components/ModaleRoleMembre";
import {
  CRITERES_MEMBRES_VIDES,
  criteresMembresActifs,
  filtrerMembres,
  initiales,
  rolesPresents,
} from "@/features/projets/regles";
import type { CriteresMembres } from "@/features/projets/regles";
import type { Equipe, MembreEquipe, Projet } from "@/features/projets/types";
import { cn } from "@/lib/utils";

import {
  AVATAR_CHEF,
  AVATAR_MEMBRE,
  BADGE_NATURE,
  pastilleEquipe,
} from "../../../equipe-affectations/classes";
import { BARRE_PROJET, BARRE_PROJET_COLLEE } from "../../../classes";
import { useEstColle } from "../../../EnteteChantier";
import { lienEquipesChantier } from "../../../equipe-affectations/liens";

const colonne = aideColonnes<MembreEquipe>();

interface Props {
  projetId: string;
  equipeId: string;
}

/**
 * La fiche d'une équipe : ses membres, un par ligne, avec leur rôle.
 *
 * Elle lit les équipes du chantier dans **le même cache** que l'écran
 * « Équipes et affectations » : revenir en arrière montre la carte déjà à
 * jour, sans rechargement. Chaque écriture renvoie l'équipe entière, posée
 * telle quelle dans ce cache — nommer un chef en fait redescendre un autre,
 * et c'est le serveur qui le décide, pas cet écran.
 *
 * **Aucun calcul ici** : tout vient de `features/projets/regles`.
 */
export function FicheEquipe({ projetId, equipeId }: Props) {
  const t = useTranslations("projets.equipesAffectations");
  const tFiche = useTranslations("projets.equipesAffectations.fiche");
  const clientRequetes = useQueryClient();

  const [criteres, setCriteres] = useState<CriteresMembres>(CRITERES_MEMBRES_VIDES);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [membreRole, setMembreRole] = useState<MembreEquipe | null>(null);
  const [membreRetrait, setMembreRetrait] = useState<MembreEquipe | null>(null);
  /** Le rang de la dernière ouverture d'une modale, qui lui sert de `key`. */
  const [ouverture, setOuverture] = useState(0);

  const requete = useQuery({
    queryKey: cleEquipes(projetId),
    queryFn: ({ signal }) => listerEquipes(projetId, signal),
  });
  // La même liste que le sélecteur de chantier des écrans voisins : déjà en
  // cache quand on arrive d'« Équipes et affectations ».
  const requeteProjets = useQuery({
    queryKey: CLE_LISTE_PROJETS,
    queryFn: ({ signal }) => listerProjets(signal),
  });
  const projet = requeteProjets.data?.find((candidat) => candidat.id === projetId) ?? null;

  const equipes = useMemo(() => requete.data ?? [], [requete.data]);
  const rang = equipes.findIndex((candidate) => candidate.id === equipeId);
  const equipe = rang >= 0 ? equipes[rang] : null;

  const lignes = useMemo(
    () => (equipe ? filtrerMembres(equipe, criteres) : []),
    [equipe, criteres],
  );
  const filtresActifs = criteresMembresActifs(criteres);

  function ouvrir(action: () => void) {
    setOuverture((precedent) => precedent + 1);
    action();
  }

  function surModifiee(modifiee: Equipe) {
    clientRequetes.setQueryData<Equipe[]>(cleEquipes(projetId), (anciennes) =>
      (anciennes ?? []).map((candidate) => (candidate.id === modifiee.id ? modifiee : candidate)),
    );
    void clientRequetes.invalidateQueries({ queryKey: cleEquipes(projetId) });
    // L'effectif d'une équipe s'affiche aussi sur les activités qu'elle tient.
    void clientRequetes.invalidateQueries({ queryKey: cleLots(projetId) });
  }

  const colonnes = useMemo(
    () =>
      colonne.columns([
        colonne.display({
          id: "membre",
          header: tFiche("colonnes.membre"),
          cell: ({ row }) => {
            const membre = row.original;
            const chef = membre.id === equipe?.chef?.id;
            return (
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    chef ? AVATAR_CHEF : AVATAR_MEMBRE,
                  )}
                  aria-hidden="true"
                >
                  {initiales(membre.prenom, membre.nom)}
                </span>
                <span className="font-medium text-neutral-900">
                  {t("nomComplet", { prenom: membre.prenom, nom: membre.nom })}
                </span>
              </span>
            );
          },
        }),
        colonne.accessor("role", {
          header: tFiche("colonnes.role"),
          cell: ({ getValue }) => {
            const role = getValue();
            return role === "CHEF_EQUIPE" ? (
              <Badge variante="primaire">{t(`role.${role}`)}</Badge>
            ) : (
              <span className="text-neutral-800">{t(`role.${role}`)}</span>
            );
          },
        }),
        colonne.display({
          id: "actions",
          header: tFiche("colonnes.actions"),
          meta: { classe: BORD_DROIT_TABLEAU },
          cell: ({ row }) => {
            const nom = t("nomComplet", { prenom: row.original.prenom, nom: row.original.nom });
            return (
              <span className="inline-flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tFiche("actionChangerRole", { nom })}
                  title={tFiche("actionChangerRole", { nom })}
                  onClick={() => ouvrir(() => setMembreRole(row.original))}
                >
                  <UserCog />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-erreur hover:text-erreur"
                  aria-label={tFiche("actionRetirer", { nom })}
                  title={tFiche("actionRetirer", { nom })}
                  onClick={() => ouvrir(() => setMembreRetrait(row.original))}
                >
                  <UserMinus />
                </Button>
              </span>
            );
          },
        }),
      ]),
    [t, tFiche, equipe?.chef?.id],
  );

  /** Prénom et nom séparés : le fichier se retrie seul. */
  const exporter = useMemo<ExportTableau<MembreEquipe>>(
    () => ({
      titre: tFiche("export.titre", { nom: equipe?.nom ?? "" }),
      nomFichier: tFiche("export.nomFichier"),
      colonnes: [
        { entete: tFiche("export.prenom"), valeur: (membre) => membre.prenom },
        { entete: tFiche("export.nom"), valeur: (membre) => membre.nom },
        { entete: tFiche("colonnes.role"), valeur: (membre) => t(`role.${membre.role}`) },
      ],
    }),
    [t, tFiche, equipe?.nom],
  );

  const retour = (
    <Link
      href={lienEquipesChantier(projetId)}
      className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-neutral-600 no-underline hover:text-primary"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {tFiche("retour")}
    </Link>
  );

  const entete = (
    <>
      {retour}
      {projet && <ProjetConcerne projet={projet} />}
    </>
  );

  if (requete.isPending) return <EtatChargement />;
  if (requete.isError) return <EtatErreur onReessayer={() => void requete.refetch()} />;
  if (!equipe) {
    return (
      <div className="flex flex-col gap-5">
        {entete}
        <EtatVide titre={tFiche("introuvableTitre")} description={tFiche("introuvable")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {entete}

      <EnTetePage
        titre={
          <span className="flex flex-wrap items-center gap-3">
            <span
              className={cn("size-3 shrink-0 rounded-full", pastilleEquipe(rang))}
              aria-hidden="true"
            />
            {equipe.nom}
            <Badge variante={BADGE_NATURE[equipe.nature]}>{t(`nature.${equipe.nature}`)}</Badge>
          </span>
        }
        description={tFiche("sousTitre", {
          specialite: equipe.specialite,
          nombre: equipe.effectif,
        })}
      />

      {!equipe.chef && (
        <Alert variant="avertissement">
          <TriangleAlert />
          <AlertDescription>{tFiche("sansChef")}</AlertDescription>
        </Alert>
      )}

      <TableauListe
        colonnes={colonnes}
        donnees={lignes}
        cleLigne={(membre) => membre.id}
        messageVide={filtresActifs ? tFiche("aucunResultat") : tFiche("aucunMembre")}
        filtresActifs={filtresActifs}
        onReinitialiser={() => setCriteres(CRITERES_MEMBRES_VIDES)}
        cleCriteres={`${criteres.recherche}|${criteres.role}`}
        exporter={exporter}
        actions={
          <Bouton
            variante="primaire"
            taille="sm"
            iconeGauche={<Plus size={16} aria-hidden="true" />}
            onClick={() => ouvrir(() => setAjoutOuvert(true))}
          >
            {tFiche("actionAjouter")}
          </Bouton>
        }
        outils={
          <>
            <RechercheTableau
              valeur={criteres.recherche}
              onChangement={(recherche) => setCriteres({ ...criteres, recherche })}
              libelle={tFiche("recherche")}
              placeholder={tFiche("recherchePlaceholder")}
            />
            <FiltreTableau
              valeur={criteres.role}
              onChangement={(role) => setCriteres({ ...criteres, role })}
              libelle={tFiche("filtreRole")}
              libelleTous={tFiche("tousRoles")}
              options={rolesPresents(equipe).map((role) => ({
                valeur: role,
                libelle: t(`role.${role}`),
              }))}
            />
          </>
        }
      />

      <ModaleAjoutMembre
        key={`ajout-${ouverture}`}
        ouverte={ajoutOuvert}
        onFermer={() => setAjoutOuvert(false)}
        projetId={projetId}
        equipe={equipe}
        onAjoute={surModifiee}
      />
      <ModaleRoleMembre
        key={`role-${ouverture}`}
        membre={membreRole}
        onFermer={() => setMembreRole(null)}
        projetId={projetId}
        equipe={equipe}
        onModifiee={surModifiee}
      />
      <ModaleRetraitMembre
        key={`retrait-${ouverture}`}
        membre={membreRetrait}
        onFermer={() => setMembreRetrait(null)}
        projetId={projetId}
        equipe={equipe}
        onRetire={surModifiee}
      />
    </div>
  );
}

/**
 * Le projet auquel appartient l'équipe, rappelé en tête de la fiche. Il reste
 * collé sous l'en-tête de l'application quand on descend dans la liste, comme
 * le sélecteur de chantier des écrans voisins.
 */
function ProjetConcerne({ projet }: { projet: Projet }) {
  const t = useTranslations("projets.equipesAffectations.fiche");
  const [barre, setBarre] = useState<HTMLDivElement | null>(null);
  const colle = useEstColle(barre);

  return (
    <div ref={setBarre} className={cn(BARRE_PROJET, colle && BARRE_PROJET_COLLEE)}>
      <div className="flex flex-col rounded-xl border border-l-4 border-solid border-primary-100 border-l-primary bg-primary-50 px-4 py-3 shadow-sm">
        <span className="text-xs font-medium text-primary">{t("projet")}</span>
        <span className="truncate text-base font-semibold text-neutral-900">{projet.nom}</span>
        {projet.ville && <span className="truncate text-xs text-neutral-600">{projet.ville}</span>}
      </div>
    </div>
  );
}
