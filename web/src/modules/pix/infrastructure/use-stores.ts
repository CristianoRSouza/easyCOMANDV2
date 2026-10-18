import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/shared/http/api-client";
import type { StoreLite } from "../domain/pix";

export type { StoreLite } from "../domain/pix";

/**
 * `usePixStores` de hoje: todas as lojas (com o nome da empresa) num `Map` por id. A paginação de
 * 1000 em 1000 que a tela fazia agora é da API; a chave do cache e o tempo de validade são os mesmos.
 */
export function usePixStores() {
  return useQuery({
    queryKey: ["pix-webhooks", "stores"],
    queryFn: async () => {
      const lojas = await apiRequest<StoreLite[]>("/pix/stores");
      return new Map(lojas.map((s) => [s.id, s]));
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
