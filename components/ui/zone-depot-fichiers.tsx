"use client";

import { CircleAlert, FileText, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ChangeEvent, ComponentProps, DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { formaterTailleFichier } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props
  extends Omit<ComponentProps<"input">, "type" | "value" | "onChange" | "multiple" | "className"> {
  fichiers: File[];
  onChange: (fichiers: File[]) => void;
  /** Plusieurs fichiers, ou un seul qui remplace le précédent. */
  multiple?: boolean;
  /** Au-delà, les fichiers en trop sont écartés avec un message. */
  maximum?: number;
  /**
   * Pourquoi un fichier est écarté — le message à afficher —, ou `null`
   * s'il convient. La règle appartient au domaine : la zone ne fait que
   * l'appliquer au dépôt.
   */
  refuser?: (fichier: File) => string | null;
  /** La contrainte lue sous l'invite : « PDF uniquement · 20 Mo max ». */
  consigne: string;
  className?: string;
}

/** Deux dépôts du même fichier n'en font qu'un. */
function cle(fichier: File): string {
  return `${fichier.name}:${fichier.size}:${fichier.lastModified}`;
}

/**
 * Une zone de dépôt de fichiers : glisser-déposer ou parcourir, puis la
 * liste des fichiers retenus, chacun retirable.
 *
 * Le champ natif reste dans le DOM (masqué, pas retiré) : c'est lui que
 * `<label>` et `FormControl` ciblent, et lui qui reçoit le focus clavier —
 * la zone s'éclaire alors comme au survol.
 */
export function ZoneDepotFichiers({
  fichiers,
  onChange,
  multiple = false,
  maximum,
  refuser,
  consigne,
  className,
  disabled,
  ...input
}: Props) {
  const t = useTranslations("zoneDepot");
  const [survol, setSurvol] = useState(false);
  const [refus, setRefus] = useState<string[]>([]);

  function ajouter(nouveaux: File[]) {
    const messages: string[] = [];
    const acceptes: File[] = [];
    for (const fichier of nouveaux) {
      const motif = refuser?.(fichier) ?? null;
      if (motif) messages.push(t("refus", { nom: fichier.name, motif }));
      else acceptes.push(fichier);
    }

    let suivants = multiple ? [...fichiers] : [];
    const presents = new Set(suivants.map(cle));
    for (const fichier of multiple ? acceptes : acceptes.slice(0, 1)) {
      if (!presents.has(cle(fichier))) {
        suivants.push(fichier);
        presents.add(cle(fichier));
      }
    }
    if (maximum !== undefined && suivants.length > maximum) {
      suivants = suivants.slice(0, maximum);
      messages.push(t("maximumAtteint", { max: maximum }));
    }

    setRefus(messages);
    onChange(suivants);
  }

  function choisir(evenement: ChangeEvent<HTMLInputElement>) {
    ajouter(Array.from(evenement.target.files ?? []));
    // Sans remise à zéro, choisir de nouveau le même fichier ne déclenche rien.
    evenement.target.value = "";
  }

  function survoler(evenement: DragEvent<HTMLLabelElement>) {
    evenement.preventDefault();
    if (!disabled) setSurvol(true);
  }

  function quitter(evenement: DragEvent<HTMLLabelElement>) {
    // `dragleave` part aussi en passant sur un enfant de la zone.
    if (!evenement.currentTarget.contains(evenement.relatedTarget as Node | null)) setSurvol(false);
  }

  function deposer(evenement: DragEvent<HTMLLabelElement>) {
    evenement.preventDefault();
    setSurvol(false);
    if (!disabled) ajouter(Array.from(evenement.dataTransfer.files));
  }

  function retirer(fichier: File) {
    setRefus([]);
    onChange(fichiers.filter((autre) => cle(autre) !== cle(fichier)));
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <label
        onDragEnter={survoler}
        onDragOver={survoler}
        onDragLeave={quitter}
        onDrop={deposer}
        className={cn(
          "group flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-neutral-50 px-4 py-6 text-center transition-colors",
          "hover:border-primary-300 hover:bg-primary-50 focus-within:border-primary focus-within:bg-primary-50",
          "has-[input[aria-invalid=true]]:border-erreur",
          survol && "border-primary bg-primary-50",
          disabled && "pointer-events-none cursor-not-allowed opacity-60",
        )}
      >
        <input
          {...input}
          type="file"
          multiple={multiple}
          disabled={disabled}
          onChange={choisir}
          className="sr-only"
        />
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full bg-neutral-0 text-primary-600 shadow-sm transition-transform group-hover:scale-105",
            survol && "scale-110",
          )}
        >
          <Upload className="size-5" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium text-foreground">
          {survol ? t("relacher") : t("deposer")}
        </span>
        <span className="text-sm text-muted-foreground">
          {t.rich("parcourir", {
            lien: (morceaux) => (
              <span className="font-semibold text-primary-600 underline-offset-4 group-hover:underline">
                {morceaux}
              </span>
            ),
          })}
        </span>
        <span className="text-xs text-muted-foreground">{consigne}</span>
      </label>

      {refus.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0" role="alert">
          {refus.map((message) => (
            <li key={message} className="flex items-start gap-1.5 text-xs font-medium text-erreur">
              <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {message}
            </li>
          ))}
        </ul>
      )}

      {fichiers.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label={t("fichiersRetenus")}>
          {fichiers.map((fichier) => (
            <li
              key={cle(fichier)}
              className="flex items-center gap-3 rounded-lg border border-solid border-border bg-card py-2 pr-1 pl-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                <FileText className="size-4" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground" title={fichier.name}>
                  {fichier.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formaterTailleFichier(fichier.size)}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-erreur-fond hover:text-erreur"
                onClick={() => retirer(fichier)}
                disabled={disabled}
                aria-label={t("retirer", { nom: fichier.name })}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
