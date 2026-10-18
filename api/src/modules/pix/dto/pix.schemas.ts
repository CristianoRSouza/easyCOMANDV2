import { z } from 'zod';

const environment = z.enum(['homologacao', 'producao']);
const pixType = z.enum(['recebimento', 'cobranca', 'deposito', 'devolucao', 'retirada']);

/** `save` de `credentials.functions.ts`, mesmos limites. */
export const SalvarCredencialSchema = z.object({
  store_id: z.string().uuid(),
  company_id: z.string().uuid(),
  environment,
  api_base_url: z.string().trim().max(300).optional(),
  basic_user: z.string().trim().max(200).optional(),
  basic_token: z.string().trim().max(2000).optional(),
  secret_key: z.string().trim().max(2000).optional(),
  insecure_tls: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export type SalvarCredencialInput = z.infer<typeof SalvarCredencialSchema>;

export const ChaveDeCredencialSchema = z.object({
  store_id: z.string().uuid(),
  company_id: z.string().uuid(),
  environment,
});
export type ChaveDeCredencial = z.infer<typeof ChaveDeCredencialSchema>;

export const ResumoDeEventosSchema = z.object({
  endpoint_id: z.string().uuid().optional(),
  store_id: z.string().uuid().optional(),
  environment: z.string().optional(),
});
export type ResumoDeEventos = z.infer<typeof ResumoDeEventosSchema>;

export const FeedSchema = ResumoDeEventosSchema.extend({
  pix_type: z.string().optional(),
  outcome: z.string().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(5).max(100).optional(),
});
export type FeedInput = z.infer<typeof FeedSchema>;

export const ListaDeEndpointsSchema = z.object({
  store_id: z.string().optional(),
  apenas_ativos: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export type ListaDeEndpoints = z.infer<typeof ListaDeEndpointsSchema>;

export const RegistrarEndpointSchema = z.object({
  store_id: z.string().min(1),
  environment,
  pix_type: pixType,
  company_id: z.string().optional(),
});
export type RegistrarEndpoint = z.infer<typeof RegistrarEndpointSchema>;

export const DesativarEndpointSchema = z.object({
  store_id: z.string().min(1),
  environment,
  pix_type: pixType,
});
export type DesativarEndpoint = z.infer<typeof DesativarEndpointSchema>;
