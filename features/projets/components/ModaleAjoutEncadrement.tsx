"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CircleX, Info, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLE_COLLABORATEURS, listerCollaborateurs } from "@/features/invitations/adaptateur";
import { ajouterMembreEncadrement } from "@/features/projets/adaptateur";
import {
  FONCTIONS_AUTRE_MEMBRE,
  candidatsEncadrement,
  intervenantDuCollaborateur,
} from "@/features/projets/regles";
import type { FonctionProjet, Projet } from "@/features/projets/types";
import {
  LONGUEUR_MAX_ZONE,
  saisieEncadrementVide,
  schemaAjoutEncadrement,
  versAjoutEncadrement,
  type SaisieAjoutEncadrement,
  type ValeursAjoutEncadrement,
} from "@/features/projets/validations";
import type { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const FORM_ID = "form-ajout-encadrement";
const CHAMP = "h-[var(--input-height-md)]";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  projet: Projet;
  /** La place présélectionnée à l'ouverture. */
  fonctionInitiale: FonctionProjet;
  /** Les places que le compte peut pourvoir : le chef de projet n'est désignable que par la direction. */
  fonctionsAutorisees: FonctionProjet[];
  onModifie: (projet: Projet) => void;
}

/**
 * L'arrivée d'une personne dans l'équipe d'encadrement et de gestion d'un
 * projet : sa place, puis la personne, **parmi les utilisateurs du compte** —
 * l'encadrement se connecte, il n'y a pas de saisie libre ici comme dans les
 * équipes de terrain.
 *
 * Un chef de chantier peut préciser sa zone ou son lot ; un autre membre doit
 * dire sa fonction. Désigner un chef de projet remplace celui en place, et la
 * modale le dit avant qu'on valide.
 *
 * L'écran la remonte à chaque ouverture (`key`) : elle repart toujours vierge.
 */
export function ModaleAjoutEncadrement({
  ouverte,
  onFermer,
  projet,
  fonctionInitiale,
  fonctionsAutorisees,
  onModifie,
}: Props) {
  const t = useTranslations("projets.encadrement");
  const [erreur, setErreur] = useState<string | null>(null);

  const form = useForm<SaisieAjoutEncadrement, unknown, ValeursAjoutEncadrement>({
    resolver: zodResolver(schemaAjoutEncadrement),
    defaultValues: saisieEncadrementVide(fonctionInitiale),
    // Pas « onTouched » : ouvrir la liste des utilisateurs fait perdre le
    // focus au champ, qui passerait en erreur avant qu'on ait pu choisir.
    mode: "onSubmit",
  });
  const enCours = form.formState.isSubmitting;
  const fonction = useWatch({ control: form.control, name: "fonction" }) as FonctionProjet;
  const designationChef = fonction === "CHEF_PROJET";

  const requeteUtilisateurs = useQuery({
    queryKey: CLE_COLLABORATEURS,
    queryFn: listerCollaborateurs,
    enabled: ouverte,
  });
  const candidats = candidatsEncadrement(requeteUtilisateurs.data ?? [], projet, fonction);
  const options = candidats.map((candidat) => ({
    valeur: candidat.id,
    libelle: candidat.nomComplet || candidat.email,
  }));

  function changerFonction(nouvelle: string) {
    form.setValue("fonction", nouvelle, { shouldValidate: true });
    // La personne choisie pour une place ne l'est pas forcément pour une autre.
    form.setValue("utilisateurId", "");
    form.clearErrors(["utilisateurId", "fonctionMembre"]);
  }

  async function soumettre(valeurs: ValeursAjoutEncadrement) {
    setErreur(null);
    const choisi = candidats.find((candidat) => candidat.id === valeurs.utilisateurId);
    if (!choisi) return;
    const intervenant = intervenantDuCollaborateur(choisi);
    try {
      onModifie(await ajouterMembreEncadrement(projet.id, versAjoutEncadrement(valeurs, intervenant)));
      toast.success(
        t(valeurs.fonction === "CHEF_PROJET" ? "ajout.succesChefProjet" : "ajout.succes", {
          nom: intervenant.nomComplet,
        }),
      );
      onFermer();
    } catch (err) {
      const cause = err as ErreurApi;
      setErreur(cause.message || t("ajout.erreurGenerique"));
    }
  }

  return (
    <Dialog open={ouverte} onOpenChange={(ouvert) => !ouvert && !enCours && onFermer()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{designationChef ? t("ajout.titreChefProjet") : t("ajout.titre")}</DialogTitle>
          <DialogDescription>{t("ajout.sousTitre")}</DialogDescription>
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

            {fonctionsAutorisees.length > 1 && (
              <FormField
                control={form.control}
                name="fonction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("ajout.champFonction")}</FormLabel>
                    <Select value={field.value} onValueChange={changerFonction} disabled={enCours}>
                      <FormControl>
                        <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                          <SelectValue placeholder={t("ajout.selectionner")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fonctionsAutorisees.map((place) => (
                          <SelectItem key={place} value={place}>
                            {t(`fonctionUnitaire.${place}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {designationChef && projet.chefProjet && (
              <Alert variant="avertissement">
                <Info />
                <AlertDescription>
                  {t("ajout.remplacement", { nom: projet.chefProjet.nomComplet })}
                </AlertDescription>
              </Alert>
            )}

            {requeteUtilisateurs.isError && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{t("ajout.erreurUtilisateurs")}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="utilisateurId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ajout.champUtilisateur")}</FormLabel>
                  <FormControl>
                    <Combobox
                      className={CHAMP}
                      options={options}
                      valeur={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder={
                        requeteUtilisateurs.isPending
                          ? t("ajout.chargementUtilisateurs")
                          : t("ajout.utilisateurPlaceholder")
                      }
                      placeholderRecherche={t("ajout.utilisateurRecherche")}
                      aucunResultat={t("ajout.utilisateurAucun")}
                      disabled={enCours || requeteUtilisateurs.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {fonction === "CHEF_CHANTIER" && (
              <FormField
                control={form.control}
                name="zone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("ajout.champZone")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={CHAMP}
                        maxLength={LONGUEUR_MAX_ZONE}
                        placeholder={t("ajout.zonePlaceholder")}
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormDescription>{t("ajout.aideZone")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {fonction === "AUTRE_MEMBRE" && (
              <FormField
                control={form.control}
                name="fonctionMembre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("ajout.champFonctionMembre")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={enCours}>
                      <FormControl>
                        <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                          <SelectValue placeholder={t("ajout.selectionner")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FONCTIONS_AUTRE_MEMBRE.map((fonctionMembre) => (
                          <SelectItem key={fonctionMembre} value={fonctionMembre}>
                            {t(`fonctionAutreMembre.${fonctionMembre}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>

        <DialogFooter className="gap-3">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("ajout.annuler")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={enCours} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {designationChef ? t("ajout.designer") : t("ajout.ajouter")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
