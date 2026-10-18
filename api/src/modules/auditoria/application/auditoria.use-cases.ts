import { Injectable } from '@nestjs/common';
import { janela } from '../../../common/consulta';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import {
  filtroDeAtividade,
  paraAuditoriaUnificada,
  type FiltrosDePermissao,
  type UnifiedAuditLog,
} from '../domain/auditoria';
import { AuditoriaRepository } from '../infrastructure/auditoria.repository';

type Db = UserSupabaseClient;

/** Teto da exportação CSV — o `EXPORT_LIMIT` de hoje. */
export const LIMITE_DE_EXPORTACAO = 10_000;

/** Telas de auditoria — hoje consultas do navegador; sem gate na aplicação (RLS decide). */
@Injectable()
export class AuditoriaService {
  constructor(private readonly repo: AuditoriaRepository) {}

  atividade(db: Db, c: { page: number; pageSize: number; search?: string }) {
    return this.repo.atividade(db, janela(c.page, c.pageSize), filtroDeAtividade(c.search));
  }

  empresas(db: Db) {
    return this.repo.empresas(db);
  }

  async ecp(
    db: Db,
    c: { company_id: string; source: string; action: string; user?: string; from?: string; page: number; pageSize: number },
  ): Promise<{ rows: UnifiedAuditLog[]; total: number }> {
    const lista = await this.repo.ecpUnificada(db, {
      company_id: c.company_id,
      source: c.source,
      action: c.action,
      user: c.user?.trim() || null,
      from: c.from ?? null,
      limit: c.pageSize,
      offset: (c.page - 1) * c.pageSize,
    });
    return paraAuditoriaUnificada(lista);
  }

  permissoes(db: Db, f: FiltrosDePermissao, page: number, pageSize: number) {
    return this.repo.permissoes(db, f, janela(page, pageSize), true);
  }

  async contarPermissoes(db: Db, f: FiltrosDePermissao): Promise<{ count: number }> {
    return { count: await this.repo.contarPermissoes(db, f) };
  }

  /** Para o CSV: sem `before`/`after`, até 10 mil linhas (o PostgREST ainda aplica o teto dele). */
  exportarPermissoes(db: Db, f: FiltrosDePermissao) {
    return this.repo.permissoes(db, f, { from: 0, to: LIMITE_DE_EXPORTACAO - 1 }, false);
  }
}
