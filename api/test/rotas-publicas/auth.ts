/** Rotas ABERTAS do módulo `auth` — cada uma com o motivo. */
export const ROTAS_PUBLICAS: Record<string, string> = {
  'POST /auth/login': 'login com e-mail e senha: roda justamente quando ainda não há sessão',
  'POST /auth/refresh': 'renovação: o access token já venceu; a credencial é o refresh token no corpo',
};
