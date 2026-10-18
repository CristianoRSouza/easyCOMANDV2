import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Regras de camada (mesmo modelo do EasyFood V2):
 * - `src/server/**` é o único lugar que lê configuração/segredos do servidor. Código que pode ir
 *   ao navegador (`shared`, `modules`, componentes de `app`) não importa de lá.
 * - `domain`/`application` de cada módulo são puros: sem React, sem Next, sem HTTP, sem UI.
 * - `ui` de um módulo não fala HTTP direto: passa pelo `infrastructure` do módulo.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "tests/visual/output/**", "test-results/**", "next-env.d.ts"]),
  {
    files: ["src/shared/**", "src/modules/**", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@/server/*", "@/server"] }],
    },
  },
  {
    files: ["src/modules/*/domain/**", "src/modules/*/application/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react-dom",
            "next",
            "next/*",
            "@/server/*",
            "@/shared/http/*",
            "@/shared/ui/*",
            "../infrastructure/*",
            "../ui/*",
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/ui/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@/server/*", "@/server", "@/shared/http/api-client"] }],
    },
  },
  {
    // Telas trazidas do EasyControl atual com o JSX e os efeitos INTACTOS (só os imports e as
    // chamadas de dados mudaram). Padrões como "zerar a página num efeito" mudam o momento em que a
    // tela re-renderiza; reescrevê-los seria mudar comportamento, não migrar. Ficam como AVISO, para
    // aparecerem a quem for refatorar a tela depois da virada.
    files: ["src/modules/*/ui/**", "src/shared/layout/**"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    // Copiados sem alteração do EasyControl atual (shadcn) — não são código nosso para "corrigir".
    files: ["src/shared/ui/**", "src/shared/hooks/use-mobile.tsx"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/static-components": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
]);
