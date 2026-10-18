import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { correlacaoAtual } from '../logging/request-context';
import { ErroDeRegra, type TipoDeErro } from '../erros';

/**
 * Envelope de erro estável: toda resposta de erro sai como
 * `{ error, message, statusCode, details? }` (+ `requestId` quando há correlação).
 * O BFF trata isso, nunca status cru — e repassa o `message` à tela, por isso as mensagens
 * de erro dos módulos têm que ser as MESMAS que o EasyControl mostra hoje.
 *
 * Erro não tratado (não-HttpException) vira 500 genérico: o detalhe (schema, PostgREST,
 * Stripe) fica SÓ no log.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('http');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'internal_error';
    let message = 'Erro interno.';
    let details: unknown;

    let internalDetail = message;
    if (exception instanceof ErroDeRegra) {
      // Regra de negócio: o TEXTO é o que a tela de hoje mostra — sai inteiro.
      statusCode = STATUS_DA_REGRA[exception.tipo];
      error = exception.codigo ?? CODIGO_DA_REGRA[exception.tipo];
      message = exception.message;
      details = exception.detalhes;
      internalDetail = message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        error = (b.error as string) ?? httpError(statusCode);
        message = (b.message as string) ?? message;
        details = b.details;
      }
      internalDetail = message;
    } else if (ehCorpoGrandeDemais(exception)) {
      /**
       * `entity.too.large` do body-parser é um Error com `status`, não uma HttpException —
       * então cairia no ramo genérico e viraria **500 "Erro interno"**, indistinguível de
       * servidor quebrado. 413 com o teto no texto é o que transforma "o servidor caiu" em
       * "manda menos" (aprendido na API do EasyFood, onde isso travou a fila do sync).
       */
      statusCode = HttpStatus.PAYLOAD_TOO_LARGE;
      error = 'payload_too_large';
      message =
        'Corpo da requisição acima do limite. Envie em lotes menores ' +
        '(o teto do servidor é HTTP_BODY_LIMIT).';
      internalDetail = (exception as Error).message;
    } else if (exception instanceof Error) {
      internalDetail = exception.message; // fica SÓ no log
    }

    const corr = correlacaoAtual();

    if (statusCode >= 500) {
      // `corr` no log E no corpo da resposta: é o que permite ao suporte pedir "qual o
      // código que apareceu na tela?" e achar a requisição exata, em vez de caçar pelo
      // horário aproximado.
      this.log.error(
        `${internalDetail}${corr ? ` | corr=${corr}` : ''}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      // Erro não tratado: NÃO vazar detalhe interno (schema/pg/e-mail) ao cliente.
      if (!(exception instanceof HttpException) && !(exception instanceof ErroDeRegra)) {
        error = 'internal_error';
        message = 'Erro interno.';
        details = undefined;
      }
    }

    res.status(statusCode).json({
      error,
      message,
      statusCode,
      // Só o identificador da requisição — não é detalhe interno, e sem ele o cliente
      // não tem como referenciar o problema.
      ...(corr ? { requestId: corr } : {}),
      ...(details ? { details } : {}),
    });
  }
}

const STATUS_DA_REGRA: Record<TipoDeErro, number> = {
  proibido: HttpStatus.FORBIDDEN,
  invalido: HttpStatus.BAD_REQUEST,
  nao_encontrado: HttpStatus.NOT_FOUND,
  conflito: HttpStatus.CONFLICT,
  banco: HttpStatus.BAD_REQUEST,
  externo: HttpStatus.BAD_GATEWAY,
};

const CODIGO_DA_REGRA: Record<TipoDeErro, string> = {
  proibido: 'forbidden',
  invalido: 'invalid_operation',
  nao_encontrado: 'not_found',
  conflito: 'conflict',
  banco: 'db_rejected',
  externo: 'upstream_error',
};

function httpError(status: number): string {
  if (status === 400) return 'bad_request';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  return 'error';
}

/** Erro do body-parser quando o corpo passa do teto (`limit`). */
function ehCorpoGrandeDemais(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const err = e as { type?: unknown; status?: unknown; statusCode?: unknown };
  return (
    err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413
  );
}
