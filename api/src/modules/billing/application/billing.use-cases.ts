import { Injectable, Logger } from '@nestjs/common';
import { ErroDeRegra } from '../../../common/erros';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  comNomeDaEmpresa,
  cotacaoDeReferencia,
  modoDaPreferencia,
  normalizarCustoDeModelo,
  normalizarLinhaDeCache,
  normalizarPacote,
  planosComUso,
  precoDoPacote,
  type AiCacheRow,
  type PlanoDaEmpresa,
  type ResultadoDaSincronizacao,
  type StripeMode,
} from '../domain/billing';
import { BillingRepository } from '../infrastructure/billing.repository';
import { StripePrecosGateway } from '../infrastructure/stripe-precos.gateway';

type Db = UserSupabaseClient;
type Linha = Record<string, unknown>;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Catálogo e configuração do faturamento — as consultas que hoje as abas de "Planos & Preços",
 * "Configurações" e "Créditos de IA" fazem DIRETO do navegador. Sem gate na aplicação, como
 * hoje: quem decide é a RLS do schema `billing`.
 */
@Injectable()
export class CatalogoService {
  constructor(private readonly repo: BillingRepository) {}

  config(db: Db, categoria?: string) {
    return this.repo.config(db, categoria);
  }

  async atualizarConfig(db: Db, id: string, valor: Record<string, unknown>): Promise<{ ok: true }> {
    await this.repo.atualizarConfig(db, id, valor, new Date());
    return { ok: true };
  }

  async cotacao(db: Db): Promise<{ value: number | null }> {
    return { value: cotacaoDeReferencia(await this.repo.valorDaCotacao(db)) };
  }

  planos(db: Db, modulo: string) {
    return this.repo.planos(db, modulo);
  }

  async atualizarPlano(db: Db, id: string, patch: Linha): Promise<{ ok: true }> {
    await this.repo.atualizarPlano(db, id, patch, new Date());
    return { ok: true };
  }

  async pacotes(db: Db): Promise<Linha[]> {
    return (await this.repo.pacotes(db)).map(normalizarPacote);
  }

  async atualizarPacote(db: Db, id: string, patch: Linha): Promise<{ ok: true }> {
    await this.repo.atualizarPacote(db, id, patch);
    return { ok: true };
  }

  async custos(db: Db): Promise<Linha[]> {
    return (await this.repo.custos(db)).map(normalizarCustoDeModelo);
  }

  async atualizarCusto(db: Db, id: string, patch: Linha): Promise<{ ok: true }> {
    await this.repo.atualizarCusto(db, id, patch);
    return { ok: true };
  }

  async usoDoCache(db: Db, dias: number, app?: string): Promise<AiCacheRow[]> {
    const desde = new Date(Date.now() - dias * DIA_MS).toISOString();
    return (await this.repo.usoDeIaDesde(db, desde, app)).map(normalizarLinhaDeCache);
  }
}

/** Preferência de modo do Stripe por usuário (`lib/stripe-invoke.ts` e `StripeModeTab`). */
@Injectable()
export class ModoStripeService {
  constructor(private readonly repo: BillingRepository) {}

  /**
   * Leitura com erro → `null`: hoje a tela cai no valor que tinha guardado no localStorage.
   * Sem linha → live.
   */
  async ler(db: Db, userId: string): Promise<{ mode: StripeMode | null }> {
    const r = await this.repo.preferenciaDeModo(db, userId);
    if (r === 'erro') return { mode: null };
    return { mode: modoDaPreferencia(r?.mode) };
  }

  async gravar(db: Db, userId: string, mode: StripeMode): Promise<{ mode: StripeMode }> {
    await this.repo.gravarPreferenciaDeModo(db, userId, mode, new Date());
    return { mode };
  }
}

/** Sincronizações com o Stripe — price ids dos pacotes de IA e a Edge Function de planos. */
@Injectable()
export class SincronizacaoStripeService {
  private readonly log = new Logger('billing:stripe-sync');

  constructor(
    private readonly repo: BillingRepository,
    private readonly stripe: StripePrecosGateway,
  ) {}

  /**
   * `syncAiCreditsStripePriceIds` de hoje. O modo é o da PREFERÊNCIA do usuário; erro na leitura
   * da preferência cai em LIVE (com aviso no log), como hoje.
   */
  async priceIdsDosPacotes(db: Db, userId: string): Promise<ResultadoDaSincronizacao> {
    const pref = await this.repo.preferenciaDeModo(db, userId);
    if (pref === 'erro') this.log.warn('leitura do modo falhou; usando live');
    const mode: StripeMode = pref === 'erro' ? 'live' : modoDaPreferencia(pref?.mode);
    const chave = this.stripe.chave(mode);

    const pacotes = await this.repo.pacotesParaSincronizar(db);
    const precos = await this.stripe.precosAtivos(chave);

    const details: ResultadoDaSincronizacao['details'] = [];
    let matched = 0;
    let updated = 0;
    for (const pacote of pacotes) {
      const preco = precoDoPacote(pacote, precos);
      if (!preco) {
        details.push({ slug: pacote.slug, price_id: null, reason: 'no_match' });
        continue;
      }
      matched++;
      if (preco.id === pacote.stripe_price_id) {
        details.push({ slug: pacote.slug, price_id: preco.id, reason: 'already_synced' });
        continue;
      }
      const falha = await this.repo.gravarPriceId(db, pacote.id, preco.id);
      if (falha) {
        details.push({ slug: pacote.slug, price_id: preco.id, reason: `update_failed: ${falha}` });
        continue;
      }
      updated++;
      details.push({ slug: pacote.slug, price_id: preco.id, reason: 'updated' });
    }
    return { mode, scanned: pacotes.length, matched, updated, details };
  }

  /**
   * Um ambiente da Edge Function `stripe-sync-plans` (a tela chama duas vezes: test e live).
   * Falha da função → 502 com o texto do supabase-js, que a tela põe no log daquele ambiente.
   */
  async planos(db: Db, corpo: { mode: 'test' | 'live'; module?: string }): Promise<unknown> {
    const r = await this.repo.sincronizarPlanos(db, corpo);
    if ('erro' in r) throw new ErroDeRegra(r.erro, 'externo');
    return r.data;
  }
}

/** Licenças (tela "Faturamento"). */
@Injectable()
export class LicencasService {
  constructor(private readonly repo: BillingRepository) {}

  async deTotem(db: Db) {
    const [licencas, empresas] = await Promise.all([this.repo.licencasDeTotem(db), this.repo.empresas(db)]);
    return comNomeDaEmpresa(licencas, empresas);
  }

  async planosDasEmpresas(db: Db): Promise<PlanoDaEmpresa[]> {
    const desde = new Date(Date.now() - 30 * DIA_MS).toISOString();
    const [licencas, empresas, uso] = await Promise.all([
      this.repo.licencasDeEmpresa(db),
      this.repo.empresas(db),
      this.repo.usoDesde(db, desde),
    ]);
    return planosComUso(licencas, empresas, uso);
  }
}
