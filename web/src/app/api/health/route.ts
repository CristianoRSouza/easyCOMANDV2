/**
 * Liveness do servidor Next — usado pelo HEALTHCHECK do contêiner.
 *
 * Não consulta a API de propósito: se a API cair, este contêiner continua saudável (ele ainda
 * serve as telas e mostra o erro); amarrar os dois faria o orquestrador reiniciar o web em ciclo
 * por um problema que não é dele.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
