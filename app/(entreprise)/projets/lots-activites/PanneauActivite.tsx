"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleX, LoaderCircle, Pencil, Trash2, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge, Bouton, EtatChargement } from "@/components/ui";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { fonctionsSurProjet, useDroits } from "@/features/habilitations";
import { lireHistoriqueAvancement, mettreAJourAvancement } from "@/features/projets/adaptateur";
import {
  CLE_LISTE_PROJETS,
  cleHistoriqueAvancement,
  cleLots,
  cleProjet,
  cleStatistiques,
} from "@/features/projets/cles";
import {
  activitesDuProjet,
  peutMettreAJourAvancement,
  quantiteActuelleActivite,
  quantiteRealisee,
  statutActivite,
} from "@/features/projets/regles";
import type { Activite, Lot, Projet } from "@/features/projets/types";
import {
  COMMENTAIRE_AVANCEMENT_MIN,
  saisieAvancementDepuis,
  schemaAvancement,
  versMiseAJourAvancement,
  type SaisieAvancement,
} from "@/features/projets/validations";
import { ErreurApi } from "@/lib/api";
import { formaterDateHeure, formaterMontant, formaterQuantite } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BADGE_STATUT, BLOC, PANNEAU_COLLE } from "./classes";
import { Periode, Quantite } from "./StructureLots";

interface Props {
  projet?: Projet | null;
  activite: Activite | null;
  lot: Lot | null;
  lots: Lot[];
  onModifier: (activite: Activite) => void;
  onSupprimer: (activite: Activite) => void;
}

/**
 * Le détail de l'activité choisie dans l'arbre.
 *
 * Il reste en vue pendant qu'on parcourt le tableau (`sticky`) : c'est lui
 * qu'on lit en descendant la liste. L'avancement remonte du journal de
 * chantier ; le conducteur de travaux et le chef de projet peuvent aussi le
 * mettre à jour à la main, avec un commentaire qui reste dans l'historique.
 */
export function PanneauActivite({ projet, activite, lot, lots, onModifier, onSupprimer }: Props) {
  const t = useTranslations("projets.lotsActivites");
  const { droits, peutSurProjet, voitMontants } = useDroits();
  const peutSaisir = projet ? peutSurProjet("projets.ecrire", projet) : false;
  const peutMettreAJour = projet
    ? peutMettreAJourAvancement(projet, fonctionsSurProjet(projet, droits))
    : false;
  const [avancementOuvert, setAvancementOuvert] = useState(false);

  if (!activite || !lot) {
    return (
      <aside className={cn(BLOC, "p-5 text-sm text-neutral-500", PANNEAU_COLLE)}>
        {t("panneau.aucuneSelection")}
      </aside>
    );
  }

  const statut = statutActivite(activite);
  const realisee = quantiteRealisee(activite);
  const dependance = activite.dependanceId
    ? activitesDuProjet(lots).find((candidate) => candidate.id === activite.dependanceId)
    : null;

  return (
    <aside
      className={cn(BLOC, "flex flex-col gap-4 p-5", PANNEAU_COLLE)}
      aria-labelledby="titre-activite"
    >
      <header className="flex flex-col gap-1.5">
        <span className="text-xs text-neutral-500">
          {t("panneau.enTete", { code: lot.code, nom: lot.nom })}
        </span>
        <h2 id="titre-activite" className="m-0 text-lg font-bold text-neutral-900">
          {t("libelleActivite", { code: activite.code, libelle: activite.libelle })}
        </h2>
        <span className="flex flex-wrap gap-1.5">
          <Badge variante={BADGE_STATUT[statut]}>{t(`statutActivite.${statut}`)}</Badge>
          {activite.surCheminCritique && (
            <span title={t("critiqueTitre")}>
              <Badge variante="avertissement">{t("critique")}</Badge>
            </span>
          )}
        </span>
      </header>

      <Separator />

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <Ligne libelle={t("panneau.quantitePrevue")} premiere>
          <Quantite activite={activite} />
        </Ligne>
        <Ligne libelle={t("panneau.realise")}>
          {realisee === null || activite.unite === null
            ? t("pourcentage", { valeur: activite.avancement })
            : t("panneau.realiseValeur", {
                quantite: t("quantiteAvecUnite", {
                  quantite: formaterQuantite(realisee),
                  unite: t(`unites.${activite.unite}`),
                }),
                pourcentage: activite.avancement,
              })}
        </Ligne>
        <Ligne libelle={t("panneau.periode")}>
          <Periode debut={activite.dateDebutPrevue} fin={activite.dateFinPrevue} />
        </Ligne>
        {/* Le budget se tient au lot : on montre celui du lot de l'activité. */}
        {voitMontants && (
          <Ligne libelle={t("panneau.budgetLot")}>
            {lot.budget === null ? (
              <span className="text-neutral-500 italic">{t("panneau.nonDefini")}</span>
            ) : (
              formaterMontant(lot.budget)
            )}
          </Ligne>
        )}
        <Ligne libelle={t("panneau.equipe")}>
          {activite.equipe ? (
            t("libelleEquipe", { nom: activite.equipe.nom, effectif: activite.equipe.effectif })
          ) : (
            <span className="text-avertissement italic">{t("panneau.equipeAAffecter")}</span>
          )}
        </Ligne>
        <Ligne libelle={t("panneau.dependDe")}>
          {dependance
            ? t("libelleActivite", { code: dependance.code, libelle: dependance.libelle })
            : t("panneau.aucuneDependance")}
        </Ligne>
      </dl>

      {peutMettreAJour && projet && (
        <>
          <Bouton
            variante="primaire"
            taille="sm"
            iconeGauche={<TrendingUp size={16} aria-hidden="true" />}
            onClick={() => setAvancementOuvert(true)}
          >
            {t("avancement.bouton")}
          </Bouton>
          {/* Monté à l'ouverture seulement : chaque ouverture repart de la quantité actuelle. */}
          {avancementOuvert && (
            <ModaleAvancement
              projetId={projet.id}
              activite={activite}
              onFermer={() => setAvancementOuvert(false)}
            />
          )}
        </>
      )}

      <Separator />

      <HistoriqueAvancement activite={activite} />

      {peutSaisir && (
        <>
          <Separator />

          <div className="flex flex-wrap gap-2">
            <Bouton
              variante="secondaire"
              taille="sm"
              iconeGauche={<Pencil size={16} aria-hidden="true" />}
              onClick={() => onModifier(activite)}
            >
              {t("panneau.modifier")}
            </Bouton>
            <Bouton
              variante="danger"
              taille="sm"
              iconeGauche={<Trash2 size={16} aria-hidden="true" />}
              onClick={() => onSupprimer(activite)}
            >
              {t("panneau.supprimer")}
            </Bouton>
          </div>
        </>
      )}
    </aside>
  );
}

/**
 * Une ligne du détail. Chacune est précédée d'un filet sur toute la largeur de
 * la grille, sauf la première (`premiere`) : il sépare, il n'encadre pas.
 */
function Ligne({
  libelle,
  premiere = false,
  children,
}: {
  libelle: string;
  premiere?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {!premiere && <Separator className="col-span-2" />}
      <dt className="text-neutral-500">{libelle}</dt>
      <dd className="m-0 text-neutral-900 tabular-nums">{children}</dd>
    </>
  );
}

const FORM_ID_AVANCEMENT = "form-avancement-activite";
const CHAMP = "h-[var(--input-height-md)]";

/**
 * La mise à jour manuelle de l'avancement : la nouvelle quantité cumulée
 * réalisée et un commentaire obligatoire. Le schéma refuse une quantité en
 * baisse ; le serveur reste juge (403 hors CT et CP, 422 sur une baisse), et
 * son message s'affiche tel quel.
 */
function ModaleAvancement({
  projetId,
  activite,
  onFermer,
}: {
  projetId: string;
  activite: Activite;
  onFermer: () => void;
}) {
  const t = useTranslations("projets.lotsActivites");
  const clientRequetes = useQueryClient();
  const [erreur, setErreur] = useState<string | null>(null);

  const quantiteActuelle = quantiteActuelleActivite(activite);
  const unite = activite.unite === null ? null : t(`unites.${activite.unite}`);
  const schema = useMemo(() => schemaAvancement(quantiteActuelle), [quantiteActuelle]);
  const libelleActivite = t("libelleActivite", { code: activite.code, libelle: activite.libelle });

  const form = useForm<SaisieAvancement>({
    resolver: zodResolver(schema),
    defaultValues: saisieAvancementDepuis(quantiteActuelle),
    mode: "onTouched",
  });

  const enCours = form.formState.isSubmitting;
  const commentaire = useWatch({ control: form.control, name: "commentaire" }) ?? "";
  const longueur = commentaire.trim().length;

  async function soumettre(valeurs: SaisieAvancement) {
    setErreur(null);
    try {
      await mettreAJourAvancement(activite.id, versMiseAJourAvancement(valeurs));
      toast.success(t("avancement.succes", { activite: libelleActivite }));

      // L'arbre, l'en-tête et la fiche repartent des chiffres recalculés par le serveur.
      void clientRequetes.invalidateQueries({ queryKey: cleLots(projetId) });
      void clientRequetes.invalidateQueries({ queryKey: cleStatistiques(projetId) });
      void clientRequetes.invalidateQueries({ queryKey: cleProjet(projetId) });
      void clientRequetes.invalidateQueries({ queryKey: CLE_LISTE_PROJETS });
      void clientRequetes.invalidateQueries({ queryKey: cleHistoriqueAvancement(activite.id) });
      onFermer();
    } catch (err) {
      if (err instanceof ErreurApi) {
        const parChamp = err.erreursParChamp;
        if (parChamp.quantite_realisee) {
          form.setError("quantite", { message: parChamp.quantite_realisee });
        }
        if (parChamp.commentaire) {
          form.setError("commentaire", { message: parChamp.commentaire });
        }
        setErreur(err.message || t("avancement.erreurGenerique"));
      } else {
        setErreur(t("avancement.erreurGenerique"));
      }
    }
  }

  return (
    <Dialog open onOpenChange={(visible) => !visible && onFermer()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("avancement.titre")}</DialogTitle>
          <DialogDescription>
            {t("avancement.description", { activite: libelleActivite })}
          </DialogDescription>
        </DialogHeader>

        {erreur && (
          <Alert variant="erreur">
            <CircleX className="size-4" />
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}

        <Form {...form} preRempli>
          <form
            id={FORM_ID_AVANCEMENT}
            onSubmit={form.handleSubmit(soumettre)}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="quantite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {unite === null
                      ? t("avancement.champQuantite")
                      : t("avancement.champQuantiteUnite", { unite })}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={cn(CHAMP, "tabular-nums")}
                      inputMode="decimal"
                      disabled={enCours}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("avancement.quantiteActuelle", {
                      quantite:
                        unite === null
                          ? formaterQuantite(quantiteActuelle)
                          : t("quantiteAvecUnite", {
                              quantite: formaterQuantite(quantiteActuelle),
                              unite,
                            }),
                    })}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="commentaire"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>{t("avancement.champCommentaire")}</FormLabel>
                    <span
                      className={cn(
                        "text-xs",
                        longueur >= COMMENTAIRE_AVANCEMENT_MIN
                          ? "text-neutral-500"
                          : "font-medium text-amber-600",
                      )}
                    >
                      {t("avancement.compteur", {
                        actuel: longueur,
                        min: COMMENTAIRE_AVANCEMENT_MIN,
                      })}
                    </span>
                  </div>
                  <FormControl>
                    <Textarea {...field} rows={3} disabled={enCours} />
                  </FormControl>
                  <FormDescription>{t("avancement.commentaireAide")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter className="flex-row justify-end gap-2 max-sm:flex-col-reverse">
          <Button type="button" variant="outline" onClick={onFermer} disabled={enCours}>
            {t("avancement.annuler")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID_AVANCEMENT}
            disabled={enCours || longueur < COMMENTAIRE_AVANCEMENT_MIN}
            aria-busy={enCours}
          >
            {enCours && <LoaderCircle className="animate-spin" />}
            {t("avancement.enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Les mises à jour manuelles de l'activité, de la plus récente à la plus
 * ancienne : quand, qui, quantité avant → après, et pourquoi.
 */
function HistoriqueAvancement({ activite }: { activite: Activite }) {
  const t = useTranslations("projets.lotsActivites.avancement.historique");
  const tUnites = useTranslations("projets.lotsActivites");

  const requete = useQuery({
    queryKey: cleHistoriqueAvancement(activite.id),
    queryFn: ({ signal }) => lireHistoriqueAvancement(activite.id, signal),
  });
  const evenements = requete.data ?? [];

  /** « 120 m² », ou le nombre seul quand l'activité n'a pas d'unité. */
  function quantite(valeur: number | null): string {
    const formatee = formaterQuantite(valeur);
    return activite.unite === null
      ? formatee
      : tUnites("quantiteAvecUnite", { quantite: formatee, unite: tUnites(`unites.${activite.unite}`) });
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby="titre-historique-avancement">
      <h3 id="titre-historique-avancement" className="m-0 text-sm font-semibold text-neutral-900">
        {t("titre")}
      </h3>

      {requete.isPending && <EtatChargement />}
      {requete.isError && <p className="m-0 text-sm text-erreur">{t("erreur")}</p>}
      {requete.isSuccess && evenements.length === 0 && (
        <p className="m-0 text-sm text-neutral-500">{t("vide")}</p>
      )}

      {evenements.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {evenements.map((evenement) => (
            <li
              key={evenement.id}
              className="flex flex-col gap-1 border-b border-neutral-100 pb-2 text-xs text-neutral-600 last:border-b-0 last:pb-0"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-neutral-900 tabular-nums">
                  {t("transition", {
                    avant: quantite(evenement.quantiteAvant),
                    apres: quantite(evenement.quantiteApres),
                  })}
                </span>
                <span className="tabular-nums text-neutral-500">
                  {t("transition", {
                    avant: t("avancement", { valeur: formaterQuantite(evenement.avancementAvant) }),
                    apres: t("avancement", { valeur: formaterQuantite(evenement.avancementApres) }),
                  })}
                </span>
              </span>
              <span className="text-[11px] text-neutral-500">
                {t("auteurEtDate", {
                  auteur: evenement.auteur,
                  date: formaterDateHeure(evenement.le),
                })}
              </span>
              <p className="m-0 text-neutral-700">{evenement.commentaire}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
