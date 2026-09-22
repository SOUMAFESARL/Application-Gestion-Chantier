"use client";

import { CheckCircle, CurrencyCircleDollar } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alerte } from "@/components/ui/Alerte";
import { Badge } from "@/components/ui/Badge";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { signerBonPaiement } from "@/features/tableauDeBord/adaptateur";
import { bonSignable, signatureAboutie } from "@/features/tableauDeBord/regles";
import type { BonAPayer } from "@/features/tableauDeBord/types";
import { formaterMontant } from "@/lib/format";
import { CARTE_ENTETE, CARTE_TITRE } from "./classes";


interface Props {
  bons: BonAPayer[];
  compteur: number;
  onBonSigne: (bon: BonAPayer) => void;
}

interface MessageSignature {
  type: "succes" | "erreur";
  texte: string;
}

/**
 * Les bons de paiement en attente de signature.
 *
 * Le composant porte **son propre** état de signature — quels bons ont été
 * signés dans cette session, lesquels sont en cours — et ne remonte au
 * tableau de bord que l'événement qui l'intéresse : un bon de moins à signer.
 * Auparavant, ces trois états vivaient dans le composant de page, qui les
 * portait pour cette seule carte.
 */
export function ListeBonsAPayer({ bons, compteur, onBonSigne }: Props) {
  const t = useTranslations("tableauDeBord.bdp");
  const [signes, setSignes] = useState<Record<string, boolean>>({});
  const [enCoursSignature, setEnCoursSignature] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<MessageSignature | null>(null);

  async function handleSigner(bon: BonAPayer) {
    if (!bonSignable(bon, signes, enCoursSignature)) return;

    setEnCoursSignature((prev) => ({ ...prev, [bon.id]: true }));
    setMessage(null);

    try {
      const resultat = await signerBonPaiement(bon.id);
      if (signatureAboutie(resultat)) {
        setSignes((prev) => ({ ...prev, [bon.id]: true }));
        onBonSigne(bon);
        setMessage({ type: "succes", texte: t("succesSignature") });
      }
    } catch (err: unknown) {
      const erreur = err instanceof Error ? err.message : String(err);
      setMessage({ type: "erreur", texte: t("erreurSignature", { erreur }) });
    } finally {
      setEnCoursSignature((prev) => ({ ...prev, [bon.id]: false }));
    }
  }

  const restants = bons.filter((bon) => bon.statut !== "SIGNE" && !signes[bon.id]).length;

  return (
    <Carte>
      <div className={CARTE_ENTETE}>
        <div className={CARTE_TITRE}>
          <CurrencyCircleDollar size={18} style={{ color: "var(--color-primary-500, #D4652A)" }} />
          <span>{t("titre")}</span>
        </div>
        <Badge variante="avertissement">{t("compteur", { n: compteur || restants })}</Badge>
      </div>
      <p
        style={{
          fontSize: "12px",
          color: "var(--color-neutral-500, #8A8680)",
          marginBottom: "12px",
        }}
      >
        {t("sousTitre")}
      </p>

      {message && (
        <div style={{ marginBottom: "12px" }}>
          <Alerte type={message.type === "succes" ? "succes" : "erreur"}>{message.texte}</Alerte>
        </div>
      )}

      <div>
        {bons.map((bon) => {
          const estSigne = Boolean(signes[bon.id]) || bon.statut === "SIGNE";
          const enCours = Boolean(enCoursSignature[bon.id]);

          return (
            <div
              key={bon.id}
              className="flex items-center justify-between border-b border-neutral-100 py-2.5 text-[13px] last:border-b-0"
            >
              <div>
                <div className="font-semibold text-neutral-900">{bon.beneficiaire}</div>
                <div className="text-[11px] text-neutral-500">
                  {t("detailLot", { lot: bon.corpsEtat, ref: bon.reference })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="font-bold text-primary-600">{formaterMontant(bon.montant)}</span>
                <Bouton
                  variante={estSigne ? "ghost" : "secondaire"}
                  taille="sm"
                  iconeGauche={estSigne ? <CheckCircle size={14} weight="bold" /> : undefined}
                  disabled={estSigne || enCours}
                  onClick={() => handleSigner(bon)}
                >
                  {enCours ? t("signatureEnCours") : estSigne ? t("signe") : t("actionSigner")}
                </Bouton>
              </div>
            </div>
          );
        })}
      </div>
    </Carte>
  );
}
