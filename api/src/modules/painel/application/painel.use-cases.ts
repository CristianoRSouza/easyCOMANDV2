import { Injectable } from '@nestjs/common';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { janelasDoDashboard, somarReceita, type DashboardKpis } from '../domain/painel';
import { PainelRepository } from '../infrastructure/painel.repository';

type Db = UserSupabaseClient;

/**
 * Dashboard e telas de módulo — hoje consultas do NAVEGADOR (`lib/queries/dashboard.ts`,
 * `_admin.modules.*`, `easyml-connect-card.tsx`). Sem gate na aplicação: a RLS decide.
 */
@Injectable()
export class PainelService {
  constructor(private readonly repo: PainelRepository) {}

  async dashboard(db: Db): Promise<DashboardKpis> {
    const { contagens, receita } = await this.repo.kpis(db, janelasDoDashboard(Date.now()));
    return { ...contagens, mlRevenue30d: somarReceita(receita) };
  }

  totens(db: Db) {
    return this.repo.totens(db);
  }

  agentes(db: Db) {
    return this.repo.agentes(db);
  }

  kpisEasyCommandPay(db: Db) {
    return this.repo.rpcDeKpis(db, 'get_easycommandpay_kpis');
  }

  kpisEasyMl(db: Db) {
    return this.repo.rpcDeKpis(db, 'get_easyml_kpis');
  }

  conexoes(db: Db) {
    return this.repo.conexoes(db);
  }

  pedidosMl(db: Db) {
    return this.repo.pedidosMl(db);
  }

  usoDeIa(db: Db) {
    return this.repo.usoDeIa(db);
  }
}
