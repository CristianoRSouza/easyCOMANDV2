import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/shared/http/api-client";

export interface DashboardKpis {
  companies: number;
  stores: number;
  totemsActive: number;
  totemsOnline: number;
  totemLicenses: number;
  nfceAgents: number;
  recentActivity: number;
  // EasyML Connect
  mlConnectionsActive: number;
  mlProductLinks: number;
  mlProductKits: number;
  mlOrders30d: number;
  mlRevenue30d: number;
  mlAiCalls30d: number;
}

/**
 * KPIs do dashboard — hoje 13 consultas do navegador ao Supabase; agora uma chamada à API, que
 * faz as mesmas 13 em paralelo. A chave do cache é a mesma.
 */
export function useDashboardKpis() {
  return useQuery<DashboardKpis>({
    queryKey: ["dashboard-kpis"],
    queryFn: () => apiRequest<DashboardKpis>("/dashboard/kpis"),
  });
}
