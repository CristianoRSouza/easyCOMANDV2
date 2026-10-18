import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { DocSessao } from '../../../common/swagger';

const GATE = 'Exige `pv_user_roles` system_admin/tech_admin (403 "Permissão negada — requer system_admin.").';

export const DocListar = () =>
  DocSessao(
    'Lista usuários (pb_profiles + papel legado), paginado',
    GATE,
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'pageSize', required: false, type: Number }),
    ApiQuery({ name: 'query', required: false, type: String, description: 'Busca por e-mail ou nome.' }),
  );

export const DocPromover = () => DocSessao('Promove a system_admin (troca o papel legado)', GATE);

export const DocRebaixar = () =>
  DocSessao('Rebaixa a user', `${GATE} Não vale para a própria conta.`);

export const DocAtivo = () =>
  DocSessao(
    'Ativa/desativa a conta (pb_profiles.is_active)',
    `${GATE} Não dá para desativar a própria conta.`,
    ApiBody({ schema: { type: 'object', required: ['is_active'], properties: { is_active: { type: 'boolean' } } } }),
  );

export const DocExcluir = () =>
  DocSessao('Exclui de vez (Auth + papéis + perfil)', `${GATE} Usa a service_role (motivo \`usuario-exclusao\`).`);
