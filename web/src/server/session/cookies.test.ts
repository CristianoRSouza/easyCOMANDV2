// @vitest-environment node
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  asSessionTokens,
  clearedSessionCookies,
  readCookie,
  sessionCookies,
} from "./cookies";
import { readJwtExp } from "./jwt-exp";
import { jwt } from "@/test/bff-test-kit";

describe("cookies de sessão", () => {
  it("nomes do contrato: ecv2_at e ecv2_rt", () => {
    expect(ACCESS_TOKEN_COOKIE).toBe("ecv2_at");
    expect(REFRESH_TOKEN_COOKIE).toBe("ecv2_rt");
  });

  it("grava os dois tokens httpOnly, SameSite=Lax, Path=/ e Secure quando pedido", () => {
    const [at, rt] = sessionCookies({ access_token: "a.b.c", refresh_token: "r/1+", expires_at: 1 }, true);
    expect(at).toBe(`ecv2_at=a.b.c; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly; Secure`);
    expect(rt).toBe(`ecv2_rt=r%2F1%2B; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly; Secure`);
  });

  it("sem Secure em HTTP (dev)", () => {
    for (const cookie of sessionCookies({ access_token: "a", refresh_token: "r", expires_at: 1 }, false)) {
      expect(cookie).not.toContain("Secure");
      expect(cookie).toContain("HttpOnly");
    }
  });

  it("apagar = valor vazio com Max-Age=0 nos dois", () => {
    expect(clearedSessionCookies(true)).toEqual([
      "ecv2_at=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure",
      "ecv2_rt=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure",
    ]);
  });

  it("lê cookie do cabeçalho, decodificando; malformado ou vazio é ausente (nunca lança)", () => {
    const header = "x=1; ecv2_at=abc; ecv2_rt=r%2F1%2B; ruim=%E0%A4%A";
    expect(readCookie(header, "ecv2_at")).toBe("abc");
    expect(readCookie(header, "ecv2_rt")).toBe("r/1+");
    expect(readCookie(header, "ruim")).toBeNull();
    expect(readCookie("ecv2_at=", "ecv2_at")).toBeNull();
    expect(readCookie(null, "ecv2_at")).toBeNull();
  });

  it("valida o formato `session` da API", () => {
    expect(asSessionTokens({ access_token: "a", refresh_token: "r", expires_at: 10 })).toEqual({
      access_token: "a",
      refresh_token: "r",
      expires_at: 10,
    });
    expect(asSessionTokens({ access_token: "a", refresh_token: "r" })).toBeNull();
    expect(asSessionTokens({ access_token: "", refresh_token: "r", expires_at: 1 })).toBeNull();
    expect(asSessionTokens(null)).toBeNull();
  });

  it("lê o exp do JWT sem validar assinatura; token ilegível é null", () => {
    expect(readJwtExp(jwt(123))).toBe(123);
    expect(readJwtExp("nao-e-jwt")).toBeNull();
    expect(readJwtExp("a.###.c")).toBeNull();
  });
});
