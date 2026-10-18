import { z } from 'zod';
import { PERMISSION_KEY_REGEX } from '../domain/rbac';

/** Os MESMOS limites do `Input` de `rbac.functions.ts`, ação a ação. */

const scope = z.enum(['global', 'company', 'store']);
const effect = z.enum(['grant', 'deny']);
const uuidOpcionalNulo = z.string().uuid().nullable().optional();

export const ModuloSchema = z.object({
  key: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(500).nullable().optional(),
  version: z.string().max(32).default('1.0.0'),
  is_active: z.boolean().default(true),
});
export type ModuloInput = z.infer<typeof ModuloSchema>;

export const PermissaoSchema = z.object({
  key: z.string().regex(PERMISSION_KEY_REGEX, 'Formato inválido (use module.action ou module.*)'),
  module_key: z.string().min(1),
  scope,
  description: z.string().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
});
export type PermissaoInput = z.infer<typeof PermissaoSchema>;

export const RoleSchema = z.object({
  key: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(500).nullable().optional(),
  scope,
  permission_ids: z.array(z.string().uuid()).default([]),
});
export type RoleInput = z.infer<typeof RoleSchema>;

export const DuplicarRoleSchema = z.object({
  new_key: z.string().min(1).max(64),
  new_name: z.string().min(1).max(128),
});
export type DuplicarRoleInput = z.infer<typeof DuplicarRoleSchema>;

export const FiltroDeAtribuicoesSchema = z.object({
  user_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
});
export type FiltroDeAtribuicoes = z.infer<typeof FiltroDeAtribuicoesSchema>;

export const AtribuicaoSchema = z.object({
  user_id: z.string().uuid(),
  role_id: z.string().uuid(),
  company_id: uuidOpcionalNulo,
  store_id: uuidOpcionalNulo,
});
export type AtribuicaoInput = z.infer<typeof AtribuicaoSchema>;

export const BuscaSchema = z.object({ query: z.string().max(120).default('') });
export type BuscaInput = z.infer<typeof BuscaSchema>;

export const LojasSchema = z.object({ company_id: z.string().uuid().optional() });
export type LojasInput = z.infer<typeof LojasSchema>;

export const FiltroDeOverridesSchema = z.object({
  user_id: z.string().uuid(),
  company_id: z.string().uuid().optional(),
});
export type FiltroDeOverrides = z.infer<typeof FiltroDeOverridesSchema>;

export const OverrideSchema = z.object({
  user_id: z.string().uuid(),
  permission_id: z.string().uuid(),
  effect,
  company_id: uuidOpcionalNulo,
  store_id: uuidOpcionalNulo,
});
export type OverrideInput = z.infer<typeof OverrideSchema>;

export const AuditoriaSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  entity: z.string().optional(),
  actor_id: z.string().uuid().optional(),
});
export type AuditoriaInput = z.infer<typeof AuditoriaSchema>;

export const AcessoNegadoSchema = z.object({
  path: z.string().max(200).default('/rbac'),
  attempted_role: z.string().max(64).nullable().optional(),
});
export type AcessoNegadoInput = z.infer<typeof AcessoNegadoSchema>;

export const ContagemDeNegadosSchema = z.object({ hours: z.coerce.number().int().min(1).max(168).default(24) });
export type ContagemDeNegados = z.infer<typeof ContagemDeNegadosSchema>;

export const MinhasPermissoesSchema = z.object({ company_id: z.string().uuid().optional() });
export type MinhasPermissoes = z.infer<typeof MinhasPermissoesSchema>;
