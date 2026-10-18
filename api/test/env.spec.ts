import { describe, expect, it } from 'vitest';
import { loadEnv, segredosAusentes } from '../src/config/env';

/**
 * O ambiente é o contrato com o cofre (o MESMO do EasyControl atual). Nome ou default que mude
 * aqui muda o comportamento da produção sem nenhuma linha de negócio mudar.
 */

const MINIMO = {
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_falsa',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-falsa',
};

describe('loadEnv — fail-fast', () => {
  it('sobe com o mínimo e aplica os defaults', () => {
    const env = loadEnv({ ...MINIMO });
    expect(env.PORT).toBe(3030);
    expect(env.API_PREFIX).toBe('api/v1');
    expect(env.CORS_ORIGIN).toBe(''); // fechado: quem chama é o servidor do Next
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.STRIPE_SECRET_KEY_TEST).toBe('');
    expect(env.STRIPE_SECRET_KEY_LIVE).toBe('');
  });

  it('PIX_WEBHOOK_API_URL vazia cai na EasyERP-API de produção, como o client.ts de hoje', () => {
    expect(loadEnv({ ...MINIMO }).PIX_WEBHOOK_API_URL).toBe('https://webhook-easyerp.easysoftcloud.com.br/api/v1');
    expect(loadEnv({ ...MINIMO, PIX_WEBHOOK_API_URL: '   ' }).PIX_WEBHOOK_API_URL).toBe(
      'https://webhook-easyerp.easysoftcloud.com.br/api/v1',
    );
    expect(loadEnv({ ...MINIMO, PIX_WEBHOOK_API_URL: 'https://hom.exemplo/api/v1' }).PIX_WEBHOOK_API_URL).toBe(
      'https://hom.exemplo/api/v1',
    );
  });

  it.each(Object.keys(MINIMO))('sem %s a API não sobe', (nome) => {
    const fonte: Record<string, string> = { ...MINIMO };
    delete fonte[nome];
    expect(() => loadEnv(fonte)).toThrow(nome);
  });

  it('a mensagem de erro nomeia a variável, nunca ecoa o valor', () => {
    const segredo = 'valor-que-nao-pode-vazar';
    try {
      loadEnv({ ...MINIMO, SUPABASE_URL: segredo });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toMatch(/SUPABASE_URL/);
      expect((e as Error).message).not.toContain(segredo);
    }
  });
});

describe('segredosAusentes', () => {
  it('lista por NOME as chaves do Stripe que faltam', () => {
    const faltando = segredosAusentes(loadEnv({ ...MINIMO }));
    expect(faltando.join(' ')).toContain('STRIPE_SECRET_KEY_LIVE');
    expect(faltando.join(' ')).toContain('STRIPE_SECRET_KEY_TEST');
  });

  it('nada falta com as duas chaves', () => {
    const env = loadEnv({ ...MINIMO, STRIPE_SECRET_KEY_TEST: 'sk_test_x', STRIPE_SECRET_KEY_LIVE: 'sk_live_x' });
    expect(segredosAusentes(env)).toEqual([]);
  });
});
