/**
 * Aviso global de "a sessão acabou" (401 vindo do BFF). O provider de sessão escuta e zera o
 * usuário; a tela de layout decide o que mostrar/para onde ir.
 */
const EVENT = "easycontrol:session-expired";

export function notifySessionExpired(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function onSessionExpired(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
