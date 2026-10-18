import 'dotenv/config';
import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarLeituraDoCorpo } from './bootstrap/corpo';
import { resolveCors } from './bootstrap/cors';
import { setupSwagger } from './bootstrap/swagger';
import { loadEnv, segredosAusentes, type Env } from './config/env';
import { EasySoftLogger } from './common/logging/easysoft-logger';
import { criarRequestLogMiddleware } from './common/logging/request-log.middleware';

async function bootstrap() {
  // Padrão EasySoft de Logs: escreve na SAÍDA PADRÃO (quem recolhe é o Docker). Construído
  // ANTES do `loadEnv()` para que até a falha de ambiente saia no formato certo.
  const logger = new EasySoftLogger({ app: 'easycontrol-api' });

  let env: Env;
  try {
    env = loadEnv(); // fail-fast: aborta o boot se o ambiente estiver inválido
  } catch (e) {
    logger.emitir({ level: 'fatal', ctx: 'BOOT', step: 'env', msg: (e as Error).message });
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger, bodyParser: false });

  configurarLeituraDoCorpo(app, { limite: env.HTTP_BODY_LIMIT });

  // ANTES de tudo: cada requisição ganha um id de correlação, que sai no log e volta no header
  // `x-request-id`. O BFF repassa o dele, para o mesmo id amarrar Next e API.
  app.use(criarRequestLogMiddleware(logger));
  app.use(helmet());
  // Atrás de 1 proxy em prod — para o rate-limit anônimo ler o IP do X-Forwarded-For.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const cors = resolveCors(env.CORS_ORIGIN);
  if (cors.wildcard) {
    logger.emitir({
      level: 'warn',
      ctx: 'BOOT',
      step: 'cors',
      msg: 'CORS_ORIGIN="*": qualquer origem liberada (sem credenciais). Esta API é chamada pelo servidor do Next; o normal é deixar vazio.',
    });
  }
  app.enableCors(cors.options);
  app.setGlobalPrefix(env.API_PREFIX);

  if (env.SWAGGER_ENABLED) setupSwagger(app, env);

  await app.listen(env.PORT);

  logger.emitir({
    level: 'info',
    ctx: 'BOOT',
    step: 'startup',
    msg: `EasyControl API no ar em :${env.PORT}/${env.API_PREFIX}`,
    data: {
      porta: env.PORT,
      prefixo: env.API_PREFIX,
      nivelDeLog: process.env.LOG_LEVEL ?? 'info',
      formatoDeLog: process.env.LOG_FORMAT ?? 'text',
      swagger: env.SWAGGER_ENABLED,
    },
  });

  // Cofre incompleto não trava o boot, mas desliga uma funcionalidade sem avisar ninguém —
  // então avisa aqui, por NOME, nunca por valor.
  const faltando = segredosAusentes(env);
  if (faltando.length) {
    logger.emitir({
      level: 'warn',
      ctx: 'BOOT',
      step: 'segredos',
      msg: 'Segredos ausentes: as funcionalidades afetadas respondem com erro',
      data: { faltando },
    });
  }
}

bootstrap();
