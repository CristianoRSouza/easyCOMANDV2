import "server-only";
import { z } from "zod";

/**
 * Configuração lida SÓ no servidor do Next. Nada daqui vai ao navegador: nenhuma variável usa o
 * prefixo `NEXT_PUBLIC_`, e o ESLint proíbe importar `@/server/*` em `shared`, `modules` e
 * componentes de `app`.
 *
 * Segredos (service role do Supabase, Stripe) NÃO entram aqui — vivem só na API. E, ao contrário
 * do EasyControl de hoje, nem a URL/publishable key do Supabase entram no bundle: o navegador só
 * fala com este Next.
 */
export interface ServerConfig {
  /** Base da API NestJS, sem barra final. As rotas ficam em `${apiUrl}/api/v1`. */
  apiUrl: string;
  /** Atributo `Secure` nos cookies de sessão (obrigatório em HTTPS). */
  secureCookies: boolean;
}

export const DEFAULT_API_URL = "http://127.0.0.1:3030";

const schema = z.object({
  EASYCONTROL_API_URL: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().url().safeParse(v).success, {
      message: "EASYCONTROL_API_URL deve ser uma URL (ex.: http://127.0.0.1:3030).",
    }),
  SESSION_COOKIE_SECURE: z
    .enum(["true", "false"], {
      errorMap: () => ({ message: 'SESSION_COOKIE_SECURE deve ser "true" ou "false".' }),
    })
    .optional(),
  NODE_ENV: z.string().optional(),
});

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export function readServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Configuração inválida do servidor — ${problems.join("; ")}`);
  }
  const data = parsed.data;
  return {
    apiUrl: withoutTrailingSlash(data.EASYCONTROL_API_URL || DEFAULT_API_URL),
    // Em HTTP puro (dev local) o navegador descarta cookie `Secure` em silêncio.
    secureCookies: data.SESSION_COOKIE_SECURE
      ? data.SESSION_COOKIE_SECURE === "true"
      : data.NODE_ENV === "production",
  };
}

let cached: ServerConfig | null = null;

export function getServerConfig(): ServerConfig {
  cached ??= readServerConfig();
  return cached;
}
