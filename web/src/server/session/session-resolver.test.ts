// @vitest-environment node
import { NOW, bodyText, cookieHeader, json, jwt, makeDeps, neverCalled } from "@/test/bff-test-kit";
import { REFRESH_MARGIN_SECONDS, resolveSession } from "./session-resolver";

const fresh = jwt(NOW + 3600);

describe("resolveSession (renovação automática)", () => {
  it("sem cookies: anônimo, sem chamar a API", async () => {
    const { deps } = makeDeps(neverCalled);
    expect(await resolveSession(null, deps)).toEqual({ kind: "anonymous" });
  });

  it("access token com folga: usa como está, sem renovar", async () => {
    const { deps } = makeDeps(neverCalled);
    const result = await resolveSession(cookieHeader({ ecv2_at: fresh, ecv2_rt: "rt" }), deps);
    expect(result).toEqual({ kind: "active", accessToken: fresh, setCookies: [] });
  });

  it("exatamente 60 s de folga ainda não renova; 59 s renova", async () => {
    const { deps } = makeDeps(neverCalled);
    const at60 = jwt(NOW + REFRESH_MARGIN_SECONDS);
    expect(await resolveSession(cookieHeader({ ecv2_at: at60, ecv2_rt: "rt" }), deps)).toMatchObject({
      kind: "active",
      accessToken: at60,
      setCookies: [],
    });

    const renewed = jwt(NOW + 3600, "novo");
    const second = makeDeps(() =>
      json(200, { session: { access_token: renewed, refresh_token: "rt2", expires_at: NOW + 3600 } }),
    );
    const result = await resolveSession(cookieHeader({ ecv2_at: jwt(NOW + 59), ecv2_rt: "rt" }), second.deps);
    expect(result.kind).toBe("active");
    expect(second.calls).toHaveLength(1);
  });

  it("renova com POST /auth/refresh { refresh_token } e devolve os cookies novos", async () => {
    const renewed = jwt(NOW + 3600, "novo");
    const { deps, calls } = makeDeps(() =>
      json(200, { session: { access_token: renewed, refresh_token: "rt2", expires_at: NOW + 3600 } }),
    );
    const result = await resolveSession(cookieHeader({ ecv2_at: jwt(NOW + 10), ecv2_rt: "rt-velho" }), deps);

    expect(calls[0]!.url).toBe("http://api.test/api/v1/auth/refresh");
    expect(calls[0]!.method).toBe("POST");
    expect(JSON.parse(bodyText(calls[0]!))).toEqual({ refresh_token: "rt-velho" });
    expect(result.kind).toBe("active");
    if (result.kind !== "active") return;
    expect(result.accessToken).toBe(renewed);
    expect(result.setCookies[0]).toMatch(/^ecv2_at=/);
    expect(result.setCookies[1]).toMatch(/^ecv2_rt=rt2;/);
  });

  it("só o refresh token (access ausente/ilegível): renova", async () => {
    const renewed = jwt(NOW + 3600);
    const { deps, calls } = makeDeps(() =>
      json(200, { session: { access_token: renewed, refresh_token: "rt2", expires_at: NOW + 3600 } }),
    );
    const result = await resolveSession(cookieHeader({ ecv2_rt: "rt" }), deps);
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ kind: "active", accessToken: renewed });
  });

  it("refresh recusado (401): sessão expirada e os dois cookies apagados", async () => {
    const { deps } = makeDeps(() => json(401, { error: "unauthorized", message: "x", statusCode: 401 }));
    const result = await resolveSession(cookieHeader({ ecv2_at: jwt(NOW - 5), ecv2_rt: "rt" }), deps);
    expect(result.kind).toBe("expired");
    if (result.kind !== "expired") return;
    expect(result.setCookies).toEqual([
      "ecv2_at=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure",
      "ecv2_rt=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure",
    ]);
  });

  it("API fora do ar na renovação: segue com o token se ainda vale; senão 'unreachable' sem apagar cookies", async () => {
    const down = makeDeps(() => {
      throw new TypeError("fetch failed");
    });
    const stillValid = jwt(NOW + 30);
    expect(await resolveSession(cookieHeader({ ecv2_at: stillValid, ecv2_rt: "rt" }), down.deps)).toEqual({
      kind: "active",
      accessToken: stillValid,
      setCookies: [],
    });
    expect(await resolveSession(cookieHeader({ ecv2_at: jwt(NOW - 1), ecv2_rt: "rt" }), down.deps)).toEqual({
      kind: "unreachable",
    });
  });

  it("access vencido e sem refresh token: expirada", async () => {
    const { deps } = makeDeps(neverCalled);
    const result = await resolveSession(cookieHeader({ ecv2_at: jwt(NOW - 1) }), deps);
    expect(result.kind).toBe("expired");
  });
});
