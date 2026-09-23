/**
 * L'équipe de démonstration, en attendant « GET /collaborateurs/ ».
 *
 * Même rôle que `projets/simulationProjets.ts` : l'écran se relit et se
 * pagine sans API. Rien n'en sort quand `NEXT_PUBLIC_API_SIMULE` vaut `0`.
 */

import type { Collaborateur } from "./types";

export const COLLABORATEURS_SIMULES: Collaborateur[] = [
  { id: "sim-c01", nomComplet: "Yves Kouassi", email: "y.kouassi@demo.ci", telephone: "+2250701020304", role: "DP", statut: "ACTIF", creeLe: "2026-01-12" },
  { id: "sim-c02", nomComplet: "Aminata Koné", email: "a.kone@demo.ci", telephone: "+2250505060708", role: "CT", statut: "ACTIF", creeLe: "2026-01-19" },
  { id: "sim-c03", nomComplet: "Serge Bamba", email: "s.bamba@demo.ci", telephone: "+2250102030405", role: "CC", statut: "ACTIF", creeLe: "2026-02-03" },
  { id: "sim-c04", nomComplet: "Fatou Traoré", email: "f.traore@demo.ci", telephone: "+2250708091011", role: "RF", statut: "ACTIF", creeLe: "2026-02-10" },
  { id: "sim-c05", nomComplet: "Jean-Marc Yao", email: "jm.yao@demo.ci", telephone: "+2250506070809", role: "IT", statut: "INVITE", creeLe: "2026-09-18" },
  { id: "sim-c06", nomComplet: "Mariam Ouattara", email: "m.ouattara@demo.ci", telephone: "+2250709080706", role: "RA", statut: "ACTIF", creeLe: "2026-03-02" },
  { id: "sim-c07", nomComplet: "Koffi N'Guessan", email: "k.nguessan@demo.ci", telephone: "+2250101010202", role: "MAG", statut: "ACTIF", creeLe: "2026-03-15" },
  { id: "sim-c08", nomComplet: "Awa Diabaté", email: "a.diabate@demo.ci", telephone: "+2250707070808", role: "RH", statut: "INVITE", creeLe: "2026-09-20" },
  { id: "sim-c09", nomComplet: "Ibrahim Cissé", email: "i.cisse@demo.ci", telephone: "+2250505050606", role: "CT", statut: "EXPIREE", creeLe: "2026-06-01" },
  { id: "sim-c10", nomComplet: "Christelle Aka", email: "c.aka@demo.ci", telephone: "+2250102020303", role: "CC", statut: "ACTIF", creeLe: "2026-04-07" },
  { id: "sim-c11", nomComplet: "Bâtir Plus SARL", email: "contact@batirplus.ci", telephone: "+2252720304050", role: "ST", statut: "ACTIF", creeLe: "2026-04-22" },
  { id: "sim-c12", nomComplet: "Moussa Sangaré", email: "m.sangare@demo.ci", telephone: "+2250709091010", role: "IT", statut: "ACTIF", creeLe: "2026-05-05" },
  { id: "sim-c13", nomComplet: "Nadège Brou", email: "n.brou@demo.ci", telephone: "+2250506060707", role: "MOA", statut: "INVITE", creeLe: "2026-09-21" },
  { id: "sim-c14", nomComplet: "Lassina Coulibaly", email: "l.coulibaly@demo.ci", telephone: "+2250103030404", role: "VI", statut: "EXPIREE", creeLe: "2026-05-28" },
  { id: "sim-c15", nomComplet: "Estelle Gnagne", email: "e.gnagne@demo.ci", telephone: "+2250708080909", role: "CT", statut: "ACTIF", creeLe: "2026-06-16" },
];
