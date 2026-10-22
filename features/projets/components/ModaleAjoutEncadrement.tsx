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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ajouterMembreEncadrement,
  listerAffectables,
  listerLots,
} from "@/features/projets/adaptateur";
import { cleLots } from "@/features/projets/cles";
import { intituleLot } from "@/features/projets/regles";
import type { FonctionProjet, Intervenant, Projet } from "@/features/projets/types";
import {
  fonctionDuRole,
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
 * projet : sa place, puis la personne, **parmi les collaborateurs affectables**
 * — l'encadrement se connecte, il n'y a pas de saisie libre ici.
 *
 * **Le rôle d'abord, puis la personne parmi ceux qui ont ce rôle** : la liste des
 * rôles est celle des rôles de portée Projet que portent les collaborateurs
 * affectables — tout rôle créé plus tard y apparaît sans changer ce code
 * (décision du 16/10/2026). Un chef de chantier peut préciser son lot, parmi ceux du projet ;
 * désigner un chef de projet remplace celui en place, et la modale le dit.
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
  const role = useWatch({ control: form.control, name: "role" }) ?? "";
  const fonction = fonctionDuRole(role);
  const designationChef = role !== "" && fonction === "CHEF_PROJET";

  const requeteAffectables = useQuery({
    queryKey: ["projets", projet.id, "affectables"],
    queryFn: ({ signal }) => listerAffectables(projet.id, signal),
    enabled: ouverte,
  });

  const idsEnPlace = new Set([
    ...(projet.chefProjet ? [projet.chefProjet.id] : []),
    ...projet.conducteursTravaux.map((c) => c.id),
    ...projet.chefsChantier.map((c) => c.intervenant.id),
    ...projet.autresMembres.map((m) => m.intervenant.id),
  ]);

  const libres = (requeteAffectables.data ?? []).filter(
    (candidat) => !idsEnPlace.has(candidat.id) && candidat.roleCode !== "DG",
  );

  // Les rôles proposés : ceux des collaborateurs affectables, dans la limite des places
  // que le compte peut pourvoir (CP, CT, CC ont la leur ; tout autre rôle relève de
  // « autre membre »).
  const roles = [
    ...new Map(
      libres
        .filter((candidat) => fonctionsAutorisees.includes(fonctionDuRole(candidat.roleCode)))
        .map((candidat) => [candidat.roleCode, candidat.role || candidat.roleCode]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  // Règle du 16/10/2026 : seuls les collaborateurs qui ont le rôle choisi, quel qu'il soit.
  const candidats = libres.filter((candidat) => candidat.roleCode === role);

  const options = candidats.map((candidat) => ({
    valeur: candidat.id,
    libelle: candidat.nom,
  }));

  // Les lots du projet, pour le chef de chantier : le premier choix, vide, est « tout le chantier ».
  const requeteLots = useQuery({
    queryKey: cleLots(projet.id),
    queryFn: ({ signal }) => listerLots(projet.id, signal),
    enabled: ouverte && fonction === "CHEF_CHANTIER",
  });
  const optionsLots = [
    { valeur: "", libelle: t("toutLeChantier") },
    ...(requeteLots.data ?? []).map((lot) => ({
      valeur: lot.id,
      libelle: intituleLot({ code: lot.code, libelle: lot.nom }),
    })),
  ];

  function changerRole(nouveau: string) {
    form.setValue("role", nouveau, { shouldValidate: true });
    // La personne choisie pour un rôle ne l'a pas forcément pour un autre.
    form.setValue("utilisateurId", "");
    form.clearErrors(["utilisateurId"]);
  }

  async function soumettre(valeurs: ValeursAjoutEncadrement) {
    setErreur(null);
    const choisi = candidats.find((candidat) => candidat.id === valeurs.utilisateurId);
    if (!choisi) return;
    const intervenant: Intervenant = {
      id: choisi.id,
      nom: "",
      prenom: "",
      nomComplet: choisi.nom,
      email: "",
      telephone: "",
      statut: "ACTIF",
      lienWhatsApp: null,
    };
    try {
      onModifie(await ajouterMembreEncadrement(projet.id, versAjoutEncadrement(valeurs, intervenant)));
      toast.success(
        t(fonctionDuRole(valeurs.role) === "CHEF_PROJET" ? "ajout.succesChefProjet" : "ajout.succes", {
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

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ajout.champFonction")}</FormLabel>
                  <Select value={field.value} onValueChange={changerRole} disabled={enCours}>
                    <FormControl>
                      <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                        <SelectValue placeholder={t("ajout.selectionner")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map(([code, libelle]) => (
                        <SelectItem key={code} value={code}>
                          {libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {designationChef && projet.chefProjet && (
              <Alert variant="avertissement">
                <Info />
                <AlertDescription>
                  {t("ajout.remplacement", { nom: projet.chefProjet.nomComplet })}
                </AlertDescription>
              </Alert>
            )}

            {requeteAffectables.isError && (
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
                        requeteAffectables.isPending
                          ? t("ajout.chargementUtilisateurs")
                          : t("ajout.utilisateurPlaceholder")
                      }
                      placeholderRecherche={t("ajout.utilisateurRecherche")}
                      aucunResultat={t("ajout.utilisateurAucun")}
                      disabled={enCours || requeteAffectables.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {fonction === "CHEF_CHANTIER" && (
              <FormField
                control={form.control}
                name="lotId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("ajout.champLot")}</FormLabel>
                    <FormControl>
                      <Combobox
                        className={CHAMP}
                        options={optionsLots}
                        valeur={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder={
                          requeteLots.isPending ? t("ajout.chargementLots") : t("toutLeChantier")
                        }
                        placeholderRecherche={t("ajout.lotRecherche")}
                        aucunResultat={t("ajout.lotAucun")}
                        disabled={enCours || requeteLots.isPending}
                      />
                    </FormControl>
                    <FormDescription>{t("ajout.aideLot")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {fonction === "CHEF_CHANTIER" && requeteLots.isError && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{t("ajout.erreurLots")}</AlertDescription>
              </Alert>
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
