import { useSyncExternalStore } from "react"

/**
 * Hook `use-mobile` de shadcn, posé par `npx shadcn@latest add sidebar`.
 *
 * Le seuil (768px) est celui déjà utilisé par l'ancienne coquille
 * (`layout.module.css`, règle 2 : sidebar tablette entre 768 et 1024px) —
 * conservé pour que la bascule desktop/mobile de la nouvelle sidebar tombe
 * au même endroit que celle qu'elle remplace.
 *
 * `useSyncExternalStore` plutôt qu'un `useState` + `useEffect` : la seconde
 * forme appelle `setState` de façon synchrone dans l'effet, ce que la règle
 * `react-hooks/set-state-in-effect` refuse — même raison que la bascule de
 * session (`lib/auth/session.ts`).
 */
const MOBILE_BREAKPOINT = 768

function abonnement(rappel: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", rappel)
  return () => mql.removeEventListener("change", rappel)
}

function instantane() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  return useSyncExternalStore(abonnement, instantane, () => false)
}
