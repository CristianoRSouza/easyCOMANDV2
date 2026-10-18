import { DocSessao } from '../../../common/swagger';

/**
 * Documentação das rotas do RBAC, agrupada pelo GATE — é a informação que mais importa a quem lê
 * o Swagger (e a que mais varia de rota para rota).
 */
export const D = {
  listaSemGate: (summary: string) =>
    DocSessao(summary, 'Sem gate na aplicação, como hoje: o que aparece é decidido pela RLS do Supabase.'),
  catalogo: (summary: string) =>
    DocSessao(summary, 'Exige system_admin (legado ou global do RBAC novo); senão 403 "Permissão negada".'),
  gestao: (summary: string) =>
    DocSessao(
      summary,
      'system_admin, ou company_admin da empresa da linha (role global: só system_admin). Recusa com 403.',
    ),
  qualquer: (summary: string) => DocSessao(summary, 'Qualquer usuário autenticado.'),
};
