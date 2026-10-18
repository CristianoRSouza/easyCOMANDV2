# Decisões pendentes — para o dono do produto

A migração preservou o comportamento de hoje, **inclusive os defeitos**: mudar regra durante a troca de
tecnologia esconderia a mudança no meio de milhares de linhas. Esta lista é o que foi encontrado e
mantido de propósito, mais o que a V2 já resolveu.

## Já resolvido na V2 (segurança, sem mudar o que a tela mostra)

1. **Sessão fora do `localStorage`.** Hoje o token de um administrador global fica acessível a
   qualquer script da página; na V2 fica em cookie httpOnly.
2. **Nada do Supabase no navegador.** URL, publishable key e o token deixaram o bundle.
3. **CSP com nonce** em todas as respostas (antes não havia CSP).
4. **Edição de planos, pacotes e custos com lista fechada de campos.** Hoje a tela manda o objeto
   inteiro ao PostgREST; na V2, campo fora da lista é recusado com 400 antes de chegar ao banco.
   É a única mudança de comportamento visível, e só para chamadas que a tela nunca faz.

## Defeitos mantidos (decidir antes ou depois da virada)

| # | Onde | O que acontece hoje | Risco |
|---|---|---|---|
| 1 | Menus — `hasMenusAccess` | O override direto da permissão `core.menus.manage` só funciona como **deny**: o código procura `effect = 'allow'`, mas o enum é `grant`/`deny`. Um grant direto não libera a tela. | Baixo (só system_admin e roles liberam) |
| 2 | Dois gates de admin | Usuários e eventos PIX olham só `pv_user_roles`; RBAC, menus e vínculos aceitam também o `system_admin` global do RBAC novo. E o **login** só aceita `pv_user_roles` — quem é admin só pelo RBAC novo não entra. | Médio (regra confusa) |
| 3 | Auditoria RBAC | A gravação em `pv_rbac_audit_log` não confere erro: se a RLS recusar, a ação acontece sem registro. | Médio |
| 4 | Editar role / trocar papel | Sem transação: apaga todos os vínculos e grava os novos. Falha no meio deixa a role sem permissões (ou o usuário sem papel). | Médio |
| 5 | Buscas | O texto digitado vai cru para o filtro `.or(...)` do PostgREST: vírgula ou parêntese no termo quebra a consulta. (A RLS continua valendo; é erro de tela, não vazamento.) | Baixo |
| 6 | Telas sem gate na aplicação | Configuração de faturamento, edição de planos/pacotes/custos, credenciais PIX e todas as listas dependem SÓ da RLS. **Conferir as policies de escrita em produção.** | Alto se a RLS estiver aberta |
| 7 | Exportação da auditoria de permissões | Pede até 10.000 linhas, mas o PostgREST corta no teto do projeto (normalmente 1.000) sem avisar. | Baixo |
| 8 | Módulos RBAC | Não há como excluir módulo (nem hoje, nem na V2). | Baixo |

## Encontrado na homologação (banco, não migração)

Conferido chamando o PostgREST direto com o token do usuário — a mesma chamada que o EasyControl de hoje
faz; os dois sistemas falham igual:

- `devices.pixnopdv_store_credentials`: o papel `authenticated` não tem **DELETE** (nem UPDATE para o
  upsert). Salvar e excluir credenciais PIX falha em homologação com "permission denied".
- `get_easycommandpay_kpis` e `get_easyml_kpis`: "permission denied for function" — os cartões de KPI
  das telas EasyFoodPay e EasyML ficam zerados em homologação.

## Mantido idêntico de propósito (conhecido, não é defeito de migração)

- `<html lang="en">` e as páginas de erro/404 em inglês ("Page not found", "This page didn't load").
- A cotação USD→BRL ao vivo vem da AwesomeAPI direto do navegador (a CSP libera só esse endereço).
- Mensagens de erro do Stripe em inglês ("Stripe secret key not configured for mode …").

## Antes da virada

- Adaptar o deploy (`deploy/`, workflows do GitHub e `refresh-env.sh` do repositório atual) para **dois
  contêineres** (api + web). As `VITE_*` deixam de existir; `VITE_PIX_WEBHOOK_API_URL` vira
  `PIX_WEBHOOK_API_URL` da API.
- Conferir o item 6 (policies de escrita) em produção.
