import { defaultDeps } from "@/server/runtime";
import { handleApiForward } from "@/server/bff/forward";

type Context = { params: Promise<{ path: string[] }> };

/** Repasse autenticado do navegador para a API (`/api/v1/*` → `${EASYCONTROL_API_URL}/api/v1/*`). */
async function forward(request: Request, { params }: Context): Promise<Response> {
  const { path } = await params;
  return handleApiForward(request, path, defaultDeps());
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
