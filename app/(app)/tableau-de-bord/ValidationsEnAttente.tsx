"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FilePenLine, Receipt, ShoppingCart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alerte, Badge, Bouton } from "@/components/ui";
import { apresValidation, montantAValider } from "@/features/tableauDeBord";
import type { ElementAValider, TableauDeBord, TypeValidation } from "@/features/tableauDeBord";
import { validerElement } from "@/features/tableauDeBord/adaptateur";
import { formaterDate, formaterMontant, formaterMontantCourt } from "@/lib/format";

import {
  BLOC,
  BLOC_CORPS,
  BLOC_ENTETE,
  BLOC_SOUS_TITRE,
  BLOC_TITRE,
  BLOC_VIDE,
  LIGNE_LISTE,
  MONTANT_TAB,
  PROJET_DETAIL,
} from "./classes";
import { CLE_TABLEAU_DE_BORD } from "./cles";

const ICONE_TYPE: Record<TypeValidation, LucideIcon> = {
  BON_PAIEMENT: Receipt,
  DEMANDE_ACHAT: ShoppingCart,
  AVENANT: FilePenLine,
};

interface Message {
  type: "succes" | "erreur";
  texte: string;
}

/**
 * Ce qui attend la signature du DG : bons de paiement, achats au-delà de son
 * seuil, avenants. Il remplace la seule liste des bons de paiement — un DG
 * ne signe pas que des paiements.
 *
 * **Une validation en un clic** (CDC §7.1, trois clics au plus) : l'élément
 * quitte la file dès que le serveur l'accepte, par `apresValidation` appliqué
 * au cache, sans recharger tout l'écran. Pas de nouvel essai automatique :
 * une signature rejouée coûte plus cher qu'un échec visible.
 */
export function ValidationsEnAttente({ validations }: { validations: ElementAValider[] }) {
  const t = useTranslations("tableauDeBord.validations");
  const clientRequetes = useQueryClient();
  const [message, setMessage] = useState<Message | null>(null);

  const validation = useMutation({
    mutationFn: validerElement,
    onMutate: () => setMessage(null),
    onSuccess: (_resultat, element) => {
      clientRequetes.setQueryData<TableauDeBord>(CLE_TABLEAU_DE_BORD, (tdb) =>
        tdb ? apresValidation(tdb, element.id) : tdb,
      );
      setMessage({ type: "succes", texte: t("succes", { reference: element.reference }) });
    },
    onError: (_erreur, element) =>
      setMessage({ type: "erreur", texte: t("erreur", { reference: element.reference }) }),
  });

  return (
    <section className={BLOC}>
      <header className={BLOC_ENTETE}>
        <div>
          <h2 className={BLOC_TITRE}>{t("titre")}</h2>
          {validations.length > 0 && (
            <p className={BLOC_SOUS_TITRE}>
              {t("total", { montant: formaterMontantCourt(montantAValider(validations)) })}
            </p>
          )}
        </div>
        {validations.length > 0 && <Badge variante="primaire">{validations.length}</Badge>}
      </header>

      <div className={BLOC_CORPS}>
        {message && (
          <div className="mb-3">
            <Alerte type={message.type}>{message.texte}</Alerte>
          </div>
        )}

        {validations.length === 0 ? (
          <p className={BLOC_VIDE}>{t("aucune")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {validations.map((element) => {
              const Icone = ICONE_TYPE[element.type];
              const enCours = validation.isPending && validation.variables?.id === element.id;

              return (
                <li key={element.id} className={LIGNE_LISTE}>
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                    <Icone className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-neutral-500">{t(`types.${element.type}`)}</div>
                    <div className="truncate text-sm font-semibold text-neutral-900" title={element.objet}>
                      {element.objet}
                    </div>
                    <div className={PROJET_DETAIL}>
                      {t("detail", { reference: element.reference, chantier: element.chantierNom })}
                    </div>
                    <div className={PROJET_DETAIL}>
                      {t("demande", {
                        demandeur: element.demandeur,
                        date: formaterDate(element.demandeLe),
                      })}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`${MONTANT_TAB} text-sm text-neutral-900`}>
                      {formaterMontant(element.montant)}
                    </span>
                    <Bouton
                      variante="secondaire"
                      taille="sm"
                      iconeGauche={<Check className="size-4" aria-hidden="true" />}
                      enCours={enCours}
                      disabled={validation.isPending && !enCours}
                      onClick={() => validation.mutate(element)}
                    >
                      {t("valider")}
                    </Bouton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
