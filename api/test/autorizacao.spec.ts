import { describe, expect, it } from 'vitest';
import { AutorizacaoService } from '../src/common/autorizacao/autorizacao.service';
import { PapeisRepository } from '../src/common/autorizacao/papeis.repository';
import { decisaoPorOverrideDeMenus, papelDoAdmin } from '../src/common/autorizacao/regras';
import { ErroDeRegra } from '../src/common/erros';
import { fakeSupabase, valorDoEq, type Consulta, type Resposta } from './fakes/supabase.fake';

type Cenario = {
  legados?: string[];
  atribuicoes?: Array<{ company_id: string | null; key: string; role_id?: string }>;
  overrides?: Array<{ effect: string; key: string }>;
  permissoesDasRoles?: string[];
};

function montar(c: Cenario) {
  const { db, consultas } = fakeSupabase((q: Consulta): Resposta => {
    if (q.tabela === 'pv_user_roles') return { data: (c.legados ?? []).map((role) => ({ role })) };
    if (q.tabela === 'pv_user_role_assignments') {
      const empresa = valorDoEq(q, 'company_id');
      const linhas = (c.atribuicoes ?? []).filter((a) => empresa === undefined || a.company_id === empresa);
      return { data: linhas.map((a) => ({ company_id: a.company_id, role_id: a.role_id ?? 'r1', pv_roles: { key: a.key } })) };
    }
    if (q.tabela === 'pv_user_permissions') {
      return { data: (c.overrides ?? []).map((o) => ({ effect: o.effect, pv_permissions: { key: o.key } })) };
    }
    if (q.tabela === 'pv_role_permissions') return { data: (c.permissoesDasRoles ?? []).map((key) => ({ pv_permissions: { key } })) };
    return { data: [] };
  });
  return { db, consultas, svc: new AutorizacaoService(new PapeisRepository()) };
}

describe('gates de administrador', () => {
  it('admin LEGADO: system_admin ou tech_admin em pv_user_roles; o RBAC novo não conta', async () => {
    expect(await montar({ legados: ['tech_admin'] }).svc.ehAdminLegado(montar({ legados: ['tech_admin'] }).db, 'u')).toBe(true);
    const s = montar({ atribuicoes: [{ company_id: null, key: 'system_admin' }] });
    expect(await s.svc.ehAdminLegado(s.db, 'u')).toBe(false);
  });

  it('system_admin: legado OU atribuição GLOBAL; atribuição com empresa não vale', async () => {
    const global = montar({ atribuicoes: [{ company_id: null, key: 'system_admin' }] });
    expect(await global.svc.ehSystemAdmin(global.db, 'u')).toBe(true);
    const daEmpresa = montar({ atribuicoes: [{ company_id: 'c1', key: 'system_admin' }] });
    expect(await daEmpresa.svc.ehSystemAdmin(daEmpresa.db, 'u')).toBe(false);
  });

  it('as consultas filtram pelo PRÓPRIO usuário (a RLS deixa admin ver as linhas dos outros)', async () => {
    const s = montar({});
    await s.svc.ehSystemAdmin(s.db, 'eu');
    for (const q of s.consultas) expect(valorDoEq(q, 'user_id')).toBe('eu');
  });

  it('exigirAdminLegado recusa com 403 e o texto de hoje', async () => {
    const s = montar({ legados: ['user'] });
    const erro = await s.svc.exigirAdminLegado(s.db, 'u').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDeRegra);
    expect((erro as ErroDeRegra).tipo).toBe('proibido');
    expect((erro as ErroDeRegra).message).toBe('Permissão negada — requer system_admin.');
  });

  it('company_admin só naquela empresa', async () => {
    const s = montar({ atribuicoes: [{ company_id: 'c1', key: 'company_admin' }] });
    expect(await s.svc.ehCompanyAdmin(s.db, 'u', 'c1')).toBe(true);
    expect(await s.svc.ehCompanyAdmin(s.db, 'u', 'c2')).toBe(false);
  });
});

describe('acesso aos menus (core.menus.manage)', () => {
  it('system_admin entra sem olhar permissão', async () => {
    const s = montar({ legados: ['system_admin'] });
    expect(await s.svc.temAcessoAosMenus(s.db, 'u')).toBe(true);
  });

  it('pela permissão numa role', async () => {
    const s = montar({ atribuicoes: [{ company_id: 'c1', key: 'gerente' }], permissoesDasRoles: ['core.menus.manage'] });
    expect(await s.svc.temAcessoAosMenus(s.db, 'u')).toBe(true);
  });

  it('override DENY vence a role', async () => {
    const s = montar({
      atribuicoes: [{ company_id: 'c1', key: 'gerente' }],
      overrides: [{ effect: 'deny', key: 'core.menus.manage' }],
      permissoesDasRoles: ['core.menus.manage'],
    });
    expect(await s.svc.temAcessoAosMenus(s.db, 'u')).toBe(false);
  });

  it('DEFEITO PRESERVADO: override GRANT direto não libera (o código de hoje procura "allow")', async () => {
    expect(decisaoPorOverrideDeMenus([{ effect: 'grant', permission_key: 'core.menus.manage' }])).toBeNull();
    const s = montar({ overrides: [{ effect: 'grant', key: 'core.menus.manage' }] });
    expect(await s.svc.temAcessoAosMenus(s.db, 'u')).toBe(false);
  });

  it('exigirAcessoAosMenus recusa com o texto de hoje', async () => {
    const s = montar({});
    await expect(s.svc.exigirAcessoAosMenus(s.db, 'u')).rejects.toThrow('Permissão negada — core.menus.manage requerida.');
  });
});

describe('papelDoAdmin', () => {
  it('system_admin vence tech_admin; nenhum dos dois → false', () => {
    expect(papelDoAdmin(['tech_admin', 'system_admin'])).toBe('system_admin');
    expect(papelDoAdmin(['tech_admin'])).toBe('tech_admin');
    expect(papelDoAdmin(['user'])).toBe(false);
  });
});
