import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SEC_SUPABASE_BEARER } from '../common/swagger';
import type { Env } from '../config/env';

/**
 * Swagger / OpenAPI — servido na MESMA porta, sob `/<API_PREFIX>/docs`
 * (JSON em `/<API_PREFIX>/docs-json`).
 *
 * Dois detalhes que NÃO devem ser mexidos sem entender o efeito:
 *  - `addServer('/<prefixo>')` + `createDocument(..., { ignoreGlobalPrefix: true })` andam em
 *    par: o prefixo global do Nest não entra nos paths do documento; ele é declarado uma única
 *    vez no `server`. Sem o `ignoreGlobalPrefix`, path e server duplicam o prefixo e o
 *    "Try it out" chama `/api/v1/api/v1/...` → 404.
 *  - `persistAuthorization: true` mantém o token digitado no botão **Authorize** após reload.
 */
export function setupSwagger(app: INestApplication, env: Env): void {
  const config = new DocumentBuilder()
    .setTitle('EasyControl API')
    .setDescription(
      'Backend do EasyControl V2: toda regra de negócio, Stripe, EasyERP-API e acesso ao Supabase. Quem chama é o ' +
        '**servidor do Next (BFF)** — o navegador nunca fala com esta API nem vê token.\n\n' +
        'Autenticação por um `AuthGuard` global: rotas **públicas** (`@Public`) ou rotas de **sessão**, ' +
        'que exigem `Authorization: Bearer <access_token do Supabase>` (validado com `getClaims`). As ' +
        'consultas rodam com o JWT do usuário, então a RLS do Supabase vale exatamente como hoje.\n\n' +
        'Não existe header de tenant: empresa/loja vêm no corpo/query e cada módulo confere o acesso.\n\n' +
        'Todo erro sai no mesmo envelope: `{ error, message, statusCode, details? }`.',
    )
    .setVersion(process.env.npm_package_version ?? '0.1.0')
    .setContact('EasySoft Sistemas', '', 'contato@easysoftsistemas.com.br')
    .addServer(`/${env.API_PREFIX}`)
    .addBearerAuth(
      {
        // `in` é omitido de propósito: no OpenAPI 3.0 ele só vale para `type: apiKey`; num
        // scheme `http`/bearer o campo é inválido e redundante.
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          '`access_token` da sessão do Supabase Auth (JWT). Em produção quem o envia é o BFF do Next, ' +
          'que o guarda em cookie httpOnly. Para testar aqui, cole um access token válido do projeto.',
      },
      SEC_SUPABASE_BEARER,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: true });
  SwaggerModule.setup(`${env.API_PREFIX}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'EasyControl API — docs',
  });
}
