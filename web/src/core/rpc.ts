import { supabase } from './supabase';
import type { OverviewStats, MonthlyTrendPoint, QualityKpis, DateType } from './types';

async function callRpc<T>(name: string, args: Record<string, unknown>, timeoutMs = 35_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await supabase.rpc(name, args).abortSignal(controller.signal);
    if (error) throw new Error(`${name}: ${error.message}`);
    return data as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`${name}: timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const rpc = {
  overviewStats: (p_start: string | null, p_end: string | null, p_date_type: DateType) =>
    callRpc<OverviewStats>('get_overview_stats', { p_start, p_end, p_date_type }, 60_000),

  monthlyTrend: (p_months_back = 12, p_date_type: DateType = 'discharge', p_mode = 'units') =>
    callRpc<MonthlyTrendPoint[]>('get_monthly_trend', { p_months_back, p_date_type, p_mode }),

  qualityKpis: (p_start: string | null, p_end: string | null, p_date_type: DateType) =>
    callRpc<QualityKpis>('get_quality_kpis', { p_start, p_end, p_date_type }),
};
