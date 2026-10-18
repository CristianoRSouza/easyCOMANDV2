import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ApiDocs } from '../../../common/swagger';

/**
 * Documentação OpenAPI das rotas de health. Cada `Doc*` equivale a empilhar os mesmos
 * decorators sobre o método, na mesma ordem.
 */

const okSchema: SchemaObject = {
  type: 'object',
  properties: { status: { type: 'string', enum: ['ok'], example: 'ok' } },
};

export const DocLive = () =>
  ApiDocs(
    ApiOperation({
      summary: 'Liveness do processo (usado pelo orquestrador/Docker)',
      description:
        'Responde 200 sempre que o processo aceita requisições. **Não** toca o Supabase nem o Stripe de ' +
        'propósito: um blip de dependência não pode fazer o orquestrador matar o container. Pública ' +
        '(`@Public`) — sem sessão.',
    }),
    ApiResponse({ status: 200, description: 'Processo no ar.', schema: okSchema }),
  );

export const DocHealth = () =>
  ApiDocs(
    ApiOperation({
      summary: 'Health público mínimo (idêntico ao liveness)',
      description:
        'Mesmo corpo do `/health/live`. É deliberadamente mínimo: **nenhuma** métrica interna (contadores, ' +
        'versão, estado de dependências) vaza numa rota pública. Pública (`@Public`).',
    }),
    ApiResponse({ status: 200, description: 'Processo no ar.', schema: okSchema }),
  );
