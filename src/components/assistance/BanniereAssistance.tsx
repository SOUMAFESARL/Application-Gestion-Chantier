"use client";

import { Clock, LockKey, ShieldCheck, SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { quitterAssistance } from "@/features/super-admin/api";
import { SessionAssistanceLocale } from "@/features/super-admin/types";
import {
  desactiverSessionAssistance,
  EVENEMENT_ASSISTANCE_CHANGEE,
  lireSessionAssistance,
  tempsRestantAssistanceSecondes,
} from "@/lib/auth/assistance";

import styles from "./BanniereAssistance.module.css";

export function BanniereAssistance() {
  const t = useTranslations("superAdmin");
  const router = useRouter();
  const [session, setSession] = useState<SessionAssistanceLocale | null>(() => {
    return typeof window !== "undefined" ? lireSessionAssistance() : null;
  });
  const [secondesRestantes, setSecondesRestantes] = useState<number>(() => {
    return typeof window !== "undefined" ? tempsRestantAssistanceSecondes() : 0;
  });
  const [enCoursFermeture, setEnCoursFermeture] = useState<boolean>(false);

  useEffect(() => {
    const gererChangement = () => {
      setSession(lireSessionAssistance());
      setSecondesRestantes(tempsRestantAssistanceSecondes());
    };

    window.addEventListener(EVENEMENT_ASSISTANCE_CHANGEE, gererChangement);
    return () => {
      window.removeEventListener(EVENEMENT_ASSISTANCE_CHANGEE, gererChangement);
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    const horloge = window.setInterval(() => {
      const rest = tempsRestantAssistanceSecondes();
      setSecondesRestantes(rest);
      if (rest <= 0) {
        desactiverSessionAssistance();
        setSession(null);
        router.push("/super-admin");
      }
    }, 1000);

    return () => window.clearInterval(horloge);
  }, [session, router]);

  const gererQuitterAssistance = async () => {
    setEnCoursFermeture(true);
    try {
      if (session?.entrepriseId) {
        await quitterAssistance(session.entrepriseId);
      }
    } finally {
      desactiverSessionAssistance();
      setSession(null);
      setEnCoursFermeture(false);
      router.push("/super-admin");
    }
  };

  if (!session || !session.actif) {
    return null;
  }

  const minutes = Math.floor(secondesRestantes / 60);
  const secondes = secondesRestantes % 60;
  const tempsAffiche = `${String(minutes).padStart(2, "0")}:${String(secondes).padStart(2, "0")}`;

  return (
    <div className={styles.banniere} role="status" aria-live="polite">
      <div className={styles.zoneGauche}>
        <div className={styles.badgeAlerte}>
          <span className={styles.pointActif} />
          <ShieldCheck size={16} weight="bold" />
          <span>{t("banniereTitre")}</span>
        </div>

        <div className={styles.infoTexte}>
          <span>
            {t("banniereConsultation", {
              entreprise: session.entrepriseNom,
              utilisateur: `${session.utilisateurNom} (${session.utilisateurEmail})`,
            })}
          </span>
          <span className={styles.separateur} aria-hidden="true" />
          <span className={styles.modeLectureSeule}>
            <LockKey size={12} weight="fill" />
            <span>{t("banniereLectureSeule")}</span>
          </span>
        </div>
      </div>

      <div className={styles.zoneDroite}>
        <div className={styles.compteurTimer} title={t("banniereExpire", { temps: tempsAffiche })}>
          <Clock size={16} weight="bold" />
          <span>{tempsAffiche}</span>
        </div>

        <button
          type="button"
          className={styles.btnQuitter}
          onClick={gererQuitterAssistance}
          disabled={enCoursFermeture}
        >
          <SignOut size={16} weight="bold" />
          <span>{enCoursFermeture ? t("banniereQuitterEnCours") : t("banniereQuitter")}</span>
        </button>
      </div>
    </div>
  );
}
