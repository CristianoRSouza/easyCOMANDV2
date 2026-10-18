import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as crypto from 'crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { extrairBearer } from './auth.guard';

/** O pouco da requisição que a chave de contagem lê — este guard roda antes de tudo. */
type RequisicaoRastreavel = { headers?: IncomingHttpHeaders };

/**
 * Rate-limit contado por SESSÃO, não por IP.
 *
 * Por que: TODA chamada chega do servidor do Next (BFF), então pelo IP de origem todos os
 * usuários seriam o mesmo cliente e dividiriam uma cota só — o primeiro a abrir o dashboard
 * derrubaria os outros com 429. A sessão é o que separa um usuário do outro.
 *
 * Chave de contagem, em ordem:
 *   1. `Authorization: Bearer <jwt>` → `s:<sha256(jwt)>`
 *   2. Anônimo (login, cadastro, webhook) → IP (comportamento do pai)
 *
 * ⚠️ Este guard roda ANTES do AuthGuard (ordem em `app.module.ts`), então o JWT ainda não foi
 * verificado: a chave sai do token CRU. Isso é proposital e seguro — o valor só serve de chave
 * de contagem, nunca de credencial; um token forjado conta na própria cota e morre no 401 logo
 * depois. O hash existe para não deixar o JWT em memória de métrica.
 *
 * Efeito colateral: o access token é renovado pelo BFF a cada ~1 h, e cada token novo começa
 * uma cota nova. Para uma janela de 60 s isso é irrelevante.
 *
 * ⚠️ Anônimo por IP só protege de verdade se o IP for o do NAVEGADOR — e quem conecta aqui é o
 * Next. O BFF precisa repassar o IP do cliente em `X-Forwarded-For` (e o `trust proxy` do
 * main.ts precisa bater com o número de saltos). Pendente para o módulo `auth`.
 */
@Injectable()
export class SessionThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequisicaoRastreavel): Promise<string> {
    const token = extrairBearer(req.headers?.authorization);
    if (token) return `s:${sha256(token)}`;
    return super.getTracker(req as Record<string, unknown>);
  }
}

function sha256(v: string): string {
  return crypto.createHash('sha256').update(v).digest('hex');
}
