"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardHat, LoaderCircle, Pencil, Repeat, Trash2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { aideColonnes } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExportTableau } from "@/components/ui/export-tableau";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BORD_DROIT_TABLEAU, TableauListe } from "@/components/ui/tableau-liste";
import { SelecteurPerimetre } from "@/features/decoupage/components/SelecteurPerimetre";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import {
  affecterCollaborateur,
  changerChefChantier,
  listerAffectables,
  listerAffectationsCollaborateurs,
  modifierAffectationCollaborateur,
  remplacerTitulaire,
  retirerAffectationCollaborateur,
} from "@/features/projets/adaptateur";
import { cleAffectables, cleAffectationsCollaborateurs, cleProjet } from "@/features/projets/cles";
import { libellePerimetre } from "@/features/projets/regles";
import type { AffectationCollaborateur, Projet } from "@/features/projets/types";
import { listerRoles } from "@/features/roles/api";
import { CLE_ROLES } from "@/features/roles/cles";
import { ErreurApi } from "@/lib/api";
import { ABSENT, formaterDate } from "@/lib/format";

const colonne = aideColonnes<AffectationCollaborateur>();

/** Le code du rôle de chef de chantier (registre des rôles du serveur, `RoleProjet.CC`). */
const ROLE_CHEF_CHANTIER = "CC";

type Fenetre =
  | { type: "affecter" }
  | { type: "modifier"; affectation: AffectationCollaborateur }
  | { type: "remplacer"; affectation: AffectationCollaborateur }
  | { type: "chefChantier" }
  | { type: "retirer"; affectation: AffectationCollaborateur };

/**
 * Les collaborateurs affectés au projet (décision P13) : chacun avec **son rôle sur ce projet** —
 * qui peut différer de son rôle sur la plateforme — et **son périmètre**, des cases de l'arbre ou
 * tout le projet. On affecte, on modifie le rôle ou le périmètre, on **remplace** un titulaire
 * dans sa propre fenêtre (seul moyen pour un rôle unique par projet), on change de chef de
 * chantier, on retire.
 */
export function AffectationsCollaborateurs({ projet }: { projet: Projet }) {
  const t = useTranslations("ficheProjet.affectations");
  const { peutSurProjet } = useDroits();
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);
  const peutAffecter = peutSurProjet(PERMISSIONS.AFFECTER_MEMBRES, projet);
  const peutRetirer = peutSurProjet(PERMISSIONS.RETIRER_MEMBRES, projet);

  const requete = useQuery({
    queryKey: cleAffectationsCollaborateurs(projet.id),
    queryFn: ({ signal }) => listerAffectationsCollaborateurs(projet.id, signal),
  });

  const colonnes = useMemo(
    () => [
      colonne.display({
        id: "collaborateur",
        header: t("colonnes.collaborateur"),
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium text-neutral-900">{row.original.utilisateur.nomComplet}</span>
            {row.original.utilisateur.email && (
              <span className="text-xs text-neutral-500">{row.original.utilisateur.email}</span>
            )}
          </span>
        ),
      }),
      colonne.display({
        id: "role",
        header: t("colonnes.role"),
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span>{row.original.roleProjetLibelle}</span>
            {row.original.rolePlateforme && row.original.rolePlateforme !== row.original.roleProjet && (
              <span className="text-xs text-neutral-500">
                {t("rolePlateforme", { role: row.original.rolePlateforme })}
              </span>
            )}
          </span>
        ),
      }),
      colonne.display({
        id: "perimetre",
        header: t("colonnes.perimetre"),
        cell: ({ row }) => (
          <span className="text-neutral-700">
            {row.original.perimetres.length === 0 ? t("toutLeProjet") : libellePerimetre(row.original.perimetres)}
          </span>
        ),
      }),
      colonne.display({
        id: "depuis",
        header: t("colonnes.depuis"),
        cell: ({ row }) => formaterDate(row.original.dateDebut),
      }),
      colonne.display({
        id: "actions",
        header: () => <span className="sr-only">{t("colonnes.actions")}</span>,
        cell: ({ row }) => (
          <span className="flex justify-end gap-1">
            <BoutonPermis
              size="icon-sm"
              variant="ghost"
              aria-label={t("modifier")}
              title={t("modifier")}
              permis={peutAffecter && row.original.modifiable}
              permission={PERMISSIONS.AFFECTER_MEMBRES}
              onClick={() => setFenetre({ type: "modifier", affectation: row.original })}
            >
              <Pencil />
            </BoutonPermis>
            <BoutonPermis
              size="icon-sm"
              variant="ghost"
              aria-label={t("remplacer")}
              title={t("remplacer")}
              permis={peutAffecter && row.original.modifiable}
              permission={PERMISSIONS.AFFECTER_MEMBRES}
              onClick={() => setFenetre({ type: "remplacer", affectation: row.original })}
            >
              <Repeat />
            </BoutonPermis>
            <BoutonPermis
              size="icon-sm"
              variant="ghost"
              aria-label={t("retirer")}
              title={t("retirer")}
              permis={peutRetirer && row.original.modifiable}
              permission={PERMISSIONS.RETIRER_MEMBRES}
              onClick={() => setFenetre({ type: "retirer", affectation: row.original })}
            >
              <Trash2 />
            </BoutonPermis>
          </span>
        ),
        meta: { classe: BORD_DROIT_TABLEAU },
      }),
    ],
    [t, peutAffecter, peutRetirer],
  );

  const exporter = useMemo<ExportTableau<AffectationCollaborateur>>(
    () => ({
      titre: t("export.titre", { projet: projet.nom }),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        { entete: t("colonnes.collaborateur"), valeur: (a) => a.utilisateur.nomComplet },
        { entete: t("colonnes.role"), valeur: (a) => a.roleProjetLibelle },
        { entete: t("export.rolePlateforme"), valeur: (a) => a.rolePlateforme },
        {
          entete: t("colonnes.perimetre"),
          valeur: (a) => (a.perimetres.length === 0 ? t("toutLeProjet") : libellePerimetre(a.perimetres)),
        },
        { entete: t("colonnes.depuis"), valeur: (a) => a.dateDebut ?? "" },
        { entete: t("export.jusqua"), valeur: (a) => a.dateFin ?? "" },
      ],
    }),
    [t, projet.nom],
  );

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="m-0 text-lg font-semibold text-neutral-900">{t("titre")}</h2>
        <p className="m-0 text-sm text-neutral-600">{t("description")}</p>
      </header>
      {requete.isPending && <EtatChargement />}
      {requete.isError && <EtatErreur onReessayer={() => void requete.refetch()} />}
      {requete.isSuccess && (
        <TableauListe
          colonnes={colonnes}
          donnees={requete.data}
          cleLigne={(a) => a.id}
          messageVide={t("vide")}
          exporter={exporter}
          actions={
            <span className="flex flex-wrap gap-2">
              <BoutonPermis
                size="sm"
                variant="outline"
                permis={peutAffecter}
                permission={PERMISSIONS.AFFECTER_MEMBRES}
                onClick={() => setFenetre({ type: "chefChantier" })}
              >
                <HardHat />
                {t("changerChefChantier")}
              </BoutonPermis>
              <BoutonPermis
                size="sm"
                permis={peutAffecter}
                permission={PERMISSIONS.AFFECTER_MEMBRES}
                onClick={() => setFenetre({ type: "affecter" })}
              >
                <UserPlus />
                {t("affecter")}
              </BoutonPermis>
            </span>
          }
        />
      )}

      {(fenetre?.type === "affecter" || fenetre?.type === "modifier") && (
        <TiroirAffectationCollaborateur
          key={fenetre.type === "modifier" ? fenetre.affectation.id : "nouvelle"}
          projet={projet}
          affectation={fenetre.type === "modifier" ? fenetre.affectation : null}
          onFermer={() => setFenetre(null)}
        />
      )}
      {(fenetre?.type === "remplacer" || fenetre?.type === "chefChantier") && (
        <FenetreRemplacement
          projet={projet}
          affectation={fenetre.type === "remplacer" ? fenetre.affectation : null}
          onFermer={() => setFenetre(null)}
        />
      )}
      {fenetre?.type === "retirer" && (
        <FenetreRetrait projet={projet} affectation={fenetre.affectation} onFermer={() => setFenetre(null)} />
      )}
    </section>
  );
}

function useActualiser(projetId: string) {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: cleAffectationsCollaborateurs(projetId) });
    await client.invalidateQueries({ queryKey: cleProjet(projetId) });
  };
}

function messageErreur(erreur: unknown, repli: string): string {
  if (erreur instanceof ErreurApi) {
    const champs = Object.values(erreur.erreursParChamp).filter((v) => typeof v === "string");
    return erreur.code === "validation" && champs.length > 0 ? champs.join(" ") : erreur.message || repli;
  }
  return repli;
}

/** Les rôles de portée Projet de l'entreprise : ceux qu'on tient sur un chantier. */
function useRolesProjet() {
  return useQuery({
    queryKey: CLE_ROLES,
    queryFn: listerRoles,
    select: (roles) => roles.filter((role) => role.portee === "PROJET" && role.est_actif),
  });
}

/* ------------------------------------------------------------------ *
 * Affecter, ou modifier le rôle et le périmètre.
 * ------------------------------------------------------------------ */

function TiroirAffectationCollaborateur({
  projet,
  affectation,
  onFermer,
}: {
  projet: Projet;
  affectation: AffectationCollaborateur | null;
  onFermer: () => void;
}) {
  const t = useTranslations("ficheProjet.affectations");
  const actualiser = useActualiser(projet.id);
  const [utilisateurId, setUtilisateurId] = useState(affectation?.utilisateur.id ?? "");
  const [role, setRole] = useState(affectation?.roleProjet ?? "");
  const [perimetres, setPerimetres] = useState<string[]>(affectation?.perimetres.map((c) => c.id) ?? []);
  const [erreur, setErreur] = useState<string | null>(null);

  const candidats = useQuery({
    queryKey: cleAffectables(projet.id),
    queryFn: ({ signal }) => listerAffectables(projet.id, signal),
    enabled: affectation === null,
  });
  const roles = useRolesProjet();

  const ecriture = useMutation({
    mutationFn: () =>
      affectation
        ? modifierAffectationCollaborateur(projet.id, affectation.id, {
            roleProjet: role !== affectation.roleProjet ? role : undefined,
            perimetresIds: perimetres,
          })
        : affecterCollaborateur(projet.id, { utilisateurId, roleProjet: role, perimetresIds: perimetres }),
    onSuccess: async () => {
      toast.success(affectation ? t("modifiee") : t("affectee"));
      onFermer();
      await actualiser();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });

  const candidatChoisi = candidats.data?.find((c) => c.id === utilisateurId);

  return (
    <Sheet open onOpenChange={(ouvert) => !ouvert && !ecriture.isPending && onFermer()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-neutral-200 py-5 pr-14 pl-6">
          <SheetTitle className="text-lg text-neutral-900">
            {affectation ? t("titreModification", { nom: affectation.utilisateur.nomComplet }) : t("titreAffectation")}
          </SheetTitle>
          <SheetDescription>{t("sousTitre")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-6 py-5">
          {!affectation && (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
              {t("champCollaborateur")}
              <Select
                value={utilisateurId}
                onValueChange={(valeur) => {
                  setUtilisateurId(valeur);
                  // Par défaut, le rôle sur le projet est celui de la plateforme.
                  const candidat = candidats.data?.find((c) => c.id === valeur);
                  if (candidat && !role) setRole(candidat.roleCode);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={candidats.isPending ? t("chargement") : t("choisirCollaborateur")} />
                </SelectTrigger>
                <SelectContent>
                  {(candidats.data ?? []).map((candidat) => (
                    <SelectItem key={candidat.id} value={candidat.id}>
                      {t("candidat", { nom: candidat.nom, role: candidat.role })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
            {t("champRole")}
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("choisirRole")} />
              </SelectTrigger>
              <SelectContent>
                {(roles.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.code.toUpperCase()}>
                    {r.libelle}
                    {r.unique_par_projet ? ` — ${t("unique")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs font-normal text-neutral-500">
              {candidatChoisi
                ? t("aideRoleAvecPlateforme", { role: candidatChoisi.role })
                : t("aideRole")}
            </span>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-700">{t("champPerimetre")}</span>
            {projet.decoupageCree ? (
              <SelecteurPerimetre projetId={projet.id} valeur={perimetres} onChange={setPerimetres} />
            ) : (
              <span className="text-sm text-neutral-500">{t("sansArbre")}</span>
            )}
          </div>
          {erreur && (
            <Alert variant="erreur">
              <AlertDescription>{erreur}</AlertDescription>
            </Alert>
          )}
        </div>
        <SheetFooter className="flex-row justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <Button variant="outline" onClick={onFermer} disabled={ecriture.isPending}>
            {t("annuler")}
          </Button>
          <Button onClick={() => ecriture.mutate()} disabled={ecriture.isPending || (!affectation && !utilisateurId) || !role}>
            {ecriture.isPending && <LoaderCircle className="animate-spin" />}
            {affectation ? t("enregistrer") : t("affecter")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ *
 * Remplacer un titulaire, ou changer de chef de chantier.
 * ------------------------------------------------------------------ */

function FenetreRemplacement({
  projet,
  affectation,
  onFermer,
}: {
  projet: Projet;
  /** `null` : changer de chef de chantier. */
  affectation: AffectationCollaborateur | null;
  onFermer: () => void;
}) {
  const t = useTranslations("ficheProjet.affectations");
  const actualiser = useActualiser(projet.id);
  const [utilisateurId, setUtilisateurId] = useState("");
  const [date, setDate] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const candidats = useQuery({
    queryKey: cleAffectables(projet.id),
    queryFn: ({ signal }) => listerAffectables(projet.id, signal),
  });

  const ecriture = useMutation({
    mutationFn: () =>
      affectation
        ? remplacerTitulaire(projet.id, {
            roleProjet: affectation.roleProjet,
            utilisateurId,
            affectationRemplaceeId: affectation.id,
            // Le nouveau titulaire reprend le périmètre de l'ancien.
            perimetresIds: affectation.perimetres.map((c) => c.id),
            dateChangement: date || null,
          })
        : changerChefChantier(projet.id, { utilisateurId, perimetresIds: [], dateChangement: date || null }),
    onSuccess: async () => {
      toast.success(t("remplace"));
      onFermer();
      await actualiser();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });

  const proposes = (candidats.data ?? []).filter(
    (c) => c.id !== affectation?.utilisateur.id && (affectation !== null || c.roleCode === ROLE_CHEF_CHANTIER),
  );

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !ecriture.isPending && onFermer()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {affectation
              ? t("titreRemplacement", { nom: affectation.utilisateur.nomComplet, role: affectation.roleProjetLibelle })
              : t("titreChefChantier")}
          </DialogTitle>
          <DialogDescription>{t("descriptionRemplacement")}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
          {t("champNouveauTitulaire")}
          <Select value={utilisateurId} onValueChange={setUtilisateurId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={candidats.isPending ? t("chargement") : t("choisirCollaborateur")} />
            </SelectTrigger>
            <SelectContent>
              {proposes.map((candidat) => (
                <SelectItem key={candidat.id} value={candidat.id}>
                  {t("candidat", { nom: candidat.nom, role: candidat.role })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
          {t("champDateChangement")}
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="text-xs font-normal text-neutral-500">{t("aideDateChangement")}</span>
        </label>
        {erreur && (
          <Alert variant="erreur">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onFermer} disabled={ecriture.isPending}>
            {t("annuler")}
          </Button>
          <Button onClick={() => ecriture.mutate()} disabled={ecriture.isPending || !utilisateurId}>
            {ecriture.isPending && <LoaderCircle className="animate-spin" />}
            {t("confirmerRemplacement")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FenetreRetrait({
  projet,
  affectation,
  onFermer,
}: {
  projet: Projet;
  affectation: AffectationCollaborateur;
  onFermer: () => void;
}) {
  const t = useTranslations("ficheProjet.affectations");
  const actualiser = useActualiser(projet.id);
  const [erreur, setErreur] = useState<string | null>(null);
  const ecriture = useMutation({
    mutationFn: () => retirerAffectationCollaborateur(projet.id, affectation.id),
    onSuccess: async () => {
      toast.success(t("retire", { nom: affectation.utilisateur.nomComplet }));
      onFermer();
      await actualiser();
    },
    onError: (e) => setErreur(messageErreur(e, t("erreur"))),
  });
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !ecriture.isPending && onFermer()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("titreRetrait", { nom: affectation.utilisateur.nomComplet })}</DialogTitle>
          <DialogDescription>{t("descriptionRetrait", { role: affectation.roleProjetLibelle || ABSENT })}</DialogDescription>
        </DialogHeader>
        {erreur && (
          <Alert variant="erreur">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onFermer} disabled={ecriture.isPending}>
            {t("annuler")}
          </Button>
          <Button variant="destructive" onClick={() => ecriture.mutate()} disabled={ecriture.isPending}>
            {ecriture.isPending && <LoaderCircle className="animate-spin" />}
            {t("retirer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
