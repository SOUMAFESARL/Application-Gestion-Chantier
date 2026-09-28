"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
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
import { CLE_COLLABORATEURS, listerCollaborateurs } from "@/features/invitations/api";
import { ajouterMembreEquipe } from "@/features/projets/adaptateur";
import { collaborateursDisponibles, membresEquipe } from "@/features/projets/regles";
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
  onAjoute: (equipe: Equipe) => void;
}

/**
 * L'arrivée d'une personne dans une équipe déjà constituée : même champ que
 * la constitution — un collaborateur, ou une personne saisie — et son rôle.
 * On n'y entre pas chef : on le devient en changeant de rôle, geste qui dit
 * ce qu'il advient de l'ancien.
 *
 * L'écran le remonte à chaque ouverture (`key`) : il repart toujours vierge.
 */
export function ModaleAjoutMembre({ ouverte, onFermer, projetId, equipe, onAjoute }: Props) {
  const t = useTranslations("projets.equipesAffectations.fiche.ajout");
  const [erreur, setErreur] = useState<string | null>(null);

  const form = useForm<SaisieAjoutMembre, unknown, ValeursAjoutMembre>({
    resolver: zodResolver(schemaAjoutMembre),
    defaultValues: { membre: membreVide() },
    mode: "onTouched",
  });
  const enCours = form.formState.isSubmitting;

  const requeteCollaborateurs = useQuery({
    queryKey: CLE_COLLABORATEURS,
    queryFn: listerCollaborateurs,
    enabled: ouverte,
  });
  const dejaDansEquipe = membresEquipe(equipe)
    .map((membre) => membre.collaborateurId)
    .filter((identifiant): identifiant is string => identifiant !== null);

  async function soumettre(valeurs: ValeursAjoutMembre) {
    setErreur(null);
    try {
      onAjoute(await ajouterMembreEquipe(projetId, equipe.id, versSaisieMembreEquipe(valeurs.membre)));
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

            <FormField
              control={form.control}
              name="membre"
              render={({ field }) => (
                <ChampMembre
                  id="nouveau-membre"
                  valeur={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  collaborateurs={collaborateursDisponibles(
                    requeteCollaborateurs.data ?? [],
                    dejaDansEquipe,
                  )}
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
