"use client";

import { CheckCircle, HourglassHigh, HourglassLow, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Bouton } from "@/components/ui";
import type { Session } from "@/lib/auth";

import styles from "./ModalSession.module.css";

interface Props {
  session: Session;
  onProlonger: () => Promise<boolean>;
  onDeconnecter: () => Promise<void>;
  onReconnecter: () => void;
}

export function ModalSession({
  session,
  onProlonger,
  onDeconnecter,
  onReconnecter,
}: Props) {
  const t = useTranslations("session");
  const [enCoursProlongation, setEnCoursProlongation] = useState(false);
  const [afficherToast, setAfficherToast] = useState(false);

  const { etat, secondesRestantes, prolongeable } = session;

  const visible = etat !== "active";

  const gererProlongation = useCallback(async () => {
    setEnCoursProlongation(true);
    try {
      const succes = await onProlonger();
      if (succes) {
        setAfficherToast(true);
      }
    } finally {
      setEnCoursProlongation(false);
    }
  }, [onProlonger]);

  // Masquer le toast après 3 secondes
  useEffect(() => {
    if (!afficherToast) return;
    const timer = window.setTimeout(() => {
      setAfficherToast(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [afficherToast]);

  // Formatage du temps restant
  const tempsFormate =
    secondesRestantes >= 60
      ? t("minutes", { compte: Math.ceil(secondesRestantes / 60) })
      : t("secondes", { compte: Math.max(1, secondesRestantes) });

  // Calcul du pourcentage pour la jauge
  // 30 min max = 1800 s pour l'inactivité ; 15 min = 900 s pour l'avertissement de fin
  const maxSecondes = prolongeable ? 1800 : 900;
  const pourcentage = Math.min(100, Math.max(0, (secondesRestantes / maxSecondes) * 100));

  const estUrgent = etat === "urgence";
  const estExpire = etat === "expiree" || etat === "fin_de_session";

  return (
    <>
      {/* Toast de prolongation réussie (M5 état 4) */}
      <div
        className={`${styles.toast} ${afficherToast ? styles.toastShow : ""}`}
        role="status"
        aria-live="polite"
      >
        <CheckCircle size={18} weight="bold" style={{ display: "inline", verticalAlign: "sub", marginRight: 8 }} />
        {t("toastProlonge")}
      </div>

      {/* Modale d'avertissement / expiration */}
      <div
        className={`${styles.backdrop} ${visible ? styles.active : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-modale-session"
      >
        <div className={styles.modal}>
          {/* Icône selon l'état */}
          <div
            className={`${styles.icon} ${
              estExpire
                ? styles.iconErr
                : estUrgent
                ? styles.iconWarn
                : styles.iconInfo
            }`}
          >
            {estExpire ? (
              <LockSimple size={28} weight="bold" />
            ) : estUrgent ? (
              <HourglassHigh size={28} weight="regular" />
            ) : (
              <HourglassLow size={28} weight="regular" />
            )}
          </div>

          {/* Titre */}
          <h2 id="titre-modale-session" className={styles.titre}>
            {etat === "avertissement" && t("avertissementTitre")}
            {etat === "urgence" && t("urgenceTitre")}
            {etat === "expiree" && t("expireeTitre")}
            {etat === "fin_proche" && t("finProcheTitre")}
            {etat === "fin_de_session" && t("finDeSessionTitre")}
          </h2>

          {/* Compte à rebours et jauge si la session n'est pas encore finie */}
          {!estExpire && (
            <>
              <div className={styles.timerText}>
                {prolongeable
                  ? t("compteRebours", { temps: "" })
                  : t("compteReboursPlafond", { temps: "" })}
                <span
                  className={`${styles.count} ${
                    estUrgent ? styles.countUrgent : ""
                  }`}
                >
                  {tempsFormate}
                </span>
              </div>
              <div className={styles.timerBar}>
                <div
                  className={`${styles.timerFill} ${
                    estUrgent ? styles.timerFillUrgent : ""
                  }`}
                  style={{ width: `${pourcentage}%` }}
                />
              </div>
            </>
          )}

          {/* Corps de texte explicatif */}
          <p className={styles.texte}>
            {etat === "avertissement" &&
              t.rich("avertissementTexte", {
                fort: (chunks) => <strong>{chunks}</strong>,
              })}
            {etat === "urgence" &&
              t.rich("urgenceTexte", {
                fort: (chunks) => <strong>{chunks}</strong>,
              })}
            {etat === "expiree" &&
              t.rich("expireeTexte", {
                br: () => <br />,
                fort: (chunks) => <strong>{chunks}</strong>,
              })}
            {etat === "fin_proche" &&
              t("finProcheTexte", { temps: tempsFormate })}
            {etat === "fin_de_session" &&
              t.rich("finDeSessionTexte", {
                fort: (chunks) => <strong>{chunks}</strong>,
              })}
          </p>

          {/* Actions */}
          <div className={styles.actions}>
            {prolongeable && !estExpire ? (
              <>
                <Bouton
                  pleineLargeur
                  enCours={enCoursProlongation}
                  onClick={gererProlongation}
                >
                  {t("resterConnecte")}
                </Bouton>
                <Bouton
                  variante="secondaire"
                  pleineLargeur
                  onClick={onDeconnecter}
                >
                  {t("seDeconnecter")}
                </Bouton>
              </>
            ) : (
              <Bouton pleineLargeur onClick={onReconnecter}>
                {t("seReconnecter")}
              </Bouton>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
