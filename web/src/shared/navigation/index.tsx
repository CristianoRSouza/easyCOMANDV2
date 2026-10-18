"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { forwardRef, useEffect, type AnchorHTMLAttributes, type ReactNode } from "react";

/**
 * Adaptador de navegação: a MESMA forma de uso do TanStack Router nas telas de hoje
 * (`<Link to>`, `useNavigate()({ to, replace })`, `useLocation().pathname`, `<Navigate>`), sobre o
 * roteador do Next. As telas foram trazidas com o JSX intacto — só o import mudou — e é este
 * arquivo que absorve a diferença entre os dois roteadores.
 */

type Busca = Record<string, string | number | boolean | null | undefined>;

function comBusca(to: string, search?: Busca): string {
  if (!search) return to;
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(search)) {
    if (valor !== undefined && valor !== null) params.set(chave, String(valor));
  }
  const qs = params.toString();
  return qs ? `${to}?${qs}` : to;
}

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  search?: Busca;
  replace?: boolean;
  children?: ReactNode;
};

/**
 * `prefetch={false}`: o roteador de hoje pré-carrega só na INTENÇÃO (`defaultPreload: "intent"`,
 * ao passar o mouse). O padrão do Next pré-carregaria TODO link visível — as ~20 rotas da barra
 * lateral a cada página, cada uma uma ida ao servidor (as páginas são dinâmicas por causa do nonce
 * da CSP). Como as telas buscam os dados no cliente, a navegação continua imediata sem isso.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, search, replace, ...rest }, ref) {
  return <NextLink ref={ref} href={comBusca(to, search)} replace={replace} prefetch={false} {...rest} />;
});

export function useNavigate() {
  const router = useRouter();
  return (opts: { to: string; replace?: boolean; search?: Busca }) => {
    const destino = comBusca(opts.to, opts.search);
    if (opts.replace) router.replace(destino);
    else router.push(destino);
  };
}

export function useLocation(): { pathname: string } {
  return { pathname: usePathname() ?? "/" };
}

/** Redireciona ao montar (o `<Navigate>` do TanStack Router). */
export function Navigate({ to, search, replace }: { to: string; search?: Busca; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to, search, replace });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  return null;
}
