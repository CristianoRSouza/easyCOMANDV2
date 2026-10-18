import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserSupabase } from '../../../common/http/request.decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DocSessao } from '../../../common/swagger';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { AuditoriaService } from '../application/auditoria.use-cases';
import {
  AtividadeSchema,
  EcpSchema,
  FiltrosDePermissaoSchema,
  ListaDePermissoesSchema,
  type AtividadeInput,
  type EcpInput,
  type FiltrosDePermissaoInput,
  type ListaDePermissoes,
} from '../dto/auditoria.schemas';

const RLS = 'Sem gate na aplicação: a RLS do Supabase decide, como hoje.';

/** Telas "Auditoria" (atividade + EasyFoodPay) e "Auditoria de permissões". */
@ApiTags('Auditoria')
@Controller('audit')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get('activity')
  @DocSessao('Log de atividade (activity_logs), paginado, com busca livre', RLS)
  atividade(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(AtividadeSchema)) q: AtividadeInput) {
    return this.auditoria.atividade(db, q);
  }

  @Get('companies')
  @DocSessao('Empresas (até 500) para o filtro da auditoria do EasyFoodPay', RLS)
  empresas(@UserSupabase() db: UserSupabaseClient) {
    return this.auditoria.empresas(db);
  }

  @Get('easyfoodpay')
  @DocSessao('Auditoria unificada do EasyFoodPay (RPC get_ecp_unified_audit)', RLS)
  ecp(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(EcpSchema)) q: EcpInput) {
    return this.auditoria.ecp(db, q);
  }

  @Get('permissions')
  @DocSessao('Auditoria de permissões (pv_permission_audit_log), paginada', RLS)
  permissoes(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(ListaDePermissoesSchema)) q: ListaDePermissoes) {
    const { page, pageSize, ...filtros } = q;
    return this.auditoria.permissoes(db, filtros, page, pageSize);
  }

  @Get('permissions/count')
  @DocSessao('Total estimado da auditoria de permissões com os filtros', RLS)
  contar(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(FiltrosDePermissaoSchema)) q: FiltrosDePermissaoInput) {
    return this.auditoria.contarPermissoes(db, q);
  }

  @Get('permissions/export')
  @DocSessao('Linhas para o CSV (até 10 mil, sem before/after)', RLS)
  exportar(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(FiltrosDePermissaoSchema)) q: FiltrosDePermissaoInput) {
    return this.auditoria.exportarPermissoes(db, q);
  }
}
