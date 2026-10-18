/**
 * Agregadores para o painel "Economia de Cache (IA)".
 * Fonte: billing.usage_log + billing.model_costs.real_cost_usd_per_1k.
 */

export const CACHE_DISCOUNT = 0.5;

export interface AiCacheRow {
  created_at: string;
  model_used: string | null;
  tokens_input: number;
  tokens_cached: number;
  app_source: string | null;
}

export interface AiCacheKpis {
  sum_input: number;
  sum_cached: number;
  cache_hit_pct: number;
  interactions: number;
}

export function computeKpis(rows: AiCacheRow[]): AiCacheKpis {
  let sum_input = 0;
  let sum_cached = 0;
  for (const r of rows) {
    sum_input += r.tokens_input;
    sum_cached += r.tokens_cached;
  }
  return {
    sum_input,
    sum_cached,
    cache_hit_pct: sum_input > 0 ? (sum_cached / sum_input) * 100 : 0,
    interactions: rows.length,
  };
}

export interface ByModelAgg {
  model_used: string;
  sum_input: number;
  sum_cached: number;
  cache_hit_pct: number;
  savings_usd: number;
  savings_brl: number;
}

export function aggregateByModel(
  rows: AiCacheRow[],
  costByKey: Map<string, number>,
  usdBrl: number,
): ByModelAgg[] {
  const map = new Map<string, { sum_input: number; sum_cached: number }>();
  for (const r of rows) {
    const key = r.model_used ?? "(desconhecido)";
    const cur = map.get(key) ?? { sum_input: 0, sum_cached: 0 };
    cur.sum_input += r.tokens_input;
    cur.sum_cached += r.tokens_cached;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([model_used, v]) => {
      const realCost = costByKey.get(model_used) ?? 0;
      const savings_usd = (v.sum_cached / 1000) * realCost * CACHE_DISCOUNT;
      return {
        model_used,
        sum_input: v.sum_input,
        sum_cached: v.sum_cached,
        cache_hit_pct: v.sum_input > 0 ? (v.sum_cached / v.sum_input) * 100 : 0,
        savings_usd,
        savings_brl: savings_usd * usdBrl,
      };
    })
    .sort((a, b) => b.savings_brl - a.savings_brl);
}

export function totalSavingsBrl(byModel: ByModelAgg[]): number {
  return byModel.reduce((s, m) => s + m.savings_brl, 0);
}

export interface DailyPoint {
  date: string;
  sum_input: number;
  sum_cached: number;
}

// Agrupa por dia em America/Sao_Paulo (UTC-3, sem horário de verão atual).
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;

function toSpDate(iso: string): string {
  const t = new Date(iso).getTime() - SP_OFFSET_MS;
  return new Date(t).toISOString().slice(0, 10);
}

export function aggregateDaily(rows: AiCacheRow[], days: number): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const r of rows) {
    const d = toSpDate(r.created_at);
    const cur = map.get(d) ?? { date: d, sum_input: 0, sum_cached: 0 };
    cur.sum_input += r.tokens_input;
    cur.sum_cached += r.tokens_cached;
    map.set(d, cur);
  }
  // Preenche dias sem dado para gráfico contínuo.
  const out: DailyPoint[] = [];
  const today = new Date(Date.now() - SP_OFFSET_MS).toISOString().slice(0, 10);
  const start = new Date(Date.now() - SP_OFFSET_MS - (days - 1) * 86400000);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    out.push(map.get(d) ?? { date: d, sum_input: 0, sum_cached: 0 });
    if (d === today) break;
  }
  return out;
}