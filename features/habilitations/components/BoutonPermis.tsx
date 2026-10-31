"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cleLibellePermission, type CodePermission } from "../permissions";

type Props = ComponentProps<typeof Button> & {
  /** Le compte a-t-il la permission ? Faux : le bouton est grisé. */
  permis: boolean;
  /** La permission qu'exige le geste, nommée dans l'infobulle quand elle manque. */
  permission: CodePermission;
};

/**
 * Un bouton dont le geste exige une permission (décision P7) : sans elle, il reste **visible et
 * grisé**, et son infobulle nomme la permission manquante. Un bouton masqué laissait croire que
 * le geste n'existait pas ; grisé, il dit à qui le demander.
 *
 * Un bouton désactivé ne reçoit pas le survol : l'infobulle se pose sur l'enveloppe.
 */
export function BoutonPermis({ permis, permission, disabled, ...props }: Props) {
  const t = useTranslations("habilitations");
  if (permis) return <Button disabled={disabled} {...props} />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          <Button {...props} disabled aria-disabled="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {t("permissionManquante", {
          permission: t(`permissions.${cleLibellePermission(permission)}`),
        })}
      </TooltipContent>
    </Tooltip>
  );
}
