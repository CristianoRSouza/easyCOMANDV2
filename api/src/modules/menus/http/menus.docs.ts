import { DocSessao } from '../../../common/swagger';

export const DocLeitura = (summary: string) =>
  DocSessao(summary, 'Sem gate na aplicação, como hoje (RLS decide).');

export const DocEscrita = (summary: string) =>
  DocSessao(
    summary,
    'Exige system_admin ou a permissão `core.menus.manage`; senão 403 "Permissão negada — core.menus.manage requerida.". ' +
      'Permissão exigida inexistente ou fora do formato → 400.',
  );
