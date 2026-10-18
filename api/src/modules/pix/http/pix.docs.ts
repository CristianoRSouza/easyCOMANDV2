import { DocSessao } from '../../../common/swagger';

export const D = {
  rls: (summary: string) => DocSessao(summary, 'Sem gate na aplicação: a RLS do Supabase decide, como hoje.'),
  admin: (summary: string) =>
    DocSessao(
      summary,
      'Exige `pv_user_roles` system_admin/tech_admin (403 "Permissão negada — requer system_admin."). Lê o schema `webhook` com a service_role (motivo `pix-eventos`).',
    ),
  easyerp: (summary: string) =>
    DocSessao(
      summary,
      'Repassa à EasyERP-API com o JWT do usuário (PIX_WEBHOOK_API_URL). Erros vêm com `error` = código da EasyERP-API ' +
        '(ex.: `credentials_ambiguous`, com `details.company_ids`). 401 de lá vira 502 aqui.',
    ),
};
