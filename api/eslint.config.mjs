import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * ESLint da EasyBilling API — mesmo desenho da API do EasyFood V2: preset `recommended`,
 * `any` como ERRO e regras de CAMADA dentro dos módulos.
 *
 * ── Camadas dos módulos (`src/modules/<modulo>/{http,application,domain,infrastructure}`) ──
 *
 *   http → application → infrastructure
 *                 ↘          ↓
 *                   domain  (puro)
 *
 * A pasta já diz a intenção; estas regras impedem que um import a desminta. `import type` é
 * liberado onde só o TIPO cruza a fronteira e nada roda.
 *
 * ── O que conta como "banco" aqui ────────────────────────────────────────────
 * Não há `pg` nesta API (decisão de arquitetura: tudo por supabase-js, para a RLS valer). O
 * acesso a dados é o `@supabase/supabase-js` e os pontos de `src/db/`:
 *   • `db/supabase-admin` — cliente service_role (ignora RLS);
 *   • `db/service-role`   — a porta rotulada para a service_role;
 *   • `db/user-supabase`  — cliente/fábrica do USUÁRIO (RLS);
 *   • `db/supabase-auth`  — verificação de JWT (só o AuthGuard usa).
 * `pg` continua na lista: se alguém o instalar, o lint acusa antes do revisor.
 */
const proibir = (...grupos) => ({
  'no-restricted-imports': ['error', { patterns: grupos }],
});

const SO_NEST_COMUM = {
  regex: '^@nestjs/(?!common$)',
  message: 'Só `@nestjs/common` aqui; Swagger e afins são da camada http.',
};
const BANCO = {
  group: [
    'pg',
    '@supabase/supabase-js',
    '**/db/supabase-admin',
    '**/db/service-role',
    '**/db/user-supabase',
    '**/db/supabase-auth',
  ],
  message: 'Acesso a banco/Supabase é da camada infrastructure.',
};
/*
 * O caso de uso PODE importar o `ServiceRole`: ele não é acesso a banco, é o rótulo de uma
 * escalação de privilégio ("este fluxo escreve a licença como admin") — e decidir que uma
 * operação escala é regra de aplicação. Também pode receber o TIPO do cliente do usuário,
 * para repassá-lo ao repositório. O que ele não pode é criar cliente ou consultar direto.
 */
const BANCO_NA_APLICACAO = {
  group: ['pg', '@supabase/supabase-js', '**/db/supabase-admin', '**/db/user-supabase', '**/db/supabase-auth'],
  message: 'Acesso a banco/Supabase é da camada infrastructure.',
  allowTypeImports: true,
};
/*
 * O controller recebe o cliente do usuário pronto (`@UserSupabase() db: UserSupabaseClient`) e
 * o entrega ao caso de uso — por isso o TIPO de `db/user-supabase` passa. Qualquer coisa da
 * service_role, nem como tipo: escalar privilégio não é decisão de controller.
 */
const BANCO_NO_HTTP = [
  {
    group: ['pg', '@supabase/supabase-js', '**/db/user-supabase'],
    message: 'http não fala com o banco; recebe o cliente do usuário só como TIPO.',
    allowTypeImports: true,
  },
  {
    group: ['**/db/supabase-admin', '**/db/service-role', '**/db/supabase-auth'],
    message: 'service_role e verificação de JWT não são da camada http.',
  },
];
const EXPRESS = { group: ['express'], message: 'Requisição/resposta HTTP é da camada http.' };
// Stripe é cliente externo: mora em infrastructure (docs/arquitetura.md, "Dinheiro").
// `regex` ancorado, não `group`: um `group: ['stripe']` (estilo gitignore) também casaria com
// `../common/stripe`, e o núcleo compartilhado não é o SDK.
const STRIPE = { regex: '^stripe(/.*)?$', message: 'Chamadas ao Stripe ficam na camada infrastructure.' };

/*
 * ── Onde o cliente Stripe NASCE: `src/common/stripe/` ─────────────────────────
 * A fábrica (`StripeClientFactory`) e a resolução de modo (`StripeModeService`) são núcleo
 * compartilhado: quase todo módulo de produto precisa do cliente do modo certo, e as TRÊS regras
 * de modo (usuário/live, ambiente/test, evento/livemode) não podem ser reimplementadas em cada
 * um. Por isso o import de VALOR do SDK é liberado em `src/common/stripe/**` e barrado no resto
 * de `src/common/` (lá só `import type`, ex.: os tipos de `common/billing`).
 * Nos módulos, a regra de camadas abaixo continua: infrastructure usa o cliente; application
 * só o tipo; http e domain nada. Quem precisa de cliente injeta `StripeClientFactory` — não
 * faz `new Stripe(...)`.
 */
const comumSemStripe = {
  files: ['src/common/**/*.ts'],
  ignores: ['src/common/stripe/**'],
  rules: proibir({
    ...STRIPE,
    allowTypeImports: true,
    message: 'O cliente Stripe só nasce em src/common/stripe (StripeClientFactory). Aqui, só `import type`.',
  }),
};

const camadas = [
  comumSemStripe,
  {
    files: ['src/modules/*/domain/**/*.ts'],
    rules: proibir(
      { group: ['@nestjs/*'], message: 'domain é puro: sem Nest.' },
      { ...BANCO, message: 'domain é puro: sem banco.' },
      { ...EXPRESS, message: 'domain é puro: sem HTTP.' },
      { ...STRIPE, message: 'domain é puro: sem Stripe.' },
      {
        regex: '/(application|infrastructure|http)/',
        message: 'domain não depende das outras camadas.',
      },
    ),
  },
  {
    files: ['src/modules/*/infrastructure/**/*.ts'],
    rules: proibir(SO_NEST_COMUM, EXPRESS, {
      regex: '/(application|http)/',
      message: 'infrastructure só conhece o domain.',
    }),
  },
  {
    files: ['src/modules/*/application/**/*.ts'],
    rules: proibir(
      SO_NEST_COMUM,
      BANCO_NA_APLICACAO,
      EXPRESS,
      { ...STRIPE, allowTypeImports: true },
      { regex: '/http/', message: 'application não conhece a camada http.' },
    ),
  },
  {
    files: ['src/modules/*/http/**/*.ts'],
    rules: proibir(...BANCO_NO_HTTP, STRIPE, {
      regex: '/infrastructure/',
      message: 'http fala com application; quem busca dado é o caso de uso.',
    }),
  },
];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      // Arquivo GERADO pelo Supabase (cópia do EasyBilling atual) — regerar, não editar/lintar.
      'src/db/database.types.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      /*
       * O prefixo `_` é a convenção para "existe por contrato, não se usa" — parâmetro que a
       * interface obriga a declarar, campo descartado num destructuring, argumento de callback
       * de terceiro. Honrar o `_` alinha a ferramenta à intenção que já está escrita.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      /*
       * `any` é ERRO desde o primeiro dia. Fronteira sem tipo estável (payload de terceiro,
       * linha de RPC) usa `unknown` e um mapper — não `any`.
       */
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  ...camadas,
);
