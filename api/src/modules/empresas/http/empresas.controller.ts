import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserSupabase } from '../../../common/http/request.decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DocSessao } from '../../../common/swagger';
import type { UserSupabaseClient } from '../../../db/user-supabase';
import { EmpresasService } from '../application/empresas.use-cases';
import { EmpresasQuerySchema, LojasQuerySchema, type EmpresasQuery, type LojasQuery } from '../dto/empresas.schemas';

const RLS = 'Sem gate na aplicação: a RLS do Supabase decide, como hoje.';

/** Telas "Empresas" e "Lojas". */
@ApiTags('Empresas e lojas')
@Controller()
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Get('companies')
  @DocSessao('Empresas (até 200) com a contagem de lojas', RLS, ApiQuery({ name: 'search', required: false, type: String }))
  listarEmpresas(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(EmpresasQuerySchema)) q: EmpresasQuery) {
    return this.empresas.empresas(db, q.search);
  }

  @Get('stores')
  @DocSessao(
    'Lojas (até 300) com o nome da empresa',
    RLS,
    ApiQuery({ name: 'search', required: false, type: String }),
    ApiQuery({ name: 'only_active', required: false, enum: ['true', 'false'] }),
  )
  listarLojas(@UserSupabase() db: UserSupabaseClient, @Query(new ZodValidationPipe(LojasQuerySchema)) q: LojasQuery) {
    return this.empresas.lojas(db, q.search, q.only_active);
  }
}
