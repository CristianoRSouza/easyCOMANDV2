import { describe, expect, it } from 'vitest';
import { resolveCors } from '../src/bootstrap/cors';

describe('resolveCors', () => {
  it('vazio = fechado (nenhum header CORS)', () => {
    expect(resolveCors('')).toEqual({ wildcard: false, options: { origin: false } });
    expect(resolveCors(' , ')).toEqual({ wildcard: false, options: { origin: false } });
  });

  it('`*` libera qualquer origem SEM credenciais', () => {
    expect(resolveCors('*')).toEqual({ wildcard: true, options: { origin: true, credentials: false } });
  });

  it('lista explícita: só ela, com credenciais', () => {
    expect(resolveCors('https://a.com, https://b.com')).toEqual({
      wildcard: false,
      options: { origin: ['https://a.com', 'https://b.com'], credentials: true },
    });
  });
});
