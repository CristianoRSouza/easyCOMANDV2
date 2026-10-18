import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiDocs, DocSessao, errorSchema } from '../../../common/swagger';

const sessao = {
  type: 'object',
  properties: {
    access_token: { type: 'string' },
    refresh_token: { type: 'string' },
    expires_at: { type: 'integer', description: 'Epoch em segundos.' },
  },
};
const adminUser = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', enum: ['system_admin', 'tech_admin'] },
  },
};

export const DocLogin = () =>
  ApiDocs(
    ApiOperation({
      summary: 'Login com e-mail e senha (só system_admin/tech_admin)',
      description:
        'Pública. Cria a sessão no Supabase e confere o papel em `pv_user_roles`. Quem não é da equipe técnica ' +
        'tem a sessão encerrada na hora e recebe 403 "Acesso restrito à equipe técnica EasySoft.".',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string' }, password: { type: 'string' } },
      },
    }),
    ApiResponse({ status: 200, schema: { type: 'object', properties: { session: sessao, user: adminUser } } }),
    ApiResponse({ status: 400, description: 'Credencial recusada (texto do Supabase).', schema: errorSchema(['auth_failed'], 'Invalid login credentials', 400) }),
    ApiResponse({ status: 403, schema: errorSchema(['access_denied'], 'Acesso restrito à equipe técnica EasySoft.', 403) }),
  );

export const DocRefresh = () =>
  ApiDocs(
    ApiOperation({ summary: 'Renova a sessão com o refresh token', description: 'Pública (roda justamente quando o access token venceu).' }),
    ApiBody({ schema: { type: 'object', required: ['refresh_token'], properties: { refresh_token: { type: 'string' } } } }),
    ApiResponse({ status: 200, schema: { type: 'object', properties: { session: sessao } } }),
    ApiResponse({ status: 401, schema: errorSchema(['unauthorized'], 'Sessão inválida ou expirada. Faça login novamente.', 401) }),
    ApiResponse({ status: 503, schema: errorSchema(['auth_unavailable'], 'Não foi possível renovar a sessão agora. Tente novamente.', 503) }),
  );

export const DocLogout = () =>
  DocSessao('Encerra a sessão (escopo global, como o signOut de hoje)', undefined, ApiResponse({ status: 204 }));

export const DocMe = () =>
  DocSessao(
    'Revalida o administrador da sessão',
    '403 quando o usuário deixou de ser admin (a sessão é encerrada); 503 quando a leitura do papel falhou.',
    ApiResponse({ status: 200, schema: { type: 'object', properties: { user: adminUser } } }),
  );
