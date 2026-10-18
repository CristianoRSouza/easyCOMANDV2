import { z } from 'zod';

/** `list` de hoje: página ≥ 1, tamanho 1–100 (padrão 25), busca até 120 caracteres. */
export const ListaDeUsuariosSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  query: z.string().max(120).optional(),
});
export type ListaDeUsuarios = z.infer<typeof ListaDeUsuariosSchema>;

export const AtivoSchema = z.object({ is_active: z.boolean() });
export type AtivoInput = z.infer<typeof AtivoSchema>;
