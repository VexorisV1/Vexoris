export const fmtNum = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return n.toLocaleString('ar-EG');
};

export const fmtPct = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return `${n.toFixed(0)}%`;
};

export const fmtMonth = (iso: string): string => {
  // "2025-12" → "ديسمبر ٢٥"
  const [y, m] = iso.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
};

export const fmtDate = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-EG', { dateStyle: 'medium' });
};
