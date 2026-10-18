// =============================================================================
// Comparação visual com o EasyControl ATUAL: abre cada tela (e os estados interativos: abas,
// cartões, menus, diálogos) no legado e no novo, logado com o MESMO usuário no MESMO banco, e
// compara as capturas pixel a pixel.
//
//   LEGADO_URL=http://localhost:3200 NOVO_URL=http://localhost:3100 \
//   QA_EMAIL=... QA_SENHA=... npm run compare:legacy -- [pasta-de-saida]
//
// As credenciais vêm SÓ do ambiente (nunca de arquivo). Use a homologação: as duas versões
// precisam ler o mesmo banco para os dados baterem.
//
// Por que o repasse da EasyERP-API: no legado é o NAVEGADOR que chama a EasyERP-API, e ela recusa
// a origem `localhost` (CORS) — a tela de Webhooks PIX mostraria "Failed to fetch". O script repassa
// essa chamada pelo Playwright e devolve com CORS liberado, só no legado e só neste teste.
// =============================================================================
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const LEGADO = process.env.LEGADO_URL ?? "http://localhost:3200";
const NOVO = process.env.NOVO_URL ?? "http://localhost:3100";
const SAIDA = process.argv[2] ?? "comparacao-visual";
if (!process.env.QA_EMAIL || !process.env.QA_SENHA) {
  console.error("Defina QA_EMAIL e QA_SENHA no ambiente.");
  process.exit(1);
}
mkdirSync(SAIDA, { recursive: true });

const TELAS = [
  "/dashboard", "/companies", "/stores", "/plans", "/billing", "/settings", "/webhooks-pix",
  "/pix-credentials", "/menus", "/users", "/rbac", "/user-company-access", "/permission-audit",
  "/audit", "/health", "/modules/easycommandpay", "/modules/easyml", "/modules/easychat",
];

const aba = (nome) => async (p) => p.getByRole("tab", { name: new RegExp(`^${nome}`) }).click();
const cartao = (titulo) => async (p) =>
  p.getByRole("button", { name: new RegExp(`^${titulo.replace(/[()]/g, "\\$&")}`) }).first().click();

const ESTADOS = [
  ...["Módulos", "Permissões", "Roles", "Atribuições", "Auditoria"].map((n) => ({ nome: `rbac-${n}`, rota: "/rbac", passo: aba(n) })),
  { nome: "pix-timeline", rota: "/webhooks-pix", passo: aba("Timeline") },
  ...["EasyFoodPay", "EasyArchive", "EasyML", "PlugSign", "Economia de Cache (IA)"].map((t) => ({ nome: `plans-${t}`, rota: "/plans", passo: cartao(t) })),
  ...["EasyFoodPay", "EasyML Connect"].map((t) => ({ nome: `settings-${t}`, rota: "/settings", passo: cartao(t) })),
  { nome: "menu-usuario", rota: "/dashboard", passo: async (p) => p.getByRole("button", { name: "Menu do usuário" }).click() },
  { nome: "usuarios-acoes", rota: "/users", passo: async (p) => p.locator("table tbody tr").nth(1).getByRole("button").last().click() },
];

const SEM_ANIMACAO = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

async function sessao(browser, base, legado) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  if (legado) {
    await ctx.route(/webhook-easyerp/, async (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({
          status: 204,
          headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" },
        });
      }
      const r = await route.fetch();
      return route.fulfill({ response: r, headers: { ...r.headers(), "access-control-allow-origin": "*" } });
    });
  }
  const p = await ctx.newPage();
  await p.goto(`${base}/login`, { waitUntil: "networkidle" });
  const login = await p.screenshot();
  await p.fill('input[type="email"]', process.env.QA_EMAIL);
  await p.fill('input[type="password"]', process.env.QA_SENHA);
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/dashboard/);
  return { p, login };
}

async function capturar(p, base, rota, passo) {
  await p.goto(`${base}${rota}`, { waitUntil: "load" });
  await p.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(2000);
  await p.addStyleTag({ content: SEM_ANIMACAO });
  if (passo) {
    await passo(p);
    await p.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(1500);
  }
  return p.screenshot();
}

const resultado = [];
function comparar(nome, a, b) {
  const ia = PNG.sync.read(a);
  const ib = PNG.sync.read(b);
  const diff = new PNG({ width: ia.width, height: ia.height });
  const n = pixelmatch(ia.data, ib.data, diff.data, ia.width, ia.height, { threshold: 0.1 });
  const arq = nome.replace(/^\//, "").replace(/\//g, "_");
  writeFileSync(join(SAIDA, `${arq}.legado.png`), a);
  writeFileSync(join(SAIDA, `${arq}.novo.png`), b);
  writeFileSync(join(SAIDA, `${arq}.diff.png`), PNG.sync.write(diff));
  resultado.push({ tela: nome, pixelsDiferentes: n });
}

const browser = await chromium.launch();
const a = await sessao(browser, LEGADO, true);
const b = await sessao(browser, NOVO, false);
comparar("/login", a.login, b.login);
for (const rota of TELAS) comparar(rota, await capturar(a.p, LEGADO, rota), await capturar(b.p, NOVO, rota));
for (const e of ESTADOS) comparar(e.nome, await capturar(a.p, LEGADO, e.rota, e.passo), await capturar(b.p, NOVO, e.rota, e.passo));
await browser.close();

console.table(resultado);
const diferentes = resultado.filter((r) => r.pixelsDiferentes > 0);
console.log(`${resultado.length - diferentes.length}/${resultado.length} idênticas. Capturas e diferenças em ${SAIDA}/`);
process.exit(diferentes.length ? 1 : 0);
