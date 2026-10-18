// @vitest-environment node
import { NextRequest } from "next/server";
import { NONCE_HEADER, SECURITY_HEADERS, buildContentSecurityPolicy, config, proxy } from "./proxy";

function nonceOf(csp: string): string {
  const match = csp.match(/'nonce-([^']+)'/);
  if (!match?.[1]) throw new Error(`CSP sem nonce: ${csp}`);
  return match[1];
}

describe("proxy (cabeçalhos de segurança)", () => {
  it("toda resposta leva CSP com nonce e os cabeçalhos fixos", () => {
    const response = proxy(new NextRequest("http://web.test/login"));
    const csp = response.headers.get("Content-Security-Policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("o nonce muda a cada requisição e chega ao Next pelo cabeçalho da requisição", () => {
    const first = proxy(new NextRequest("http://web.test/home"));
    const second = proxy(new NextRequest("http://web.test/home"));
    const nonce1 = nonceOf(first.headers.get("Content-Security-Policy")!);
    const nonce2 = nonceOf(second.headers.get("Content-Security-Policy")!);
    expect(nonce1).not.toBe(nonce2);
    expect(nonce1.length).toBeGreaterThanOrEqual(22);
    // NextResponse.next({ request: { headers } }) repassa os cabeçalhos sobrescritos assim:
    expect(first.headers.get(`x-middleware-request-${NONCE_HEADER}`)).toBe(nonce1);
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(
      first.headers.get("Content-Security-Policy"),
    );
  });

  it("CSP de produção: fontes e conexões só do próprio site, nada de Stripe/Google, sem eval", () => {
    const csp = buildContentSecurityPolicy("abc", false);
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/stripe|googleapis|gstatic/);
  });

  it("CSP de desenvolvimento libera eval e websocket (recarga do Next)", () => {
    const csp = buildContentSecurityPolicy("abc", true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' https://economia.awesomeapi.com.br ws: wss:");
  });

  it("não redireciona para o login (a proteção é do layout e da API) — nem em rota de tela", () => {
    const response = proxy(new NextRequest("http://web.test/modules/easycommandpay"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("HSTS só em HTTPS", () => {
    expect(proxy(new NextRequest("http://web.test/")).headers.get("Strict-Transport-Security")).toBeNull();
    expect(proxy(new NextRequest("https://web.test/")).headers.get("Strict-Transport-Security")).toContain("max-age=");
  });

  it("matcher deixa de fora só os estáticos com hash", () => {
    const source = config.matcher[0]!.source;
    expect(source).toContain("_next/static");
    expect(source).toContain("_next/image");
    expect(source).toContain("favicon.ico");
    const regex = new RegExp(`^${source}$`);
    expect(regex.test("/login")).toBe(true);
    expect(regex.test("/api/public/stripe-webhook")).toBe(true);
    expect(regex.test("/_next/static/chunks/a.js")).toBe(false);
  });
});
