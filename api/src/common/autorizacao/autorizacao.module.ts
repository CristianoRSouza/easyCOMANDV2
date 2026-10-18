import { Global, Module } from '@nestjs/common';
import { AutorizacaoService } from './autorizacao.service';
import { PapeisRepository } from './papeis.repository';

/** Gates de administrador, GLOBAIS: todo módulo de negócio usa sem importar. */
@Global()
@Module({
  providers: [PapeisRepository, AutorizacaoService],
  exports: [AutorizacaoService, PapeisRepository],
})
export class AutorizacaoModule {}
