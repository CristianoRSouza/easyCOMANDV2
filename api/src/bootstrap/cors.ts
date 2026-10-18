import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * CORS da API — FECHADO por padrão.
 *
 * Quem chama esta API é o servidor do Next (BFF), servidor a servidor: sem `Origin`, sem CORS.
 * Navegador falando direto com a API é justamente o que a arquitetura proíbe.
 *
 * Regra que vale sempre: NUNCA refletir qualquer origem COM credenciais. Allowlist explícita →
 * credenciais só para ela; `*` → sem credenciais.
 *
 *   vazio → fechado (`origin: false`: nenhum header CORS é emitido)
 *   `*`   → qualquer origem, SEM credenciais
 *   lista → só a lista, com credenciais
 */
export function resolveCors(corsOrigin: string): { options: CorsOptions; wildcard: boolean } {
  const origins = corsOrigin
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    return { wildcard: false, options: { origin: false } };
  }
  const wildcard = origins.includes('*');
  return {
    wildcard,
    options: { origin: wildcard ? true : origins, credentials: !wildcard },
  };
}
