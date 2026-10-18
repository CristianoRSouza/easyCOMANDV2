import { NextResponse, type NextRequest } from "next/server";

/**
 * Cabeçalhos de segurança de toda resposta, com CSP por nonce (um nonce novo a cada requisição).
 *
 * O Next lê a CSP do cabeçalho da REQUISIÇÃO e aplica o nonce nos scripts que ele mesmo injeta
 * (hidratação, chunks) — por isso a CSP vai nos dois sentidos, e as páginas são renderizadas
 * dinamicamente (`dynamic = "force-dynamic"` no layout raiz).
 *
 * O que o EasyControl precisa, conferido nas telas atuais (`easyCONTROL/src`):
 * - Fontes: servidas pelo próprio Next (`src/app/fonts.css`) → `font-src 'self'`. Hoje elas vêm do
 *   Google Fonts por `<link>`; aqui não há CSS nem fonte de fora.
 * - O navegador fala com o próprio Next (`/api/session/*`, `/api/v1/*`) e com a AwesomeAPI (cotação
 *   USD→BRL dos painéis de IA, pública e sem credencial) → `connect-src 'self' economia.awesomeapi`.
 *   Hoje ele falava direto também com o Supabase e com a EasyERP-API; agora quem fala é a API.
 * - Sem `<iframe>` nem script de terceiros em nenhuma tela → `frame-src 'none'`.
 * - Estilos inline (atributo `style` do React, Radix, sonner, recharts) → `style-src 'unsafe-inline'`.
 * - Imagens: `data:`/`blob:` (recharts) e `https:`.
 */

export const NONCE_HEADER = "x-nonce";

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // `strict-dynamic`: scripts carregados por um script com nonce também valem (chunks do Next).
    // `unsafe-eval` só em desenvolvimento (o React usa eval para a pilha de chamadas no dev).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https:",
    // A cotação USD→BRL ao vivo dos painéis de IA vem da AwesomeAPI, direto do navegador (como hoje).
    `connect-src 'self' https://economia.awesomeapi.com.br${isDev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Cabeçalhos fixos (sem nonce). */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Não redireciona para o login: como hoje, a proteção das telas é do layout administrativo (no
 * cliente, `RequireSystemAdmin`) e a autorização de verdade é da API, em toda chamada.
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  if (request.nextUrl.protocol === "https:") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: [
    {
      // Arquivos estáticos com hash não precisam de nonce; o resto (páginas e rotas de API) recebe.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
