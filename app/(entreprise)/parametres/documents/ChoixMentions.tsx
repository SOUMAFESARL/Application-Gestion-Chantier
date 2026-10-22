"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Bouton } from "@/components/ui";
import {
  ajouterMention,
  deplacerMention,
  mentionsDisponibles,
  retirerMention,
} from "@/features/documents";
import type { CodeMention } from "@/features/documents";

interface Props {
  /** Les mentions choisies, dans l'ordre d'impression. */
  choisies: CodeMention[];
  onChange: (mentions: CodeMention[]) => void;
  /** Sans le droit d'écriture, la liste se lit seulement. */
  lectureSeule: boolean;
}

/**
 * Les mentions d'un bloc (en-tête ou pied) : celles qui sont imprimées, dans leur ordre, puis
 * celles qu'on peut encore ajouter. L'ordre se règle d'un rang à la fois.
 */
export function ChoixMentions({ choisies, onChange, lectureSeule }: Props) {
  const t = useTranslations("reglageDocuments");
  const disponibles = mentionsDisponibles(choisies);

  return (
    <div className="flex flex-col gap-3">
      {choisies.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("mentions.aucune")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {choisies.map((code, rang) => {
            const nom = t(`codes.${code}`);
            return (
              <li
                key={code}
                className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-0 px-3 py-1.5"
              >
                <span className="w-5 text-sm font-semibold text-neutral-500">{rang + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">{nom}</span>
                {!lectureSeule && (
                  <>
                    <Bouton
                      type="button"
                      variante="ghost"
                      taille="sm"
                      disabled={rang === 0}
                      aria-label={t("mentions.monter", { mention: nom })}
                      title={t("mentions.monter", { mention: nom })}
                      onClick={() => onChange(deplacerMention(choisies, code, -1))}
                    >
                      <ArrowUp size={16} aria-hidden="true" />
                    </Bouton>
                    <Bouton
                      type="button"
                      variante="ghost"
                      taille="sm"
                      disabled={rang === choisies.length - 1}
                      aria-label={t("mentions.descendre", { mention: nom })}
                      title={t("mentions.descendre", { mention: nom })}
                      onClick={() => onChange(deplacerMention(choisies, code, 1))}
                    >
                      <ArrowDown size={16} aria-hidden="true" />
                    </Bouton>
                    <Bouton
                      type="button"
                      variante="ghost"
                      taille="sm"
                      aria-label={t("mentions.retirer", { mention: nom })}
                      title={t("mentions.retirer", { mention: nom })}
                      onClick={() => onChange(retirerMention(choisies, code))}
                    >
                      <X size={16} aria-hidden="true" />
                    </Bouton>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!lectureSeule && disponibles.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-neutral-800">{t("mentions.ajouter")}</p>
          <ul className="flex flex-wrap gap-2">
            {disponibles.map((code) => (
              <li key={code}>
                <Bouton
                  type="button"
                  variante="secondaire"
                  taille="sm"
                  iconeGauche={<Plus size={14} aria-hidden="true" />}
                  onClick={() => onChange(ajouterMention(choisies, code))}
                >
                  {t(`codes.${code}`)}
                </Bouton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
