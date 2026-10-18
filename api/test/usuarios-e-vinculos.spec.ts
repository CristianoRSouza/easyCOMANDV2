import { describe, expect, it } from 'vitest';
import { AuditoriaRbac } from '../src/common/auditoria/auditoria-rbac';
import { AutorizacaoService } from '../src/common/autorizacao/autorizacao.service';
import { PapeisRepository } from '../src/common/autorizacao/papeis.repository';
import { filtroEmailOuNome, janela } from '../src/common/consulta';
import type { ServiceRole } from '../src/db/service-role';
import { UsuariosService } from '../src/modules/users/application/usuarios.use-cases';
import { descreverErroDaLista, montarLinhas } from '../src/modules/users/domain/usuarios';
import { UsuariosRepository } from '../src/modules/users/infrastructure/usuarios.repository';
import { VinculosService } from '../src/modules/user-company-access/application/vinculos.use-cases';
import { aprovacaoNaTroca, operacaoDaTroca } from '../src/modules/user-company-access/domain/vinculos';
import { VinculosRepository } from '../src/modules/user-company-access/infrastructure/vinculos.repository';
import { fakeSupabase, type Consulta, type Resposta } from './fakes/supabase.fake';

const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ALVO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Admin legado por padrão; `extra` responde o resto. */
function banco(extra: (c: Consulta) => Resposta | undefined = () => undefined, admin = true) {
  return fakeSupabase((c) => {
    const r = extra(c);
    if (r) return r;
    if (c.tabela === 'pv_user_roles' && c.operacao === 'select') return { data: admin ? [{ role: 'system_admin' }] : [] };
    return { data: [] };
  });
}

const autorizacao = new AutorizacaoService(new PapeisRepository());
const serviceRoleFalso = { run: () => Promise.reject(new Error('não deveria escalar')) } as unknown as ServiceRole;

describe('consulta compartilhada', () => {
  it('busca e-mail OU nome com o termo aparado; vazio não filtra', () => {
    expect(filtroEmailOuNome('  ana ')).toBe('email.ilike.%ana%,full_name.ilike.%ana%');
    expect(filtroEmailOuNome('   ')).toBeNull();
  });
  it('janela inclusiva da página', () => {
    expect(janela(1, 25)).toEqual({ from: 0, to: 24 });
    expect(janela(3, 10)).toEqual({ from: 20, to: 29 });
  });
});

describe('usuários', () => {
  const svc = (db: ReturnType<typeof banco>) => ({
    s: new UsuariosService(autorizacao, new UsuariosRepository(serviceRoleFalso), new AuditoriaRbac()),
    ...db,
  });

  it('lista junta perfis e papéis; o total estimado vem do PostgREST', async () => {
    const { s, db } = svc(
      banco((c) => {
        if (c.tabela === 'pb_profiles') return { data: [{ id: ALVO, email: 'b@x', full_name: 'B', created_at: 't', is_active: true }], count: 41 };
        if (c.tabela === 'pv_user_roles' && c.passos.some((p) => p.metodo === 'in')) return { data: [{ user_id: ALVO, role: 'user' }] };
        return undefined;
      }),
    );
    const r = await s.listar(db, ADMIN, { page: 1, pageSize: 25 });
    expect(r).toEqual({ total: 41, rows: [{ id: ALVO, email: 'b@x', full_name: 'B', created_at: 't', is_active: true, role: 'user' }] });
  });

  it('não-admin legado é recusado antes de qualquer leitura de perfil', async () => {
    const { s, db, consultas } = svc(banco(undefined, false));
    await expect(s.listar(db, ADMIN, { page: 1, pageSize: 25 })).rejects.toThrow('Permissão negada — requer system_admin.');
    expect(consultas.some((c) => c.tabela === 'pb_profiles')).toBe(false);
  });

  it('promover troca o papel (apaga todos e grava system_admin) e audita de→para', async () => {
    const { s, db, consultas } = svc(
      banco((c) => (c.tabela === 'pv_user_roles' && c.operacao === 'select' && c.passos.some((p) => p.args[1] === ALVO) ? { data: [{ role: 'user' }] } : undefined)),
    );
    await s.promover(db, ADMIN, ALVO);
    const escritas = consultas.filter((c) => c.operacao !== 'select');
    expect(escritas.map((c) => `${c.operacao} ${c.tabela}`)).toEqual([
      'delete pv_user_roles',
      'insert pv_user_roles',
      'insert pv_rbac_audit_log',
    ]);
    expect(escritas[1].valores).toEqual({ user_id: ALVO, role: 'system_admin' });
    expect(escritas[2].valores).toMatchObject({ action: 'role_grant', payload: { from_role: 'user', to_role: 'system_admin' } });
  });

  it.each([
    ['rebaixar', 'Você não pode rebaixar sua própria conta de system_admin.'],
    ['excluir', 'Você não pode excluir sua própria conta.'],
  ] as const)('%s a si mesmo é recusado', async (acao, msg) => {
    const { s, db } = svc(banco());
    await expect(s[acao](db, ADMIN, ADMIN)).rejects.toThrow(msg);
  });

  it('desativar a si mesmo é recusado; ATIVAR a si mesmo não', async () => {
    const { s, db } = svc(banco((c) => (c.tabela === 'pb_profiles' && c.operacao === 'update' ? { data: [{ id: ADMIN }] } : undefined)));
    await expect(s.definirAtivo(db, ADMIN, ADMIN, false)).rejects.toThrow('Você não pode desativar sua própria conta.');
    await expect(s.definirAtivo(db, ADMIN, ADMIN, true)).resolves.toEqual({ ok: true });
  });

  it('ativar usuário inexistente → "Usuário não encontrado."', async () => {
    const { s, db } = svc(banco((c) => (c.tabela === 'pb_profiles' && c.operacao === 'update' ? { data: [] } : undefined)));
    await expect(s.definirAtivo(db, ADMIN, ALVO, true)).rejects.toThrow('Usuário não encontrado.');
  });

  it('erro da lista: message | details | hint | code; texto vazio vira a frase de permissões', () => {
    expect(descreverErroDaLista({ message: 'falhou', code: '42501' })).toBe('falhou | code=42501');
    expect(descreverErroDaLista({ message: '{"' })).toBe(
      'Falha ao consultar usuários no Supabase. Verifique permissões da tabela pb_profiles.',
    );
  });

  it('montarLinhas: sem papel → null', () => {
    expect(montarLinhas([{ id: 'x', email: null, full_name: null, created_at: null, is_active: false }], [])[0].role).toBeNull();
  });
});

describe('vínculos usuário ↔ empresa', () => {
  const svc = () => new VinculosService(autorizacao, new VinculosRepository(), new AuditoriaRbac());

  it('busca por usuário sem nenhum perfil casando → lista vazia, sem consultar os vínculos', async () => {
    const { db, consultas } = banco();
    const r = await svc().listar(db, ADMIN, { page: 1, pageSize: 25, status: 'all', user_query: 'ninguem' });
    expect(r).toEqual({ rows: [], total: 0 });
    expect(consultas.some((c) => c.tabela === 'pb_user_company_access')).toBe(false);
  });

  it('criar duplicado → 409 com o texto de hoje', async () => {
    const { db } = banco((c) =>
      c.tabela === 'pb_user_company_access' && c.operacao === 'insert' ? { error: { message: 'dup', code: '23505' } } : undefined,
    );
    await expect(svc().criar(db, ADMIN, { user_id: ALVO, company_id: ALVO, status: 'approved' })).rejects.toThrow(
      'Esse usuário já possui vínculo com essa empresa.',
    );
  });

  it('criar aprovado grava quem/quando aprovou; pendente não', async () => {
    const { db, consultas } = banco((c) => (c.tabela === 'pb_user_company_access' && c.operacao === 'insert' ? { data: { id: 'v1' } } : undefined));
    await svc().criar(db, ADMIN, { user_id: ALVO, company_id: ALVO, status: 'approved' });
    await svc().criar(db, ADMIN, { user_id: ALVO, company_id: ALVO, status: 'pending' });
    const [aprovado, pendente] = consultas.filter((c) => c.operacao === 'insert' && c.tabela === 'pb_user_company_access');
    expect(aprovado.valores).toMatchObject({ approved_by: ADMIN, status: 'approved' });
    expect(pendente.valores).not.toHaveProperty('approved_by');
  });

  it('troca de status: aprovar grava; os outros LIMPAM; op da auditoria por status', () => {
    const agora = new Date('2026-01-01T00:00:00Z');
    expect(aprovacaoNaTroca('approved', 'u', agora)).toEqual({ approved_by: 'u', approved_at: '2026-01-01T00:00:00.000Z' });
    expect(aprovacaoNaTroca('rejected', 'u', agora)).toEqual({ approved_by: null, approved_at: null });
    expect([operacaoDaTroca('approved'), operacaoDaTroca('rejected'), operacaoDaTroca('pending')]).toEqual([
      'activate',
      'deactivate',
      'pending',
    ]);
  });
});
