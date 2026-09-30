"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Clock, Eye, LoaderCircle, Pause, Play, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { Badge, Bouton, EtatChargement } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { obtenirProfilMoi } from "@/features/auth/api";
import type { ProfilUtilisateur } from "@/features/auth/api";
import { paysEntreprise } from "@/features/configuration/api";
import { useGestionCollaborateur } from "@/features/invitations/components/GestionCollaborateur";
import {
  ajouterCollaborateur,
  CLE_COLLABORATEURS,
  erreursCreationParChamp,
  listerCollaborateurs,
} from "@/features/invitations/adaptateur";
import {
  filtrerCollaborateurs,
  initiales,
  reactivationPossible,
  suppressionPossible,
  suspensionPossible,
  type FiltreCollaborateurs,
} from "@/features/invitations/regles";
import type { Collaborateur, StatutCollaborateur } from "@/features/invitations/types";
import {
  CODES_ROLES,
  LONGUEUR_MAX_NOM,
  saisieAjoutVide,
  schemaAjoutCollaborateur,
  versCreationCollaborateur,
  type SaisieAjoutCollaborateur,
  type ValeursAjoutCollaborateur,
} from "@/features/invitations/validations";
import { afficherTelephone } from "@/features/referentiels/telephone";
import { ErreurApi } from "@/lib/api";
import { formaterDate } from "@/lib/format";

import { TON_STATUT } from "./tons";

const FORM_AJOUT_ID = "form-ajout-collaborateur";

/** L'astérisque des champs obligatoires — décoratif, le schéma fait foi. */
function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

const colonne = aideColonnes<Collaborateur>();

export default function PageCollaborateurs() {
  const t = useTranslations("gestionCollaborateurs");
  const router = useRouter();
  const cache = useQueryClient();

  const [moi, setMoi] = useState<ProfilUtilisateur | null>(null);
  const [filtre, setFiltre] = useState<FiltreCollaborateurs>("TOUS");
  const [recherche, setRecherche] = useState("");

  // Modale d'ajout
  const [modaleOuverte, setModaleOuverte] = useState(false);
  // Vide tant que le serveur ne l'a pas dit : l'indicatif proposé en dépend.
  const [pays, setPays] = useState("");

  const { suspendre, reactiver, supprimer, modaux } = useGestionCollaborateur();
  const moiId = moi?.id ?? null;

  const requete = useQuery({
    queryKey: CLE_COLLABORATEURS,
    queryFn: listerCollaborateurs,
  });

  const form = useForm<SaisieAjoutCollaborateur, unknown, ValeursAjoutCollaborateur>({
    resolver: zodResolver(schemaAjoutCollaborateur),
    defaultValues: saisieAjoutVide(),
  });

  useEffect(() => {
    let vivant = true;

    // Le profil ne sert qu'à savoir si « Administrateur » peut être proposé :
    // illisible, il ne bloque pas l'écran.
    obtenirProfilMoi()
      .then((profil) => {
        if (vivant) setMoi(profil);
      })
      .catch(() => undefined);

    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });

    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    if (requete.isError) toast.error(t("erreurChargement"));
  }, [requete.isError, t]);

  /**
   * La saisie n'est remise à zéro qu'après un ajout réussi : un abandon
   * involontaire de la modale ne doit pas effacer ce qui a été tapé.
   */
  const ajout = useMutation({
    mutationFn: (valeurs: ValeursAjoutCollaborateur) =>
      ajouterCollaborateur(versCreationCollaborateur(valeurs)),
    onSuccess: ({ collaborateur, lienActivation }) => {
      // Un email déjà invité est réinvité : même identifiant, ligne remplacée.
      cache.setQueryData<Collaborateur[]>(CLE_COLLABORATEURS, (liste = []) => [
        collaborateur,
        ...liste.filter((c) => c.id !== collaborateur.id),
      ]);
      // Le serveur ne renvoie le lien qu'en développement : il permet de
      // dérouler l'écran d'activation sans passer par la boîte mail.
      toast.success(
        t("succesAjout", { nom: collaborateur.nomComplet, email: collaborateur.email }),
        lienActivation
          ? {
              action: {
                label: t("lienActivation"),
                onClick: () => router.push(lienActivation),
              },
            }
          : undefined,
      );
      form.reset(saisieAjoutVide());
      setModaleOuverte(false);
    },
    onError: (cause) => {
      // Une erreur rattachée à un champ s'affiche sous ce champ ; les autres
      // (quota, email déjà pris, droits) passent par un toast.
      const parChamp = Object.entries(erreursCreationParChamp(cause));
      for (const [champ, message] of parChamp) {
        form.setError(champ as keyof SaisieAjoutCollaborateur, { message });
      }
      if (parChamp.length > 0) return;
      toast.error(cause instanceof ErreurApi && cause.message ? cause.message : t("erreurAjout"));
    },
  });
  const ajoutEnCours = ajout.isPending;

  const optionsRoles = CODES_ROLES.filter(
    (code) => code !== "AD" || Boolean(moi?.is_dg || moi?.is_owner || moi?.role_global === "DG"),
  ).map((code) => ({ valeur: code, libelle: t(`roleOptions.${code}`) }));

  const collaborateurs = useMemo(() => requete.data ?? [], [requete.data]);

  const collaborateursFiltres = useMemo(
    () => filtrerCollaborateurs(collaborateurs, filtre, recherche),
    [collaborateurs, filtre, recherche],
  );

  const colonnes = useMemo(() => {
    // Le catalogue d'abord ; un code qu'il ne connaît pas garde le libellé du serveur.
    const libelleRole = (c: Collaborateur) =>
      t.has(`roleOptions.${c.role}`) ? t(`roleOptions.${c.role}`) : c.roleLibelle;

    return colonne.columns([
      colonne.accessor("nomComplet", {
        header: t("colonneNom"),
        cell: ({ row }) => {
          const nom = row.original.nomComplet || t("collaborateurInvite");
          return (
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[13px] font-bold text-primary-700">
                {initiales(nom)}
              </div>
              <div className="flex min-w-0 flex-col">
                <Link
                  href={`/parametres/collaborateurs/${row.original.id}`}
                  className="font-semibold text-neutral-900 no-underline hover:text-primary-600 hover:underline"
                >
                  {nom}
                </Link>
                <span className="text-xs text-neutral-500">{row.original.email}</span>
              </div>
            </div>
          );
        },
      }),
      colonne.accessor("telephone", {
        header: t("colonneTelephone"),
        meta: { classe: "tabular-nums whitespace-nowrap text-neutral-700" },
        cell: ({ getValue }) => afficherTelephone(getValue()) || t("telephoneInconnu"),
      }),
      colonne.accessor("role", {
        header: t("colonneRole"),
        cell: ({ row }) => <Badge variante="neutre">{libelleRole(row.original)}</Badge>,
      }),
      colonne.accessor("statut", {
        header: t("colonneStatut"),
        cell: ({ getValue }) => (
          <Badge variante={TON_STATUT[getValue()]}>
            {getValue() === "ACTIF" && <CheckCircle2 size={14} aria-hidden="true" />}
            {getValue() === "INVITE" && <Clock size={14} aria-hidden="true" />}
            {getValue() === "DESACTIVE" && <Ban size={14} aria-hidden="true" />}
            {t(`statut.${getValue()}`)}
          </Badge>
        ),
      }),
      colonne.accessor("creeLe", {
        header: t("colonneDate"),
        meta: { classe: "tabular-nums whitespace-nowrap text-neutral-600" },
        cell: ({ getValue }) => formaterDate(getValue()),
      }),
      colonne.display({
        id: "actions",
        header: t("colonneActions"),
        meta: { classe: BORD_DROIT_TABLEAU },
        cell: ({ row }) => {
          const c = row.original;
          const nom = c.nomComplet || c.email;
          return (
            <span className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" asChild>
                <Link
                  href={`/parametres/collaborateurs/${c.id}`}
                  aria-label={t("actionConsulter", { nom })}
                  title={t("actionConsulter", { nom })}
                >
                  <Eye />
                </Link>
              </Button>
              {suspensionPossible(c, moiId) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => suspendre(c)}
                  aria-label={t("actionSuspendre", { nom })}
                  title={t("actionSuspendre", { nom })}
                  className="text-avertissement hover:text-avertissement"
                >
                  <Pause />
                </Button>
              )}
              {reactivationPossible(c, moiId) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => reactiver(c)}
                  aria-label={t("actionReactiver", { nom })}
                  title={t("actionReactiver", { nom })}
                  className="text-succes hover:text-succes"
                >
                  <Play />
                </Button>
              )}
              {suppressionPossible(c, moiId) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => supprimer(c)}
                  aria-label={t("actionSupprimer", { nom })}
                  title={t("actionSupprimer", { nom })}
                  className="text-erreur hover:text-erreur"
                >
                  <Trash2 />
                </Button>
              )}
            </span>
          );
        },
      }),
    ]);
  }, [t, moiId, suspendre, reactiver, supprimer]);

  if (requete.isPending) {
    return (
      <div className="flex flex-col gap-8">
        <EtatChargement message={t("chargement")} />
      </div>
    );
  }

  const compte = (statut: StatutCollaborateur) =>
    collaborateurs.filter((c) => c.statut === statut).length;

  // « Tous » n'est pas une option : c'est l'entrée de tête du `FiltreTableau`.
  const filtres: {
    valeur: Exclude<FiltreCollaborateurs, "TOUS">;
    libelle: string;
    nombre: number;
  }[] = [
    { valeur: "ACTIFS", libelle: t("filtreActifs"), nombre: compte("ACTIF") },
    { valeur: "INVITES", libelle: t("filtreInvites"), nombre: compte("INVITE") },
    { valeur: "SUSPENDUS", libelle: t("filtreSuspendus"), nombre: compte("DESACTIVE") },
  ];

  const exporter: ExportTableau<Collaborateur> = {
    titre: t("export.titre"),
    nomFichier: t("export.nomFichier"),
    colonnes: [
      { entete: t("colonneNom"), valeur: (c) => c.nomComplet || t("collaborateurInvite") },
      { entete: t("export.email"), valeur: (c) => c.email },
      { entete: t("colonneTelephone"), valeur: (c) => afficherTelephone(c.telephone) },
      {
        entete: t("colonneRole"),
        valeur: (c) => (t.has(`roleOptions.${c.role}`) ? t(`roleOptions.${c.role}`) : c.roleLibelle),
      },
      { entete: t("colonneStatut"), valeur: (c) => t(`statut.${c.statut}`) },
      { entete: t("colonneDate"), valeur: (c) => formaterDate(c.creeLe) },
    ],
  };

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage titre={t("titre")} description={t("sousTitre")} />

      <TableauListe
        colonnes={colonnes}
        donnees={collaborateursFiltres}
        cleLigne={(c) => c.id}
        messageVide={t("aucunResultat")}
        filtresActifs={filtre !== "TOUS" || recherche.trim() !== ""}
        onReinitialiser={() => {
          setFiltre("TOUS");
          setRecherche("");
        }}
        cleCriteres={`${filtre}|${recherche}`}
        exporter={exporter}
        actions={
          <Bouton
            variante="primaire"
            taille="sm"
            iconeGauche={<UserPlus size={16} aria-hidden="true" />}
            onClick={() => setModaleOuverte(true)}
          >
            {t("boutonAjouter")}
          </Bouton>
        }
        outils={
          <>
            <RechercheTableau
              valeur={recherche}
              onChangement={setRecherche}
              libelle={t("recherchePlaceholder")}
              placeholder={t("recherchePlaceholder")}
            />
            <FiltreTableau
              valeur={filtre === "TOUS" ? "" : filtre}
              onChangement={(valeur) => setFiltre(valeur || "TOUS")}
              libelle={t("filtreStatut")}
              libelleTous={t("filtreAvecNombre", {
                libelle: t("filtreTous"),
                nombre: collaborateurs.length,
              })}
              options={filtres.map((f) => ({
                valeur: f.valeur,
                libelle: t("filtreAvecNombre", { libelle: f.libelle, nombre: f.nombre }),
              }))}
            />
          </>
        }
      />

      {modaux}

      {/* Modale d'ajout */}
      <Dialog
        open={modaleOuverte}
        onOpenChange={(ouverte) => !ajoutEnCours && setModaleOuverte(ouverte)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("ajouterTitre")}</DialogTitle>
            <DialogDescription>{t("ajouterSousTitre")}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              id={FORM_AJOUT_ID}
              onSubmit={form.handleSubmit((valeurs) => ajout.mutate(valeurs))}
              noValidate
              className="flex flex-col gap-5"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="prenom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("champPrenom")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="off"
                          maxLength={LONGUEUR_MAX_NOM}
                          placeholder={t("placeholderPrenom")}
                          disabled={ajoutEnCours}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          autoComplete="off"
                          maxLength={LONGUEUR_MAX_NOM}
                          placeholder={t("placeholderNom")}
                          disabled={ajoutEnCours}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("champEmail")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        inputMode="email"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder={t("placeholderEmail")}
                        disabled={ajoutEnCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* `ChampTelephone` porte son propre libellé et son message :
                  il reçoit l'erreur du schéma plutôt que `FormLabel`. Il
                  stocke du E.164, dont le serveur a besoin pour WhatsApp. */}
              <FormField
                control={form.control}
                name="telephone"
                render={({ field, fieldState }) => (
                  <ChampTelephone
                    libelle={t("champTelephone")}
                    paysDefaut={pays}
                    valeur={field.value}
                    onChange={field.onChange}
                    erreur={fieldState.error?.message}
                    disabled={ajoutEnCours}
                    required
                  />
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("champRole")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        options={optionsRoles}
                        valeur={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder={t("champRoleChoisir")}
                        placeholderRecherche={t("champRoleRecherche")}
                        aucunResultat={t("champRoleAucun")}
                        disabled={ajoutEnCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModaleOuverte(false)}
              disabled={ajoutEnCours}
            >
              {t("boutonAnnuler")}
            </Button>
            <Button
              type="submit"
              form={FORM_AJOUT_ID}
              disabled={ajoutEnCours}
              aria-busy={ajoutEnCours}
            >
              {ajoutEnCours && <LoaderCircle className="animate-spin" />}
              {ajoutEnCours ? t("ajoutEnCours") : t("boutonValider")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
