import { invalido } from '../../../common/erros';

/**
 * Regras puras da tela "Usuários" — `easyCONTROL/src/lib/users/users.functions.ts`.
 */

export type PapelDoUsuario = 'system_admin' | 'tech_admin' | 'company_admin' | 'user' | null;

/** Linha da tabela, campo a campo como hoje (`UserRow`). */
export interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: PapelDoUsuario;
  created_at: string | null;
  is_active: boolean;
}

export type PerfilLinha = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  is_active: boolean;
};

export type PapelLinha = { user_id: string; role: string };

/**
 * Junta perfis e papéis. Com mais de um papel para o mesmo usuário, vence o ÚLTIMO lido — o
 * `Map.set` de hoje sobrescreve na ordem em que o PostgREST devolve.
 */
export function montarLinhas(perfis: PerfilLinha[], papeis: PapelLinha[]): UserRow[] {
  const porUsuario = new Map<string, PapelDoUsuario>();
  for (const p of papeis) porUsuario.set(p.user_id, p.role as PapelDoUsuario);
  return perfis.map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    created_at: p.created_at,
    is_active: p.is_active,
    role: porUsuario.get(p.id) ?? null,
  }));
}

export function naoPodeRebaixarASiMesmo(alvo: string, ator: string): void {
  if (alvo === ator) throw invalido('Você não pode rebaixar sua própria conta de system_admin.');
}

export function naoPodeDesativarASiMesmo(alvo: string, ator: string, ativo: boolean): void {
  if (alvo === ator && !ativo) throw invalido('Você não pode desativar sua própria conta.');
}

export function naoPodeExcluirASiMesmo(alvo: string, ator: string): void {
  if (alvo === ator) throw invalido('Você não pode excluir sua própria conta.');
}

type ErroDeConsulta = { message?: string; details?: string; hint?: string; code?: string };

/**
 * `formatSupabaseError` de hoje: junta message/details/hint/code; texto vazio (ou o `{"` que o
 * PostgREST às vezes devolve) vira a frase sobre as permissões de `pb_profiles`.
 */
export function descreverErroDaLista(erro: ErroDeConsulta): string {
  const partes = [erro.message, erro.details, erro.hint, erro.code && `code=${erro.code}`].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  const texto = partes.join(' | ').trim();
  if (!texto || texto === '{"' || texto === '{') {
    return 'Falha ao consultar usuários no Supabase. Verifique permissões da tabela pb_profiles.';
  }
  return texto;
}
