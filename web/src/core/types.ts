export interface OverviewStats {
  overall_pct: number;
  total_forms: number;
  total_units: number;
  total_clerks: number;
  total_nurses: number;
  total_doctors: number;
  total_reviews: number;
}

export interface MonthlyTrendPoint {
  month: string;
  count: number;
  percentage: number;
  total_score: number;
}

export interface QualityKpis {
  avg_quality: number;
  total_files: number;
  top_reviewer: string;
  working_days: number;
  total_reviewers: number;
  avg_per_reviewer: number;
}

export type DateType = 'discharge' | 'admission' | 'review';
