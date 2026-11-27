"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, LoaderCircle, LogOut, MapPin, Pencil, Power, Save, Search, Trash2, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelecteurDate } from "@/components/ui/SelecteurDate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cleDecoupage } from "@/features/decoupage/cles";
import { SelecteurPerimetre } from "@/features/decoupage/components/SelecteurPerimetre";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import { cleEquipes } from "@/features/projets/cles";
import { ComboboxReferentiel } from "@/features/projets/components/ComboboxReferentiel";
import { REFERENTIEL_FONCTIONS_EQUIPE, useReferentiel } from "@/features/projets/referentiels";
import type { Projet } from "@/features/projets/types";
import { listerTiers } from "@/features/tiers/adaptateur";
import { ErreurApi } from "@/lib/api";
import { formaterDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  affecterEquipeCase,
  ajouterMembres,
  creerEquipeProjet,
  listerPersonnes,
  listerUtilisateursEntreprise,
  modifierEquipeProjet,
  modifierMembre,
  retirerAffectationEquipe,
  retirerMembre,
  supprimerEquipeProjet,
} from "../adaptateur";
import { cleEquipesProjet, CLE_PARTENAIRES, cleRegistre, cleUtilisateursEntreprise } from "../cles";
import {
  aujourdhuiIso,
  filtrerPartenairesEligibles,
  personnesAjoutables,
  resoudreCodeFonctionDepuisMetier,
  trierPersonnesPourEquipe,
} from "../regles";
import type {
  Avertissement,
  EquipeProjet,
  FonctionMembre,
  MembreEquipe,
  Personne,
  SaisieMembre,
} from "../types";
import { FONCTION_MEMBRE_DEFAUT } from "../types";
import { FenetrePersonne } from "./FenetrePersonne";

const INTERNE = "interne";

interface MembreBrouillon extends SaisieMembre {
  nomComplet: string;
  roleOuMetier?: string;
  estUtilisateur?: boolean;
  personne?: Personne;
  /** Entreprise d'appartenance : `null` pour notre entreprise, UUID pour un partenaire. */
  entrepriseId: string | null;
  entrepriseNom?: string;
}

function cleMembre(m: { utilisateurId?: string; personneId?: string }): string {
  return m.utilisateurId ? `u:${m.utilisateurId}` : `p:${m.personneId}`;
}

/**
 * Le tiroir d'une équipe du projet : son identité (nom, corps d'état, entreprise), ses membres
 * datés pris dans le registre — avec sélection multiple par fonction et ajout rapide d'une
 * personne absente du registre —, désignation du chef par couronne seule, et les cases de
 * l'arbre où elle travaille.
 */
export function TiroirEquipeProjet({
  projet,
  equipe,
  onCreee,
  onFermer,
}: {
  projet: Projet;
  /** `null` : une nouvelle équipe. */
  equipe: EquipeProjet | null;
  onCreee: (equipe: EquipeProjet) => void;
  onFermer: () => void;
}) {
  const t = useTranslations("equipes.tiroir");
  const tEquipes = useTranslations("equipes");
  const { peutSurProjet } = useDroits();
  const permis = peutSurProjet(PERMISSIONS.GERER_EQUIPES, projet);
  // Précharge le référentiel des fonctions d'équipe dès l'ouverture du tiroir.
  useReferentiel(REFERENTIEL_FONCTIONS_EQUIPE);

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg text-neutral-900">
            <span>{equipe ? equipe.nom : t("titreNouvelle")}</span>
            {equipe && !equipe.estActive && <Badge variante="neutre">{tEquipes("inactive")}</Badge>}
          </SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-6 py-5">
          <Identite projet={projet} equipe={equipe} permis={permis} onCreee={onCreee} />
          {equipe && (
            <>
              <Membres projet={projet} equipe={equipe} permis={permis} />
              <Cases projet={projet} equipe={equipe} permis={permis} />
              {permis && <ActionsEquipe projet={projet} equipe={equipe} onSupprimee={onFermer} />}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function useActualiser(projetId: string) {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: cleEquipesProjet(projetId) });
    // L'arbre porte les équipes de chaque case ; la synthèse, l'effectif du projet.
    await client.invalidateQueries({ queryKey: cleDecoupage(projetId) });
    await client.invalidateQueries({ queryKey: cleEquipes(projetId) });
  };
}

/** Les avertissements du serveur (deux équipes le même jour…) : affichés, jamais bloquants. */
function signaler(avertissements: Avertissement[]) {
  for (const avertissement of avertissements) toast.warning(avertissement.message);
}

function messageErreur(erreur: unknown, repli: string): string {
  if (erreur instanceof ErreurApi) {
    const champs = Object.values(erreur.erreursParChamp);
    return erreur.code === "validation" && champs.length > 0 ? champs.join(" ") : erreur.message || repli;
  }
  return repli;
}

function Section({ titre, action, children }: { titre: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-base font-semibold text-neutral-900">{titre}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Identité (et membres initiaux lors de la création).
 * ------------------------------------------------------------------ */

function Identite({
  projet,
  equipe,
  permis,
  onCreee,
}: {
  projet: Projet;
  equipe: EquipeProjet | null;
  permis: boolean;
  onCreee: (equipe: EquipeProjet) => void;
}) {
  const t = useTranslations("equipes.tiroir");
  const { libelle: libelleFonction } = useReferentiel(REFERENTIEL_FONCTIONS_EQUIPE);
  const actualiser = useActualiser(projet.id);
  const [nom, setNom] = useState(equipe?.nom ?? "");
  const [corpsEtat, setCorpsEtat] = useState(equipe?.corpsEtat ?? "");
  const [entreprise, setEntreprise] = useState(equipe?.entreprise.id ?? INTERNE);
  const [membresInitiaux, setMembresInitiaux] = useState<MembreBrouillon[]>([]);
  const [fenetreMembresOuverte, setFenetreMembresOuverte] = useState(false);
  const [membreEnEdition, setMembreEnEdition] = useState<MembreBrouillon | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const partenaires = useQuery({ queryKey: CLE_PARTENAIRES, queryFn: ({ signal }) => listerTiers(undefined, signal) });

  const partenairesEligibles = useMemo(() => {
    const filtres = filtrerPartenairesEligibles(partenaires.data ?? []);
    if (
      equipe &&
      !equipe.entreprise.interne &&
      equipe.entreprise.id &&
      !filtres.some((p) => p.id === equipe.entreprise.id)
    ) {
      return [...filtres, { id: equipe.entreprise.id, raisonSociale: equipe.entreprise.nom }];
    }
    return filtres;
  }, [partenaires.data, equipe]);

  const equipeEntrepriseId = entreprise === INTERNE ? null : entreprise;

  function changerEntreprise(nouvelleEntreprise: string) {
    setEntreprise(nouvelleEntreprise);
    if (equipe) return;
    const nouvEntrepriseId = nouvelleEntreprise === INTERNE ? null : nouvelleEntreprise;
    const chefIneligible = membresInitiaux.find(
      (m) => m.estChef && m.entrepriseId !== nouvEntrepriseId,
    );
    if (chefIneligible) {
      setMembresInitiaux((courants) =>
        courants.map((m) =>
          m.estChef && m.entrepriseId !== nouvEntrepriseId ? { ...m, estChef: false } : m,
        ),
      );
      toast.warning(t("chefRetireChangementEntreprise", { nom: chefIneligible.nomComplet }));
    }
  }

  const ecriture = useMutation({
    mutationFn: () => {
      const saisie = {
        nom,
        corpsEtat,
        entreprisePartenaireId: entreprise === INTERNE ? null : entreprise,
        membres: equipe
          ? undefined
          : membresInitiaux.map((m) => ({
              personneId: m.personneId,
              utilisateurId: m.utilisateurId,
              fonction: m.fonction,
              estChef: m.estChef,
              dateArrivee: m.dateArrivee,
            })),
      };
      return equipe ? modifierEquipeProjet(projet.id, equipe.id, saisie) : creerEquipeProjet(projet.id, saisie);
    },
    onSuccess: async ({ resultat, avertissements }) => {
      setErreur(null);
      if (equipe) {
        toast.success(t("enregistree", { nom: resultat.nom }));
      } else if (resultat.membres.length > 0) {
        toast.success(t("creeeAvecMembres", { nom: resultat.nom, nombre: resultat.membres.length }));
      } else {
        toast.success(t("creee", { nom: resultat.nom }));
      }
      signaler(avertissements);
      await actualiser();
      if (!equipe) onCreee(resultat);
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });

  function ajouterMembresBrouillon(nouveaux: MembreBrouillon[]) {
    setMembresInitiaux((courants) => {
      const base = [...courants];
      const clesPresentes = new Set(base.map(cleMembre));
      for (const n of nouveaux) {
        const k = cleMembre(n);
        if (!clesPresentes.has(k)) {
          base.push(n);
          clesPresentes.add(k);
        }
      }
      return base;
    });
  }

  function basculerChefBrouillon(cle: string) {
    setMembresInitiaux((courants) => {
      const cible = courants.find((m) => cleMembre(m) === cle);
      if (!cible) return courants;
      if (!cible.estChef && cible.entrepriseId !== equipeEntrepriseId) return courants;
      const devientChef = !cible.estChef;
      return courants.map((m) => ({
        ...m,
        estChef: cleMembre(m) === cle ? devientChef : false,
      }));
    });
  }

  function modifierMembreBrouillon(
    cle: string,
    modification: { fonction: FonctionMembre; dateArrivee: string | null },
  ) {
    setMembresInitiaux((courants) =>
      courants.map((m) =>
        cleMembre(m) === cle
          ? { ...m, fonction: modification.fonction, dateArrivee: modification.dateArrivee }
          : m,
      ),
    );
    setMembreEnEdition(null);
  }

  function retirerMembreBrouillon(cle: string) {
    setMembresInitiaux((courants) => courants.filter((m) => cleMembre(m) !== cle));
  }

  return (
    <>
      <Section titre={t("identite")}>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            {t("nom")}
            <Input value={nom} maxLength={200} onChange={(e) => setNom(e.target.value)} disabled={!permis} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            {t("corpsEtat")}
            <Input value={corpsEtat} maxLength={200} onChange={(e) => setCorpsEtat(e.target.value)} disabled={!permis} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
          {t("entreprise")}
          <Select value={entreprise} onValueChange={changerEntreprise} disabled={!permis}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INTERNE}>{t("notreEntreprise")}</SelectItem>
              {partenairesEligibles.map((tiers) => (
                <SelectItem key={tiers.id} value={tiers.id}>
                  {tiers.raisonSociale}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {!equipe && (
          <div className="mt-2 flex flex-col gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-neutral-900">
                {t("membres", { nombre: membresInitiaux.length })}
              </span>
              <BoutonPermis
                type="button"
                size="sm"
                variant="outline"
                permis={permis}
                permission={PERMISSIONS.GERER_EQUIPES}
                onClick={() => setFenetreMembresOuverte(true)}
              >
                <UserPlus />
                {t("ajouterMembre")}
              </BoutonPermis>
            </div>
            {membresInitiaux.length === 0 ? (
              <p className="m-0 text-xs text-neutral-500">{t("aucunMembre")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-neutral-0 p-0">
                {membresInitiaux.map((membre) => {
                  const cle = cleMembre(membre);
                  const memeEntreprise = membre.entrepriseId === equipeEntrepriseId;
                  const bloqueChef = !membre.estChef && !memeEntreprise;
                  const libelleCouronne = bloqueChef
                    ? t("chefMemeEntreprise")
                    : membre.estChef
                      ? t("retirerChef")
                      : t("nommerChef");
                  return (
                    <li key={cle} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900">
                          {membre.nomComplet}
                          {membre.estChef && <Badge variante="primaire">{t("chef")}</Badge>}
                          {membre.estUtilisateur && <Badge variante="neutre">{t("avecCompte")}</Badge>}
                          {!memeEntreprise && (
                            <Badge variante="avertissement">
                              {membre.entrepriseId === null ? t("notreEntreprise") : membre.entrepriseNom}
                            </Badge>
                          )}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {t("periodeMembre", {
                            fonction: libelleFonction(membre.fonction),
                            debut: formaterDate(membre.dateArrivee ?? aujourdhuiIso()),
                          })}
                          {membre.roleOuMetier ? ` · ${membre.roleOuMetier}` : ""}
                        </span>
                      </span>
                      {permis && (
                        <span className="flex gap-1">
                          <span className="inline-flex" title={libelleCouronne}>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className={cn(membre.estChef && "text-primary-600")}
                              aria-label={libelleCouronne}
                              aria-pressed={membre.estChef}
                              disabled={bloqueChef}
                              onClick={() => basculerChefBrouillon(cle)}
                            >
                              <Crown />
                            </Button>
                          </span>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t("modifierMembre")}
                            title={t("modifierMembre")}
                            onClick={() => setMembreEnEdition(membre)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t("supprimerMembre")}
                            title={t("supprimerMembre")}
                            onClick={() => retirerMembreBrouillon(cle)}
                          >
                            <Trash2 />
                          </Button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {erreur && (
          <Alert variant="erreur">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <div className="flex justify-end">
          <BoutonPermis
            size="sm"
            permis={permis}
            permission={PERMISSIONS.GERER_EQUIPES}
            onClick={() => ecriture.mutate()}
            disabled={ecriture.isPending || !nom.trim()}
          >
            {ecriture.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
            {equipe ? t("enregistrer") : t("creer")}
          </BoutonPermis>
        </div>
      </Section>

      {!equipe && fenetreMembresOuverte && (
        <FenetreAjoutMembre
          projet={projet}
          nomEquipe={nom.trim() || t("titreNouvelle")}
          entrepriseId={equipeEntrepriseId}
          idsDejaPresents={membresInitiaux.map((m) => m.personneId).filter(Boolean) as string[]}
          utilisateursDejaPresents={membresInitiaux.map((m) => m.utilisateurId).filter(Boolean) as string[]}
          onAjouterBrouillon={(nouveaux) => {
            ajouterMembresBrouillon(nouveaux);
            setFenetreMembresOuverte(false);
          }}
          onFermer={() => setFenetreMembresOuverte(false)}
        />
      )}

      {!equipe && membreEnEdition && (
        <FenetreEditionMembre
          nomComplet={membreEnEdition.nomComplet}
          fonctionInitiale={membreEnEdition.fonction}
          dateArriveeInitiale={membreEnEdition.dateArrivee}
          enCours={false}
          erreur={null}
          onEnregistrer={(modif) => modifierMembreBrouillon(cleMembre(membreEnEdition), modif)}
          onFermer={() => setMembreEnEdition(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Membres d'une équipe existante.
 * ------------------------------------------------------------------ */

function Membres({ projet, equipe, permis }: { projet: Projet; equipe: EquipeProjet; permis: boolean }) {
  const t = useTranslations("equipes.tiroir");
  const { libelle: libelleFonction } = useReferentiel(REFERENTIEL_FONCTIONS_EQUIPE);
  const actualiser = useActualiser(projet.id);
  const [ajout, setAjout] = useState(false);
  const [depart, setDepart] = useState<MembreEquipe | null>(null);
  const [enEdition, setEnEdition] = useState<MembreEquipe | null>(null);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);

  const chef = useMutation({
    mutationFn: (membre: MembreEquipe) =>
      modifierMembre(projet.id, equipe.id, membre.id, { estChef: !membre.estChef }),
    onSuccess: async ({ avertissements }) => {
      signaler(avertissements);
      await actualiser();
    },
    onError: (e) => toast.error(messageErreur(e, t("erreur"))),
  });

  const edition = useMutation({
    mutationFn: ({
      membre,
      fonction,
      dateArrivee,
    }: {
      membre: MembreEquipe;
      fonction: FonctionMembre;
      dateArrivee: string | null;
    }) => modifierMembre(projet.id, equipe.id, membre.id, { fonction, dateArrivee }),
    onSuccess: async ({ avertissements }) => {
      setErreurEdition(null);
      toast.success(t("membreModifie"));
      signaler(avertissements);
      setEnEdition(null);
      await actualiser();
    },
    onError: (e) => setErreurEdition(messageErreur(e, t("erreur"))),
  });

  const suppression = useMutation({
    mutationFn: (membre: MembreEquipe) => retirerMembre(projet.id, equipe.id, membre.id, { supprimer: true }),
    onSuccess: actualiser,
    onError: (e) => toast.error(messageErreur(e, t("erreur"))),
  });

  return (
    <Section
      titre={t("membres", { nombre: equipe.effectif })}
      action={
        <BoutonPermis size="sm" variant="outline" permis={permis} permission={PERMISSIONS.GERER_EQUIPES} onClick={() => setAjout(true)}>
          <UserPlus />
          {t("ajouterMembre")}
        </BoutonPermis>
      }
    >
      {equipe.membres.length === 0 ? (
        <p className="m-0 text-sm text-neutral-500">{t("aucunMembre")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-neutral-100 rounded-lg border border-solid border-neutral-200 p-0">
          {equipe.membres.map((membre) => {
            const memeEntreprise = membre.personne.entreprise.id === equipe.entreprise.id;
            const bloqueChef = !membre.estChef && !memeEntreprise;
            const libelleCouronne = bloqueChef
              ? t("chefMemeEntreprise")
              : membre.estChef
                ? t("retirerChef")
                : t("nommerChef");
            const libelleFct = membre.fonctionLibelle || libelleFonction(membre.fonction);

            return (
              <li key={membre.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2 font-medium text-neutral-900">
                    {membre.personne.nomComplet}
                    {membre.estChef && <Badge variante="primaire">{t("chef")}</Badge>}
                    {membre.personne.aUnCompte && <Badge variante="neutre">{t("avecCompte")}</Badge>}
                    {!memeEntreprise && (
                      <Badge variante="avertissement">
                        {membre.personne.entreprise.interne
                          ? t("notreEntreprise")
                          : membre.personne.entreprise.nom}
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {membre.dateDepart
                      ? t("periodeMembreFinie", {
                          fonction: libelleFct,
                          debut: formaterDate(membre.dateArrivee),
                          fin: formaterDate(membre.dateDepart),
                        })
                      : t("periodeMembre", { fonction: libelleFct, debut: formaterDate(membre.dateArrivee) })}
                  </span>
                </span>
                {permis && (
                  <span className="flex gap-1">
                    {membre.enCours && (
                      <>
                        <span className="inline-flex" title={libelleCouronne}>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className={cn(membre.estChef && "text-primary-600")}
                            aria-label={libelleCouronne}
                            aria-pressed={membre.estChef}
                            onClick={() => chef.mutate(membre)}
                            disabled={bloqueChef || chef.isPending}
                          >
                            <Crown />
                          </Button>
                        </span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t("modifierMembre")}
                          title={t("modifierMembre")}
                          onClick={() => {
                            setErreurEdition(null);
                            setEnEdition(membre);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={t("fairePartir")} title={t("fairePartir")} onClick={() => setDepart(membre)}>
                          <LogOut />
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("supprimerMembre")}
                      title={t("supprimerMembre")}
                      onClick={() => suppression.mutate(membre)}
                      disabled={suppression.isPending}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {ajout && (
        <FenetreAjoutMembre
          projet={projet}
          equipe={equipe}
          nomEquipe={equipe.nom}
          entrepriseId={equipe.entreprise.id}
          idsDejaPresents={equipe.membres.filter((m) => m.enCours).map((m) => m.personne.id)}
          utilisateursDejaPresents={equipe.membres
            .filter((m) => m.enCours && m.personne.utilisateurId)
            .map((m) => m.personne.utilisateurId as string)}
          onFermer={() => setAjout(false)}
        />
      )}
      {enEdition && (
        <FenetreEditionMembre
          nomComplet={enEdition.personne.nomComplet}
          fonctionInitiale={enEdition.fonction}
          dateArriveeInitiale={enEdition.dateArrivee}
          enCours={edition.isPending}
          erreur={erreurEdition}
          onEnregistrer={({ fonction, dateArrivee }) =>
            edition.mutate({ membre: enEdition, fonction, dateArrivee })
          }
          onFermer={() => !edition.isPending && setEnEdition(null)}
        />
      )}
      {depart && <FenetreDepart projet={projet} equipe={equipe} membre={depart} onFermer={() => setDepart(null)} />}
    </Section>
  );
}

function FenetreEditionMembre({
  nomComplet,
  fonctionInitiale,
  dateArriveeInitiale,
  enCours,
  erreur,
  onEnregistrer,
  onFermer,
}: {
  nomComplet: string;
  fonctionInitiale: FonctionMembre;
  dateArriveeInitiale: string | null;
  enCours: boolean;
  erreur: string | null;
  onEnregistrer: (valeurs: { fonction: FonctionMembre; dateArrivee: string | null }) => void;
  onFermer: () => void;
}) {
  const t = useTranslations("equipes.tiroir");
  const tCreationProjet = useTranslations("projets.tiroirCreation");
  const [fonction, setFonction] = useState<FonctionMembre>(fonctionInitiale || FONCTION_MEMBRE_DEFAUT);
  const [arrivee, setArrivee] = useState(dateArriveeInitiale ?? aujourdhuiIso());

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{t("titreEditionMembre", { nom: nomComplet })}</DialogTitle>
          <DialogDescription>{t("descriptionEditionMembre")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            <span>{t("fonction")}</span>
            <ComboboxReferentiel
              categorie={REFERENTIEL_FONCTIONS_EQUIPE}
              valeurPar="code"
              valeur={fonction}
              onChange={setFonction}
              disabled={enCours}
            />
          </div>
          <div className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            <span>{t("arrivee")}</span>
            <SelecteurDate
              valeur={arrivee}
              onChange={setArrivee}
              placeholder={tCreationProjet("champDateChoisir")}
              disabled={enCours}
            />
          </div>
        </div>
        {erreur && (
          <Alert variant="erreur">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button
            onClick={() => onEnregistrer({ fonction, dateArrivee: arrivee || null })}
            disabled={enCours || !fonction}
          >
            {enCours && <LoaderCircle className="animate-spin" />}
            {t("enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FenetreAjoutMembre({
  projet,
  equipe,
  nomEquipe,
  entrepriseId,
  idsDejaPresents,
  utilisateursDejaPresents = [],
  onAjouterBrouillon,
  onFermer,
}: {
  projet: Projet;
  equipe?: EquipeProjet;
  nomEquipe: string;
  entrepriseId: string | null;
  idsDejaPresents: string[];
  utilisateursDejaPresents?: string[];
  onAjouterBrouillon?: (membres: MembreBrouillon[]) => void;
  onFermer: () => void;
}) {
  const t = useTranslations("equipes.tiroir");
  const tCreationProjet = useTranslations("projets.tiroirCreation");
  const { peutCode } = useDroits();
  const actualiser = useActualiser(projet.id);
  const { entrees: fonctions } = useReferentiel(REFERENTIEL_FONCTIONS_EQUIPE);

  const [onglet, setOnglet] = useState<"utilisateurs" | "registre">(
    entrepriseId !== null ? "registre" : "utilisateurs",
  );
  const [personneIds, setPersonneIds] = useState<string[]>([]);
  const [utilisateurIds, setUtilisateurIds] = useState<string[]>([]);
  const [recherchePersonne, setRecherchePersonne] = useState("");
  const [rechercheUtilisateur, setRechercheUtilisateur] = useState("");
  const [fonction, setFonction] = useState<FonctionMembre>(FONCTION_MEMBRE_DEFAUT);
  const [fonctionChoisieManuellement, setFonctionChoisieManuellement] = useState(false);
  const [arrivee, setArrivee] = useState(aujourdhuiIso());
  const [ajoutRapide, setAjoutRapide] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const registre = useQuery({
    queryKey: cleRegistre(),
    queryFn: ({ signal }) => listerPersonnes({}, signal),
  });

  const utilisateurs = useQuery({
    queryKey: cleUtilisateursEntreprise(),
    queryFn: ({ signal }) => listerUtilisateursEntreprise(signal),
  });

  const ensemblePersonnesPresentes = useMemo(() => new Set(idsDejaPresents), [idsDejaPresents]);
  const ensembleUtilisateursPresents = useMemo(() => new Set(utilisateursDejaPresents), [utilisateursDejaPresents]);

  const utilisateursProposes = useMemo(() => {
    return (utilisateurs.data ?? []).filter((u) => {
      if (ensembleUtilisateursPresents.has(u.id)) return false;
      if (u.personneId && ensemblePersonnesPresentes.has(u.personneId)) return false;
      return true;
    });
  }, [utilisateurs.data, ensembleUtilisateursPresents, ensemblePersonnesPresentes]);

  const utilisateursFiltres = useMemo(() => {
    const terme = rechercheUtilisateur.trim().toLowerCase();
    if (!terme) return utilisateursProposes;
    return utilisateursProposes.filter(
      (u) =>
        (u.nomComplet || `${u.prenom ?? ""} ${u.nom}`).toLowerCase().includes(terme) ||
        (u.role || "").toLowerCase().includes(terme) ||
        u.email.toLowerCase().includes(terme),
    );
  }, [utilisateursProposes, rechercheUtilisateur]);

  const proposees = useMemo(() => {
    const base = equipe
      ? personnesAjoutables(registre.data ?? [], equipe.membres)
      : (registre.data ?? []).filter((p) => p.estActive);
    const filtrables = base.filter((p) => {
      if (ensemblePersonnesPresentes.has(p.id)) return false;
      if (p.utilisateurId && ensembleUtilisateursPresents.has(p.utilisateurId)) return false;
      return true;
    });
    return trierPersonnesPourEquipe(filtrables, entrepriseId);
  }, [registre.data, equipe, ensemblePersonnesPresentes, ensembleUtilisateursPresents, entrepriseId]);

  const proposeesFiltrees = useMemo(() => {
    const terme = recherchePersonne.trim().toLowerCase();
    if (!terme) return proposees;
    return proposees.filter(
      (p) =>
        p.nomComplet.toLowerCase().includes(terme) ||
        p.metier.toLowerCase().includes(terme) ||
        p.entreprise.nom.toLowerCase().includes(terme),
    );
  }, [proposees, recherchePersonne]);

  function basculerUtilisateur(id: string, coche: boolean) {
    if (coche) {
      const u = (utilisateurs.data ?? []).find((x) => x.id === id);
      if (u?.personneId) {
        setPersonneIds((courants) => courants.filter((pid) => pid !== u.personneId));
      }
      setUtilisateurIds((courants) => (courants.includes(id) ? courants : [...courants, id]));
    } else {
      setUtilisateurIds((courants) => courants.filter((x) => x !== id));
    }
  }

  function preRemplirFonctionDepuisPersonne(personne: Personne) {
    if (fonctionChoisieManuellement) return;
    if (personneIds.length > 0 || utilisateurIds.length > 0) return;
    const codeReconnu = resoudreCodeFonctionDepuisMetier(personne.metier, fonctions);
    if (codeReconnu) setFonction(codeReconnu);
  }

  function basculerPersonne(id: string, coche: boolean, personneCreee?: Personne) {
    if (coche) {
      const p = personneCreee ?? (registre.data ?? []).find((x) => x.id === id);
      if (p) preRemplirFonctionDepuisPersonne(p);
      if (p?.utilisateurId) {
        setUtilisateurIds((courants) => courants.filter((uid) => uid !== p.utilisateurId));
      }
      setPersonneIds((courants) => (courants.includes(id) ? courants : [...courants, id]));
    } else {
      setPersonneIds((courants) => courants.filter((x) => x !== id));
    }
  }

  function basculerTousUtilisateursVisibles() {
    const idsVisibles = utilisateursFiltres.map((u) => u.id);
    const toutEstCoche =
      idsVisibles.length > 0 && idsVisibles.every((id) => utilisateurIds.includes(id));
    if (toutEstCoche) {
      const ensembleVisible = new Set(idsVisibles);
      setUtilisateurIds((courants) => courants.filter((id) => !ensembleVisible.has(id)));
    } else {
      const personnesARetirer = new Set(
        utilisateursFiltres.filter((u) => u.personneId).map((u) => u.personneId as string),
      );
      setPersonneIds((courants) => courants.filter((id) => !personnesARetirer.has(id)));
      setUtilisateurIds((courants) => Array.from(new Set([...courants, ...idsVisibles])));
    }
  }

  function basculerToutVisible() {
    const idsVisibles = proposeesFiltrees.map((p) => p.id);
    const toutEstCoche =
      idsVisibles.length > 0 && idsVisibles.every((id) => personneIds.includes(id));
    if (toutEstCoche) {
      const ensembleVisible = new Set(idsVisibles);
      setPersonneIds((courants) => courants.filter((id) => !ensembleVisible.has(id)));
    } else {
      const utilisateursARetirer = new Set(
        proposeesFiltrees.filter((p) => p.utilisateurId).map((p) => p.utilisateurId as string),
      );
      setUtilisateurIds((courants) => courants.filter((id) => !utilisateursARetirer.has(id)));
      setPersonneIds((courants) => Array.from(new Set([...courants, ...idsVisibles])));
    }
  }

  const ecriture = useMutation({
    mutationFn: async () => {
      if (onAjouterBrouillon) {
        const dictionnairePersonnes = new Map((registre.data ?? []).map((p) => [p.id, p]));
        const dictionnaireUtilisateurs = new Map((utilisateurs.data ?? []).map((u) => [u.id, u]));
        const nouveaux: MembreBrouillon[] = [];

        for (const uid of utilisateurIds) {
          const u = dictionnaireUtilisateurs.get(uid);
          if (u) {
            nouveaux.push({
              utilisateurId: uid,
              nomComplet: u.nomComplet || `${u.prenom ?? ""} ${u.nom}`.trim(),
              roleOuMetier: u.role || u.roleCode || "",
              estUtilisateur: true,
              entrepriseId: null,
              fonction,
              estChef: false,
              dateArrivee: arrivee || null,
            });
          }
        }

        for (const pid of personneIds) {
          const p = dictionnairePersonnes.get(pid);
          if (p) {
            nouveaux.push({
              personneId: pid,
              personne: p,
              nomComplet: p.nomComplet,
              roleOuMetier: p.metier,
              estUtilisateur: Boolean(p.utilisateurId || p.aUnCompte),
              entrepriseId: p.entreprise.id,
              entrepriseNom: p.entreprise.nom,
              fonction,
              estChef: false,
              dateArrivee: arrivee || null,
            });
          }
        }

        onAjouterBrouillon(nouveaux);
        return null;
      }

      if (!equipe) return null;
      return ajouterMembres(projet.id, equipe.id, {
        personneIds: personneIds.length > 0 ? personneIds : undefined,
        utilisateurIds: utilisateurIds.length > 0 ? utilisateurIds : undefined,
        fonction,
        estChef: false,
        dateArrivee: arrivee || null,
      });
    },
    onSuccess: async (reponse) => {
      if (!reponse) return;
      const { resultat, avertissements } = reponse;
      if (resultat.length === 1 && resultat[0]) {
        toast.success(t("membreAjoute", { nom: resultat[0].personne.nomComplet }));
      } else if (resultat.length > 1) {
        toast.success(t("membresAjoutes", { nombre: resultat.length }));
      }
      signaler(avertissements);
      onFermer();
      await actualiser();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });

  const idsVisiblesPersonnes = proposeesFiltrees.map((p) => p.id);
  const toutVisibleCoche =
    idsVisiblesPersonnes.length > 0 && idsVisiblesPersonnes.every((id) => personneIds.includes(id));

  const idsVisiblesUtilisateurs = utilisateursFiltres.map((u) => u.id);
  const tousUtilisateursVisiblesCoches =
    idsVisiblesUtilisateurs.length > 0 && idsVisiblesUtilisateurs.every((id) => utilisateurIds.includes(id));

  const totalSelectionnes = personneIds.length + utilisateurIds.length;

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !ecriture.isPending && onFermer()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("titreAjoutMembre", { equipe: nomEquipe })}</DialogTitle>
          <DialogDescription>{t("descriptionAjoutMembre")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            <span>{t("fonction")}</span>
            <ComboboxReferentiel
              categorie={REFERENTIEL_FONCTIONS_EQUIPE}
              valeurPar="code"
              valeur={fonction}
              onChange={(v) => {
                setFonction(v);
                setFonctionChoisieManuellement(true);
              }}
              disabled={ecriture.isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            <span>{t("arrivee")}</span>
            <SelecteurDate
              valeur={arrivee}
              onChange={setArrivee}
              placeholder={tCreationProjet("champDateChoisir")}
              disabled={ecriture.isPending}
            />
          </div>
        </div>

        {/* Onglets Collaborateurs / Registre */}
        <div className="flex border-b border-neutral-200">
          <button
            type="button"
            onClick={() => setOnglet("utilisateurs")}
            className={cn(
              "cursor-pointer border-0 border-b-2 bg-transparent px-3 py-2 text-sm font-medium transition-colors",
              onglet === "utilisateurs"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-neutral-500 hover:text-neutral-700",
            )}
          >
            {t("ongletUtilisateurs", { nombre: utilisateursProposes.length })}
          </button>
          <button
            type="button"
            onClick={() => setOnglet("registre")}
            className={cn(
              "cursor-pointer border-0 border-b-2 bg-transparent px-3 py-2 text-sm font-medium transition-colors",
              onglet === "registre"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-neutral-500 hover:text-neutral-700",
            )}
          >
            {t("ongletRegistre", { nombre: proposees.length })}
          </button>
        </div>

        {/* Sélection des personnes */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-neutral-700">
              {t("totalMembresSelectionnes", { nombre: totalSelectionnes })}
            </span>
            {onglet === "utilisateurs" ? (
              utilisateursFiltres.length > 1 && (
                <button
                  type="button"
                  onClick={basculerTousUtilisateursVisibles}
                  className="cursor-pointer border-0 bg-transparent text-xs font-medium text-primary-600 hover:underline"
                >
                  {tousUtilisateursVisiblesCoches ? t("toutDeselectionner") : t("toutSelectionner")}
                </button>
              )
            ) : (
              proposeesFiltrees.length > 1 && (
                <button
                  type="button"
                  onClick={basculerToutVisible}
                  className="cursor-pointer border-0 bg-transparent text-xs font-medium text-primary-600 hover:underline"
                >
                  {toutVisibleCoche ? t("toutDeselectionner") : t("toutSelectionner")}
                </button>
              )
            )}
          </div>

          {onglet === "utilisateurs" ? (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <Input
                  value={rechercheUtilisateur}
                  onChange={(e) => setRechercheUtilisateur(e.target.value)}
                  placeholder={t("rechercherUtilisateur")}
                  className="pl-9"
                />
              </div>

              <div className="max-h-56 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/40">
                {utilisateurs.isPending ? (
                  <p className="m-0 p-3 text-xs text-neutral-500">{t("chargement")}</p>
                ) : utilisateursFiltres.length === 0 ? (
                  <p className="m-0 p-3 text-xs text-neutral-500">{t("aucunUtilisateurDisponible")}</p>
                ) : (
                  utilisateursFiltres.map((u) => {
                    const coche = utilisateurIds.includes(u.id);
                    const nomAffiche = u.nomComplet || `${u.prenom ?? ""} ${u.nom}`.trim();
                    return (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-neutral-100/70"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Checkbox
                            checked={coche}
                            onCheckedChange={(v) => basculerUtilisateur(u.id, v === true)}
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-medium text-neutral-900">
                              {u.role ? t("utilisateurRole", { nom: nomAffiche, role: u.role }) : nomAffiche}
                            </span>
                            <span className="truncate text-xs text-neutral-500">{u.email}</span>
                          </span>
                        </span>
                        <Badge variante="neutre">{t("avecCompte")}</Badge>
                      </label>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden="true"
                />
                <Input
                  value={recherchePersonne}
                  onChange={(e) => setRecherchePersonne(e.target.value)}
                  placeholder={t("rechercherPersonne")}
                  className="pl-9"
                />
              </div>

              <div className="max-h-56 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/40">
                {registre.isPending ? (
                  <p className="m-0 p-3 text-xs text-neutral-500">{t("chargement")}</p>
                ) : proposeesFiltrees.length === 0 ? (
                  <p className="m-0 p-3 text-xs text-neutral-500">{t("aucunePersonneDisponible")}</p>
                ) : (
                  proposeesFiltrees.map((personne) => {
                    const coche = personneIds.includes(personne.id);
                    return (
                      <label
                        key={personne.id}
                        className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-neutral-100/70"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Checkbox
                            checked={coche}
                            onCheckedChange={(v) => basculerPersonne(personne.id, v === true)}
                          />
                          <span className="truncate font-medium text-neutral-900">
                            {personne.metier
                              ? t("personneMetier", { nom: personne.nomComplet, metier: personne.metier })
                              : personne.nomComplet}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          {personne.aUnCompte && <Badge variante="neutre">{t("avecCompte")}</Badge>}
                          {!personne.entreprise.interne && (
                            <Badge variante="neutre">{personne.entreprise.nom}</Badge>
                          )}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <BoutonPermis
                type="button"
                size="sm"
                variant="link"
                className="self-start px-0"
                permis={peutCode(PERMISSIONS.MAIN_OEUVRE_GERER)}
                permission={PERMISSIONS.MAIN_OEUVRE_GERER}
                onClick={() => setAjoutRapide(true)}
              >
                {t("ajoutRapide")}
              </BoutonPermis>
            </>
          )}
        </div>

        {erreur && (
          <Alert variant="erreur">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onFermer} disabled={ecriture.isPending}>
            {t("annuler")}
          </Button>
          <Button
            onClick={() => ecriture.mutate()}
            disabled={ecriture.isPending || totalSelectionnes === 0}
          >
            {ecriture.isPending && <LoaderCircle className="animate-spin" />}
            {totalSelectionnes > 1
              ? t("ajouterPlusieurs", { nombre: totalSelectionnes })
              : t("ajouter")}
          </Button>
        </DialogFooter>
        {ajoutRapide && (
          <FenetrePersonne
            personne={null}
            entrepriseParDefaut={entrepriseId}
            onFermer={() => setAjoutRapide(false)}
            onEnregistree={(personne) => {
              basculerPersonne(personne.id, true, personne);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FenetreDepart({
  projet,
  equipe,
  membre,
  onFermer,
}: {
  projet: Projet;
  equipe: EquipeProjet;
  membre: MembreEquipe;
  onFermer: () => void;
}) {
  const t = useTranslations("equipes.tiroir");
  const tCreationProjet = useTranslations("projets.tiroirCreation");
  const actualiser = useActualiser(projet.id);
  const [date, setDate] = useState(aujourdhuiIso());
  const [erreur, setErreur] = useState<string | null>(null);
  const ecriture = useMutation({
    mutationFn: () => retirerMembre(projet.id, equipe.id, membre.id, { dateDepart: date || null }),
    onSuccess: async () => {
      toast.success(t("parti", { nom: membre.personne.nomComplet }));
      onFermer();
      await actualiser();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !ecriture.isPending && onFermer()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("titreDepart", { nom: membre.personne.nomComplet })}</DialogTitle>
          <DialogDescription>{t("descriptionDepart")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
          <span>{t("dateDepart")}</span>
          <SelecteurDate
            valeur={date}
            onChange={setDate}
            placeholder={tCreationProjet("champDateChoisir")}
            disabled={ecriture.isPending}
          />
        </div>
        {erreur && (
          <Alert variant="erreur">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onFermer} disabled={ecriture.isPending}>
            {t("annuler")}
          </Button>
          <Button onClick={() => ecriture.mutate()} disabled={ecriture.isPending}>
            {ecriture.isPending && <LoaderCircle className="animate-spin" />}
            {t("fairePartir")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ *
 * Cases de l'arbre.
 * ------------------------------------------------------------------ */

function Cases({ projet, equipe, permis }: { projet: Projet; equipe: EquipeProjet; permis: boolean }) {
  const t = useTranslations("equipes.tiroir");
  const actualiser = useActualiser(projet.id);
  const [choix, setChoix] = useState<string[] | null>(null);

  const affectation = useMutation({
    mutationFn: (caseId: string) => affecterEquipeCase(projet.id, equipe.id, caseId),
    onSuccess: async (avertissements) => {
      toast.success(t("affectee"));
      signaler(avertissements);
      setChoix(null);
      await actualiser();
    },
    onError: (e) => toast.error(messageErreur(e, t("erreur"))),
  });
  const retrait = useMutation({
    mutationFn: (affectationId: string) => retirerAffectationEquipe(projet.id, affectationId),
    onSuccess: actualiser,
    onError: (e) => toast.error(messageErreur(e, t("erreur"))),
  });

  return (
    <Section
      titre={t("casesTitre")}
      action={
        choix === null && (
          <BoutonPermis
            size="sm"
            variant="outline"
            permis={permis}
            permission={PERMISSIONS.GERER_EQUIPES}
            onClick={() => setChoix([])}
            disabled={!projet.decoupageCree}
          >
            <MapPin />
            {t("affecterCase")}
          </BoutonPermis>
        )
      }
    >
      <p className="m-0 text-xs text-neutral-500">{t("heritage")}</p>
      {equipe.cases.length === 0 ? (
        <p className="m-0 text-sm text-neutral-500">{t("aucuneCase")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {equipe.cases.map((une) => (
            <li key={une.affectationId}>
              <span className="inline-flex items-center gap-1 rounded-md border border-solid border-neutral-200 bg-neutral-50 py-1 pr-1 pl-2 text-sm">
                <span className="text-xs text-neutral-500">{une.niveau}</span>
                {une.libelle}
                {permis && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("retirerCase", { libelle: une.libelle })}
                    onClick={() => retrait.mutate(une.affectationId)}
                    disabled={retrait.isPending}
                  >
                    <X />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {choix !== null && (
        <div className="flex flex-col gap-2 rounded-lg border border-solid border-neutral-200 p-3">
          <SelecteurPerimetre projetId={projet.id} valeur={choix} onChange={setChoix} unique />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setChoix(null)}>
              {t("annuler")}
            </Button>
            <Button size="sm" onClick={() => choix[0] && affectation.mutate(choix[0])} disabled={!choix[0] || affectation.isPending}>
              {affectation.isPending && <LoaderCircle className="animate-spin" />}
              {t("affecter")}
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Désactivation / Réactivation et Suppression d'une équipe existante.
 * ------------------------------------------------------------------ */

function ActionsEquipe({
  projet,
  equipe,
  onSupprimee,
}: {
  projet: Projet;
  equipe: EquipeProjet;
  onSupprimee: () => void;
}) {
  const t = useTranslations("equipes.tiroir");
  const actualiser = useActualiser(projet.id);
  const [confirmation, setConfirmation] = useState<"etat" | "suppression" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const basculerEtat = useMutation({
    mutationFn: (estActive: boolean) => modifierEquipeProjet(projet.id, equipe.id, { estActive }),
    onSuccess: async ({ resultat }) => {
      setErreur(null);
      setConfirmation(null);
      toast.success(
        resultat.estActive
          ? t("reactivee", { nom: resultat.nom })
          : t("desactivee", { nom: resultat.nom }),
      );
      await actualiser();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });

  const suppression = useMutation({
    mutationFn: () => supprimerEquipeProjet(projet.id, equipe.id),
    onSuccess: async () => {
      setErreur(null);
      setConfirmation(null);
      toast.success(t("supprimee", { nom: equipe.nom }));
      await actualiser();
      onSupprimee();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });

  const enCours = basculerEtat.isPending || suppression.isPending;

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={enCours}
          onClick={() => {
            setErreur(null);
            if (equipe.estActive) {
              setConfirmation("etat");
            } else {
              basculerEtat.mutate(true);
            }
          }}
        >
          {basculerEtat.isPending && !equipe.estActive ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Power />
          )}
          {equipe.estActive ? t("desactiverEquipe") : t("reactiverEquipe")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={enCours}
          onClick={() => {
            setErreur(null);
            setConfirmation("suppression");
          }}
        >
          <Trash2 />
          {t("supprimerEquipe")}
        </Button>
      </div>

      {confirmation && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && !enCours && setConfirmation(null)}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>
                {confirmation === "suppression"
                  ? t("titreSupprimerEquipe", { nom: equipe.nom })
                  : t("titreDesactiverEquipe", { nom: equipe.nom })}
              </DialogTitle>
              <DialogDescription>
                {confirmation === "suppression"
                  ? t("descriptionSupprimerEquipe")
                  : t("descriptionDesactiverEquipe")}
              </DialogDescription>
            </DialogHeader>
            {erreur && (
              <Alert variant="erreur">
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}
            <DialogFooter className="gap-3">
              <Button variant="outline" onClick={() => setConfirmation(null)} disabled={enCours}>
                {t("annuler")}
              </Button>
              <Button
                variant={confirmation === "suppression" ? "destructive" : "default"}
                disabled={enCours}
                onClick={() =>
                  confirmation === "suppression"
                    ? suppression.mutate()
                    : basculerEtat.mutate(false)
                }
              >
                {enCours && <LoaderCircle className="animate-spin" />}
                {confirmation === "suppression" ? t("confirmerSuppression") : t("confirmerDesactivation")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
