"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CircleX, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CLE_COLLABORATEURS, listerCollaborateurs } from "@/features/invitations/adaptateur";
import { creerEquipe } from "@/features/projets/adaptateur";
import {
  collaborateursDisponibles,
  effectifEquipe,
  NATURES_EQUIPE,
} from "@/features/projets/regles";
import type { Equipe } from "@/features/projets/types";
import {
  membreVide,
  saisieEquipeVide,
  schemaEquipe,
  versCreationEquipe,
  type SaisieEquipe,
  type ValeursEquipe,
} from "@/features/projets/validations";
import type { ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";

import { ChampMembre, messagesMembre } from "./ChampMembre";

const FORM_ID = "form-equipe";

const RANGEE = "grid grid-cols-2 gap-x-4 gap-y-3 max-[640px]:grid-cols-1";
const CHAMP = "h-[var(--input-height-md)]";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  projetId: string;
  onCreee: (equipe: Equipe) => void;
}

function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

/**
 * La constitution d'une équipe sur un chantier : son nom, sa nature (interne
 * ou sous-traitant), son corps d'état, son chef et ses membres.
 *
 * L'effectif n'est pas saisi : il se compte (`effectifEquipe`). Un chiffre
 * tapé à côté d'une liste de noms finit toujours par la contredire.
 *
 * L'écran le remonte à chaque ouverture (`key`) : il repart toujours vierge.
 */
export function TiroirEquipe({ ouverte, onFermer, projetId, onCreee }: Props) {
  const t = useTranslations("projets.equipesAffectations.formEquipe");
  const tEcran = useTranslations("projets.equipesAffectations");
  const [erreur, setErreur] = useState<string | null>(null);

  const form = useForm<SaisieEquipe, unknown, ValeursEquipe>({
    resolver: zodResolver(schemaEquipe),
    defaultValues: saisieEquipeVide(),
    mode: "onTouched",
  });
  const membres = useFieldArray({ control: form.control, name: "membres" });
  const [chef, membresSaisis] = useWatch({ control: form.control, name: ["chef", "membres"] });
  const effectif = effectifEquipe({ chef, membres: membresSaisis ?? [] });
  const enCours = form.formState.isSubmitting;

  const requeteCollaborateurs = useQuery({
    queryKey: CLE_COLLABORATEURS,
    queryFn: listerCollaborateurs,
    enabled: ouverte,
  });
  const collaborateurs = requeteCollaborateurs.data ?? [];
  const pris = [chef, ...(membresSaisis ?? [])]
    .map((personne) => personne?.collaborateurId)
    .filter((identifiant): identifiant is string => Boolean(identifiant));

  /** Les collaborateurs qu'une ligne peut encore choisir : le sien, et ceux que personne n'a pris. */
  function disponibles(choixDeLaLigne: string) {
    return collaborateursDisponibles(collaborateurs, pris, choixDeLaLigne);
  }

  async function soumettre(valeurs: ValeursEquipe) {
    setErreur(null);
    try {
      onCreee(await creerEquipe(projetId, versCreationEquipe(valeurs)));
      onFermer();
    } catch (err) {
      const cause = err as ErreurApi;
      setErreur(cause.message || t("erreurGenerique"));
    }
  }

  return (
    <Sheet open={ouverte} onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="flex items-center gap-2 text-lg text-neutral-900">
            {t("titre")}
            <Badge variante="primaire">
              {tEcran("personnes", { nombre: effectif })}
            </Badge>
          </SheetTitle>
          <SheetDescription>{t("sousTitre")}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(soumettre)}
            noValidate
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 [scrollbar-width:thin]"
          >
            {erreur && (
              <Alert variant="erreur">
                <CircleX />
                <AlertDescription>{erreur}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="nom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("champNom")} <Requis />
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={CHAMP}
                      placeholder={t("champNomPlaceholder")}
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={RANGEE}>
              <FormField
                control={form.control}
                name="nature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("champNature")} <Requis />
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={enCours}>
                      <FormControl>
                        <SelectTrigger className={cn(CHAMP, "w-full bg-card")} onBlur={field.onBlur}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NATURES_EQUIPE.map((nature) => (
                          <SelectItem key={nature} value={nature}>
                            {tEcran(`nature.${nature}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("champSpecialite")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={CHAMP}
                        placeholder={t("champSpecialitePlaceholder")}
                        disabled={enCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-semibold text-neutral-900">
                {t("chef")} <Requis />
              </legend>
              <FormField
                control={form.control}
                name="chef"
                render={({ field }) => (
                  <ChampMembre
                    id="chef"
                    valeur={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    collaborateurs={disponibles(field.value.collaborateurId)}
                    erreurs={messagesMembre(form.formState.errors.chef)}
                    libelle={t("chef")}
                    disabled={enCours}
                  />
                )}
              />
            </fieldset>

            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-semibold text-neutral-900">
                {t("membres", { nombre: membres.fields.length })}
              </legend>

              {membres.fields.length === 0 && (
                <p className="m-0 text-sm text-neutral-500">{t("aucunMembre")}</p>
              )}

              {membres.fields.map((membre, rang) => (
                <FormField
                  key={membre.id}
                  control={form.control}
                  name={`membres.${rang}`}
                  render={({ field }) => (
                    <ChampMembre
                      id={`membre-${rang + 1}`}
                      valeur={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      collaborateurs={disponibles(field.value.collaborateurId)}
                      erreurs={messagesMembre(form.formState.errors.membres?.[rang])}
                      libelle={t("champPersonneRang", { rang: rang + 1 })}
                      libelleRole={t("champRoleRang", { rang: rang + 1 })}
                      disabled={enCours}
                      action={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={CHAMP}
                          onClick={() => membres.remove(rang)}
                          disabled={enCours}
                          aria-label={t("retirerMembre", { rang: rang + 1 })}
                          title={t("retirerMembre", { rang: rang + 1 })}
                        >
                          <Trash2 />
                        </Button>
                      }
                    />
                  )}
                />
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => membres.append(membreVide())}
                disabled={enCours}
              >
                <Plus />
                {t("ajouterMembre")}
              </Button>
            </fieldset>
          </form>
        </Form>

        <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("annuler")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={enCours} aria-busy={enCours}>
            {enCours && <LoaderCircle className="animate-spin" />}
            {t("constituer")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
