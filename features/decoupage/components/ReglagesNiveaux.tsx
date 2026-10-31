"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import type { Projet } from "@/features/projets/types";
import { ErreurApi } from "@/lib/api";

import { ajouterNiveauProjet, listerListes, modifierNiveau } from "../adaptateur";
import { CLE_LISTES, cleDecoupage } from "../cles";
import type { ListeValeurs, NiveauProjet, ReferenceListe } from "../types";

const SANS_LISTE = "aucune";

/**
 * Les réglages des niveaux d'un projet découpé (décision P6) : renommer un niveau, changer sa
 * liste de valeurs, cocher « Alerter à ce niveau » ; ajouter un niveau à la fin (A-3).
 *
 * Insérer un niveau entre deux autres réorganise l'arbre : c'est un geste avancé (lot 6).
 * Ces réglages portent sur tout le projet : un périmètre réduit à une branche ne suffit pas.
 */
export function ReglagesNiveaux({ projet, niveaux }: { projet: Projet; niveaux: NiveauProjet[] }) {
  const t = useTranslations("decoupage.niveaux");
  const { peutSurProjet } = useDroits();
  const permis = peutSurProjet(PERMISSIONS.DECOUPER, projet);
  const listes = useQuery({ queryKey: CLE_LISTES, queryFn: ({ signal }) => listerListes(signal) });
  const [nouveau, setNouveau] = useState("");
  const client = useQueryClient();

  const ajout = useMutation({
    mutationFn: () => ajouterNiveauProjet(projet.id, { libelle: nouveau.trim(), liste: null, alerter: false }),
    onSuccess: async () => {
      toast.success(t("ajoute", { libelle: nouveau.trim() }));
      setNouveau("");
      await client.invalidateQueries({ queryKey: cleDecoupage(projet.id) });
    },
    onError: (erreur) => toast.error(erreur instanceof ErreurApi ? erreur.message : t("erreur")),
  });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-solid border-neutral-200 bg-neutral-0 p-4 shadow-sm">
      <header>
        <h3 className="m-0 text-base font-semibold text-neutral-900">{t("titre")}</h3>
        <p className="m-0 text-sm text-neutral-600">{t("description")}</p>
      </header>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {niveaux.map((niveau) => (
          <LigneNiveau
            key={`${niveau.id}-${niveau.libelle}-${niveau.alerter}-${niveau.liste?.id ?? ""}`}
            projet={projet}
            niveau={niveau}
            listes={listes.data ?? []}
            permis={permis}
          />
        ))}
      </ol>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          if (nouveau.trim()) ajout.mutate();
        }}
      >
        <Input
          value={nouveau}
          maxLength={60}
          onChange={(e) => setNouveau(e.target.value)}
          placeholder={t("nouveauNiveau")}
          aria-label={t("nouveauNiveau")}
          className="max-w-xs"
          disabled={!permis || ajout.isPending}
        />
        <BoutonPermis type="submit" size="sm" variant="outline" permis={permis} permission={PERMISSIONS.DECOUPER} disabled={!nouveau.trim() || ajout.isPending}>
          {ajout.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}
          {t("ajouter")}
        </BoutonPermis>
      </form>
    </section>
  );
}

function LigneNiveau({
  projet,
  niveau,
  listes,
  permis,
}: {
  projet: Projet;
  niveau: NiveauProjet;
  listes: ListeValeurs[];
  permis: boolean;
}) {
  const t = useTranslations("decoupage.niveaux");
  const client = useQueryClient();
  const [libelle, setLibelle] = useState(niveau.libelle);
  const [liste, setListe] = useState<ReferenceListe | null>(niveau.liste);
  const [alerter, setAlerter] = useState(niveau.alerter);
  const modifie = libelle.trim() !== niveau.libelle || liste?.id !== niveau.liste?.id || alerter !== niveau.alerter;

  const enregistrement = useMutation({
    mutationFn: () =>
      modifierNiveau(projet.id, niveau.id, {
        libelle: libelle.trim() !== niveau.libelle ? libelle.trim() : undefined,
        liste: liste?.id !== niveau.liste?.id ? liste : undefined,
        alerter: alerter !== niveau.alerter ? alerter : undefined,
      }),
    onSuccess: async () => {
      toast.success(t("enregistre", { libelle: libelle.trim() }));
      await client.invalidateQueries({ queryKey: cleDecoupage(projet.id) });
      await client.invalidateQueries({ queryKey: ["projets", projet.id] });
    },
    onError: (erreur) => toast.error(erreur instanceof ErreurApi ? erreur.message : t("erreur")),
  });

  const desactive = !permis || enregistrement.isPending;

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-solid border-neutral-200 p-2">
      <Badge variante="neutre">{t("rang", { rang: niveau.ordre })}</Badge>
      <Input
        value={libelle}
        maxLength={60}
        onChange={(e) => setLibelle(e.target.value)}
        aria-label={t("libelle")}
        className="w-48"
        disabled={desactive}
      />
      <Select
        value={liste ? `${liste.origine}:${liste.id}` : SANS_LISTE}
        onValueChange={(valeur) => {
          const choisie = listes.find((l) => `${l.origine}:${l.id}` === valeur);
          setListe(choisie ? { origine: choisie.origine, id: choisie.id, libelle: choisie.libelle } : null);
        }}
        disabled={desactive}
      >
        <SelectTrigger className="w-56" aria-label={t("liste")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SANS_LISTE}>{t("sansListe")}</SelectItem>
          {liste && !listes.some((l) => l.id === liste.id) && (
            <SelectItem value={`${liste.origine}:${liste.id}`}>{liste.libelle}</SelectItem>
          )}
          {listes.map((l) => (
            <SelectItem key={`${l.origine}:${l.id}`} value={`${l.origine}:${l.id}`}>
              {l.libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
        <Checkbox checked={alerter} onCheckedChange={(v) => setAlerter(v === true)} disabled={desactive} />
        {t("alerter")}
      </label>
      <BoutonPermis
        size="sm"
        variant="outline"
        className="ml-auto"
        permis={permis}
        permission={PERMISSIONS.DECOUPER}
        disabled={!modifie || !libelle.trim() || enregistrement.isPending}
        onClick={() => enregistrement.mutate()}
      >
        {enregistrement.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
        {t("enregistrer")}
      </BoutonPermis>
    </li>
  );
}
