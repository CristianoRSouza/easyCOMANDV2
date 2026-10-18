/**
 * Regras puras da tela "Vínculos usuário ↔ empresa" —
 * `easyCONTROL/src/lib/user-company-access/user-company-access.functions.ts`.
 */

export type StatusDoVinculo = 'pending' | 'approved' | 'rejected';

export interface VinculoLinha {
  id: string;
  user_id: string;
  company_id: string;
  status: StatusDoVinculo;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

/** `UcaRow` de hoje: a linha + e-mail/nome do usuário + nome da empresa. */
export interface UcaRow extends VinculoLinha {
  user_email: string | null;
  user_full_name: string | null;
  company_name: string | null;
}

export type PerfilResumo = { id: string; email: string | null; full_name: string | null };
export type EmpresaResumo = { id: string; name: string | null };

export function enriquecer(linhas: VinculoLinha[], perfis: PerfilResumo[], empresas: EmpresaResumo[]): UcaRow[] {
  const porPerfil = new Map(perfis.map((p) => [p.id, p]));
  const porEmpresa = new Map(empresas.map((c) => [c.id, c]));
  return linhas.map((r) => ({
    ...r,
    user_email: porPerfil.get(r.user_id)?.email ?? null,
    user_full_name: porPerfil.get(r.user_id)?.full_name ?? null,
    company_name: porEmpresa.get(r.company_id)?.name ?? null,
  }));
}

/**
 * Campos de aprovação ao CRIAR: só um vínculo nascido `approved` grava quem aprovou e quando.
 */
export function aprovacaoNaCriacao(status: StatusDoVinculo, ator: string, agora: Date): Record<string, unknown> {
  return status === 'approved' ? { approved_by: ator, approved_at: agora.toISOString() } : {};
}

/** Ao TROCAR o status: aprovar grava quem/quando; qualquer outro status LIMPA os dois. */
export function aprovacaoNaTroca(status: StatusDoVinculo, ator: string, agora: Date): Record<string, unknown> {
  return status === 'approved'
    ? { approved_by: ator, approved_at: agora.toISOString() }
    : { approved_by: null, approved_at: null };
}

/** `op` da auditoria na troca de status (activate / deactivate / pending). */
export function operacaoDaTroca(status: StatusDoVinculo): 'activate' | 'deactivate' | 'pending' {
  if (status === 'approved') return 'activate';
  if (status === 'rejected') return 'deactivate';
  return 'pending';
}

export const MSG_VINCULO_DUPLICADO = 'Esse usuário já possui vínculo com essa empresa.';

/** Os ids distintos, na ordem em que aparecem. */
export const distintos = (ids: string[]) => Array.from(new Set(ids));
