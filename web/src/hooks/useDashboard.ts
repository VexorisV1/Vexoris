import { useQuery } from '@tanstack/react-query';
import { rpc } from '@/core/rpc';
import type { DateType } from '@/core/types';

const DASH_CACHE = 5 * 60 * 1000;

export function useOverviewStats(dateType: DateType = 'discharge') {
  return useQuery({
    queryKey: ['dashboard', 'overview', dateType],
    queryFn: () => rpc.overviewStats(null, null, dateType),
    staleTime: DASH_CACHE,
    retry: 1,
  });
}

export function useMonthlyTrend(monthsBack = 12, dateType: DateType = 'discharge') {
  return useQuery({
    queryKey: ['dashboard', 'trend', monthsBack, dateType],
    queryFn: () => rpc.monthlyTrend(monthsBack, dateType),
    staleTime: DASH_CACHE,
  });
}

export function useQualityKpis(dateType: DateType = 'discharge') {
  return useQuery({
    queryKey: ['dashboard', 'quality', dateType],
    queryFn: () => rpc.qualityKpis(null, null, dateType),
    staleTime: DASH_CACHE,
  });
}
