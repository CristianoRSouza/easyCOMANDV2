import { z } from 'zod';

/** Os MESMOS limites do `Input` de `menus.functions.ts`. */

const linhaDeOrdem = z.object({ id: z.string().uuid(), display_order: z.number().int().min(0) });

export const MenuSchema = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().max(64).nullable().optional(),
  path: z.string().max(200).nullable().optional(),
  module: z.string().min(1).max(64),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  required_role: z.string().nullable().optional(),
  required_permission: z.string().max(120).nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
});
export type MenuInput = z.infer<typeof MenuSchema>;

export const SubmenuSchema = z.object({
  menu_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  path: z.string().min(1).max(200),
  icon: z.string().max(64).nullable().optional(),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  parent_submenu_id: z.string().uuid().nullable().optional(),
  required_role: z.string().nullable().optional(),
  required_permission: z.string().max(120).nullable().optional(),
});
export type SubmenuInput = z.infer<typeof SubmenuSchema>;

export const OrdemSchema = z.object({ rows: z.array(linhaDeOrdem).min(1).max(500) });
export type OrdemInput = z.infer<typeof OrdemSchema>;
