import { QueryClient } from "@tanstack/react-query";

/**
 * Mesmo `QueryClient` do EasyControl atual (`easyCONTROL/src/router.tsx`): dados frescos por 1 min,
 * cache por 10 min, sem refetch ao focar a janela, 1 nova tentativa em consulta e nenhuma em
 * mutação. Não mudar sem motivo — isso decide o que a tela mostra e quantas vezes chama a API.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
