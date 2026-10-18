import { describe, expect, it } from 'vitest';
import { AuditoriaRbac } from '../src/common/auditoria/auditoria-rbac';
import { AutorizacaoService } from '../src/common/autorizacao/autorizacao.service';
import { PapeisRepository } from '../src/common/autorizacao/papeis.repository';
import { ErroDeRegra } from '../src/common/erros';
import { MenusService } from '../src/modules/menus/application/menus.use-cases';
import { normalizarPermissaoExigida, ordemDeExclusao, papelExigido } from '../src/modules/menus/domain/menus';
import { MenusRepository } from '../src/modules/menus/infrastructure/menus.repository';
import { RbacService } from '../src/modules/rbac/application/rbac.use-cases';
import {
  PERMISSION_KEY_REGEX,
  conferirAtribuicao,
  conferirEdicaoDeRoleDeSistema,
  contar,
  permissoesPorRole,
} from '../src/modules/rbac/domain/rbac';
import { RbacRepository } from '../src/modules/rbac/infrastructure/rbac.repository';
import { fakeSupabase, valorDoEq, type Consulta, type Resposta } from './fakes/supabase.fake';

const EU = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const autorizacao = new AutorizacaoService(new PapeisRepository());

function banco(admin: boolean, extra: (c: Consulta) => Resposta | undefined = () => undefined) {
  return fakeSupabase((c) => {
    const r = extra(c);
    if (r) return r;
    if (c.tabela === 'pv_user_roles') return { data: admin ? [{ role: 'system_admin' }] : [] };
    return { data: [] };
  });
}

const tipo = async (p: Promise<unknown>) => ((await p.catch((e: unknown) => e)) as ErroDeRegra).tipo;

describe('RBAC — regras', () => {
  it('chave de permissão: módulo.ação, módulo.* ou *', () => {
    for (const ok of ['core.menus.manage', 'billing.*', '*']) expect(PERMISSION_KEY_REGEX.test(ok)).toBe(true);
    for (const ruim of ['Core.menus', 'menus', 'a..b', 'a.b c']) expect(PERMISSION_KEY_REGEX.test(ruim)).toBe(false);
  });

  it('role de sistema: key e name congelados', () => {
    expect(() => conferirEdicaoDeRoleDeSistema({ key: 'k', name: 'n', is_system: true }, { key: 'k', name: 'outro' })).toThrow(
      'Roles de sistema não podem ter key ou name alterados.',
    );
    expect(() => conferirEdicaoDeRoleDeSistema({ key: 'k', name: 'n', is_system: true }, { key: 'k', name: 'n' })).not.toThrow();
  });

  it('atribuição por quem não é system_admin: nunca global, só na própria empresa', async () => {
    const naoEhAdmin = async () => false;
    await expect(conferirAtribuicao({ scope: 'global' }, 'c1', false, naoEhAdmin)).rejects.toThrow(
      'Apenas system_admin pode atribuir roles globais.',
    );
    await expect(conferirAtribuicao({ scope: 'company' }, 'c1', false, naoEhAdmin)).rejects.toThrow(
      'Você só pode atribuir roles na sua empresa.',
    );
    await expect(conferirAtribuicao({ scope: 'company' }, null, true, naoEhAdmin)).rejects.toThrow(
      'Empresa é obrigatória para roles de escopo company/store.',
    );
    await expect(conferirAtribuicao(null, 'c1', true, naoEhAdmin)).rejects.toThrow('Role inexistente');
    await expect(conferirAtribuicao({ scope: 'store' }, 'c1', false, async () => true)).resolves.toBeUndefined();
  });

  it('contagens e agrupamento de permissões por role', () => {
    expect(Object.fromEntries(contar(['a', 'a', null, 'b']))).toEqual({ a: 2, b: 1 });
    expect(
      permissoesPorRole([
        { role_id: 'r', permission_id: 'p1', key: 'x.a' },
        { role_id: 'r', permission_id: 'p2', key: 'x.b' },
      ]).get('r'),
    ).toEqual({ ids: ['p1', 'p2'], keys: ['x.a', 'x.b'] });
  });
});

describe('RBAC — casos de uso', () => {
  const svc = () => new RbacService(autorizacao, new RbacRepository(), new AuditoriaRbac());

  it('escrita de catálogo sem system_admin → 403 "Permissão negada"', async () => {
    const { db } = banco(false);
    const erro = (await svc()
      .salvarModulo(db, EU, undefined, { key: 'k', name: 'n', version: '1.0.0', is_active: true })
      .catch((e: unknown) => e)) as ErroDeRegra;
    expect(erro.tipo).toBe('proibido');
    expect(erro.message).toBe('Permissão negada');
  });

  it('módulo com chave repetida → "Já existe um módulo com a chave …"', async () => {
    const { db } = banco(true, (c) => (c.tabela === 'pv_modules' && c.operacao === 'insert' ? { error: { message: 'dup', code: '23505' } } : undefined));
    await expect(svc().salvarModulo(db, EU, undefined, { key: 'core', name: 'n', version: '1', is_active: true })).rejects.toThrow(
      'Já existe um módulo com a chave "core".',
    );
  });

  it('permissão vinculada a role não pode ser excluída', async () => {
    const { db } = banco(true, (c) => (c.tabela === 'pv_role_permissions' ? { data: [{ role_id: 'r' }] } : undefined));
    await expect(svc().excluirPermissao(db, EU, 'p')).rejects.toThrow(
      'Permissão está vinculada a uma ou mais roles. Remova os vínculos antes de excluir.',
    );
  });

  it('role de sistema não pode ser excluída', async () => {
    const { db } = banco(true, (c) => (c.tabela === 'pv_roles' ? { data: { is_system: true } } : undefined));
    expect(await tipo(svc().excluirRole(db, EU, 'r'))).toBe('invalido');
  });

  it('editar role apaga os vínculos e grava os novos, nessa ordem', async () => {
    const { db, consultas } = banco(true, (c) =>
      c.tabela === 'pv_roles' && c.operacao === 'select' ? { data: { key: 'k', name: 'n', is_system: false } } : undefined,
    );
    await svc().editarRole(db, EU, 'r1', { key: 'k', name: 'n', scope: 'company', permission_ids: ['p1', 'p2'] });
    expect(consultas.filter((c) => c.tabela === 'pv_role_permissions').map((c) => c.operacao)).toEqual(['delete', 'insert']);
  });

  it('revogar atribuição GLOBAL por company_admin → 403', async () => {
    const { db } = banco(false, (c) =>
      c.tabela === 'pv_user_role_assignments' && valorDoEq(c, 'id') === 'a1'
        ? { data: { id: 'a1', company_id: 'c1', pv_roles: { scope: 'global', key: 'x' } } }
        : c.tabela === 'pv_user_role_assignments'
          ? { data: [{ company_id: 'c1', role_id: 'r', pv_roles: { key: 'company_admin' } }] }
          : undefined,
    );
    expect(await tipo(svc().revogar(db, EU, 'a1'))).toBe('proibido');
  });

  it('registrar o próprio acesso negado não exige papel', async () => {
    const { db, consultas } = banco(false);
    await svc().registrarNegado(db, EU, { path: '/rbac', attempted_role: null });
    expect(consultas.find((c) => c.tabela === 'pv_rbac_audit_log')?.valores).toMatchObject({
      action: 'access_denied',
      entity: 'route',
      actor_id: EU,
    });
  });

  it('empresas sem nome viram "—"', async () => {
    const { db } = banco(true, (c) => (c.tabela === 'pv_companies' ? { data: [{ id: 'c', name: null }] } : undefined));
    expect(await svc().empresas(db)).toEqual([{ id: 'c', name: '—' }]);
  });
});

describe('menus', () => {
  const svc = () => new MenusService(autorizacao, new MenusRepository(), new AuditoriaRbac());

  it('papel "all" é ausência de exigência', () => {
    expect(papelExigido('all')).toBeNull();
    expect(papelExigido('company_admin')).toBe('company_admin');
  });

  it('permissão exigida: vazia → null; fora do formato → erro com o texto de hoje', () => {
    expect(normalizarPermissaoExigida('  ')).toBeNull();
    expect(normalizarPermissaoExigida(' core.menus.manage ')).toBe('core.menus.manage');
    expect(() => normalizarPermissaoExigida('Core')).toThrow("Formato inválido — use 'modulo.recurso.acao'");
  });

  it('permissão inexistente é recusada antes de gravar', async () => {
    const { db, consultas } = banco(true);
    await expect(
      svc().salvarMenu(db, EU, undefined, { name: 'M', module: 'core', display_order: 0, is_active: true, required_permission: 'core.x.y' }),
    ).rejects.toThrow('Permissão "core.x.y" inexistente — crie em /rbac → Permissões antes de usá-la aqui.');
    expect(consultas.some((c) => c.tabela === 'pb_menus')).toBe(false);
  });

  it('excluir menu: netos, depois raízes, depois o menu', async () => {
    expect(ordemDeExclusao([{ id: 'r', parent_submenu_id: null }, { id: 'f', parent_submenu_id: 'r' }])).toEqual({
      filhos: ['f'],
      raizes: ['r'],
    });
    const { db, consultas } = banco(true, (c) =>
      c.tabela === 'pb_submenus' && c.operacao === 'select'
        ? { data: [{ id: 'r', parent_submenu_id: null }, { id: 'f', parent_submenu_id: 'r' }] }
        : undefined,
    );
    await svc().excluirMenu(db, EU, 'm1');
    const deletes = consultas.filter((c) => c.operacao === 'delete').map((c) => `${c.tabela}:${JSON.stringify(c.passos.at(-1)?.args)}`);
    expect(deletes).toEqual(['pb_submenus:["id",["f"]]', 'pb_submenus:["id",["r"]]', 'pb_menus:["id","m1"]']);
  });

  it('escrita sem acesso → 403 com o texto de hoje', async () => {
    const { db } = banco(false);
    await expect(svc().reordenarMenus(db, EU, [{ id: 'm', display_order: 1 }])).rejects.toThrow(
      'Permissão negada — core.menus.manage requerida.',
    );
  });
});
