import { Injectable } from '@nestjs/common';
import { AutorizacaoService } from '../../../common/autorizacao';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  filtroDaBusca,
  montarPatch,
  paginarFeed,
  paraStatus,
  paraStoreLite,
  resumir,
  type PixCredentialStatus,
  type PixEnvironment,
  type PixEventRow,
  type PixEventSummary,
  type PixFeedEvent,
  type PixStoreEventSummary,
  type PixType,
  type SalvarCredencial,
  type StoreLite,
} from '../domain/pix';
import { CredenciaisRepository } from '../infrastructure/credenciais.repository';
import { EasyErpGateway, type PixEndpoint } from '../infrastructure/easyerp.gateway';
import { EventosRepository, type FiltroDoResumo } from '../infrastructure/eventos.repository';
import { LojasRepository } from '../infrastructure/lojas.repository';

type Db = UserSupabaseClient;

/**
 * Credenciais PIXnoPDV por loja (`managePixCredentials` de hoje). Sem gate na aplicação: a RLS de
 * `devices.pixnopdv_store_credentials` decide, como hoje.
 */
@Injectable()
export class CredenciaisService {
  constructor(private readonly repo: CredenciaisRepository) {}

  async listar(db: Db): Promise<{ credentials: PixCredentialStatus[] }> {
    return { credentials: (await this.repo.listar(db)).map(paraStatus) };
  }

  async salvar(db: Db, dados: SalvarCredencial): Promise<{ ok: true }> {
    await this.repo.gravar(db, montarPatch(dados, new Date()));
    return { ok: true };
  }

  async excluir(db: Db, chave: { company_id: string; store_id: string; environment: PixEnvironment }): Promise<{ ok: true }> {
    await this.repo.excluir(db, chave);
    return { ok: true };
  }
}

/** Eventos recebidos (`listPixWebhookEvents` / `listPixWebhookFeed`) — gate de admin LEGADO. */
@Injectable()
export class EventosService {
  constructor(
    private readonly autorizacao: AutorizacaoService,
    private readonly repo: EventosRepository,
  ) {}

  async resumo(
    db: Db,
    ator: string,
    f: FiltroDoResumo,
  ): Promise<{ events: PixEventRow[]; summary: PixEventSummary[]; storeSummary: PixStoreEventSummary[] }> {
    await this.autorizacao.exigirAdminLegado(db, ator);
    const events = await this.repo.paraResumo(f);
    return { events, ...resumir(events) };
  }

  async feed(
    db: Db,
    ator: string,
    f: FiltroDoResumo & { pix_type?: string; outcome?: string; search?: string; cursor?: string; limit?: number },
  ): Promise<{ items: PixFeedEvent[]; nextCursor: string | null }> {
    await this.autorizacao.exigirAdminLegado(db, ator);
    const limite = f.limit ?? 25;
    const linhas = await this.repo.paraFeed({
      endpoint_id: f.endpoint_id,
      store_id: f.store_id,
      environment: f.environment,
      pix_type: f.pix_type,
      outcome: f.outcome,
      cursor: f.cursor,
      busca: filtroDaBusca(f.search),
      limite,
    });
    return paginarFeed(linhas, limite);
  }
}

/** Lojas para os seletores do PIX (`usePixStores`). */
@Injectable()
export class LojasPixService {
  constructor(private readonly repo: LojasRepository) {}

  async listar(db: Db): Promise<StoreLite[]> {
    const lojas = await this.repo.todas(db);
    const nomes = await this.repo.nomesDasEmpresas(db, Array.from(new Set(lojas.map((s) => s.company_id).filter(Boolean))));
    // Mesmo efeito do `Map` de hoje: id repetido fica com a ÚLTIMA ocorrência.
    const porId = new Map<string, StoreLite>();
    for (const s of lojas) porId.set(s.id, paraStoreLite(s, nomes));
    return Array.from(porId.values());
  }
}

/** Endpoints de webhook na EasyERP-API, com o JWT do usuário (ver EasyErpGateway). */
@Injectable()
export class EndpointsService {
  constructor(private readonly easyerp: EasyErpGateway) {}

  listar(token: string, filtro: { store_id?: string; apenas_ativos?: boolean }): Promise<PixEndpoint[]> {
    return this.easyerp.listarEndpoints(token, filtro);
  }

  registrar(token: string, d: { store_id: string; environment: PixEnvironment; pix_type: PixType; company_id?: string }) {
    return this.easyerp.registrarEndpoint(token, d);
  }

  desativar(token: string, d: { store_id: string; environment: PixEnvironment; pix_type: PixType }) {
    return this.easyerp.desativarEndpoint(token, d);
  }
}
