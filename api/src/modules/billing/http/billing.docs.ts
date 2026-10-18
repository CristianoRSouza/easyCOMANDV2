import { DocSessao } from '../../../common/swagger';

export const D = {
  rls: (summary: string) =>
    DocSessao(summary, 'Sem gate na aplicação: a RLS do schema `billing` decide, como hoje (as telas consultavam direto do navegador).'),
  stripe: (summary: string) =>
    DocSessao(summary, 'Fala com o Stripe (ou com a Edge Function) em nome do usuário. Falha externa → 502 com o texto do erro.'),
};
