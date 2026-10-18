import "server-only";

/**
 * Lê o `exp` (segundos) do JWT SEM validar a assinatura — serve só para decidir QUANDO renovar.
 * Quem valida o token é a API, em toda chamada. `null` para token que não é JWT legível.
 */
export function readJwtExp(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof json.exp === "number" && Number.isFinite(json.exp) ? json.exp : null;
  } catch {
    return null;
  }
}
