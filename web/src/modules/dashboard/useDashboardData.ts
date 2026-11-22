import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/core/supabase';

export interface DashboardData {
  kpi: {
    audits_today: number;
    emergency_today: number;
    pending_notes: number;
    accuracy: number;
  };
  chart: { date: string; day: string; value: number }[];
  activity: {
    user: string;
    initial: string;
    action: string;
    target: string | null;
    created_at: string;
  }[];
  departments: { name: string; score: number }[];
  statuses: {
    completed: number;
    in_review: number;
    error: number;
    pending: number;
    total: number;
  };
  quick_stats: {
    avg_time: number;
    reviewers: number;
    completion_rate: number;
  };
  recent_files: {
    file_number: string;
    patient: string;
    department: string | null;
    reviewer: string;
    status: string;
    has_errors: boolean;
    created_at: string;
  }[];
}

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_data');
      if (error) throw error;
      return data as DashboardData;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
