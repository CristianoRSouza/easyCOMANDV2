import { SetMetadata } from '@nestjs/common';

/**
 * Marca uma rota como pública (pula a autenticação) — ex.: health, login, cadastro, o webhook
 * do Stripe (que se autentica pela assinatura, não por sessão).
 *
 * O padrão é FECHADO: sem esta marca, o `AuthGuard` global exige `Authorization: Bearer <jwt>`.
 * Abrir uma rota é ato explícito, e o teste `test/rotas-publicas.guard.spec.ts` obriga a
 * registrar cada rota aberta numa lista com justificativa — quem revisa o diff vê.
 *
 * Não existe `@ServiceOnly` nem marca de tenant aqui (diferente da API do EasyFood): quem chama
 * esta API é sempre o BFF com o JWT do usuário, e a empresa/loja chega no corpo/query, como nas
 * server functions de hoje — a autorização por empresa é de cada módulo.
 */
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
