import { z } from 'zod';

/**
 * Entrada do login. Hoje o formulário usa `<input type="email" required>` e manda o que foi
 * digitado direto ao `signInWithPassword` — a validação aqui só barra o vazio; formato de e-mail
 * quem recusa é o Supabase, com o texto dele, como hoje.
 */
export const CredentialsSchema = z.object({
  email: z.string().min(1, 'Informe o e-mail.'),
  password: z.string().min(1, 'Informe a senha.'),
});
export type Credentials = z.infer<typeof CredentialsSchema>;

export const RefreshSchema = z.object({ refresh_token: z.string().min(1) });
export type RefreshInput = z.infer<typeof RefreshSchema>;
