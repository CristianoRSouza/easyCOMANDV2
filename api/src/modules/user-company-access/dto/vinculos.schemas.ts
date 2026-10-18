import { z } from 'zod';

const status = z.enum(['pending', 'approved', 'rejected']);

export const ListaDeVinculosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.union([status, z.literal('all')]).default('all'),
  company_id: z.string().uuid().optional(),
  user_query: z.string().max(120).optional(),
});
export type ListaDeVinculos = z.infer<typeof ListaDeVinculosSchema>;

export const BuscaDeUsuariosSchema = z.object({ query: z.string().max(120).default('') });
export type BuscaDeUsuarios = z.infer<typeof BuscaDeUsuariosSchema>;

export const NovoVinculoSchema = z.object({
  user_id: z.string().uuid(),
  company_id: z.string().uuid(),
  status: status.default('approved'),
});
export type NovoVinculo = z.infer<typeof NovoVinculoSchema>;

export const TrocaDeStatusSchema = z.object({ status });
export type TrocaDeStatus = z.infer<typeof TrocaDeStatusSchema>;
