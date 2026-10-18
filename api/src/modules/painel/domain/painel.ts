/** Regras puras do dashboard e das telas de módulo (EasyCommandPay, EasyML Connect). */

export interface DashboardKpis {
  companies: number;
  stores: number;
  totemsActive: number;
  totemsOnline: number;
  totemLicenses: number;
  nfceAgents: number;
  recentActivity: number;
  mlConnectionsActive: number;
  mlProductLinks: number;
  mlProductKits: number;
  mlOrders30d: number;
  mlRevenue30d: number;
  mlAiCalls30d: number;
}

const MIN = 60 * 1000;
const DIA = 24 * 60 * MIN;

/** Os três instantes que o dashboard de hoje usa: 5 min (online), 24 h (atividade), 30 dias. */
export function janelasDoDashboard(agora: number): { cincoMin: string; umDia: string; trintaDias: string } {
  return {
    cincoMin: new Date(agora - 5 * MIN).toISOString(),
    umDia: new Date(agora - DIA).toISOString(),
    trintaDias: new Date(agora - 30 * DIA).toISOString(),
  };
}

/** Receita de 30 dias: soma de `total_amount` (string ou número; inválido conta 0). */
export function somarReceita(linhas: Array<{ total_amount: number | string | null }>): number {
  return linhas.reduce((soma, r) => soma + (Number(r.total_amount) || 0), 0);
}
