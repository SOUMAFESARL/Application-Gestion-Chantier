"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, LoaderCircle, LogOut, MapPin, Save, Trash2, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cleDecoupage } from "@/features/decoupage/cles";
import { SelecteurPerimetre } from "@/features/decoupage/components/SelecteurPerimetre";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import { cleEquipes } from "@/features/projets/cles";
import type { Projet } from "@/features/projets/types";
import { listerTiers } from "@/features/tiers/adaptateur";
import { ErreurApi } from "@/lib/api";
import { formaterDate } from "@/lib/format";

import {
  affecterEquipeCase,
  ajouterMembre,
  creerEquipeProjet,
  listerPersonnes,
  modifierEquipeProjet,
  modifierMembre,
  retirerAffectationEquipe,
  retirerMembre,
} from "../adaptateur";
import { cleEquipesProjet, CLE_PARTENAIRES, cleRegistre } from "../cles";
import { aujourdhuiIso, personnesAjoutables } from "../regles";
import type { Avertissement, EquipeProjet, FonctionMembre, MembreEquipe } from "../types";
import { FONCTIONS_MEMBRE } from "../types";
import { FenetrePersonne } from "./FenetrePersonne";

const INTERNE = "interne";

/**
 * Le tiroir d'une équipe du projet : son identité (nom, corps d'état, entreprise), ses membres
 * datés pris dans le registre — avec l'ajout rapide d'une personne absente du registre —, et les
 * cases de l'arbre où elle travaille. Une personne dans deux équipes le même jour est permise :
 * le serveur l'avertit, l'écran le montre.
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
  const { peutSurProjet } = useDroits();
  const permis = peutSurProjet(PERMISSIONS.GERER_EQUIPES, projet);

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg text-neutral-900">{equipe ? equipe.nom : t("titreNouvelle")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-6 py-5">
          <Identite projet={projet} equipe={equipe} permis={permis} onCreee={onCreee} />
          {equipe && (
            <>
              <Membres projet={projet} equipe={equipe} permis={permis} />
              <Cases projet={projet} equipe={equipe} permis={permis} />
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
 * Identité.
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
  const actualiser = useActualiser(projet.id);
  const [nom, setNom] = useState(equipe?.nom ?? "");
  const [corpsEtat, setCorpsEtat] = useState(equipe?.corpsEtat ?? "");
  const [entreprise, setEntreprise] = useState(equipe?.entreprise.id ?? INTERNE);
  const [erreur, setErreur] = useState<string | null>(null);
  const partenaires = useQuery({ queryKey: CLE_PARTENAIRES, queryFn: ({ signal }) => listerTiers(undefined, signal) });

  const ecriture = useMutation({
    mutationFn: () => {
      const saisie = { nom, corpsEtat, entreprisePartenaireId: entreprise === INTERNE ? null : entreprise };
      return equipe ? modifierEquipeProjet(projet.id, equipe.id, saisie) : creerEquipeProjet(projet.id, saisie);
    },
    onSuccess: async ({ resultat, avertissements }) => {
      setErreur(null);
      toast.success(equipe ? t("enregistree", { nom: resultat.nom }) : t("creee", { nom: resultat.nom }));
      signaler(avertissements);
      await actualiser();
      if (!equipe) onCreee(resultat);
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });

  return (
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
        <Select value={entreprise} onValueChange={setEntreprise} disabled={!permis}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={INTERNE}>{t("notreEntreprise")}</SelectItem>
            {(partenaires.data ?? []).map((tiers) => (
              <SelectItem key={tiers.id} value={tiers.id}>
                {tiers.raisonSociale}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
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
  );
}

/* ------------------------------------------------------------------ *
 * Membres.
 * ------------------------------------------------------------------ */

function Membres({ projet, equipe, permis }: { projet: Projet; equipe: EquipeProjet; permis: boolean }) {
  const t = useTranslations("equipes.tiroir");
  const tFonction = useTranslations("equipes.fonctions");
  const actualiser = useActualiser(projet.id);
  const [ajout, setAjout] = useState(false);
  const [depart, setDepart] = useState<MembreEquipe | null>(null);

  const chef = useMutation({
    mutationFn: (membre: MembreEquipe) => modifierMembre(projet.id, equipe.id, membre.id, { estChef: true }),
    onSuccess: async ({ avertissements }) => {
      signaler(avertissements);
      await actualiser();
    },
    onError: (e) => toast.error(messageErreur(e, t("erreur"))),
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
          {equipe.membres.map((membre) => (
            <li key={membre.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 font-medium text-neutral-900">
                  {membre.personne.nomComplet}
                  {membre.estChef && <Badge variante="primaire">{t("chef")}</Badge>}
                  {!membre.personne.entreprise.interne && membre.personne.entreprise.id !== equipe.entreprise.id && (
                    <Badge variante="avertissement">{membre.personne.entreprise.nom}</Badge>
                  )}
                </span>
                <span className="text-xs text-neutral-500">
                  {membre.dateDepart
                    ? t("periodeMembreFinie", {
                        fonction: tFonction(membre.fonction),
                        debut: formaterDate(membre.dateArrivee),
                        fin: formaterDate(membre.dateDepart),
                      })
                    : t("periodeMembre", { fonction: tFonction(membre.fonction), debut: formaterDate(membre.dateArrivee) })}
                </span>
              </span>
              {permis && (
                <span className="flex gap-1">
                  {!membre.estChef && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("nommerChef")}
                      title={t("nommerChef")}
                      onClick={() => chef.mutate(membre)}
                      disabled={chef.isPending}
                    >
                      <Crown />
                    </Button>
                  )}
                  <Button size="icon-sm" variant="ghost" aria-label={t("fairePartir")} title={t("fairePartir")} onClick={() => setDepart(membre)}>
                    <LogOut />
                  </Button>
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
          ))}
        </ul>
      )}
      {ajout && <FenetreAjoutMembre projet={projet} equipe={equipe} onFermer={() => setAjout(false)} />}
      {depart && <FenetreDepart projet={projet} equipe={equipe} membre={depart} onFermer={() => setDepart(null)} />}
    </Section>
  );
}

function FenetreAjoutMembre({ projet, equipe, onFermer }: { projet: Projet; equipe: EquipeProjet; onFermer: () => void }) {
  const t = useTranslations("equipes.tiroir");
  const tFonction = useTranslations("equipes.fonctions");
  const { peutCode } = useDroits();
  const actualiser = useActualiser(projet.id);
  const [personneId, setPersonneId] = useState("");
  const [fonction, setFonction] = useState<FonctionMembre>("OUVRIER");
  const [estChef, setEstChef] = useState(false);
  const [arrivee, setArrivee] = useState(aujourdhuiIso());
  const [ajoutRapide, setAjoutRapide] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const registre = useQuery({ queryKey: cleRegistre(), queryFn: ({ signal }) => listerPersonnes({}, signal) });
  const proposees = personnesAjoutables(registre.data ?? [], equipe.membres);

  const ecriture = useMutation({
    mutationFn: () =>
      ajouterMembre(projet.id, equipe.id, { personneId, fonction, estChef, dateArrivee: arrivee || null }),
    onSuccess: async ({ resultat, avertissements }) => {
      toast.success(t("membreAjoute", { nom: resultat.personne.nomComplet }));
      signaler(avertissements);
      onFermer();
      await actualiser();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !ecriture.isPending && onFermer()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t("titreAjoutMembre", { equipe: equipe.nom })}</DialogTitle>
          <DialogDescription>{t("descriptionAjoutMembre")}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
          {t("personne")}
          <Select value={personneId} onValueChange={setPersonneId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={registre.isPending ? t("chargement") : t("choisirPersonne")} />
            </SelectTrigger>
            <SelectContent>
              {proposees.map((personne) => (
                <SelectItem key={personne.id} value={personne.id}>
                  {personne.metier ? t("personneMetier", { nom: personne.nomComplet, metier: personne.metier }) : personne.nomComplet}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
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
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            {t("fonction")}
            <Select value={fonction} onValueChange={(v) => setFonction(v as FonctionMembre)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONCTIONS_MEMBRE.map((f) => (
                  <SelectItem key={f} value={f}>
                    {tFonction(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            {t("arrivee")}
            <Input type="date" value={arrivee} onChange={(e) => setArrivee(e.target.value)} />
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
          <Checkbox checked={estChef} onCheckedChange={(v) => setEstChef(v === true)} />
          {t("estChef")}
        </label>
        {erreur && (
          <Alert variant="erreur">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onFermer} disabled={ecriture.isPending}>
            {t("annuler")}
          </Button>
          <Button onClick={() => ecriture.mutate()} disabled={ecriture.isPending || !personneId}>
            {ecriture.isPending && <LoaderCircle className="animate-spin" />}
            {t("ajouter")}
          </Button>
        </DialogFooter>
        {ajoutRapide && (
          <FenetrePersonne
            personne={null}
            entrepriseParDefaut={equipe.entreprise.id}
            onFermer={() => setAjoutRapide(false)}
            onEnregistree={(personne) => setPersonneId(personne.id)}
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
        <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
          {t("dateDepart")}
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
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
