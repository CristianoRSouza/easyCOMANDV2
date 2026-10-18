import { describe, expect, it } from 'vitest';
import * as crypto from 'crypto';
import { SessionThrottlerGuard } from '../src/common/guards/session-throttler.guard';

/**
 * O que este teste protege: toda chamada chega do MESMO servidor (o BFF do Next). Se a cota
 * voltasse a ser por IP, todos os usuários dividiriam uma cota só e um derrubaria o outro com
 * 429. A chave é a sessão (hash do Bearer).
 *
 * Só `getTracker` é exercitado; o guard é montado sem as dependências do Nest, por isso o
 * acesso pelo protótipo (nada aqui toca storage/reflector).
 */
type Tracker = (req: Record<string, unknown>) => Promise<string>;
const getTracker = (SessionThrottlerGuard.prototype as unknown as { getTracker: Tracker }).getTracker;
const guard = Object.create(SessionThrottlerGuard.prototype) as object;
const track = (req: Record<string, unknown>) => getTracker.call(guard, req);
const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

describe('SessionThrottlerGuard — cota por sessão, não por IP', () => {
  it('usa o hash do Bearer como chave', async () => {
    expect(await track({ headers: { authorization: 'Bearer jwt-abc' } })).toBe(`s:${sha('jwt-abc')}`);
  });

  it('duas sessões vindas do MESMO IP (o BFF) não compartilham cota', async () => {
    const ip = '10.0.0.5';
    const a = await track({ headers: { authorization: 'Bearer user-a' }, ip });
    const b = await track({ headers: { authorization: 'Bearer user-b' }, ip });
    expect(a).not.toBe(b);
  });

  it('nunca devolve o token em claro (só o hash)', async () => {
    expect(await track({ headers: { authorization: 'Bearer segredo-em-claro' } })).not.toContain(
      'segredo-em-claro',
    );
  });

  it('anônimo cai no IP — é o que limita login/cadastro contra força bruta', async () => {
    const t = await track({ headers: {}, ips: [], ip: '198.51.100.7' });
    expect(t).not.toMatch(/^s:/);
    expect(t).toContain('198.51.100.7');
  });
});
