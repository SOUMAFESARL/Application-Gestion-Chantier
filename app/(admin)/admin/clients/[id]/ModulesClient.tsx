"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Bouton, Modale } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import type { ClientPlateforme, ModuleClient } from "@/features/administration";
import {
  modulesProposesAuClient,
  retraitModulePossible,
} from "@/features/administration";
import { basculerModuleClient } from "@/features/administration/adaptateur";
import { ErreurApi } from "@/lib/api";

import { CLES_ADMINISTRATION } from "../../cles";
import { CARTE, CARTE_TITRE } from "../../tons";

const PREFIXE_ID_MODULE = "module-client-";

interface Props {
  client: ClientPlateforme;
  peutAgir: boolean;
}

/**
 * Les modules de l'entreprise : cocher en active un, décocher le retire de son
 * espace après confirmation (ses données sont conservées).
 */
export function ModulesClient({ client, peutAgir }: Props) {
  const t = useTranslations("administration");
  const cache = useQueryClient();
  const [cibleBascule, setCibleBascule] = useState<{
    module: ModuleClient;
    actif: boolean;
  } | null>(null);

  const modules = modulesProposesAuClient(client);

  const bascule = useMutation({
    mutationFn: ({ moduleId, actif }: { moduleId: string; actif: boolean }) =>
      basculerModuleClient(client.id, moduleId, actif),
    onSuccess: (misAJour) => {
      cache.setQueryData(CLES_ADMINISTRATION.client(client.id), misAJour);
      void cache.invalidateQueries({ queryKey: CLES_ADMINISTRATION.clients() });
      if (cibleBascule) {
        toast.success(
          cibleBascule.actif
            ? t("modulesClient.succesActivation", {
                module: cibleBascule.module.libelle,
                client: client.nomCommercial,
              })
            : t("modulesClient.succesRetrait", {
                module: cibleBascule.module.libelle,
                client: client.nomCommercial,
              }),
        );
      }
      setCibleBascule(null);
    },
    onError: (cause) => {
      toast.error(cause instanceof ErreurApi ? cause.message : t("erreurs.action"));
    },
  });

  return (
    <section className={CARTE}>
      <h2 className={CARTE_TITRE}>{t("modulesClient.titre")}</h2>
      {modules.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("modulesClient.aucun")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {modules.map((module) => {
            const idChamp = `${PREFIXE_ID_MODULE}${module.id}`;
            const estDesactivable = module.desactivable;
            const peutChanger =
              peutAgir &&
              !bascule.isPending &&
              (module.actif ? retraitModulePossible(module) : true);

            return (
              <li key={module.id} className="flex items-start gap-2.5">
                <Checkbox
                  id={idChamp}
                  checked={module.actif}
                  disabled={!peutChanger}
                  onCheckedChange={(coche) => {
                    setCibleBascule({ module, actif: coche === true });
                  }}
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-0.5">
                  <label
                    htmlFor={idChamp}
                    className="cursor-pointer text-sm font-medium text-neutral-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {module.libelle}
                  </label>
                  {!estDesactivable && (
                    <span className="text-xs text-neutral-500">
                      {t("modulesClient.socle")}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modale
        ouverte={cibleBascule !== null}
        titre={
          cibleBascule?.actif
            ? t("modulesClient.activationTitre", {
                module: cibleBascule.module.libelle,
                client: client.nomCommercial,
              })
            : t("modulesClient.retraitTitre", {
                module: cibleBascule?.module.libelle ?? "",
                client: client.nomCommercial,
              })
        }
        onFermer={() => {
          if (!bascule.isPending) setCibleBascule(null);
        }}
        actions={
          <>
            <Bouton
              variante="ghost"
              onClick={() => setCibleBascule(null)}
              disabled={bascule.isPending}
            >
              {t("modulesClient.annuler")}
            </Bouton>
            <Bouton
              variante={cibleBascule?.actif ? "primaire" : "danger"}
              enCours={bascule.isPending}
              onClick={() => {
                if (cibleBascule) {
                  bascule.mutate({
                    moduleId: cibleBascule.module.id,
                    actif: cibleBascule.actif,
                  });
                }
              }}
            >
              {cibleBascule?.actif
                ? t("modulesClient.activationConfirmer")
                : t("modulesClient.retraitConfirmer")}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-2 text-sm text-neutral-600">
          <p>
            {cibleBascule?.actif
              ? t("modulesClient.activationTexte")
              : t("modulesClient.retraitTexte")}
          </p>
          {!client.dirigeant && (
            <p className="font-medium text-neutral-700">
              {t("modulesClient.sansDirigeant")}
            </p>
          )}
        </div>
      </Modale>
    </section>
  );
}
