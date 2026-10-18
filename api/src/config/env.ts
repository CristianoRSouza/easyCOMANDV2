import { z } from 'zod';

/**
 * Validação de ambiente (fail-fast no boot): toda configuração de COMPORTAMENTO da API passa
 * por aqui, validada, em vez de `process.env` espalhado pelos services.
 *
 * ── De onde saiu esta lista ─────────────────────────────────────────────────────
 * São as variáveis que o EasyControl atual (`Desktop\easyCONTROL`) lê no SERVIDOR — levantadas
 * em `src/**` (`process.env.*`) e `deploy/app.env.example` —, com os MESMOS nomes. O cofre
 * (Infisical, projetos `easycontrol` e `easycontrol-homolog`) é o mesmo; trocar nome aqui
 * obrigaria a recadastrar segredo.
 *
 * Uma variável MUDOU de lado: `VITE_PIX_WEBHOOK_API_URL` era embutida no bundle do navegador,
 * porque era o navegador quem chamava a EasyERP-API. Agora quem chama é esta API (o navegador
 * não tem mais o token), então ela vira `PIX_WEBHOOK_API_URL`, lida em runtime.
 *
 * Somam-se as de infraestrutura que só existem porque agora há um processo NestJS próprio
 * (porta, prefixo, CORS, rate-limit, teto de corpo, Swagger).
 *
 * Exceção conhecida: `easysoft-logger.ts` lê `LOG_LEVEL`/`LOG_FORMAT` direto, porque o logger é
 * construído ANTES do `loadEnv()` (uma falha de validação já sai no formato certo).
 */
const booleano = (padrao: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(padrao)
    .transform((v) => v === 'true');

const schema = z.object({
  // ── Processo ────────────────────────────────────────────────────────────────
  NODE_ENV: z.string().default('development'),
  // 3030: a 3000 é do Next em dev, a 3010 da API do EasyFood e a 3020 da do EasyBilling —
  // as quatro sobem lado a lado na máquina de quem migra.
  PORT: z.coerce.number().int().positive().default(3030),
  API_PREFIX: z.string().default('api/v1'),

  // CORS FECHADO por padrão: quem chama esta API é o servidor do Next (servidor a servidor, sem
  // `Origin`). Lista separada por vírgula; `*` libera sem credenciais (ver bootstrap/cors.ts).
  CORS_ORIGIN: z.string().default(''),

  // Teto do corpo JSON/urlencoded; acima disso, 413 com mensagem clara.
  HTTP_BODY_LIMIT: z.string().default('1mb'),

  // Swagger UI + OpenAPI JSON em /<API_PREFIX>/docs.
  SWAGGER_ENABLED: booleano('true'),

  // Rate-limit contado por SESSÃO (hash do Bearer); anônimo cai no IP.
  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(300),

  // ── Supabase (OBRIGATÓRIAS — as três estão em "OBRIGATÓRIAS" do deploy/app.env.example) ──
  SUPABASE_URL: z.string().url(),
  // Chave pública: cliente do USUÁRIO (JWT dele → RLS) e verificação do JWT (`getClaims`).
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  // service_role: IGNORA a RLS. Só pelo `ServiceRole` (db/service-role.ts).
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),

  // ── Stripe (OPCIONAIS — sem elas, só a sincronização de preços falha) ─────────
  STRIPE_SECRET_KEY_TEST: z.string().default(''),
  STRIPE_SECRET_KEY_LIVE: z.string().default(''),

  // ── EasyERP-API (Webhooks PIX) ───────────────────────────────────────────────
  // Base da API do ambiente. Vazia = a de produção, como o `client.ts` de hoje.
  PIX_WEBHOOK_API_URL: z
    .string()
    .default('')
    .transform((v) => v.trim() || 'https://webhook-easyerp.easysoftcloud.com.br/api/v1'),
});

export type Env = z.infer<typeof schema>;

/** Token de injeção do Nest para o objeto de ambiente já validado. */
export const ENV = Symbol('ENV');

/**
 * Segredos que o schema aceita vazios, mas cuja ausência desliga uma funcionalidade em
 * silêncio. Devolve os NOMES dos que faltam, para o arranque avisar — NUNCA valores.
 */
export function segredosAusentes(env: Env): string[] {
  const faltando: string[] = [];
  if (!env.STRIPE_SECRET_KEY_LIVE) {
    faltando.push('STRIPE_SECRET_KEY_LIVE (sincronização de preços no modo live)');
  }
  if (!env.STRIPE_SECRET_KEY_TEST) {
    faltando.push('STRIPE_SECRET_KEY_TEST (sincronização de preços no modo sandbox)');
  }
  return faltando;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    // Só o NOME da variável e o motivo — o zod não ecoa o valor recebido nestas mensagens.
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }
  return parsed.data;
}
