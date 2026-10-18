/**
 * Helpers de OpenAPI/Swagger para os controllers da EasyControl API.
 *
 * Um caminho de auth só, resolvido pelo `AuthGuard` global:
 *   `@Public()` → rota aberta (health, login, cadastro, webhook do Stripe)
 *   default     → `Authorization: Bearer <access_token do Supabase>` (repassado pelo BFF)
 * Por isso há um security scheme só: `supabase-bearer`.
 *
 * Não há header de tenant: empresa/loja chegam no corpo/query, como nas server functions de
 * hoje, e cada módulo confere o acesso (`assertCompanyAccess`, `fetchAllowedStoreIds`).
 *
 * Como a validação é Zod (não class-validator), os schemas de request/response são declarados
 * INLINE nos decorators — não em classes DTO com `@ApiProperty`. Sem `@ApiBody`/`@ApiQuery`/
 * `@ApiParam` explícito o parâmetro simplesmente NÃO aparece no Swagger UI.
 *
 * Uso num controller autenticado:
 *   @ApiTags('Licenças')
 *   @ApiBearerSession()
 *   @Controller('licencas')
 *   export class LicencasController { ... }
 * e em cada rota: `@ApiSessionErrorResponses()` para os erros padrão.
 */
import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

/** Nome lógico do security scheme (referenciado nos decorators e no bootstrap/swagger.ts). */
export const SEC_SUPABASE_BEARER = 'supabase-bearer';

/** Auth de USUÁRIO (ramo default do `AuthGuard`). */
export const ApiBearerSession = () => applyDecorators(ApiBearerAuth(SEC_SUPABASE_BEARER));

/**
 * Schema inline do envelope de erro do `HttpExceptionFilter`:
 * `{ error, message, statusCode, details? }`. O cliente trata ESTE shape, nunca o status cru.
 */
export function errorSchema(codes: string[], exampleMessage: string, statusCode: number): SchemaObject {
  return {
    type: 'object',
    required: ['error', 'message', 'statusCode'],
    properties: {
      error: { type: 'string', enum: codes, example: codes[0] },
      message: { type: 'string', example: exampleMessage },
      statusCode: { type: 'integer', example: statusCode },
      details: {
        description: 'Só em 400 de validação Zod: lista de `{ path, message }` por campo inválido.',
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', example: 'email' },
            message: { type: 'string', example: 'Invalid email' },
          },
        },
      },
    },
  };
}

/**
 * Empilha decorators de documentação NA ORDEM em que seriam escritos sobre o método.
 *
 * Serve para tirar a documentação de dentro do controller (para um `*.docs.ts` ao lado) sem
 * mudar o documento gerado: o `applyDecorators` do Nest aplica de cima para baixo, e
 * decorators empilhados no método aplicam de baixo para cima. A ordem decide a sequência de
 * `parameters` e `responses` no OpenAPI — por isso o `reverse()`.
 */
export const ApiDocs = (
  ...decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator>
) => applyDecorators(...[...decorators].reverse());

/** 400 do `ZodValidationPipe` — sempre `invalid_input` + `details` por campo. */
export const ApiValidationErrorResponse = () =>
  ApiResponse({
    status: 400,
    description:
      'Payload reprovado pelo `ZodValidationPipe`. `details` traz um item por campo inválido (`path` + `message`).',
    schema: errorSchema(['invalid_input'], 'Payload inválido.', 400),
  });

/**
 * 429 do `SessionThrottlerGuard` (roda ANTES da autenticação — requisição abusiva não deve
 * custar verificação). Conta por SESSÃO (hash do Bearer); anônimo conta por IP.
 */
export const ApiThrottleErrorResponse = (limitDescription = '300 requisições/minuto por sessão') =>
  ApiResponse({
    status: 429,
    description: `Rate-limit estourado (${limitDescription}). O guard de throttle roda antes da autenticação.`,
    schema: errorSchema(['error'], 'ThrottlerException: Too Many Requests', 429),
  });

/** 500 genérico — detalhe interno NUNCA vaza (só vai para o log). */
export const ApiInternalErrorResponse = () =>
  ApiResponse({
    status: 500,
    description: 'Erro interno. O detalhe real fica só no log do servidor — a resposta é genérica por segurança.',
    schema: errorSchema(['internal_error'], 'Erro interno.', 500),
  });

/**
 * O 401 do `AuthGuard`. O EasyControl de hoje respondia em inglês ("Unauthorized: …") e a tela nunca mostrava o texto: o 401 só derruba para o login.
 */
export const ApiSessionUnauthorizedResponse = () =>
  ApiResponse({
    status: 401,
    description:
      'Sem `Authorization: Bearer`, JWT inválido/expirado ("Sessão inválida ou expirada. Faça login ' +
      'novamente.") ou JWT sem `sub` ("Não foi possível identificar o usuário. Faça login novamente.").',
    schema: errorSchema(['unauthorized'], 'Sessão inválida ou expirada. Faça login novamente.', 401),
  });

/**
 * Respostas de erro padrão das rotas que exigem sessão. Aplique por rota; acrescente o
 * `@ApiResponse` de sucesso e os erros específicos (403, 404…) à parte.
 */
export const ApiSessionErrorResponses = () =>
  applyDecorators(ApiSessionUnauthorizedResponse(), ApiThrottleErrorResponse(), ApiInternalErrorResponse());

/**
 * Atalho para a documentação de uma rota de SESSÃO: resumo, descrição, Bearer e os erros padrão.
 * Rotas com corpo/consulta acrescentam `ApiBody`/`ApiQuery` no próprio `*.docs.ts`.
 */
export const DocSessao = (summary: string, description?: string, ...extras: Array<MethodDecorator>) =>
  ApiDocs(
    ApiOperation({ summary, ...(description ? { description } : {}) }),
    ApiBearerAuth(SEC_SUPABASE_BEARER),
    ...extras,
    ApiSessionErrorResponses(),
  );
