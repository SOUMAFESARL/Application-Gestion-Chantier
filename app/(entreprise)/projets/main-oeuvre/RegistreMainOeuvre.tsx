"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EnTetePage } from "@/components/layout/EnTetePage";
import { Badge, EtatChargement, EtatErreur } from "@/components/ui";
import { aideColonnes } from "@/components/ui/data-table";
import type { ExportTableau } from "@/components/ui/export-tableau";
import {
  BORD_DROIT_TABLEAU,
  FiltreTableau,
  RechercheTableau,
  TableauListe,
} from "@/components/ui/tableau-liste";
import { retirerPersonne, listerPersonnes } from "@/features/equipes/adaptateur";
import { CLE_REGISTRE, cleRegistre } from "@/features/equipes/cles";
import { FenetrePersonne } from "@/features/equipes/components/FenetrePersonne";
import { filtrerRegistre, ORIGINES_PERSONNE, type OriginePersonne } from "@/features/equipes/regles";
import type { Personne } from "@/features/equipes/types";
import { BoutonPermis, PERMISSIONS, useDroits } from "@/features/habilitations";
import { afficherTelephone } from "@/features/referentiels/telephone";
import { ErreurApi } from "@/lib/api";
import { ABSENT } from "@/lib/format";

const colonne = aideColonnes<Personne>();

export function RegistreMainOeuvre() {
  const t = useTranslations("mainOeuvre");
  const { peutCode } = useDroits();
  const peutGerer = peutCode(PERMISSIONS.MAIN_OEUVRE_GERER);
  const client = useQueryClient();
  const [recherche, setRecherche] = useState("");
  const [origine, setOrigine] = useState<OriginePersonne | "">("");
  const [fenetre, setFenetre] = useState<{ personne: Personne | null } | null>(null);

  const requete = useQuery({
    queryKey: cleRegistre(),
    queryFn: ({ signal }) => listerPersonnes({}, signal),
  });

  const retrait = useMutation({
    mutationFn: (personne: Personne) => retirerPersonne(personne.id),
    onSuccess: async (_, personne) => {
      toast.success(t("retiree", { nom: personne.nomComplet }));
      await client.invalidateQueries({ queryKey: CLE_REGISTRE });
    },
    onError: (e) => toast.error(e instanceof ErreurApi && e.message ? e.message : t("erreur")),
  });

  const lignes = useMemo(
    () => filtrerRegistre(requete.data ?? [], { recherche, origine }),
    [requete.data, recherche, origine],
  );

  const colonnes = useMemo(
    () => [
      colonne.display({
        id: "personne",
        header: t("colonnes.personne"),
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <span className="font-medium text-neutral-900">{row.original.nomComplet}</span>
            {row.original.aUnCompte && <Badge variante="information">{t("compte")}</Badge>}
          </span>
        ),
      }),
      colonne.display({
        id: "metier",
        header: t("colonnes.metier"),
        cell: ({ row }) => row.original.metier || ABSENT,
      }),
      colonne.display({
        id: "entreprise",
        header: t("colonnes.entreprise"),
        cell: ({ row }) => (row.original.entreprise.interne ? t("notreEntreprise") : row.original.entreprise.nom),
      }),
      colonne.display({
        id: "telephone",
        header: t("colonnes.telephone"),
        cell: ({ row }) => (row.original.telephone ? afficherTelephone(row.original.telephone) : ABSENT),
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
              permis={peutGerer}
              permission={PERMISSIONS.MAIN_OEUVRE_GERER}
              onClick={() => setFenetre({ personne: row.original })}
            >
              <Pencil />
            </BoutonPermis>
            <BoutonPermis
              size="icon-sm"
              variant="ghost"
              aria-label={t("retirer")}
              title={t("retirer")}
              permis={peutGerer}
              permission={PERMISSIONS.MAIN_OEUVRE_GERER}
              disabled={retrait.isPending}
              onClick={() => retrait.mutate(row.original)}
            >
              <Trash2 />
            </BoutonPermis>
          </span>
        ),
        meta: { classe: BORD_DROIT_TABLEAU },
      }),
    ],
    [t, peutGerer, retrait],
  );

  const exporter = useMemo<ExportTableau<Personne>>(
    () => ({
      titre: t("export.titre"),
      nomFichier: t("export.nomFichier"),
      colonnes: [
        { entete: t("export.nom"), valeur: (p) => p.nom },
        { entete: t("export.prenom"), valeur: (p) => p.prenom },
        { entete: t("colonnes.metier"), valeur: (p) => p.metier },
        { entete: t("colonnes.entreprise"), valeur: (p) => (p.entreprise.interne ? t("notreEntreprise") : p.entreprise.nom) },
        { entete: t("colonnes.telephone"), valeur: (p) => p.telephone },
        { entete: t("export.compte"), valeur: (p) => (p.aUnCompte ? t("oui") : t("non")) },
      ],
    }),
    [t],
  );

  return (
    <div className="flex flex-col gap-6">
      <EnTetePage titre={t("titre")} description={t("description")} />
      {requete.isPending && <EtatChargement />}
      {requete.isError && <EtatErreur onReessayer={() => void requete.refetch()} />}
      {requete.isSuccess && (
        <TableauListe
          colonnes={colonnes}
          donnees={lignes}
          cleLigne={(p) => p.id}
          messageVide={t("vide")}
          exporter={exporter}
          filtresActifs={recherche !== "" || origine !== ""}
          onReinitialiser={() => {
            setRecherche("");
            setOrigine("");
          }}
          outils={
            <>
              <RechercheTableau
                valeur={recherche}
                onChangement={setRecherche}
                libelle={t("rechercher")}
                placeholder={t("rechercherExemple")}
              />
              <FiltreTableau
                valeur={origine}
                onChangement={setOrigine}
                libelle={t("filtreEntreprise")}
                libelleTous={t("toutes")}
                options={ORIGINES_PERSONNE.map((valeur) => ({ valeur, libelle: t(`origines.${valeur}`) }))}
              />
            </>
          }
          actions={
            <BoutonPermis
              size="sm"
              permis={peutGerer}
              permission={PERMISSIONS.MAIN_OEUVRE_GERER}
              onClick={() => setFenetre({ personne: null })}
            >
              <UserPlus />
              {t("ajouter")}
            </BoutonPermis>
          }
        />
      )}
      {fenetre && (
        <FenetrePersonne
          key={fenetre.personne?.id ?? "nouvelle"}
          personne={fenetre.personne}
          onFermer={() => setFenetre(null)}
        />
      )}
    </div>
  );
}
