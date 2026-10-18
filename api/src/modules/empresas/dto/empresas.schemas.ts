import { z } from 'zod';

export const EmpresasQuerySchema = z.object({ search: z.string().max(200).optional() });
export type EmpresasQuery = z.infer<typeof EmpresasQuerySchema>;

/** A tela de lojas abre com "só ativas" ligado. */
export const LojasQuerySchema = z.object({
  search: z.string().max(200).optional(),
  only_active: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});
export type LojasQuery = z.infer<typeof LojasQuerySchema>;
