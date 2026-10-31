"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { paysEntreprise } from "@/features/configuration/api";
import { listerTiers } from "@/features/tiers/adaptateur";
import { ErreurApi } from "@/lib/api";

import { creerPersonne, modifierPersonne } from "../adaptateur";
import { CLE_PARTENAIRES, CLE_REGISTRE } from "../cles";
import type { Personne } from "../types";

const INTERNE = "interne";

/**
 * Ajouter une personne au registre de main-d'œuvre, ou la modifier : nom et prénom obligatoires,
 * téléphone et métier facultatifs, notre entreprise ou un partenaire.
 *
 * Sert aussi l'**ajout rapide** depuis une équipe (décision P11) : `entrepriseParDefaut` y
 * reprend l'entreprise de l'équipe, et `onEnregistree` reçoit la personne créée.
 */
export function FenetrePersonne({
  personne,
  entrepriseParDefaut = null,
  onFermer,
  onEnregistree,
}: {
  /** `null` : une nouvelle personne. */
  personne: Personne | null;
  entrepriseParDefaut?: string | null;
  onFermer: () => void;
  onEnregistree?: (personne: Personne) => void;
}) {
  const t = useTranslations("mainOeuvre.fenetre");
  const client = useQueryClient();
  const [nom, setNom] = useState(personne?.nom ?? "");
  const [prenom, setPrenom] = useState(personne?.prenom ?? "");
  const [telephone, setTelephone] = useState(personne?.telephone ?? "");
  const [metier, setMetier] = useState(personne?.metier ?? "");
  const [entreprise, setEntreprise] = useState<string>(personne?.entreprise.id ?? entrepriseParDefaut ?? INTERNE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pays, setPays] = useState("");

  useEffect(() => {
    let vivant = true;
    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const partenaires = useQuery({ queryKey: CLE_PARTENAIRES, queryFn: ({ signal }) => listerTiers(undefined, signal) });

  const ecriture = useMutation({
    mutationFn: () => {
      const saisie = {
        nom,
        prenom,
        telephone,
        metier,
        entreprisePartenaireId: entreprise === INTERNE ? null : entreprise,
      };
      return personne ? modifierPersonne(personne.id, saisie) : creerPersonne(saisie);
    },
    onSuccess: async (enregistree) => {
      toast.success(personne ? t("modifiee", { nom: enregistree.nomComplet }) : t("ajoutee", { nom: enregistree.nomComplet }));
      onEnregistree?.(enregistree);
      onFermer();
      await client.invalidateQueries({ queryKey: CLE_REGISTRE });
    },
    onError: (e) => {
      if (e instanceof ErreurApi) {
        const champs = Object.values(e.erreursParChamp);
        setErreur(e.code === "validation" && champs.length > 0 ? champs.join(" ") : e.message);
        return;
      }
      setErreur(t("erreur"));
    },
  });

  function valider() {
    if (!nom.trim() || !prenom.trim()) {
      setErreur(t("nomPrenomRequis"));
      return;
    }
    setErreur(null);
    ecriture.mutate();
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !ecriture.isPending && onFermer()}>
      <DialogContent className="sm:max-w-[520px]">
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(evenement) => {
            evenement.preventDefault();
            valider();
          }}
        >
          <DialogHeader>
            <DialogTitle>{personne ? t("titreModification", { nom: personne.nomComplet }) : t("titreAjout")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
              {t("prenom")}
              <Input value={prenom} maxLength={150} onChange={(e) => setPrenom(e.target.value)} autoFocus />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
              {t("nom")}
              <Input value={nom} maxLength={150} onChange={(e) => setNom(e.target.value)} />
            </label>
          </div>
          {pays && (
            <ChampTelephone libelle={t("telephone")} valeur={telephone} onChange={setTelephone} paysDefaut={pays} />
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            {t("metier")}
            <Input value={metier} maxLength={100} onChange={(e) => setMetier(e.target.value)} placeholder={t("metierExemple")} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            {t("entreprise")}
            <Select value={entreprise} onValueChange={setEntreprise}>
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
          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" onClick={onFermer} disabled={ecriture.isPending}>
              {t("annuler")}
            </Button>
            <Button type="submit" disabled={ecriture.isPending}>
              {ecriture.isPending && <LoaderCircle className="animate-spin" />}
              {t("enregistrer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
