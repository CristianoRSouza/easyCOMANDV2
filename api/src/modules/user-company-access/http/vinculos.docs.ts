import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { DocSessao } from '../../../common/swagger';

const GATE =
  'Exige system_admin (legado `pv_user_roles` ou atribuição global do RBAC novo); senão 403 "Permissão negada — requer system_admin.".';
const STATUS = { type: 'string', enum: ['pending', 'approved', 'rejected'] };

export const DocListar = () =>
  DocSessao(
    'Lista vínculos (paginado), com e-mail/nome do usuário e nome da empresa',
    GATE,
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'pageSize', required: false, type: Number }),
    ApiQuery({ name: 'status', required: false, enum: ['all', 'pending', 'approved', 'rejected'] }),
    ApiQuery({ name: 'company_id', required: false, type: String }),
    ApiQuery({ name: 'user_query', required: false, type: String }),
  );

export const DocEmpresas = () => DocSessao('Todas as empresas (id, nome), por nome', GATE);

export const DocUsuarios = () =>
  DocSessao('Busca usuários (até 100) por e-mail ou nome', GATE, ApiQuery({ name: 'query', required: false, type: String }));

export const DocCriar = () =>
  DocSessao(
    'Cria um vínculo (409 se já existir para o par usuário/empresa)',
    GATE,
    ApiBody({
      schema: {
        type: 'object',
        required: ['user_id', 'company_id'],
        properties: { user_id: { type: 'string' }, company_id: { type: 'string' }, status: STATUS },
      },
    }),
  );

export const DocStatus = () =>
  DocSessao('Troca o status (aprovar grava quem/quando; os outros limpam)', GATE, ApiBody({ schema: { type: 'object', properties: { status: STATUS } } }));

export const DocExcluir = () => DocSessao('Remove o vínculo', GATE);
