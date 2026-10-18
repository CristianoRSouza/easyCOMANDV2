import { defaultDeps } from "@/server/runtime";
import { handleLogout } from "@/server/bff/session";

/** Encerra a sessão na API e apaga os cookies. Sempre 204. */
export function POST(request: Request) {
  return handleLogout(request, defaultDeps());
}
