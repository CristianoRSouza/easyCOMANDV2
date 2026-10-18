// @vitest-environment node
import { NOW, bodyText, cookieHeader, json, jwt, makeDeps, neverCalled } from "@/test/bff-test-kit";
import { handleApiForward } from "./forward";

const token = jwt(NOW + 3600);
const sessionCookie = cookieHeader({ ecv2_at: token, ecv2_rt: "rt" });

function browserRequest(url: string, init: RequestInit = {}, cookie: string | null = sessionCookie): Request {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  return new Request(url, { ...init, headers });
}

describe("repasse /api/v1/*", () => {
  it("GET: repassa caminho e query, com Bearer do cookie; devolve status, corpo e cabeçalhos relevantes", async () => {
    const { deps, calls } = makeDeps(() =>
      json(200, { ok: 1 }, { "cache-control": "no-store", "x-interno": "nao-passa", "set-cookie": "api=1" }),
    );
    const response = await handleApiForward(
      browserRequest("http://web.test/api/v1/billing/invoices?company_id=c1&page=2", {
        headers: { accept: "application/json", "x-company-id": "c1", "x-store-id": "s1", "x-forjado": "1" },
      }),
      ["billing", "invoices"],
      deps,
    );

    expect(calls[0]!.url).toBe("http://api.test/api/v1/billing/invoices?company_id=c1&page=2");
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.headers.get("authorization")).toBe(`Bearer ${token}`);
    expect(calls[0]!.headers.get("x-company-id")).toBeNull();
    expect(calls[0]!.headers.get("x-store-id")).toBeNull();
    expect(calls[0]!.headers.get("x-forjado")).toBeNull();
    expect(calls[0]!.headers.get("cookie")).toBeNull();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: 1 });
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-interno")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("repassa o contexto do navegador: Origin, Referer, X-Forwarded-For e x-request-id (gera se faltar)", async () => {
    const { deps, calls } = makeDeps(() => json(200, {}));
    await handleApiForward(
      browserRequest("http://web.test/api/v1/x", {
        headers: { origin: "https://easycontrol.easysoftcloud.com.br", referer: "https://easycontrol.easysoftcloud.com.br/home", "x-real-ip": "200.1.2.3" },
      }),
      ["x"],
      deps,
    );
    const headers = calls[0]!.headers;
    expect(headers.get("origin")).toBe("https://easycontrol.easysoftcloud.com.br");
    expect(headers.get("referer")).toBe("https://easycontrol.easysoftcloud.com.br/home");
    expect(headers.get("x-forwarded-for")).toBe("200.1.2.3");
    expect(headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("POST/PATCH/DELETE: repassa método e corpo byte a byte", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const { deps, calls } = makeDeps(() => json(201, { criado: true }));
      const body = '{"plan_slug":"pro","qtd":3}';
      const response = await handleApiForward(
        browserRequest("http://web.test/api/v1/x", { method, body, headers: { "content-type": "application/json" } }),
        ["x"],
        deps,
      );
      expect(calls[0]!.method).toBe(method);
      expect(bodyText(calls[0]!)).toBe(body);
      expect(calls[0]!.headers.get("content-type")).toBe("application/json");
      expect(response.status).toBe(201);
    }
  });

  it("erro da API volta com o mesmo status e corpo", async () => {
    const envelope = { error: "forbidden", message: "Sem acesso a esta empresa.", statusCode: 403 };
    const { deps } = makeDeps(() => json(403, envelope));
    const response = await handleApiForward(browserRequest("http://web.test/api/v1/x"), ["x"], deps);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(envelope);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("401 da API apaga os cookies de sessão", async () => {
    const { deps } = makeDeps(() =>
      json(401, { error: "unauthorized", message: "Sessão inválida ou expirada. Faça login novamente.", statusCode: 401 }),
    );
    const response = await handleApiForward(browserRequest("http://web.test/api/v1/x"), ["x"], deps);
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([
      "ecv2_at=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure",
      "ecv2_rt=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure",
    ]);
  });

  it("sem sessão: 401 com a mensagem de hoje, sem chamar a API", async () => {
    const { deps } = makeDeps(neverCalled);
    const response = await handleApiForward(browserRequest("http://web.test/api/v1/x", {}, null), ["x"], deps);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "unauthorized",
      message: "Sessão inválida ou expirada. Faça login novamente.",
      statusCode: 401,
    });
  });

  it("token perto de vencer: renova antes e devolve os cookies novos junto da resposta", async () => {
    const renewed = jwt(NOW + 3600, "novo");
    const { deps, calls } = makeDeps((call) =>
      call.url.endsWith("/auth/refresh")
        ? json(200, { session: { access_token: renewed, refresh_token: "rt2", expires_at: NOW + 3600 } })
        : json(200, { ok: true }),
    );
    const response = await handleApiForward(
      browserRequest("http://web.test/api/v1/x", {}, cookieHeader({ ecv2_at: jwt(NOW + 20), ecv2_rt: "rt" })),
      ["x"],
      deps,
    );
    expect(calls.map((c) => c.url)).toEqual(["http://api.test/api/v1/auth/refresh", "http://api.test/api/v1/x"]);
    expect(calls[1]!.headers.get("authorization")).toBe(`Bearer ${renewed}`);
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[1]).toMatch(/^ecv2_rt=rt2;/);
  });

  it("caminho com segmento inválido: 400 sem chamar a API", async () => {
    const { deps } = makeDeps(neverCalled);
    for (const segments of [["..", "admin"], ["a", ""], ["."], []]) {
      const response = await handleApiForward(browserRequest("http://web.test/api/v1/x"), segments, deps);
      expect(response.status).toBe(400);
    }
  });

  it("segmentos são codificados (sem escapar do prefixo /api/v1)", async () => {
    const { deps, calls } = makeDeps(() => json(200, {}));
    await handleApiForward(browserRequest("http://web.test/api/v1/x"), ["a b", "c/d"], deps);
    expect(calls[0]!.url).toBe("http://api.test/api/v1/a%20b/c%2Fd");
  });

  it("API fora do ar: 503 no envelope padrão", async () => {
    const { deps } = makeDeps(() => {
      throw new TypeError("fetch failed");
    });
    const response = await handleApiForward(browserRequest("http://web.test/api/v1/x"), ["x"], deps);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("api_unreachable");
  });

  it("download: content-disposition passa; 204 sem corpo", async () => {
    const pdf = makeDeps(
      () =>
        new Response(new Uint8Array([37, 80, 68, 70]), {
          status: 200,
          headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="recibo.pdf"' },
        }),
    );
    const response = await handleApiForward(browserRequest("http://web.test/api/v1/recibo"), ["recibo"], pdf.deps);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="recibo.pdf"');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70]));

    const empty = makeDeps(() => new Response(null, { status: 204 }));
    const noContent = await handleApiForward(browserRequest("http://web.test/api/v1/x", { method: "DELETE" }), ["x"], empty.deps);
    expect(noContent.status).toBe(204);
    expect(await noContent.text()).toBe("");
  });
});
