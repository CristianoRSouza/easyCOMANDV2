import { describe, expect, it } from "vitest";
import { DEFAULT_API_URL, readServerConfig } from "./config";

describe("configuração do servidor", () => {
  it("padrões: API local na 3030 e cookie Secure só em produção", () => {
    expect(readServerConfig({})).toEqual({ apiUrl: DEFAULT_API_URL, secureCookies: false });
    expect(readServerConfig({ NODE_ENV: "production" }).secureCookies).toBe(true);
  });

  it("tira a barra final da URL da API e respeita SESSION_COOKIE_SECURE", () => {
    expect(readServerConfig({ EASYCONTROL_API_URL: "http://api:3030/", SESSION_COOKIE_SECURE: "false", NODE_ENV: "production" })).toEqual({
      apiUrl: "http://api:3030",
      secureCookies: false,
    });
  });

  it("URL inválida derruba a configuração, com o nome da variável", () => {
    expect(() => readServerConfig({ EASYCONTROL_API_URL: "nao-e-url" })).toThrow(/EASYCONTROL_API_URL/);
  });
});
