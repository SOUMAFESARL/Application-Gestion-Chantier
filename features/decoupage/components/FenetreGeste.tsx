"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { useDroits } from "@/features/habilitations";
import { listerMotifsReport } from "@/features/projets/adaptateur";
import { CLE_MOTIFS_REPORT } from "@/features/projets/cles";
import { ModaleReprogrammation } from "@/features/projets/components/ModaleReprogrammation";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";
import { formaterDate } from "@/lib/format";

import {
  cloturerCase,
  creerCase,
  desactiverCase,
  mesurerCase,
  modifierCase,
  planifierCase,
  prolongationsRequises,
  reactiverCase,
} from "../adaptateur";
import { cleDecoupage } from "../cles";
import type { GesteCase } from "../regles";
import type { CaseArbre, ModeMesure, ModificationCase, Prolongation, UniteMesure } from "../types";
import { MODES_MESURE, UNITES_MESURE } from "../types";
import { premierMessage, schemaDates, schemaJustification, schemaLibelle, schemaMotif } from "../validations";

const SANS_UNITE = "aucune";

export interface GesteOuvert {
  geste: GesteCase;
  /** La case visée ; `null` pour ajouter une case au plus haut niveau. */
  cible: CaseArbre | null;
}

/**
 * Les fenêtres des gestes de la vue en arbre (lot 4) : ajouter, modifier (renommer, chiffrer,
 * métrer), planifier, mesurer, clôturer, désactiver, réactiver.
 *
 * Chaque fenêtre garde la saisie quand le serveur refuse, et affiche son message tel quel : un
 * refus de périmètre (403) ou de règle (A-5, A-6…) se lit mieux dans ses mots que dans une
 * reformulation devinée. Après une écriture, l'arbre et le projet sont relus.
 */
export function FenetreGeste({
  projet,
  ouvert,
  onFermer,
}: {
  projet: Projet;
  ouvert: GesteOuvert | null;
  onFermer: () => void;
}) {
  if (!ouvert) return null;
  const cle = `${ouvert.geste}-${ouvert.cible?.id ?? "racine"}`;
  switch (ouvert.geste) {
    case "ajouter":
      return <FenetreAjout key={cle} projet={projet} parent={ouvert.cible} onFermer={onFermer} />;
    case "modifier":
      return ouvert.cible && <FenetreModification key={cle} projet={projet} cible={ouvert.cible} onFermer={onFermer} />;
    case "planifier":
      return ouvert.cible && <FenetrePlanification key={cle} projet={projet} cible={ouvert.cible} onFermer={onFermer} />;
    case "reprogrammer":
      return (
        ouvert.cible && (
          <ModaleReprogrammation
            key={cle}
            ouverte
            onFermer={onFermer}
            objet="elements"
            id={ouvert.cible.id}
            nomObjet={ouvert.cible.libelle}
            projetId={projet.id}
            datesActuelles={{ debut: ouvert.cible.dateDebutPrevue, fin: ouvert.cible.dateFinPrevue }}
            datesBaseline={{ debut: ouvert.cible.dateDebutBaseline, fin: ouvert.cible.dateFinBaseline }}
          />
        )
      );
    case "mesurer":
      return ouvert.cible && <FenetreMesure key={cle} projet={projet} cible={ouvert.cible} onFermer={onFermer} />;
    case "cloturer":
    case "reactiver":
      return (
        ouvert.cible && (
          <FenetreConfirmation key={cle} projet={projet} cible={ouvert.cible} geste={ouvert.geste} onFermer={onFermer} />
        )
      );
    case "desactiver":
      return ouvert.cible && <FenetreDesactivation key={cle} projet={projet} cible={ouvert.cible} onFermer={onFermer} />;
  }
}

/* ------------------------------------------------------------------ *
 * Le cadre commun.
 * ------------------------------------------------------------------ */

function useEcriture<T>(projet: Projet, ecrire: (saisie: T) => Promise<unknown>, succes: string, onFermer: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ecrire,
    onSuccess: async () => {
      toast.success(succes);
      onFermer();
      // L'arbre, et le projet (son avancement, ses dates) : tout est sous `["projets", id]`.
      await client.invalidateQueries({ queryKey: cleDecoupage(projet.id) });
      await client.invalidateQueries({ queryKey: ["projets", projet.id] });
    },
  });
}

function Cadre({
  titre,
  description,
  erreur,
  enCours,
  libelleAction,
  actionDestructive,
  onValider,
  onFermer,
  children,
}: {
  titre: string;
  description?: string;
  erreur: string | null;
  enCours: boolean;
  libelleAction: string;
  actionDestructive?: boolean;
  onValider: () => void;
  onFermer: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("decoupage.gestes");
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <DialogContent className="sm:max-w-[520px]">
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(evenement) => {
            evenement.preventDefault();
            onValider();
          }}
        >
          <DialogHeader>
            <DialogTitle>{titre}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          {erreur && (
            <Alert variant="erreur">
              <CircleAlert />
              <AlertDescription>{erreur}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
              {t("annuler")}
            </Button>
            <Button type="submit" variant={actionDestructive ? "destructive" : "default"} disabled={enCours} aria-busy={enCours}>
              {enCours && <LoaderCircle className="animate-spin" />}
              {libelleAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Champ({ libelle, aide, children }: { libelle: string; aide?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
      {libelle}
      {children}
      {aide && <span className="text-xs font-normal text-neutral-500">{aide}</span>}
    </label>
  );
}

function messageServeur(erreur: unknown, repli: string): string {
  if (erreur instanceof ErreurApi) {
    const champs = Object.values(erreur.erreursParChamp);
    if (erreur.code === "validation" && champs.length > 0) return champs.join(" ");
    return erreur.message || repli;
  }
  return repli;
}

function nombreOuNull(texte: string): number | null {
  if (texte.trim() === "") return null;
  const nombre = Number(texte.replace(",", "."));
  return Number.isFinite(nombre) ? nombre : null;
}

/* ------------------------------------------------------------------ *
 * Ajouter une case.
 * ------------------------------------------------------------------ */

function FenetreAjout({ projet, parent, onFermer }: { projet: Projet; parent: CaseArbre | null; onFermer: () => void }) {
  const t = useTranslations("decoupage.gestes");
  const [libelle, setLibelle] = useState("");
  const [code, setCode] = useState("");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const motifRequis = parent?.commence ?? false;

  const ecriture = useEcriture(
    projet,
    () =>
      creerCase(projet.id, {
        parentId: parent?.id ?? null,
        libelle: libelle.trim(),
        code: code.trim() || undefined,
        motif: motifRequis ? motif.trim() : undefined,
      }),
    t("ajout.succes", { libelle: libelle.trim() }),
    onFermer,
  );

  function valider() {
    const refus =
      premierMessage(schemaLibelle.safeParse(libelle)) ??
      (motifRequis ? premierMessage(schemaMotif.safeParse(motif)) : null);
    if (refus) {
      setErreur(refus);
      return;
    }
    setErreur(null);
    ecriture.mutate(undefined, { onError: (e) => setErreur(messageServeur(e, t("erreur"))) });
  }

  return (
    <Cadre
      titre={parent ? t("ajout.titreSous", { libelle: parent.libelle }) : t("ajout.titreRacine")}
      description={t("ajout.description")}
      erreur={erreur}
      enCours={ecriture.isPending}
      libelleAction={t("ajout.action")}
      onValider={valider}
      onFermer={onFermer}
    >
      <Champ libelle={t("champs.libelle")}>
        <Input value={libelle} maxLength={200} onChange={(e) => setLibelle(e.target.value)} autoFocus />
      </Champ>
      <Champ libelle={t("champs.code")} aide={t("champs.codeAide")}>
        <Input value={code} maxLength={30} onChange={(e) => setCode(e.target.value)} />
      </Champ>
      {motifRequis && (
        <Champ libelle={t("champs.motif")} aide={t("ajout.motifAide")}>
          <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} />
        </Champ>
      )}
    </Cadre>
  );
}

/* ------------------------------------------------------------------ *
 * Modifier : renommer, recoder, chiffrer, métrer.
 * ------------------------------------------------------------------ */

function FenetreModification({ projet, cible, onFermer }: { projet: Projet; cible: CaseArbre; onFermer: () => void }) {
  const t = useTranslations("decoupage.gestes");
  const tUnite = useTranslations("decoupage.unites");
  const tMode = useTranslations("decoupage.modesMesure");
  const { voitMontants } = useDroits();
  const [libelle, setLibelle] = useState(cible.libelle);
  const [code, setCode] = useState(cible.code);
  const [modeMesure, setModeMesure] = useState<ModeMesure>(cible.modeMesure ?? "QUANTITE");
  const [unite, setUnite] = useState<UniteMesure | null>(cible.unite);
  const [quantite, setQuantite] = useState(cible.quantitePrevue === null ? "" : String(cible.quantitePrevue));
  const montantInitial = cible.estFeuille ? cible.montant : cible.enveloppe;
  const [montant, setMontant] = useState(montantInitial === null ? "" : String(montantInitial / 100));
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  /** Seuls les champs changés partent : chacun exige sa permission (découper ou chiffrer). */
  function modifications(): ModificationCase {
    const resultat: ModificationCase = {};
    if (libelle.trim() !== cible.libelle) resultat.libelle = libelle.trim();
    if (code.trim() !== cible.code) resultat.code = code.trim();
    if (cible.estFeuille) {
      if (modeMesure !== cible.modeMesure) resultat.modeMesure = modeMesure;
      if (unite !== cible.unite) resultat.unite = unite;
      const nouvelleQuantite = nombreOuNull(quantite);
      if (nouvelleQuantite !== cible.quantitePrevue) resultat.quantitePrevue = nouvelleQuantite;
    }
    if (voitMontants) {
      const francs = nombreOuNull(montant);
      const centimes = francs === null ? null : Math.round(francs * 100);
      if (centimes !== montantInitial) {
        if (cible.estFeuille) resultat.montant = centimes;
        else resultat.enveloppe = centimes;
      }
    }
    return resultat;
  }

  const changements = modifications();
  const motifRequis =
    cible.estFeuille && cible.commence && ("quantitePrevue" in changements || "montant" in changements);

  const ecriture = useEcriture(
    projet,
    (saisie: ModificationCase) => modifierCase(cible.id, saisie),
    t("modification.succes", { libelle: libelle.trim() }),
    onFermer,
  );

  function valider() {
    const saisie = modifications();
    if (Object.keys(saisie).length === 0) {
      onFermer();
      return;
    }
    const refus =
      premierMessage(schemaLibelle.safeParse(libelle)) ??
      (motifRequis ? premierMessage(schemaMotif.safeParse(motif)) : null);
    if (refus) {
      setErreur(refus);
      return;
    }
    setErreur(null);
    ecriture.mutate(
      { ...saisie, motif: motifRequis ? motif.trim() : undefined },
      { onError: (e) => setErreur(messageServeur(e, t("erreur"))) },
    );
  }

  return (
    <Cadre
      titre={t("modification.titre", { libelle: cible.libelle })}
      description={cible.estFeuille ? t("modification.descriptionFeuille") : t("modification.descriptionParent")}
      erreur={erreur}
      enCours={ecriture.isPending}
      libelleAction={t("enregistrer")}
      onValider={valider}
      onFermer={onFermer}
    >
      <div className="grid grid-cols-[2fr_1fr] gap-3 max-sm:grid-cols-1">
        <Champ libelle={t("champs.libelle")}>
          <Input value={libelle} maxLength={200} onChange={(e) => setLibelle(e.target.value)} />
        </Champ>
        <Champ libelle={t("champs.code")}>
          <Input value={code} maxLength={30} onChange={(e) => setCode(e.target.value)} />
        </Champ>
      </div>
      {cible.estFeuille && (
        <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
          <Champ libelle={t("champs.modeMesure")}>
            <Select value={modeMesure} onValueChange={(v) => setModeMesure(v as ModeMesure)} disabled={cible.commence}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES_MESURE.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {tMode(mode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Champ>
          <Champ libelle={t("champs.unite")}>
            <Select
              value={unite ?? SANS_UNITE}
              onValueChange={(v) => setUnite(v === SANS_UNITE ? null : (v as UniteMesure))}
              disabled={cible.commence}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SANS_UNITE}>{t("champs.sansUnite")}</SelectItem>
                {UNITES_MESURE.map((u) => (
                  <SelectItem key={u} value={u}>
                    {tUnite(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Champ>
          <Champ libelle={t("champs.quantitePrevue")}>
            <Input type="number" min={0} step="any" inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
          </Champ>
        </div>
      )}
      {voitMontants && (
        <Champ
          libelle={cible.estFeuille ? t("champs.montant") : t("champs.enveloppe")}
          aide={cible.estFeuille ? undefined : t("champs.enveloppeAide")}
        >
          <Input type="number" min={0} step={1} inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} />
        </Champ>
      )}
      {motifRequis && (
        <Champ libelle={t("champs.motif")} aide={t("modification.motifAide")}>
          <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} />
        </Champ>
      )}
    </Cadre>
  );
}

/* ------------------------------------------------------------------ *
 * Planifier : la première saisie des dates, et la prolongation des parents.
 * ------------------------------------------------------------------ */

function FenetrePlanification({ projet, cible, onFermer }: { projet: Projet; cible: CaseArbre; onFermer: () => void }) {
  const t = useTranslations("decoupage.gestes");
  const [debut, setDebut] = useState(cible.dateDebutPrevue ?? "");
  const [fin, setFin] = useState(cible.dateFinPrevue ?? "");
  const [prolongations, setProlongations] = useState<Prolongation[] | null>(null);
  const [motifId, setMotifId] = useState("");
  const [justification, setJustification] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const motifs = useQuery({
    queryKey: CLE_MOTIFS_REPORT,
    queryFn: ({ signal }) => listerMotifsReport(signal),
    enabled: prolongations !== null,
  });

  const ecriture = useEcriture(
    projet,
    (prolonger: boolean) =>
      planifierCase(cible.id, {
        dateDebutPrevue: debut || null,
        dateFinPrevue: fin || null,
        prolonger,
        motifId: prolonger ? motifId : null,
        justification: prolonger ? justification.trim() : undefined,
      }),
    t("planification.succes", { libelle: cible.libelle }),
    onFermer,
  );

  function valider() {
    const refus = premierMessage(schemaDates.safeParse({ debut: debut || null, fin: fin || null }));
    if (refus) {
      setErreur(refus);
      return;
    }
    const prolonger = prolongations !== null;
    if (prolonger) {
      const refusProlongation = !motifId ? t("planification.motifRequis") : premierMessage(schemaJustification.safeParse(justification));
      if (refusProlongation) {
        setErreur(refusProlongation);
        return;
      }
    }
    setErreur(null);
    ecriture.mutate(prolonger, {
      onError: (e) => {
        const aProlonger = prolongationsRequises(e);
        if (aProlonger) {
          setProlongations(aProlonger);
          return;
        }
        setErreur(messageServeur(e, t("erreur")));
      },
    });
  }

  return (
    <Cadre
      titre={t("planification.titre", { libelle: cible.libelle })}
      description={t("planification.description")}
      erreur={erreur}
      enCours={ecriture.isPending}
      libelleAction={prolongations ? t("planification.prolonger") : t("planification.action")}
      onValider={valider}
      onFermer={onFermer}
    >
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Champ libelle={t("champs.debut")}>
          <Input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} disabled={prolongations !== null} />
        </Champ>
        <Champ libelle={t("champs.fin")}>
          <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} disabled={prolongations !== null} />
        </Champ>
      </div>
      {prolongations && (
        <div className="flex flex-col gap-3">
          <Alert variant="avertissement">
            <CircleAlert />
            <AlertDescription>
              <p className="m-0">{t("planification.prolongationRequise")}</p>
              <ul className="m-0 mt-2 list-disc pl-5">
                {prolongations.map((p) => (
                  <li key={`${p.type}-${p.id}`}>
                    {p.type === "PROJET" ? t("planification.leProjet", { libelle: p.libelle }) : p.libelle}
                    {" : "}
                    {t("planification.periode", {
                      debutAvant: formaterDate(p.dateDebutAvant),
                      finAvant: formaterDate(p.dateFinAvant),
                      debutApres: formaterDate(p.dateDebutApres),
                      finApres: formaterDate(p.dateFinApres),
                    })}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
          <Champ libelle={t("champs.motifReport")}>
            <Select value={motifId} onValueChange={setMotifId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("champs.choisirMotif")} />
              </SelectTrigger>
              <SelectContent>
                {(motifs.data ?? []).map((motif) => (
                  <SelectItem key={motif.id} value={motif.id}>
                    {motif.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Champ>
          <Champ libelle={t("champs.justification")} aide={t("planification.justificationAide")}>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} />
          </Champ>
        </div>
      )}
    </Cadre>
  );
}

/* ------------------------------------------------------------------ *
 * Mesurer une feuille hors du journal.
 * ------------------------------------------------------------------ */

function FenetreMesure({ projet, cible, onFermer }: { projet: Projet; cible: CaseArbre; onFermer: () => void }) {
  const t = useTranslations("decoupage.gestes");
  const tUnite = useTranslations("decoupage.unites");
  const mode = cible.modeMesure ?? "QUANTITE";
  const [valeur, setValeur] = useState(
    mode === "QUANTITE"
      ? String(cible.quantiteRealisee ?? "")
      : mode === "POURCENTAGE"
        ? String(cible.pourcentageDeclare ?? "")
        : "",
  );
  const [atteint, setAtteint] = useState(cible.cloture);
  const [commentaire, setCommentaire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const ecriture = useEcriture(
    projet,
    () =>
      mesurerCase(cible.id, {
        quantiteRealisee: mode === "QUANTITE" ? nombreOuNull(valeur) : undefined,
        pourcentageDeclare: mode === "POURCENTAGE" ? nombreOuNull(valeur) : undefined,
        atteint: mode === "JALON" ? atteint : undefined,
        commentaire: commentaire.trim(),
      }),
    t("mesure.succes", { libelle: cible.libelle }),
    onFermer,
  );

  function valider() {
    if (!commentaire.trim()) {
      setErreur(t("mesure.commentaireRequis"));
      return;
    }
    if (mode !== "JALON" && nombreOuNull(valeur) === null) {
      setErreur(t("mesure.valeurRequise"));
      return;
    }
    setErreur(null);
    ecriture.mutate(undefined, { onError: (e) => setErreur(messageServeur(e, t("erreur"))) });
  }

  return (
    <Cadre
      titre={t("mesure.titre", { libelle: cible.libelle })}
      description={t("mesure.description")}
      erreur={erreur}
      enCours={ecriture.isPending}
      libelleAction={t("enregistrer")}
      onValider={valider}
      onFermer={onFermer}
    >
      {mode === "QUANTITE" && (
        <Champ
          libelle={t("mesure.quantiteRealisee", { unite: cible.unite ? tUnite(cible.unite) : "" })}
          aide={cible.quantitePrevue !== null ? t("mesure.surPrevu", { prevu: cible.quantitePrevue }) : undefined}
        >
          <Input type="number" min={0} step="any" inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} />
        </Champ>
      )}
      {mode === "POURCENTAGE" && (
        <Champ libelle={t("mesure.pourcentage")}>
          <Input type="number" min={0} max={100} step="any" inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} />
        </Champ>
      )}
      {mode === "JALON" && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
          <Checkbox checked={atteint} onCheckedChange={(v) => setAtteint(v === true)} />
          {t("mesure.jalonAtteint")}
        </label>
      )}
      <Champ libelle={t("champs.commentaire")}>
        <Textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3} />
      </Champ>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ *
 * Clôturer, réactiver, désactiver.
 * ------------------------------------------------------------------ */

function FenetreConfirmation({
  projet,
  cible,
  geste,
  onFermer,
}: {
  projet: Projet;
  cible: CaseArbre;
  geste: "cloturer" | "reactiver";
  onFermer: () => void;
}) {
  const t = useTranslations("decoupage.gestes");
  const [erreur, setErreur] = useState<string | null>(null);
  const ecriture = useEcriture(
    projet,
    () => (geste === "cloturer" ? cloturerCase(cible.id) : reactiverCase(cible.id)),
    t(`${geste}.succes`, { libelle: cible.libelle }),
    onFermer,
  );
  return (
    <Cadre
      titre={t(`${geste}.titre`, { libelle: cible.libelle })}
      description={t(`${geste}.description`)}
      erreur={erreur}
      enCours={ecriture.isPending}
      libelleAction={t(`${geste}.action`)}
      onValider={() => ecriture.mutate(undefined, { onError: (e) => setErreur(messageServeur(e, t("erreur"))) })}
      onFermer={onFermer}
    />
  );
}

function FenetreDesactivation({ projet, cible, onFermer }: { projet: Projet; cible: CaseArbre; onFermer: () => void }) {
  const t = useTranslations("decoupage.gestes");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const ecriture = useEcriture(
    projet,
    () => desactiverCase(cible.id, motif.trim()),
    t("desactiver.succes", { libelle: cible.libelle }),
    onFermer,
  );

  function valider() {
    const refus = premierMessage(schemaMotif.safeParse(motif));
    if (refus) {
      setErreur(refus);
      return;
    }
    setErreur(null);
    ecriture.mutate(undefined, { onError: (e) => setErreur(messageServeur(e, t("erreur"))) });
  }

  return (
    <Cadre
      titre={t("desactiver.titre", { libelle: cible.libelle })}
      description={t("desactiver.description")}
      erreur={erreur}
      enCours={ecriture.isPending}
      libelleAction={t("desactiver.action")}
      actionDestructive
      onValider={valider}
      onFermer={onFermer}
    >
      <Champ libelle={t("champs.motif")}>
        <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} />
      </Champ>
    </Cadre>
  );
}
