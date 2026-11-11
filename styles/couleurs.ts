/**
 * Les couleurs que le CSS ne peut pas fournir.
 *
 * **La règle reste celle du guide frontend §3 : `tokens.css` déclare les
 * jetons, et rien d'autre ne les déclare.** Ce fichier n'est pas une seconde
 * palette — il n'existe que pour les rares valeurs qu'un `<meta>` doit porter
 * en clair, là où `var(--color-primary-500)` n'a aucun sens.
 *
 * Aujourd'hui il n'y en a qu'une : `themeColor`, qui teinte la barre du
 * navigateur sur mobile.
 *
 * *Pourquoi elle est ici plutôt qu'en dur dans `layout.tsx` : elle y était, et
 * personne ne pouvait le voir. Le `lint` ne lit que le JSX, la charte n'est pas
 * mesurée, et une couleur recopiée dans un fichier que l'on n'ouvre jamais ne
 * diverge pas bruyamment — elle diverge silencieusement.*
 */

/**
 * L'orange, la primaire **par défaut** — jumelle de `--color-primary-500`
 * dans `tokens.css`. Les deux se modifient ensemble ; c'est la seule paire du
 * projet dans ce cas, et c'est pour cela qu'elle est commentée des deux côtés.
 *
 * **Ce que ce fichier ne corrige pas.** Chaque entreprise cliente choisit sa
 * teinte parmi six (charte §10), injectée à l'exécution. Un client qui n'a pas
 * pris cette teinte par défaut obtient donc encore la mauvaise couleur de
 * barre de navigateur. La corriger demande une source côté serveur — la
 * personnalisation de l'entreprise — qui n'existe pas encore : le jour où elle
 * existera, c'est `generateViewport()` qui la lira, et cette constante
 * redeviendra ce que son nom dit, un simple défaut.
 */
export const COULEUR_PRIMAIRE_DEFAUT = "#F97316";

const PALIERS_PRIMAIRE = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;

export function hexVersRgb(hex: string): { r: number; g: number; b: number } | null {
  const propre = hex.replace(/^#/, "").trim();
  if (propre.length === 3) {
    return {
      r: Number.parseInt(propre[0] + propre[0], 16),
      g: Number.parseInt(propre[1] + propre[1], 16),
      b: Number.parseInt(propre[2] + propre[2], 16),
    };
  }
  if (propre.length === 6) {
    return {
      r: Number.parseInt(propre.slice(0, 2), 16),
      g: Number.parseInt(propre.slice(2, 4), 16),
      b: Number.parseInt(propre.slice(4, 6), 16),
    };
  }
  return null;
}

function rgbVersHex(r: number, g: number, b: number): string {
  const borner = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const oct = (v: number) => borner(v).toString(16).padStart(2, "0");
  return `#${oct(r)}${oct(g)}${oct(b)}`.toUpperCase();
}

function rgbVersHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / delta + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslVersHex(h: number, s: number, l: number): string {
  const hNorm = ((h % 360) + 360) % 360 / 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  if (sNorm === 0) {
    const v = Math.round(lNorm * 255);
    return rgbVersHex(v, v, v);
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1 / 2) return q;
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
    return p;
  };

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  return rgbVersHex(
    hue2rgb(p, q, hNorm + 1 / 3) * 255,
    hue2rgb(p, q, hNorm) * 255,
    hue2rgb(p, q, hNorm - 1 / 3) * 255,
  );
}

/**
 * Calcule l'échelle 50→900 à partir de la couleur dominante du logo (charte §10.3),
 * en bornant la luminosité du palier 500 pour garantir la lisibilité du texte blanc
 * sur les boutons et l'élément actif de la barre latérale.
 */
export function genererNuancesPrimaire(hexBase: string): Record<(typeof PALIERS_PRIMAIRE)[number], string> {
  const rgb = hexVersRgb(hexBase) ?? hexVersRgb(COULEUR_PRIMAIRE_DEFAUT)!;
  const { h, s, l } = rgbVersHsl(rgb.r, rgb.g, rgb.b);
  const l500 = Math.max(32, Math.min(l, 48));

  return {
    "50": hslVersHex(h, Math.min(s, 55), 97),
    "100": hslVersHex(h, Math.max(s - 20, 22), 92),
    "200": hslVersHex(h, Math.max(s - 12, 26), 83),
    "300": hslVersHex(h, Math.max(s - 6, 30), 71),
    "400": hslVersHex(h, s, Math.min(l500 + 12, 60)),
    "500": hslVersHex(h, s, l500),
    "600": hslVersHex(h, s, Math.max(l500 - 7, 25)),
    "700": hslVersHex(h, s, Math.max(l500 - 14, 18)),
    "800": hslVersHex(h, s, Math.max(l500 - 21, 12)),
    "900": hslVersHex(h, s, Math.max(l500 - 28, 8)),
  };
}

/**
 * Injecte l'échelle `--color-primary-50` → `--color-primary-900` sur `:root`
 * à partir de la couleur du logo de l'entreprise, ou rétablit les valeurs de
 * `styles/tokens.css` lorsque `hex` est vide ou absent.
 */
export function appliquerCouleurPrimaire(hex?: string | null): void {
  if (typeof document === "undefined") return;
  const racine = document.documentElement;
  const propre = hex?.trim() ?? "";

  if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(propre)) {
    for (const palier of PALIERS_PRIMAIRE) {
      racine.style.removeProperty(`--color-primary-${palier}`);
    }
    racine.style.removeProperty("--shadow-focus");
    return;
  }

  const nuances = genererNuancesPrimaire(propre);
  for (const palier of PALIERS_PRIMAIRE) {
    racine.style.setProperty(`--color-primary-${palier}`, nuances[palier]);
  }
  const rgb500 = hexVersRgb(nuances["500"]);
  if (rgb500) {
    racine.style.setProperty(
      "--shadow-focus",
      `0 0 0 3px rgb(${rgb500.r} ${rgb500.g} ${rgb500.b} / 0.25)`,
    );
  }
}

/**
 * Extrait la couleur dominante d'un fichier logo côté navigateur pour
 * prévisualiser instantanément le thème avant même l'enregistrement serveur.
 */
export function extraireCouleurDominante(fichier: File): Promise<string> {
  return new Promise((resoudre) => {
    if (typeof window === "undefined") {
      resoudre(COULEUR_PRIMAIRE_DEFAUT);
      return;
    }

    const lecteur = new FileReader();
    lecteur.onload = (e) => {
      const url = e.target?.result as string;
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        try {
          const taille = 64;
          const canevas = document.createElement("canvas");
          canevas.width = taille;
          canevas.height = taille;
          const ctx = canevas.getContext("2d");
          if (!ctx) {
            resoudre(COULEUR_PRIMAIRE_DEFAUT);
            return;
          }

          ctx.drawImage(img, 0, 0, taille, taille);
          const donnees = ctx.getImageData(0, 0, taille, taille).data;

          let totalR = 0;
          let totalG = 0;
          let totalB = 0;
          let poidsTotal = 0;
          let meilleurScore = -1;
          let meilleureCouleur = COULEUR_PRIMAIRE_DEFAUT;

          for (let i = 0; i < donnees.length; i += 4) {
            const r = donnees[i];
            const g = donnees[i + 1];
            const b = donnees[i + 2];
            const a = donnees[i + 3];

            if (a < 128) continue;
            if (r > 240 && g > 240 && b > 240) continue;
            if (r < 25 && g < 25 && b < 25) continue;

            const { s, l } = rgbVersHsl(r, g, b);
            const score = (s / 100) * (1 - Math.abs(l - 50) / 50);

            if (score > meilleurScore) {
              meilleurScore = score;
              meilleureCouleur = rgbVersHex(r, g, b);
            }

            const poids = Math.max(1, s);
            totalR += r * poids;
            totalG += g * poids;
            totalB += b * poids;
            poidsTotal += poids;
          }

          if (meilleurScore > 0.15) {
            resoudre(meilleureCouleur);
          } else if (poidsTotal > 0) {
            resoudre(rgbVersHex(totalR / poidsTotal, totalG / poidsTotal, totalB / poidsTotal));
          } else {
            resoudre(COULEUR_PRIMAIRE_DEFAUT);
          }
        } catch {
          resoudre(COULEUR_PRIMAIRE_DEFAUT);
        }
      };

      img.onerror = () => resoudre(COULEUR_PRIMAIRE_DEFAUT);
      img.src = url;
    };

    lecteur.onerror = () => resoudre(COULEUR_PRIMAIRE_DEFAUT);
    lecteur.readAsDataURL(fichier);
  });
}
