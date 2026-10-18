import { ApiError } from "./api-error";
import { apiRequest, withQuery } from "./api-client";
import { onSessionExpired } from "./session-events";

function mockFetch(response: Response) {
  const fn = vi.fn(async () => response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("cliente HTTP do navegador", () => {
  it("chama /api/v1 do próprio Next, com credenciais da mesma origem", async () => {
    const fn = mockFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const body = await apiRequest<{ ok: boolean }>("/x", { method: "POST", body: { a: 1 } });
    expect(body).toEqual({ ok: true });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/x");
    expect(init.credentials).toBe("same-origin");
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.body).toBe('{"a":1}');
  });

  it("erro vira ApiError com a mensagem do envelope da API", async () => {
    mockFetch(new Response(JSON.stringify({ error: "forbidden", message: "Sem acesso.", statusCode: 403 }), { status: 403 }));
    await expect(apiRequest("/x")).rejects.toMatchObject({ status: 403, code: "forbidden", message: "Sem acesso." });
  });

  it("qualquer 429 (até o do limitador global, em inglês) vira a mensagem de hoje", async () => {
    mockFetch(new Response(JSON.stringify({ message: "ThrottlerException: Too Many Requests", statusCode: 429 }), { status: 429 }));
    await expect(apiRequest("/x")).rejects.toMatchObject({
      status: 429,
      message: "Muitas tentativas. Aguarde alguns instantes e tente de novo.",
    });
  });

  it("401 avisa a sessão expirada", async () => {
    const listener = vi.fn();
    const off = onSessionExpired(listener);
    mockFetch(new Response(JSON.stringify({ error: "unauthorized", message: "x" }), { status: 401 }));
    await expect(apiRequest("/x")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it("falha de rede vira ApiError 0 em PT-BR", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(apiRequest("/x")).rejects.toMatchObject({ status: 0, message: "Não foi possível contactar o servidor." });
  });

  it("withQuery ignora null/undefined", () => {
    expect(withQuery("/a", { x: 1, y: null, z: undefined, w: "b c" })).toBe("/a?x=1&w=b+c");
    expect(withQuery("/a", {})).toBe("/a");
  });
});
