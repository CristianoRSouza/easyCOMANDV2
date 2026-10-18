import { defaultDeps } from "@/server/runtime";
import { handleLogin } from "@/server/bff/session";

/** `{ email, password }` → grava os cookies `ecv2_at`/`ecv2_rt` e devolve `{ user }`. */
export function POST(request: Request) {
  return handleLogin(request, defaultDeps());
}
