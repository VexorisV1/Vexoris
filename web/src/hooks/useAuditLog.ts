import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/core/supabase';
import { logAudit, AUDIT } from '@/shared/lib/audit';

// ============ Types ============
export interface AuditLogRow {
  id: number;
  created_at: string;
  action: string;
  description: string | null;
  severity: 'info' | 'warning' | 'critical';
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AuditLogFilters {
  search?: string;
  action?: string;
  severity?: string;
}

export interface AuditLogPage {
  page: number;
  pageSize: number;
}

// ============ Main query ============
export function useAuditLog(filters: AuditLogFilters, pagination: AuditLogPage) {
  return useQuery({
    queryKey: ['audit-log', filters, pagination],
    queryFn: async () => {
      const from = (pagination.page - 1) * pagination.pageSize;
      const to = from + pagination.pageSize - 1;

      let q = supabase.from('audit_log').select('*', { count: 'exact' });

      if (filters.search) {
        q = q.or(
          `user_email.ilike.%${filters.search}%,description.ilike.%${filters.search}%,action.ilike.%${filters.search}%`
        );
      }
      if (filters.action) q = q.eq('action', filters.action);
      if (filters.severity) q = q.eq('severity', filters.severity);

      const { data, error, count } = await q
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        rows: (data ?? []) as AuditLogRow[],
        total: count ?? 0,
      };
    },
    staleTime: 30_000,
  });
}

// ============ Stats ============
export function useAuditLogStats() {
  return useQuery({
    queryKey: ['audit-log', 'stats'],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [total, critical, today, usersRes] = await Promise.all([
        supabase.from('audit_log').select('*', { count: 'exact', head: true }),
        supabase.from('audit_log').select('*', { count: 'exact', head: true }).eq('severity', 'critical'),
        supabase.from('audit_log').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('audit_log').select('user_email'),
      ]);

      const uniqueUsers = new Set(
        (usersRes.data ?? []).map((u: { user_email: string | null }) => u.user_email).filter(Boolean)
      ).size;

      return {
        total: total.count ?? 0,
        critical: critical.count ?? 0,
        today: today.count ?? 0,
        users: uniqueUsers,
      };
    },
    staleTime: 60_000,
  });
}

// ============ Delete mutations ============
export function useDeleteAuditLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase.from('audit_log').delete().in('id', ids);
      if (error) throw error;
      await logAudit(AUDIT.AUDIT_LOG_BULK_DELETED, {
        description: `حذف ${ids.length} سجل يدويًا`,
        severity: 'critical',
        metadata: { count: ids.length, ids },
      });
      return ids.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

export function useDeleteBySeverity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (severity: string) => {
      const { count } = await supabase
        .from('audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('severity', severity);

      const { error } = await supabase.from('audit_log').delete().eq('severity', severity);
      if (error) throw error;

      await logAudit(AUDIT.AUDIT_LOG_BULK_DELETED, {
        description: `حذف جماعي: ${count ?? 0} سجل بخطورة ${severity}`,
        severity: 'critical',
        metadata: { count, severity },
      });
      return count ?? 0;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

// ============ Export (all matching current filters, not just page) ============
export function useExportAuditLog() {
  return useMutation({
    mutationFn: async (filters: AuditLogFilters) => {
      let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false });
      if (filters.search) {
        q = q.or(
          `user_email.ilike.%${filters.search}%,description.ilike.%${filters.search}%,action.ilike.%${filters.search}%`
        );
      }
      if (filters.action) q = q.eq('action', filters.action);
      if (filters.severity) q = q.eq('severity', filters.severity);

      const { data, error } = await q;
      if (error) throw error;

      await logAudit(AUDIT.AUDIT_LOG_EXPORTED, {
        description: `تصدير ${data?.length ?? 0} سجل`,
        severity: 'info',
      });

      return (data ?? []) as AuditLogRow[];
    },
  });
}
