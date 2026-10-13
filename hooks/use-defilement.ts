import { useSyncExternalStore } from "react"

/**
 * Où en est le défilement de la page — pour poser une ombre sous une barre
 * collée en haut dès qu'un contenu passe dessous, et au-dessus d'une barre
 * collée en bas tant qu'il en reste à lire.
 *
 * La hauteur de la page change aussi sans défilement (un volet qui se
 * déplie) : d'où l'observation de la taille du `body`, en plus du `scroll`.
 * `useSyncExternalStore`, pour la même raison que `use-mobile.ts`.
 */
function abonnement(rappel: () => void) {
  window.addEventListener("scroll", rappel, { passive: true })
  window.addEventListener("resize", rappel)
  const observateur = new ResizeObserver(rappel)
  observateur.observe(document.body)
  return () => {
    window.removeEventListener("scroll", rappel)
    window.removeEventListener("resize", rappel)
    observateur.disconnect()
  }
}

/** La page a défilé : du contenu passe sous les barres collées en haut. */
export function useDefile() {
  return useSyncExternalStore(abonnement, () => window.scrollY > 0, () => false)
}

/** Il reste du contenu sous la ligne de flottaison : il passe sous les barres collées en bas. */
export function useResteEnBas() {
  return useSyncExternalStore(
    abonnement,
    () =>
      window.scrollY + window.innerHeight <
      document.documentElement.scrollHeight - 1,
    () => false
  )
}
