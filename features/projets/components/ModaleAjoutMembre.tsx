"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleX, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import { Form, FormField } from "@/components/ui/form";
import { ajouterMembreEquipe, listerCandidatsEquipes } from "@/features/projets/adaptateur";
import { actualiserEquipes, cleCandidatsEquipes } from "@/features/projets/cles";
import { candidatsPourEquipe, membresEquipe } from "@/features/projets/regles";
import type { Equipe } from "@/features/projets/types";
import {
  membreVide,
  schemaAjoutMembre,
  versSaisieMembreEquipe,
  type SaisieAjoutMembre,
  type ValeursAjoutMembre,
} from "@/features/projets/validations";
import type { ErreurApi } from "@/lib/api";

import { ChampMembre, messagesMembre } from "./ChampMembre";

const FORM_ID = "form-ajout-membre";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  projetId: string;
  equipe: Equipe;
}

/**
 * L'arrivée d'une personne dans une équipe déjà constituée : même champ que
 * la constitution — un collaborateur affecté au chantier, ou une personne
 * saisie — et son rôle. On n'y entre pas chef : on le devient en changeant de
 * rôle, geste qui dit ce qu'il advient de l'ancien.
 *
 * Les personnes proposées viennent de `/equipes/candidats/` : celles de cette
 * équipe en sont écartées, celles d'une autre équipe du chantier restent
 * proposées, avec la mention de celle-ci. L'ajout relit les équipes et tout
 * ce qui en dépend (`actualiserEquipes`).
 *
 * L'écran le remonte à chaque ouverture (`key`) : il repart toujours vierge.
 */
export function ModaleAjoutMembre({ ouverte, onFermer, projetId, equipe }: Props) {
  const t = useTranslations("projets.equipesAffectations.fiche.ajout");
  const clientRequetes = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);

  const form = useForm<SaisieAjoutMembre, unknown, ValeursAjoutMembre>({
    resolver: zodResolver(schemaAjoutMembre),
    defaultValues: { membre: membreVide() },
    mode: "onTouched",
  });
  const enCours = form.formState.isSubmitting;

  const requeteCandidats = useQuery({
    queryKey: cleCandidatsEquipes(projetId),
    queryFn: ({ signal }) => listerCandidatsEquipes(projetId, signal),
    enabled: ouverte,
  });
  const dejaDansEquipe = membresEquipe(equipe)
    .map((membre) => membre.collaborateurId)
    .filter((identifiant): identifiant is string => identifiant !== null);

  async function soumettre(valeurs: ValeursAjoutMembre) {
    setErreur(null);
    try {
      const modifiee = await ajouterMembreEquipe(
        projetId,
        equipe.id,
        versSaisieMembreEquipe(valeurs.membre),
      );
      void actualiserEquipes(clientRequetes, projetId, modifiee);
      onFermer();
    } catch (err) {
      const cause = err as ErreurApi;
      setErreur(cause.message || t("erreurGenerique"));
    }
  }

  return (
    <Dialog open={ouverte} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("titre")}</DialogTitle>
          <DialogDescription>{t("sousTitre")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(soumettre)}
            noValidate
            className="flex flex-col gap-4"
          >
            {erreur && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}
            {requeteCandidats.isError && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>
                  {(requeteCandidats.error as ErreurApi).message || t("erreurCandidats")}
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="membre"
              render={({ field }) => (
                <ChampMembre
                  id="nouveau-membre"
                  valeur={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  candidats={candidatsPourEquipe(
                    requeteCandidats.data ?? [],
                    dejaDansEquipe,
                    equipe.id,
                  )}
                  equipeId={equipe.id}
                  erreurs={messagesMembre(form.formState.errors.membre)}
                  libelle={t("champPersonne")}
                  libelleRole={t("champRole")}
                  disabled={enCours}
                />
              )}
            />
          </form>
        </Form>

        <DialogFooter className="gap-3">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={enCours} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {t("ajouter")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
