import { Inject, Injectable, Optional } from '@nestjs/common';
import { ErroDeRegra } from '../../../common/erros';
import { ENV, type Env } from '../../../config/env';
import type { PrecoStripe, StripeMode } from '../domain/billing';

/** Token de injeção opcional: `fetch` alternativo para os testes (sem rede). */
export const FETCH_DO_STRIPE = Symbol('FETCH_DO_STRIPE');

/**
 * Leitura dos preços ATIVOS do Stripe — `listAllStripePrices` de `stripe-sync.functions.ts`,
 * pela API REST (como hoje: sem SDK), com o produto expandido, em páginas de 100, até 20 páginas.
 */
@Injectable()
export class StripePrecosGateway {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Optional() @Inject(FETCH_DO_STRIPE) private readonly fetchFn?: typeof fetch,
  ) {}

  /** Mesma mensagem de hoje quando a chave do modo não está no cofre. */
  chave(modo: StripeMode): string {
    const chave = modo === 'sandbox' ? this.env.STRIPE_SECRET_KEY_TEST : this.env.STRIPE_SECRET_KEY_LIVE;
    if (!chave) {
      throw new ErroDeRegra(
        `Stripe secret key not configured for mode "${modo}". ` +
          `Set ${modo === 'sandbox' ? 'STRIPE_SECRET_KEY_TEST' : 'STRIPE_SECRET_KEY_LIVE'}.`,
        'externo',
      );
    }
    return chave;
  }

  async precosAtivos(chave: string): Promise<PrecoStripe[]> {
    const fetchFn = this.fetchFn ?? fetch;
    const precos: PrecoStripe[] = [];
    let depoisDe: string | undefined;
    for (let i = 0; i < 20; i++) {
      const params = new URLSearchParams({ limit: '100', active: 'true', 'expand[]': 'data.product' });
      if (depoisDe) params.set('starting_after', depoisDe);
      const res = await fetchFn(`https://api.stripe.com/v1/prices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${chave}` },
      });
      if (!res.ok) {
        throw new ErroDeRegra(`Stripe API ${res.status}: ${await res.text()}`, 'externo');
      }
      const json = (await res.json()) as { data: PrecoStripe[]; has_more: boolean };
      precos.push(...json.data);
      if (!json.has_more || json.data.length === 0) break;
      depoisDe = json.data[json.data.length - 1].id;
    }
    return precos;
  }
}
