import { Inbox, RotateCw, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Les états d'écran — convention transverse.
 *
 * Tout écran qui charge des données a **quatre** états, pas un :
 * chargement, vide, erreur, données. Les trois premiers sont ici, pour
 * qu'ils se ressemblent partout et que personne n'ait à les réinventer.
 *
 * L'oubli classique est l'état vide : un tableau sans lignes affiche un
 * cadre blanc, et l'utilisateur ne sait pas s'il attend, s'il n'a rien,
 * ou si l'application est cassée.
 */

/** Le cadre commun aux trois etats : centre, aere, jamais aligne a gauche. */
const CADRE = "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center";

/** 42ch : au-dela, l'oeil perd la ligne sur un texte centre. */
const MESSAGE = "max-w-[42ch] text-sm text-neutral-600";

const TITRE = "text-base font-semibold text-neutral-900";

// ---------------------------------------------------------------------------

interface PropsChargement {
  /** Charte §8.3 : au-delà de 2 s, un texte explicite accompagne l'attente. */
  message?: string;
}

export function EtatChargement({ message }: PropsChargement) {
  const t = useTranslations("etats");

  return (
    <div className={CADRE} role="status" aria-live="polite">
      {/* `motion-reduce` fige l'anneau et lui rend sa teinte neutre : une
          rotation perpetuelle est precisement ce que cette preference ecarte. */}
      <span
        className="size-7 animate-spin rounded-full border-[3px] border-neutral-200 border-t-primary-500 [animation-duration:0.7s] motion-reduce:animate-none motion-reduce:border-t-neutral-200"
        aria-hidden="true"
      />
      <p className={MESSAGE}>{message ?? t("chargement")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface PropsVide {
  titre: string;
  /** Ce que l'utilisateur peut faire. Un écran vide sans issue est un cul-de-sac. */
  description?: string;
  action?: ReactNode;
  icone?: ReactNode;
}

export function EtatVide({ titre, description, action, icone }: PropsVide) {
  return (
    <div className={CADRE}>
      <span className="text-neutral-400" aria-hidden="true">
        {icone ?? <Inbox size={40} strokeWidth={1.5} />}
      </span>
      <p className={TITRE}>{titre}</p>
      {description && <p className={MESSAGE}>{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface PropsErreur {
  /**
   * Message destiné à l'utilisateur — celui de l'API.
   * Socle §5.2 : jamais de code HTTP ni de trace technique à l'écran.
   */
  message?: string;
  onReessayer?: () => void;
  /** Repris du `trace_id` de l'API, à communiquer au support. */
  reference?: string | null;
}

export function EtatErreur({ message, onReessayer, reference }: PropsErreur) {
  const t = useTranslations("etats");

  return (
    <div className={CADRE} role="alert">
      <span className="text-erreur" aria-hidden="true">
        <WifiOff size={40} strokeWidth={1.5} />
      </span>
      <p className={TITRE}>{t("erreurTitre")}</p>
      <p className={MESSAGE}>{message ?? t("erreurMessage")}</p>
      {onReessayer && (
        <div className="mt-3">
          <button
            type="button"
            className="inline-flex min-h-12 cursor-pointer appearance-none items-center gap-2 rounded-md border-0 bg-primary-500 px-6 font-semibold text-neutral-0 hover:bg-primary-600"
            onClick={onReessayer}
          >
            <RotateCw size={16} aria-hidden="true" />
            {t("reessayer")}
          </button>
        </div>
      )}
      {reference && (
        <p className="mt-3 text-xs text-neutral-500">
          {t("reference")} <code className="font-mono">{reference}</code>
        </p>
      )}
    </div>
  );
}
