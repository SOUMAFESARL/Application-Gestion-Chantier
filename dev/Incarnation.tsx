/* eslint-disable i18next/no-literal-string, no-restricted-syntax --
 * Outil de développement, jamais livré : ses libellés ne doivent pas entrer
 * dans `messages/fr.json`, où ils se retrouveraient à traduire. Même exception
 * que `ResetTest.tsx`.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Undo2, VenetianMask } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Bouton, Modale } from "@/components/ui";
import { Combobox } from "@/components/ui/combobox";
import type { ProfilUtilisateur } from "@/features/auth/api";
import { droitsDuRole, versDroits } from "@/features/habilitations/adaptateur";
import type { Droits } from "@/features/habilitations/types";
import { CLE_COLLABORATEURS, listerCollaborateurs } from "@/features/invitations/adaptateur";
import { listerProjets } from "@/features/projets/adaptateur";
import { CLE_LISTE_PROJETS } from "@/features/projets/cles";
import { ORDRE_FONCTIONS, affectationsDuCollaborateur, membresDeFonction } from "@/features/projets/regles";

import { useOutilsTest } from "./garde";
import {
  CLE_ROLES_INCARNABLES,
  PERSONNE_TEST,
  chantiersSimules,
  listerRolesIncarnables,
  porteeSimulee,
} from "./rolesTest";

/**
 * « Voir en tant que… » — OUTIL DE DÉVELOPPEMENT. Ne doit jamais être livré.
 *
 * **Le problème qu'il résout.** Seul le DG peut se connecter tant que le
 * backend ne livre pas la connexion des collaborateurs. Pour voir le portail
 * comme le verra un chef de chantier, le DG connecté **incarne un rôle** de
 * l'entreprise — tel qu'il est paramétré dans `/parametres/roles`, complété
 * des rôles en dur de `rolesTest.ts` tant que le serveur n'en livre pas — et,
 * pour la portée, une personne.
 *
 * **Ce qui change, ce qui ne change pas.** Seuls les *droits* changent. Le
 * nom affiché reste celui du DG, et rien ne s'écrit dans le profil local : on
 * ne fabrique pas d'identité. Les appels partent toujours avec le jeton du
 * DG — une écriture faite « en tant que » est donc faite par le DG. Pour
 * tester les refus du **serveur**, il faudra les vrais comptes.
 *
 * **Deux verrous** (`garde.ts`), et l'incarnation n'est retenue que si la
 * personne réellement connectée est le DG. Elle vit en `sessionStorage` :
 * elle disparaît avec l'onglet.
 */

const CLE_INCARNATION = "ccd.test.incarnation";
const EVENEMENT_INCARNATION = "ccd:test-incarnation";

interface Incarnation {
  roleId: string;
  /** `null` : aucune personne choisie, donc aucun chantier visible. */
  collaborateurId: string | null;
  personne: string | null;
  /**
   * Les chantiers rattachés à la personne de test — elle n'existe dans
   * aucune donnée, ses affectations sont donc simulées. Absent sinon.
   */
  chantiersSimules?: string[];
}

function lireBrut(): string | null {
  try {
    return window.sessionStorage.getItem(CLE_INCARNATION);
  } catch {
    return null;
  }
}

function ecrire(incarnation: Incarnation | null): void {
  try {
    if (incarnation) {
      window.sessionStorage.setItem(CLE_INCARNATION, JSON.stringify(incarnation));
    } else {
      window.sessionStorage.removeItem(CLE_INCARNATION);
    }
  } catch {
    // Stockage indisponible : l'incarnation ne tient pas, sans plus.
  }
  window.dispatchEvent(new Event(EVENEMENT_INCARNATION));
}

function abonner(rappel: () => void) {
  window.addEventListener(EVENEMENT_INCARNATION, rappel);
  return () => window.removeEventListener(EVENEMENT_INCARNATION, rappel);
}

/** La chaîne brute, stable entre deux lectures — `useSyncExternalStore` l'exige. */
function useIncarnationBrute(): Incarnation | null {
  const brut = useSyncExternalStore(abonner, lireBrut, () => null);
  return useMemo(() => {
    if (!brut) return null;
    try {
      return JSON.parse(brut) as Incarnation;
    } catch {
      return null;
    }
  }, [brut]);
}

/** Efface l'incarnation — à la déconnexion, par exemple. */
export function quitterIncarnation(): void {
  ecrire(null);
}

/**
 * Les droits en vigueur dans la coquille : ceux du profil, ou ceux du rôle
 * incarné quand les deux verrous sont ouverts et que le DG est connecté.
 * `null` tant qu'ils ne sont pas connus.
 */
export function useDroitsEnVigueur(profil: ProfilUtilisateur | null) {
  const outils = useOutilsTest();
  const brute = useIncarnationBrute();
  const droitsProfil = useMemo(() => (profil ? versDroits(profil) : null), [profil]);
  const incarnation = outils && droitsProfil?.estDirection ? brute : null;

  const roles = useQuery({
    queryKey: CLE_ROLES_INCARNABLES,
    queryFn: listerRolesIncarnables,
    enabled: incarnation !== null,
  });
  const role = incarnation ? roles.data?.find((r) => r.id === incarnation.roleId) : undefined;

  const droits: Droits | null = useMemo(() => {
    if (!incarnation) return droitsProfil;
    if (!role) return null;
    const droitsRole = droitsDuRole(role, incarnation.collaborateurId);
    if (!incarnation.chantiersSimules) return droitsRole;
    return { ...droitsRole, portee: porteeSimulee(role, incarnation.chantiersSimules) };
  }, [incarnation, role, droitsProfil]);

  // Un rôle supprimé entre-temps : on revient au DG plutôt que d'attendre.
  const roleDisparu = incarnation !== null && roles.isSuccess && !role;
  useEffect(() => {
    if (roleDisparu) quitterIncarnation();
  }, [roleDisparu]);

  return {
    droits,
    incarnation: incarnation && role ? { ...incarnation, roleLibelle: role.libelle } : null,
  };
}

/**
 * L'outil dans la barre du haut. Rien du tout hors poste de dev ou hors DG.
 *
 * Hors incarnation : un bouton « Voir en tant que… ». Pendant : la pastille
 * qui rappelle en permanence qu'on n'est plus le DG — un clic dessus change
 * de rôle, « Revenir au DG » en sort.
 */
export function IncarnationBarreHaut({
  profil,
  incarnation,
}: {
  profil: ProfilUtilisateur | null;
  incarnation: { roleLibelle: string; personne: string | null } | null;
}) {
  const outils = useOutilsTest();
  const [ouverte, setOuverte] = useState(false);
  if (!outils || !profil || !versDroits(profil).estDirection) return null;

  const modale = ouverte && <ModaleIncarnation onFermer={() => setOuverte(false)} />;

  if (!incarnation) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOuverte(true)}
          title="Voir le portail avec les droits d’un autre rôle (outil de test)"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-avertissement/40 bg-transparent px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-avertissement-fond hover:text-neutral-900"
        >
          <VenetianMask size={14} aria-hidden="true" className="text-avertissement" />
          <span className="hidden sm:inline">Voir en tant que…</span>
        </button>
        {modale}
      </>
    );
  }

  return (
    <>
      <span className="inline-flex items-center gap-1 rounded-full border border-avertissement/30 bg-avertissement-fond py-1 pr-1 pl-1 text-xs font-medium text-neutral-900">
        <button
          type="button"
          onClick={() => setOuverte(true)}
          title="Changer de rôle"
          className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent py-0.5 pr-1 pl-2 text-xs font-medium text-neutral-900 hover:text-primary-600"
        >
          <FlaskConical size={14} aria-hidden="true" className="shrink-0 text-avertissement" />
          <span className="max-w-56 truncate">
            Test : {incarnation.roleLibelle}
            {incarnation.personne ? ` · ${incarnation.personne}` : ""}
          </span>
        </button>
        <button
          type="button"
          onClick={quitterIncarnation}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border-0 bg-neutral-0 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:text-primary-600"
        >
          <Undo2 size={12} aria-hidden="true" />
          Revenir au DG
        </button>
      </span>
      {modale}
    </>
  );
}

function ModaleIncarnation({ onFermer }: { onFermer: () => void }) {
  const [roleId, setRoleId] = useState("");
  const [collaborateurId, setCollaborateurId] = useState("");

  const roles = useQuery({ queryKey: CLE_ROLES_INCARNABLES, queryFn: listerRolesIncarnables });
  const collaborateurs = useQuery({ queryKey: CLE_COLLABORATEURS, queryFn: listerCollaborateurs });
  const projets = useQuery({
    queryKey: CLE_LISTE_PROJETS,
    queryFn: ({ signal }) => listerProjets(signal),
  });

  /**
   * Les personnes proposées : les collaborateurs de l'entreprise, et celles
   * que citent les chantiers (le jeu de démonstration des projets porte ses
   * propres intervenants). Chacune avec le nombre de chantiers qu'elle verra.
   */
  const personnes = useMemo(() => {
    const noms = new Map<string, string>();
    for (const c of collaborateurs.data ?? []) noms.set(c.id, c.nomComplet || c.email);
    for (const p of projets.data ?? []) {
      for (const i of ORDRE_FONCTIONS.flatMap((fonction) => membresDeFonction(p, fonction))) {
        if (!noms.has(i.id)) noms.set(i.id, i.nomComplet);
      }
    }
    return [...noms.entries()]
      .map(([id, nom]) => ({
        valeur: id,
        libelle: `${nom} — ${affectationsDuCollaborateur(projets.data ?? [], id).length} chantier(s)`,
        nom,
        chantiers: affectationsDuCollaborateur(projets.data ?? [], id).length,
      }))
      // Une personne sans chantier ne montre rien : inutile de l'incarner.
      .filter((p) => p.chantiers > 0)
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [collaborateurs.data, projets.data]);

  /** Les deux premiers chantiers, prêtés à la personne de test. */
  const simules = useMemo(() => chantiersSimules(projets.data ?? []), [projets.data]);
  const options = useMemo(
    () => [
      ...(simules.length > 0
        ? [
            {
              valeur: PERSONNE_TEST.id,
              libelle: `${PERSONNE_TEST.nom} — ${simules.length} chantier(s) simulé(s)`,
            },
          ]
        : []),
      ...personnes,
    ],
    [simules, personnes],
  );
  const choix = collaborateurId || options[0]?.valeur || "";

  const optionsRoles = (roles.data ?? [])
    .filter((r) => r.est_actif)
    .map((r) => ({ valeur: r.id, libelle: r.libelle }));

  function incarner() {
    if (choix === PERSONNE_TEST.id) {
      ecrire({
        roleId,
        collaborateurId: PERSONNE_TEST.id,
        personne: PERSONNE_TEST.nom,
        chantiersSimules: simules.map((p) => p.id),
      });
    } else {
      const personne = personnes.find((p) => p.valeur === choix);
      if (!personne) return;
      ecrire({ roleId, collaborateurId: personne.valeur, personne: personne.nom });
    }
    onFermer();
  }

  return (
    <Modale
      ouverte
      titre="Voir en tant que… (outil de test)"
      onFermer={onFermer}
      actions={
        <>
          <Bouton variante="ghost" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton variante="primaire" disabled={!roleId || !choix} onClick={incarner}>
            Incarner
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-neutral-600">
          Les droits deviennent ceux du rôle, tel qu’il est paramétré dans « Rôles ». Les appels
          partent toujours au nom du DG.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium text-neutral-900">Rôle</span>
          <Combobox
            options={optionsRoles}
            valeur={roleId}
            onChange={setRoleId}
            placeholder={roles.isPending ? "Chargement…" : "Choisir un rôle…"}
            placeholderRecherche="Rechercher un rôle…"
            aucunResultat="Aucun rôle."
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium text-neutral-900">Personne (ses chantiers)</span>
          <Combobox
            options={options}
            valeur={choix}
            onChange={setCollaborateurId}
            placeholder={projets.isPending ? "Chargement…" : "Aucun chantier dans l’entreprise"}
            placeholderRecherche="Rechercher une personne…"
            aucunResultat="Aucune personne."
          />
        </label>
      </div>
    </Modale>
  );
}
