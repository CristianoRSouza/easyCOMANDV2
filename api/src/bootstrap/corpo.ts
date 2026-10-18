import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Leitura do corpo das requisições (JSON e urlencoded) com o teto `HTTP_BODY_LIMIT`.
 *
 * Tem que ser chamado ANTES de `listen`/`init` (os parsers padrão do Nest não são registrados de
 * novo). Corpo acima do teto vira 413 com mensagem clara (ver HttpExceptionFilter).
 */
export function configurarLeituraDoCorpo(app: NestExpressApplication, opcoes: { limite: string }): void {
  app.useBodyParser('json', { limit: opcoes.limite });
  app.useBodyParser('urlencoded', { limit: opcoes.limite, extended: true });
}
