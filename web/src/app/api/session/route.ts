import { defaultDeps } from "@/server/runtime";
import { handleGetSession } from "@/server/bff/session";

/** Usuário da sessão atual (`{ user }`) ou 401. Renova o access token se preciso. */
export function GET(request: Request) {
  return handleGetSession(request, defaultDeps());
}
