import { z } from 'zod';

export const AtividadeSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(200).optional(),
});
export type AtividadeInput = z.infer<typeof AtividadeSchema>;

export const EcpSchema = z.object({
  company_id: z.string().uuid(),
  source: z.enum(['all', 'totem', 'agent', 'activity']).default('all'),
  action: z.string().max(64).default('all'),
  user: z.string().max(200).optional(),
  /** Início do período, já calculado no fuso do navegador (como hoje). */
  from: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type EcpInput = z.infer<typeof EcpSchema>;

export const FiltrosDePermissaoSchema = z.object({
  from_iso: z.string().datetime({ offset: true }),
  to_iso: z.string().datetime({ offset: true }),
  actor_email: z.string().max(200).optional(),
  action: z.string().max(200).optional(),
  target_table: z.string().max(200).optional(),
  source: z.string().max(64).optional(),
});

export const ListaDePermissoesSchema = FiltrosDePermissaoSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListaDePermissoes = z.infer<typeof ListaDePermissoesSchema>;
export type FiltrosDePermissaoInput = z.infer<typeof FiltrosDePermissaoSchema>;
