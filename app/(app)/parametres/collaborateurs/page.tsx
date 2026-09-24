"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CircleX, Clock, LoaderCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { ChampTelephone } from "@/components/metier/ChampTelephone";
import { Alerte, Badge, Bouton, EtatChargement } from "@/components/ui";
import type { VarianteBadge } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { aideColonnes } from "@/components/ui/data-table";
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
import {
  creerInvitation,
  listerInvitations,
} from "@/features/invitations/api";
import type { InvitationDetail } from "@/features/invitations/api";
import {
  collaborateurDepuisInvitation,
  collaborateurDepuisProfil,
  filtrerCollaborateurs,
  initiales,
  type FiltreCollaborateurs,
} from "@/features/invitations/regles";
import { COLLABORATEURS_SIMULES } from "@/features/invitations/simulationCollaborateurs";
import type { Collaborateur, StatutCollaborateur } from "@/features/invitations/types";
import {
  CODES_ROLES,
  LONGUEUR_MAX_NOM_COMPLET,
  saisieAjoutVide,
  schemaAjoutCollaborateur,
  versCreationInvitation,
  type SaisieAjoutCollaborateur,
  type ValeursAjoutCollaborateur,
} from "@/features/invitations/validations";
import { afficherTelephone } from "@/features/referentiels/telephone";
import type { ErreurApi } from "@/lib/api";
import { SIMULATION_ACTIVE } from "@/lib/api/simulation";
import { formaterDate } from "@/lib/format";

const FORM_AJOUT_ID = "form-ajout-collaborateur";

/** L'astérisque des champs obligatoires — décoratif, le schéma fait foi. */
function Requis() {
  return (
    <span className="text-erreur" aria-hidden="true">
      *
    </span>
  );
}

const TON_STATUT: Record<StatutCollaborateur, VarianteBadge> = {
  ACTIF: "succes",
  INVITE: "avertissement",
  EXPIREE: "erreur",
};

const colonne = aideColonnes<Collaborateur>();

export default function PageCollaborateurs() {
  const t = useTranslations("gestionCollaborateurs");

  const [moi, setMoi] = useState<ProfilUtilisateur | null>(null);
  const [invites, setInvites] = useState<Collaborateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState<FiltreCollaborateurs>("TOUS");
  const [recherche, setRecherche] = useState("");

  // Modale d'ajout
  const [modaleOuverte, setModaleOuverte] = useState(false);
  // Vide tant que le serveur ne l'a pas dit : l'indicatif proposé en dépend.
  const [pays, setPays] = useState("");
  const [succesMsg, setSuccesMsg] = useState<string | null>(null);
  const [erreurAjout, setErreurAjout] = useState<string | null>(null);
  // Tant que `POST /invitations/` n'existe pas, la simulation renvoie le
  // jeton créé (un vrai serveur ne le ferait jamais — il ne voyage que par
  // email) : ce lien permet de dérouler l'écran du collaborateur sans y avoir
  // accès autrement.
  const [lienDemo, setLienDemo] = useState<string | null>(null);

  const form = useForm<SaisieAjoutCollaborateur, unknown, ValeursAjoutCollaborateur>({
    resolver: zodResolver(schemaAjoutCollaborateur),
    defaultValues: saisieAjoutVide(),
  });
  const ajoutEnCours = form.formState.isSubmitting;

  useEffect(() => {
    let vivant = true;

    // Chaque source échoue seule : sans API, le profil et les invitations
    // manquent, mais l'équipe de démonstration reste lisible.
    Promise.allSettled([obtenirProfilMoi(), listerInvitations()]).then(([profil, liste]) => {
      if (!vivant) return;
      if (profil.status === "fulfilled") setMoi(profil.value);
      if (liste.status === "fulfilled") setInvites(liste.value.map(collaborateurDepuisInvitation));
      setChargement(false);
    });

    paysEntreprise().then((code) => {
      if (vivant) setPays(code);
    });

    return () => {
      vivant = false;
    };
  }, []);

  function ouvrirModale() {
    setErreurAjout(null);
    setLienDemo(null);
    setModaleOuverte(true);
  }

  /**
   * La saisie n'est remise à zéro qu'après un ajout réussi : un abandon
   * involontaire de la modale ne doit pas effacer ce qui a été tapé.
   */
  async function ajouterCollaborateur(valeurs: ValeursAjoutCollaborateur) {
    setErreurAjout(null);
    try {
      const nouvelle = await creerInvitation(versCreationInvitation(valeurs));
      // L'invitation renvoyée ne porte pas le téléphone : on garde celui saisi.
      setInvites((prev) => [
        { ...collaborateurDepuisInvitation(nouvelle), telephone: valeurs.telephone },
        ...prev,
      ]);
      setSuccesMsg(t("succesAjout", { nom: valeurs.nomComplet, email: valeurs.email }));
      const jetonDemo = (nouvelle as InvitationDetail & { jeton?: string }).jeton;
      setLienDemo(jetonDemo ? `/invitation#jeton=${jetonDemo}` : null);
      form.reset(saisieAjoutVide());
      setModaleOuverte(false);
    } catch (err) {
      const cause = err as ErreurApi;
      setErreurAjout(cause.message || t("erreurAjout"));
    }
  }

  const optionsRoles = CODES_ROLES.filter(
    (code) => code !== "AD" || Boolean(moi?.is_dg || moi?.role_global === "DG"),
  ).map((code) => ({ valeur: code, libelle: t(`roleOptions.${code}`) }));

  const collaborateurs = useMemo(
    () => [
      ...(moi ? [collaborateurDepuisProfil(moi)] : []),
      ...invites,
      ...(SIMULATION_ACTIVE ? COLLABORATEURS_SIMULES : []),
    ],
    [moi, invites],
  );

  const collaborateursFiltres = useMemo(
    () => filtrerCollaborateurs(collaborateurs, filtre, recherche),
    [collaborateurs, filtre, recherche],
  );

  const colonnes = useMemo(
    () =>
      colonne.columns([
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
                  <span className="font-semibold text-neutral-900">{nom}</span>
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
          cell: ({ getValue }) => (
            <Badge variante="neutre">
              {t.has(`roleOptions.${getValue()}`) ? t(`roleOptions.${getValue()}`) : getValue()}
            </Badge>
          ),
        }),
        colonne.accessor("statut", {
          header: t("colonneStatut"),
          cell: ({ getValue }) => (
            <Badge variante={TON_STATUT[getValue()]}>
              {getValue() === "ACTIF" && <CheckCircle2 size={14} aria-hidden="true" />}
              {getValue() === "INVITE" && <Clock size={14} aria-hidden="true" />}
              {t(`statut.${getValue()}`)}
            </Badge>
          ),
        }),
        colonne.accessor("creeLe", {
          header: t("colonneDate"),
          meta: { classe: `${BORD_DROIT_TABLEAU} tabular-nums whitespace-nowrap text-neutral-600` },
          cell: ({ getValue }) => {
            const date = getValue();
            return date ? formaterDate(date) : t("comptePrincipal");
          },
        }),
      ]),
    [t],
  );

  if (chargement) {
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
  ];

  return (
    <div className="flex flex-col gap-5">
      <EnTetePage
        titre={t("titre")}
        description={t("sousTitre")}
        actions={
          <Bouton
            variante="primaire"
            iconeGauche={<UserPlus size={18} />}
            onClick={ouvrirModale}
          >
            {t("boutonAjouter")}
          </Bouton>
        }
      />

      {succesMsg && (
        <Alerte
          type="succes"
          action={
            lienDemo ? (
              <Link href={lienDemo} className="font-semibold underline">
                {t("simulationLienInvitation")}
              </Link>
            ) : undefined
          }
        >
          <CheckCircle2 size={20} />
          {succesMsg}
        </Alerte>
      )}

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
              onSubmit={form.handleSubmit(ajouterCollaborateur)}
              noValidate
              className="flex flex-col gap-5"
            >
              {erreurAjout && (
                <Alert variant="erreur">
                  <CircleX />
                  <AlertDescription>{erreurAjout}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="nomComplet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("champNom")} <Requis />
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="off"
                        maxLength={LONGUEUR_MAX_NOM_COMPLET}
                        placeholder={t("placeholderNom")}
                        disabled={ajoutEnCours}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
