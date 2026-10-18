import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../src/config/env';
import {
  cotacaoDeReferencia,
  descreverErroDeBilling,
  normalizarPacote,
  planosComUso,
  precoDoPacote,
  type PrecoStripe,
} from '../src/modules/billing/domain/billing';
import { filtroDaBusca, mascarar, montarPatch, paginarFeed, resumir, type PixEventRow } from '../src/modules/pix/domain/pix';
import { EasyErpGateway } from '../src/modules/pix/infrastructure/easyerp.gateway';
import { filtroDeAtividade, paraAuditoriaUnificada } from '../src/modules/auditoria/domain/auditoria';

const ENV = loadEnv({
  SUPABASE_URL: 'https://p.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-x',
  PIX_WEBHOOK_API_URL: 'https://erp.test/api/v1',
});

describe('PIX — credenciais', () => {
  it('máscara: só os 4 últimos', () => {
    expect(mascarar('abcdefgh')).toBe('••••efgh');
    expect(mascarar('')).toBeNull();
  });

  it('patch: URL padrão do ambiente; token vazio não apaga o salvo; basic_user vazio vira null', () => {
    const p = montarPatch(
      { store_id: 's', company_id: 'c', environment: 'homologacao', api_base_url: ' ', basic_user: '', basic_token: '', secret_key: 'k' },
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(p).toEqual({
      company_id: 'c',
      store_id: 's',
      environment: 'homologacao',
      updated_at: '2026-01-01T00:00:00.000Z',
      api_base_url: 'https://pixnopdv.com.br/api-h/v1',
      basic_user: null,
      secret_key: 'k',
    });
  });
});

describe('PIX — eventos', () => {
  const ev = (o: Partial<PixEventRow>): PixEventRow =>
    ({ id: 'e', endpoint_id: null, store_id: null, pix_type: 'cobranca', environment: 'producao', status: null, outcome: null, received_at: 't', ...o }) as PixEventRow;

  it('resumo: o primeiro de cada grupo (o mais novo) é o "último recebido"', () => {
    const r = resumir([
      ev({ endpoint_id: 'x', store_id: 's', received_at: '2', status: 'novo' }),
      ev({ endpoint_id: 'x', store_id: 's', received_at: '1', status: 'velho' }),
    ]);
    expect(r.summary).toEqual([{ endpoint_id: 'x', total: 2, last_received_at: '2', last_status: 'novo', last_outcome: null }]);
    expect(r.storeSummary).toEqual([{ store_id: 's', environment: 'producao', total: 2, last_received_at: '2' }]);
  });

  it('feed: limite+1 decide se há próxima página; payload sai indentado', () => {
    const linhas = [1, 2, 3].map((i) => ({ ...ev({ id: String(i), received_at: `t${i}` }), payload: { a: i } })) as never[];
    const r = paginarFeed(linhas, 2);
    expect(r.items.map((i) => i.id)).toEqual(['1', '2']);
    expect(r.nextCursor).toBe('t2');
    expect(r.items[0].payload).toBe('{\n  "a": 1\n}');
  });

  it('busca: vírgula e parênteses viram espaço (quebrariam o .or)', () => {
    expect(filtroDaBusca('a,b(c)')).toBe('tx_id.ilike.%a b c %,e2e_id.ilike.%a b c %,qrcode_id.ilike.%a b c %');
    expect(filtroDaBusca('  ')).toBeNull();
  });
});

describe('PIX — EasyERP-API', () => {
  const resposta = (status: number, corpo: unknown) =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } }));

  it('repassa o JWT do usuário e manda skip_provider no registro', async () => {
    const f = resposta(200, { endpointId: 'e', url: 'u', cadastrarNoPainel: true });
    await new EasyErpGateway(ENV, f).registrarEndpoint('jwt', { store_id: 's', environment: 'producao', pix_type: 'cobranca' });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://erp.test/api/v1/pixnopdv/endpoints/register');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt');
    expect(JSON.parse(init.body as string)).toMatchObject({ skip_provider: true });
  });

  it('erro: código e details preservados; sem message, o texto amigável do código', async () => {
    const f = resposta(409, { error: 'credentials_ambiguous', details: { company_ids: ['c1', 'c2'] } });
    const e = (await new EasyErpGateway(ENV, f).listarEndpoints('jwt', {}).catch((x: unknown) => x)) as HttpException;
    expect(e.getStatus()).toBe(409);
    expect(e.getResponse()).toEqual({
      error: 'credentials_ambiguous',
      message: 'A loja aparece em duas empresas — selecione a empresa e tente de novo.',
      details: { company_ids: ['c1', 'c2'] },
    });
  });

  it('401 de lá vira 502 aqui (401 derrubaria a sessão no BFF)', async () => {
    const e = (await new EasyErpGateway(ENV, resposta(401, { error: 'unauthorized' })).listarEndpoints('jwt', {}).catch((x: unknown) => x)) as HttpException;
    expect(e.getStatus()).toBe(502);
    expect((e.getResponse() as { message: string }).message).toBe('Sessão expirada — faça login novamente.');
  });
});

describe('faturamento — regras', () => {
  it('descreverErroDeBilling junta as partes; sem nada, a frase padrão', () => {
    expect(descreverErroDeBilling({ message: 'm', hint: 'h', code: '42' })).toBe('m | h | 42');
    expect(descreverErroDeBilling({})).toBe('Falha ao consultar dados de faturamento no Supabase.');
  });

  it('pacote: numeric vira número; total = créditos + bônus quando ausente', () => {
    expect(normalizarPacote({ credits: '100', bonus_credits: '20', total_credits: null, price_brl: '9.9' })).toMatchObject({
      credits: 100,
      bonus_credits: 20,
      total_credits: 120,
      price_brl: 9.9,
    });
  });

  it('cotação de referência: número > 0, senão null (o recuo é da tela)', () => {
    expect(cotacaoDeReferencia({ default: 5.4 })).toBe(5.4);
    expect(cotacaoDeReferencia({ default: 0 })).toBeNull();
    expect(cotacaoDeReferencia(null)).toBeNull();
  });

  it('preço do pacote: metadata.slug → lookup_key → nickname → valor em BRL, nessa ordem', () => {
    const p = (o: Partial<PrecoStripe>): PrecoStripe =>
      ({ id: 'x', active: true, currency: 'brl', unit_amount: 0, lookup_key: null, nickname: null, metadata: {}, product: 'prod', ...o }) as PrecoStripe;
    const pacote = { id: 'k', slug: 'Pro', name: 'Pro', price_brl: 49.9, stripe_price_id: null };
    const porValor = p({ id: 'valor', unit_amount: 4990 });
    const porLookup = p({ id: 'lookup', lookup_key: 'pro' });
    const porProduto = p({ id: 'produto', product: { id: 'pr', metadata: { slug: 'pro' } } });
    expect(precoDoPacote(pacote, [porValor, porLookup, porProduto])?.id).toBe('produto');
    expect(precoDoPacote(pacote, [porValor, porLookup])?.id).toBe('lookup');
    expect(precoDoPacote(pacote, [porValor])?.id).toBe('valor');
    expect(precoDoPacote(pacote, [p({ currency: 'usd', unit_amount: 4990 })])).toBeUndefined();
  });

  it('planos com uso de 30 dias por empresa+módulo', () => {
    const [plano] = planosComUso(
      [{ id: 'l', company_id: 'c', module: 'easyml', plan_name: 'P', license_type: null, is_active: true, max_users: 1, max_stores: 1, starts_at: null, expires_at: null }],
      [{ id: 'c', name: null }],
      [
        { company_id: 'c', module: 'easyml', credits_consumed: '1.00004', tokens_total: 10 },
        { company_id: 'c', module: 'easyml', credits_consumed: 2, tokens_total: '5' },
        { company_id: 'c', module: 'outro', credits_consumed: 9, tokens_total: 9 },
      ],
    );
    expect(plano).toMatchObject({ company_name: '—', usage_events_30d: 2, usage_credits_30d: 3, usage_tokens_30d: 15 });
  });
});

describe('auditoria — regras', () => {
  it('busca do log de atividade em cinco colunas', () => {
    expect(filtroDeAtividade(' x ')).toBe(
      'action.ilike.%x%,category.ilike.%x%,user_email.ilike.%x%,entity_type.ilike.%x%,summary.ilike.%x%',
    );
  });

  it('RPC unificada: total da 1ª linha; autor padrão "admin"', () => {
    const r = paraAuditoriaUnificada([{ id: 1, source: 'totem', entity_id: 2, action: 'update', total_count: '7' }]);
    expect(r.total).toBe(7);
    expect(r.rows[0]).toMatchObject({ id: '1', entity_id: '2', performed_by: 'admin', changed_fields: [], previous_values: {} });
    expect(paraAuditoriaUnificada([])).toEqual({ rows: [], total: 0 });
  });
});
