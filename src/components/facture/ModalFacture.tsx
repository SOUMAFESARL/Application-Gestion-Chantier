"use client";

import { X } from "@phosphor-icons/react";
import React, { useEffect } from "react";

import { FactureLegaleOHADA, FactureLegaleOHADAProps } from "./FactureLegaleOHADA";
import styles from "./ModalFacture.module.css";

export interface ModalFactureProps extends FactureLegaleOHADAProps {
  ouvert: boolean;
  onFermer: () => void;
}

export function ModalFacture({ ouvert, onFermer, ...propsFacture }: ModalFactureProps) {
  useEffect(() => {
    if (!ouvert) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`Facture ${propsFacture.facture.numero}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div className={styles.modalConteneur}>
        <button
          type="button"
          onClick={onFermer}
          className={styles.btnFermerHaut}
          title="Fermer (Échap)"
          aria-label="Fermer la facture"
        >
          <X size={18} weight="bold" />
        </button>

        <FactureLegaleOHADA
          {...propsFacture}
          afficherBarreOutils={true}
          surFermer={onFermer}
        />
      </div>
    </div>
  );
}
