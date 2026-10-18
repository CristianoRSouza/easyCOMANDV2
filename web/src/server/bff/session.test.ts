// @vitest-environment node
import { NOW, bodyText, cookieHeader, json, jwt, makeDeps, neverCalled } from "@/test/bff-test-kit";
import { handleGetSession, handleLogin, handleLogout } from "./session";

const loginRequest = (body: unknown) =>
  new Request("http://web.test/api/session/login", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("POST /api/session/login", () => {
  it("chama POST /auth/login, grava ecv2_at/ecv2_rt e devolve só o user (nunca o token)", async () => {
    const at = jwt(NOW + 3600);
    const { deps, calls } = makeDeps(() =>
      json(200, {
        session: { access_token: at, refresh_token: "rt", expires_at: NOW + 3600 },
        user: { id: "u1", email: "a@b.com" },
      }),
    );
    const response = await handleLogin(loginRequest({ email: "a@b.com", password: "segredo1" }), deps);

    expect(calls[0]!.url).toBe("http://api.test/api/v1/auth/login");
    expect(JSON.parse(bodyText(calls[0]!))).toEqual({ email: "a@b.com", password: "segredo1" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ user: { id: "u1", email: "a@b.com" } });
    expect(JSON.stringify(body)).not.toContain(at);
    const cookies = response.headers.getSetCookie();
    expect(cookies[0]).toMatch(/^ecv2_at=.+; HttpOnly; Secure$/);
    expect(cookies[1]).toMatch(/^ecv2_rt=rt; .*HttpOnly; Secure$/);
  });

  it("erro da API volta com o mesmo status e a mesma mensagem, sem cookie", async () => {
    const envelope = { error: "invalid_credentials", message: "E-mail ou senha incorretos.", statusCode: 400 };
    const { deps } = makeDeps(() => json(400, envelope));
    const response = await handleLogin(loginRequest({ email: "a@b.com", password: "x" }), deps);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(envelope);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("corpo que não é JSON: 400 sem chamar a API", async () => {
    const { deps } = makeDeps(neverCalled);
    expect((await handleLogin(loginRequest("{nao-json"), deps)).status).toBe(400);
  });

  it("API devolve 200 sem sessão válida: 502, sem cookie", async () => {
    const { deps } = makeDeps(() => json(200, { user: { id: "u1" } }));
    const response = await handleLogin(loginRequest({ email: "a", password: "b" }), deps);
    expect(response.status).toBe(502);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe("GET /api/session", () => {
  it("sem cookies: 401 sem chamar a API", async () => {
    const { deps } = makeDeps(neverCalled);
    const response = await handleGetSession(new Request("http://web.test/api/session"), deps);
    expect(response.status).toBe(401);
  });

  it("com sessão: GET /auth/me com Bearer e devolve { user }", async () => {
    const at = jwt(NOW + 3600);
    const { deps, calls } = makeDeps(() => json(200, { user: { id: "u1", email: "a@b.com" } }));
    const response = await handleGetSession(
      new Request("http://web.test/api/session", { headers: { cookie: cookieHeader({ ecv2_at: at, ecv2_rt: "rt" }) } }),
      deps,
    );
    expect(calls[0]!.url).toBe("http://api.test/api/v1/auth/me");
    expect(calls[0]!.headers.get("authorization")).toBe(`Bearer ${at}`);
    expect(await response.json()).toEqual({ user: { id: "u1", email: "a@b.com" } });
  });

  it("401 do /auth/me apaga os cookies", async () => {
    const { deps } = makeDeps(() => json(401, { error: "unauthorized", message: "x", statusCode: 401 }));
    const response = await handleGetSession(
      new Request("http://web.test/api/session", { headers: { cookie: cookieHeader({ ecv2_at: jwt(NOW + 3600) }) } }),
      deps,
    );
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie().every((c) => c.includes("Max-Age=0"))).toBe(true);
  });
});

describe("POST /api/session/logout", () => {
  it("chama /auth/logout com Bearer e apaga os cookies (204)", async () => {
    const at = jwt(NOW + 3600);
    const { deps, calls } = makeDeps(() => new Response(null, { status: 204 }));
    const response = await handleLogout(
      new Request("http://web.test/api/session/logout", { method: "POST", headers: { cookie: cookieHeader({ ecv2_at: at, ecv2_rt: "rt" }) } }),
      deps,
    );
    expect(calls[0]!.url).toBe("http://api.test/api/v1/auth/logout");
    expect(calls[0]!.headers.get("authorization")).toBe(`Bearer ${at}`);
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it("com a API fora do ar, os cookies são apagados mesmo assim", async () => {
    const { deps } = makeDeps(() => {
      throw new TypeError("fetch failed");
    });
    const response = await handleLogout(
      new Request("http://web.test/api/session/logout", { method: "POST", headers: { cookie: cookieHeader({ ecv2_at: jwt(NOW + 3600) }) } }),
      deps,
    );
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie().every((c) => c.includes("Max-Age=0"))).toBe(true);
  });
});
