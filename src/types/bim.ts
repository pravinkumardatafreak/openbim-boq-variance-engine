export interface RawBIMElement {
  global_id: string;
  tag: string;
  name: string;
  ifc_type: string;
  object_type: string;
  storey: string;
  material_name: string;
  concrete_grade: string;
  is_grade_explicit: boolean;
  has_base_quantities: boolean;
  has_material: boolean;
  net_volume: number;
  gross_volume: number;
  length?: number;
  width?: number;
  depth?: number;
  area?: number;
  has_geometry?: boolean;
  center_x?: number;
  center_y?: number;
  center_z?: number;
  bbox_dx?: number;
  bbox_dy?: number;
  bbox_dz?: number;
}

export interface EnrichedBIMElement extends RawBIMElement {
  concrete_vol_cum: number;
  rebar_density_kg_cum: number;
  rebar_kg: number;
  rebar_tonne: number;
  formwork_sqm: number;
  concrete_cost_inr: number;
  rebar_cost_inr: number;
  formwork_cost_inr: number;
  total_cost_inr: number;
}

export interface AuditedBIMElement extends EnrichedBIMElement {
  cohort: string;
  cohort_mean_vol: number;
  cohort_std_vol: number;
  z_score_vol: number;
  vol_ratio_to_cohort_mean: number;
  is_zscore_anomaly: boolean;

  formwork_expected_sqm: number;
  formwork_studentized_residual: number;
  rebar_expected_kg: number;
  rebar_studentized_residual: number;
  is_stratified_outlier: boolean;

  formwork_vol_ratio: number;
  cost_vol_ratio: number;
  iforest_prediction: number; // -1 anomaly, 1 normal
  iforest_score: number;
  is_ml_anomaly: boolean;

  rule_missing_material: boolean;
  rule_implicit_grade: boolean;
  rule_missing_qto: boolean;
  rule_corrupt_volume: boolean;

  risk_level: 'HIGH' | 'MEDIUM' | 'NORMAL';
  anomaly_reasons: string;
  recommended_action: string;
}

export interface ModelMetadata {
  schema: string;
  project_name: string;
  site_name: string;
  building_name: string;
  author?: string;
  originating_system?: string;
  total_entities?: number;
}

export interface BOQLineItem {
  'Item Code': string;
  Category: string;
  Description: string;
  Unit: string;
  Quantity: number;
  'Rate (INR)': number;
  'Amount (INR)': number;
  '% Share': number;
}

export interface KPISummary {
  total_elements: number;
  total_concrete_cum: number;
  concrete_cost_inr: number;
  total_steel_tonne: number;
  steel_cost_inr: number;
  rebar_density_overall: number;
  total_formwork_sqm: number;
  formwork_cost_inr: number;
  total_cost_inr: number;
  total_cost_lakhs: number;
  total_cost_crores: number;
}

export interface AuditSummary {
  high_risk_count: number;
  medium_risk_count: number;
  normal_count: number;
  at_risk_cost_inr: number;
  at_risk_cost_lakhs: number;
  high_risk_elements: AuditedBIMElement[];
}

export interface RatePreset {
  multiplier: number;
  description: string;
}

export interface RateItem {
  code: string;
  description: string;
  unit: string;
  rate: number;
}

export interface SHAPContribution {
  feature: string;
  feature_value: number;
  shap_value: number;
  impact: 'Anomaly Inducer' | 'Normalizing Factor';
}

export interface SHAPInstanceExplanation {
  expected_value: number;
  predicted_score: number;
  feature_contributions: SHAPContribution[];
}

export interface BenchmarkModelResult {
  roc_auc: number;
  pr_auc: number;
  best_f1: number;
  optimal_threshold: number;
  fpr: number[];
  tpr: number[];
  precision: number[];
  recall: number[];
}

export interface SORMatchResult {
  item_code: string;
  category: string;
  specification: string;
  unit: string;
  base_rate_inr: number;
  similarity_score: number;
  confidence_pct: number;
}
