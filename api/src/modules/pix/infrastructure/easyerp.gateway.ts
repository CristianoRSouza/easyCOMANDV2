import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { ENV, type Env } from '../../../config/env';
import { mensagemDoErro, type PixEnvironment, type PixType } from '../domain/pix';

/** Token de injeção opcional: `fetch` alternativo para os testes (sem rede). */
export const FETCH_DA_EASYERP = Symbol('FETCH_DA_EASYERP');

export interface PixEndpoint {
  id: string;
  company_id: string;
  store_id: string;
  environment: PixEnvironment;
  pix_type: PixType;
  active: boolean;
  callback_url_prefix: string;
  registered_at: string | null;
  rotated_at: string | null;
  last_event_at: string | null;
  created_at: string;
}

/**
 * Cliente da EasyERP-API (webhooks PIX) — o `client.ts` de hoje, que rodava NO NAVEGADOR com o
 * token da sessão. Agora o navegador não tem token; quem chama é esta API, com o MESMO JWT do
 * usuário (a EasyERP-API valida a sessão no Supabase dela e confere se é system_admin).
 *
 * Erros: mesmo envelope de hoje — `{ error: <código>, message, details }`, com o texto amigável
 * por código quando a EasyERP-API não manda `message`. A tela lê `error` (credentials_ambiguous…)
 * e `details.company_ids`.
 *
 * O status da EasyERP-API é preservado, EXCETO 401: no BFF, 401 significa "a SUA sessão caiu" e
 * apaga os cookies. Um 401 da EasyERP-API vira 502 com `error: unauthorized` — a tela mostra
 * "Sessão expirada — faça login novamente.", como hoje, sem derrubar a sessão daqui.
 */
@Injectable()
export class EasyErpGateway {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Optional() @Inject(FETCH_DA_EASYERP) private readonly fetchFn?: typeof fetch,
  ) {}

  async listarEndpoints(token: string, filtro: { store_id?: string; apenas_ativos?: boolean }): Promise<PixEndpoint[]> {
    const qs = new URLSearchParams();
    if (filtro.store_id) qs.set('store_id', filtro.store_id);
    if (filtro.apenas_ativos) qs.set('apenas_ativos', 'true');
    const sufixo = qs.toString() ? `?${qs.toString()}` : '';
    const corpo = await this.pedir<{ endpoints?: PixEndpoint[] }>(token, `/pixnopdv/endpoints${sufixo}`);
    return corpo.endpoints ?? [];
  }

  /** `skip_provider: true` como hoje: o cadastro no painel do PIXnoPDV é manual. */
  registrarEndpoint(
    token: string,
    dados: { store_id: string; environment: PixEnvironment; pix_type: PixType; company_id?: string },
  ): Promise<{ endpointId: string; url: string; cadastrarNoPainel: boolean }> {
    return this.pedir(token, '/pixnopdv/endpoints/register', {
      method: 'POST',
      body: JSON.stringify({ ...dados, skip_provider: true }),
    });
  }

  desativarEndpoint(
    token: string,
    dados: { store_id: string; environment: PixEnvironment; pix_type: PixType },
  ): Promise<{ desativados: number }> {
    return this.pedir(token, '/pixnopdv/endpoints/deactivate', { method: 'POST', body: JSON.stringify(dados) });
  }

  private async pedir<T>(token: string, caminho: string, init?: RequestInit): Promise<T> {
    const fetchFn = this.fetchFn ?? fetch;
    let res: Response;
    try {
      res = await fetchFn(`${this.env.PIX_WEBHOOK_API_URL}${caminho}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    } catch {
      throw new HttpException(
        { error: 'upstream_unavailable', message: 'Não foi possível falar com a EasyERP-API.' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const bruto = await res.text();
    let corpo: unknown = null;
    try {
      corpo = bruto ? JSON.parse(bruto) : null;
    } catch {
      corpo = null;
    }

    if (!res.ok) {
      const p = (corpo ?? {}) as { error?: string; message?: string; statusCode?: number; details?: Record<string, unknown> };
      const status = p.statusCode ?? res.status;
      throw new HttpException(
        {
          error: p.error ?? 'upstream_error',
          message: mensagemDoErro(p, res.status),
          ...(p.details ? { details: p.details } : {}),
        },
        status === HttpStatus.UNAUTHORIZED || status < 400 || status > 599 ? HttpStatus.BAD_GATEWAY : status,
      );
    }
    return corpo as T;
  }
}
