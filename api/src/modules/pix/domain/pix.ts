/**
 * Tipos e regras puras do PIXnoPDV — `easyCONTROL/src/lib/pix-webhooks/*`.
 */

export type PixEnvironment = 'homologacao' | 'producao';
export type PixType = 'recebimento' | 'cobranca' | 'deposito' | 'devolucao' | 'retirada';

/** URL padrão da API do PIXnoPDV por ambiente (quando o cadastro não informa outra). */
export const PIX_DEFAULT_API_BASE_URL: Record<PixEnvironment, string> = {
  producao: 'https://pixnopdv.com.br/api/v1',
  homologacao: 'https://pixnopdv.com.br/api-h/v1',
};

// ── credenciais ────────────────────────────────────────────────────────────

export interface PixCredentialStatus {
  id: string | null;
  company_id: string;
  store_id: string;
  environment: PixEnvironment;
  api_base_url: string | null;
  basic_user: string | null;
  has_basic_token: boolean;
  has_secret_key: boolean;
  basic_token_masked: string | null;
  secret_key_masked: string | null;
  insecure_tls: boolean;
  enabled: boolean;
  updated_at: string | null;
}

export type CredencialLinha = {
  id: string;
  company_id: string;
  store_id: string;
  environment: PixEnvironment;
  api_base_url: string | null;
  basic_user: string | null;
  basic_token: string | null;
  secret_key: string | null;
  insecure_tls: boolean;
  enabled: boolean;
  updated_at: string | null;
};

/** Máscara: nunca devolver o segredo por extenso — só os 4 últimos caracteres. */
export function mascarar(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return `••••${valor.slice(-4)}`;
}

export function paraStatus(r: CredencialLinha): PixCredentialStatus {
  return {
    id: r.id,
    company_id: r.company_id,
    store_id: r.store_id,
    environment: r.environment,
    api_base_url: r.api_base_url,
    basic_user: r.basic_user,
    has_basic_token: Boolean(r.basic_token),
    has_secret_key: Boolean(r.secret_key),
    basic_token_masked: mascarar(r.basic_token),
    secret_key_masked: mascarar(r.secret_key),
    insecure_tls: r.insecure_tls,
    enabled: r.enabled,
    updated_at: r.updated_at,
  };
}

export type SalvarCredencial = {
  store_id: string;
  company_id: string;
  environment: PixEnvironment;
  api_base_url?: string;
  basic_user?: string;
  basic_token?: string;
  secret_key?: string;
  insecure_tls?: boolean;
  enabled?: boolean;
};

/**
 * O `patch` do upsert, com as regras de hoje:
 *   • URL vazia → a padrão do ambiente;
 *   • `basic_user` enviado vazio → `null` (apaga); ausente → não mexe;
 *   • token/segredo só entram se vierem PREENCHIDOS — vazio não apaga o que está salvo (a tela
 *     manda vazio quando o campo mascarado não foi tocado);
 *   • `insecure_tls`/`enabled` só se vierem.
 */
export function montarPatch(d: SalvarCredencial, agora: Date): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    company_id: d.company_id,
    store_id: d.store_id,
    environment: d.environment,
    updated_at: agora.toISOString(),
    api_base_url: d.api_base_url?.trim() || PIX_DEFAULT_API_BASE_URL[d.environment],
  };
  if (d.basic_user !== undefined) patch.basic_user = d.basic_user || null;
  if (d.basic_token) patch.basic_token = d.basic_token;
  if (d.secret_key) patch.secret_key = d.secret_key;
  if (d.insecure_tls !== undefined) patch.insecure_tls = d.insecure_tls;
  if (d.enabled !== undefined) patch.enabled = d.enabled;
  return patch;
}

// ── eventos ────────────────────────────────────────────────────────────────

export interface PixEventRow {
  id: string;
  endpoint_id: string | null;
  store_id: string | null;
  pix_type: string;
  environment: string;
  status: string | null;
  outcome: string | null;
  tx_id: string | null;
  e2e_id: string | null;
  valor: number | null;
  received_at: string;
  processed_at: string | null;
  last_error: string | null;
}

export interface PixEventSummary {
  endpoint_id: string;
  total: number;
  last_received_at: string | null;
  last_status: string | null;
  last_outcome: string | null;
}

export interface PixStoreEventSummary {
  store_id: string;
  environment: string;
  total: number;
  last_received_at: string | null;
}

/**
 * Resumo por endpoint e por loja+ambiente. Os eventos chegam do MAIS NOVO para o mais antigo,
 * então o primeiro visto de cada grupo é o "último recebido".
 */
export function resumir(eventos: PixEventRow[]): { summary: PixEventSummary[]; storeSummary: PixStoreEventSummary[] } {
  const porEndpoint = new Map<string, PixEventSummary>();
  const porLoja = new Map<string, PixStoreEventSummary>();
  for (const e of eventos) {
    if (e.endpoint_id) {
      const cur = porEndpoint.get(e.endpoint_id);
      if (!cur) {
        porEndpoint.set(e.endpoint_id, {
          endpoint_id: e.endpoint_id,
          total: 1,
          last_received_at: e.received_at,
          last_status: e.status,
          last_outcome: e.outcome,
        });
      } else cur.total += 1;
    }
    if (e.store_id) {
      const chave = `${e.store_id}|${e.environment}`;
      const cur = porLoja.get(chave);
      if (!cur) {
        porLoja.set(chave, { store_id: e.store_id, environment: e.environment, total: 1, last_received_at: e.received_at });
      } else cur.total += 1;
    }
  }
  return { summary: Array.from(porEndpoint.values()), storeSummary: Array.from(porLoja.values()) };
}

export interface PixFeedEvent extends PixEventRow {
  company_id: string | null;
  qrcode_id: string | null;
  pix_status: string | null;
  emissao: string | null;
  attempts: number | null;
  body_bytes: number | null;
  payload: string | null;
}

/** Busca livre por tx_id / e2e_id / qrcode_id; vírgula e parênteses viram espaço (quebrariam o `.or`). */
export function filtroDaBusca(termo: string | undefined): string | null {
  const t = termo?.trim();
  if (!t) return null;
  const seguro = t.replace(/[,()]/g, ' ');
  return `tx_id.ilike.%${seguro}%,e2e_id.ilike.%${seguro}%,qrcode_id.ilike.%${seguro}%`;
}

/**
 * Página do feed: pede `limite + 1` linhas; se veio a mais, há próxima página e o cursor é o
 * `received_at` da última linha mostrada. O `payload` vai como JSON indentado (a tela o exibe).
 */
export function paginarFeed(
  linhas: Array<Omit<PixFeedEvent, 'payload'> & { payload: unknown }>,
  limite: number,
): { items: PixFeedEvent[]; nextCursor: string | null } {
  const lista = linhas.map((r) => ({
    ...r,
    payload: r.payload == null ? null : JSON.stringify(r.payload, null, 2),
  })) as PixFeedEvent[];
  const temMais = lista.length > limite;
  const items = temMais ? lista.slice(0, limite) : lista;
  return { items, nextCursor: temMais ? (items[items.length - 1]?.received_at ?? null) : null };
}

// ── lojas ──────────────────────────────────────────────────────────────────

export interface StoreLite {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  company_id: string;
  company_name: string | null;
}

export function paraStoreLite(
  s: { id: string; trade_name: string | null; legal_name: string | null; cnpj: string | null; company_id: string },
  nomes: Map<string, string>,
): StoreLite {
  return {
    id: s.id,
    name: s.trade_name ?? s.legal_name ?? '—',
    legal_name: s.legal_name,
    cnpj: s.cnpj,
    company_id: s.company_id,
    company_name: nomes.get(s.company_id) ?? null,
  };
}

// ── endpoints (EasyERP-API) ────────────────────────────────────────────────

/** Mensagens amigáveis por código de erro da EasyERP-API — as MESMAS de `client.ts`. */
export const MENSAGEM_POR_CODIGO: Record<string, string> = {
  credentials_not_found: 'A loja não tem credencial PIXnoPDV nesse ambiente.',
  credentials_disabled: 'A credencial existe, mas está desabilitada.',
  credentials_incomplete: 'Faltam basic_token / secret_key no cadastro da loja.',
  credentials_ambiguous: 'A loja aparece em duas empresas — selecione a empresa e tente de novo.',
  forbidden: 'Somente administradores do sistema podem usar esta tela.',
  unauthorized: 'Sessão expirada — faça login novamente.',
};

/** Texto do erro: o `message` da API → o amigável do código → genérico com o status. */
export function mensagemDoErro(payload: { error?: string; message?: string }, status: number): string {
  return (
    payload.message ?? (payload.error ? MENSAGEM_POR_CODIGO[payload.error] : undefined) ?? `Falha na requisição (${status}).`
  );
}
