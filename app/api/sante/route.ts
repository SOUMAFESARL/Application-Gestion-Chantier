/**
 * Sonde de vie du serveur Node — `GET /api/sante`.
 *
 * Passenger arrête le serveur après 2 à 4 minutes sans requête, et le
 * relancer coûte environ 4 s au premier visiteur (mesuré en production le
 * 25/10/2026). Un service de cron externe appelle cette route chaque minute
 * pour le garder éveillé.
 *
 * Pourquoi pas `/connexion` : la page est prérendue et Varnish la sert depuis
 * son cache sans réveiller Node. Cette route ne doit **jamais** être mise en
 * cache, ni par Next ni par Varnish — sinon la sonde ne prouve plus rien.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { statut: "ok", horodatage: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
