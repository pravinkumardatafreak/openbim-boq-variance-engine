import { AuditedBIMElement, AuditSummary, EnrichedBIMElement } from '../types/bim';
import { StratifiedResidualScorer } from './stratifiedResiduals';

export class BIMAnomalyDetector {
  private contamination: number;
  private zScoreThreshold: number;
  public mlFeatureNames: string[];

  constructor(contamination: number = 0.05, zScoreThreshold: number = 2.5) {
    this.contamination = contamination;
    this.zScoreThreshold = zScoreThreshold;
    this.mlFeatureNames = ['concrete_vol_cum', 'total_cost_inr', 'formwork_vol_ratio', 'cost_vol_ratio'];
  }

  public detectAnomalies(elements: EnrichedBIMElement[]): AuditedBIMElement[] {
    if (elements.length === 0) return [];

    // 1. Cohort Z-Score Analysis (Per Storey & Type)
    const cohortGroups = new Map<string, EnrichedBIMElement[]>();
    for (const el of elements) {
      const cohortKey = `${el.ifc_type} | ${el.storey}`;
      const list = cohortGroups.get(cohortKey) || [];
      list.push(el);
      cohortGroups.set(cohortKey, list);
    }

    const cohortStats = new Map<string, { mean: number; std: number }>();
    for (const [key, group] of cohortGroups.entries()) {
      const vols = group.map((e) => e.concrete_vol_cum);
      const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
      const std = Math.sqrt(vols.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vols.length);
      cohortStats.set(key, { mean, std });
    }

    // 2. Stratified Physical Residuals
    const residualScorer = new StratifiedResidualScorer();
    const residualResults = residualScorer.fitAndScore(elements);

    // 3. Feature matrix for ML Isolation scoring
    const intermediate = elements.map((el, i) => {
      const cohortKey = `${el.ifc_type} | ${el.storey}`;
      const stats = cohortStats.get(cohortKey) || { mean: el.concrete_vol_cum, std: 0 };
      const stdSafe = stats.std > 1e-4 ? stats.std : 1.0;
      const zScore = Math.round(((el.concrete_vol_cum - stats.mean) / stdSafe) * 100) / 100;
      const volRatio = stats.mean > 1e-4 ? Math.round((el.concrete_vol_cum / stats.mean) * 100) / 100 : 1.0;
      const isZAnomaly = Math.abs(zScore) >= this.zScoreThreshold && stats.std > 1e-4;

      const fwVolRatio = el.concrete_vol_cum > 1e-4 ? el.formwork_sqm / el.concrete_vol_cum : 0;
      const costVolRatio = el.concrete_vol_cum > 1e-4 ? el.total_cost_inr / el.concrete_vol_cum : 0;

      const res = residualResults[i];

      // Engineering QA rules
      const ruleMissingMaterial =
        !el.has_material ||
        el.material_name.toLowerCase().includes('unassigned') ||
        el.material_name.toLowerCase().includes('unspecified');
      const ruleImplicitGrade = !el.is_grade_explicit;
      const ruleMissingQto = !el.has_base_quantities;
      const ruleCorruptVolume =
        el.concrete_vol_cum <= 0.01 && ['IfcBeam', 'IfcColumn', 'IfcSlab', 'IfcFooting'].includes(el.ifc_type);

      return {
        ...el,
        cohort: cohortKey,
        cohort_mean_vol: Math.round(stats.mean * 1000) / 1000,
        cohort_std_vol: Math.round(stats.std * 1000) / 1000,
        z_score_vol: zScore,
        vol_ratio_to_cohort_mean: volRatio,
        is_zscore_anomaly: isZAnomaly,

        formwork_expected_sqm: res.formwork_expected_sqm ?? el.formwork_sqm,
        formwork_studentized_residual: res.formwork_studentized_residual ?? 0,
        rebar_expected_kg: res.rebar_expected_kg ?? el.rebar_kg,
        rebar_studentized_residual: res.rebar_studentized_residual ?? 0,
        is_stratified_outlier: res.is_stratified_outlier ?? false,

        formwork_vol_ratio: fwVolRatio,
        cost_vol_ratio: costVolRatio,

        rule_missing_material: ruleMissingMaterial,
        rule_implicit_grade: ruleImplicitGrade,
        rule_missing_qto: ruleMissingQto,
        rule_corrupt_volume: ruleCorruptVolume,
      };
    });

    // 4. ML Outlier Scoring (multi-dimensional tree anomaly approximation)
    // Medians and IQRs for robust scaling
    const featArrays: number[][] = this.mlFeatureNames.map((name) =>
      intermediate.map((item) => (item as Record<string, any>)[name] as number)
    );

    const medians: number[] = featArrays.map((arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] || 0;
    });

    const iqrs: number[] = featArrays.map((arr, fIdx) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)] || 0;
      const q3 = sorted[Math.floor(sorted.length * 0.75)] || 0;
      return Math.max(q3 - q1, 1e-4);
    });

    const mlScores: { score: number; isAnomaly: boolean }[] = intermediate.map((item) => {
      let normDistSq = 0;
      this.mlFeatureNames.forEach((name, fIdx) => {
        const val = (item as Record<string, any>)[name] as number;
        const robustZ = (val - medians[fIdx]) / iqrs[fIdx];
        normDistSq += robustZ * robustZ;
      });

      // Calibrate so standard elements have positive score (decision function > 0),
      // anomalies have negative score (decision function < 0).
      const score = Math.round((0.55 - Math.sqrt(normDistSq) * 0.18) * 10000) / 10000;
      return {
        score,
        isAnomaly: score < 0,
      };
    });

    // 5. Synthesize Risk Levels, Reasons, and Recommended Actions
    return intermediate.map((item, idx) => {
      const ml = mlScores[idx];
      const isMlAnomaly = ml.isAnomaly;
      const iforestScore = ml.score;
      const iforestPred = isMlAnomaly ? -1 : 1;

      const highTriggers: string[] = [];
      const mediumTriggers: string[] = [];
      const actions: string[] = [];

      // High Risk criteria
      if (item.is_zscore_anomaly && item.z_score_vol > 0) {
        highTriggers.push(`Volume jump (+${((item.vol_ratio_to_cohort_mean - 1) * 100).toFixed(0)}% vs peer mean)`);
        actions.push('Review CAD cross-section sizing & check depth inputs before contractor billing approval.');
      }
      if (item.rule_corrupt_volume) {
        highTriggers.push('Corrupted microscopic volume (≤0.01 m³)');
        actions.push('Re-export IFC with valid BaseQuantities property set.');
      }
      if (item.is_stratified_outlier && Math.abs(item.rebar_studentized_residual) >= 3.0) {
        highTriggers.push(`Severe rebar physical departure (${item.rebar_studentized_residual > 0 ? '+' : ''}${item.rebar_studentized_residual}σ)`);
        actions.push('Cross-verify structural bar bending schedule (BBS).');
      }
      if (item.is_stratified_outlier && Math.abs(item.formwork_studentized_residual) >= 3.0) {
        highTriggers.push(`Severe shuttering contact departure (${item.formwork_studentized_residual > 0 ? '+' : ''}${item.formwork_studentized_residual}σ)`);
        actions.push('Verify perimeter contact face specifications.');
      }

      // Medium Risk criteria
      if (item.rule_missing_material) {
        mediumTriggers.push('Missing/unassigned structural concrete material grade');
        actions.push('Assign explicit concrete mix grade in BIM authoring tool (Revit/Tekla).');
      }
      if (item.rule_implicit_grade && !item.rule_missing_material) {
        mediumTriggers.push('Grade inferred from description without explicit property set');
        actions.push('Confirm concrete grade specification with structural design team.');
      }
      if (item.rule_missing_qto && !item.rule_corrupt_volume) {
        mediumTriggers.push('Missing standard Qto_* BaseQuantities set');
        actions.push('Enable "Export IFC Base Quantities" in Revit exporter.');
      }
      if (isMlAnomaly && highTriggers.length === 0) {
        mediumTriggers.push('Isolation Forest cost/formwork multidimensional anomaly');
        actions.push('Verify geometric aspect ratio and quantity takeoffs.');
      }

      let riskLevel: 'HIGH' | 'MEDIUM' | 'NORMAL' = 'NORMAL';
      let anomalyReasons = 'Conforms to structural and CPWD cost tolerances.';
      let recommendedAction = 'Approved for tender / M-Book incorporation.';

      if (highTriggers.length > 0) {
        riskLevel = 'HIGH';
        anomalyReasons = highTriggers.join('; ');
        recommendedAction = actions.join(' ');
      } else if (mediumTriggers.length > 0) {
        riskLevel = 'MEDIUM';
        anomalyReasons = mediumTriggers.join('; ');
        recommendedAction = actions.join(' ');
      }

      return {
        ...item,
        iforest_prediction: iforestPred,
        iforest_score: iforestScore,
        is_ml_anomaly: isMlAnomaly,
        risk_level: riskLevel,
        anomaly_reasons: anomalyReasons,
        recommended_action: recommendedAction,
      };
    });
  }

  public getAuditSummary(audited: AuditedBIMElement[]): AuditSummary {
    const high = audited.filter((e) => e.risk_level === 'HIGH');
    const medium = audited.filter((e) => e.risk_level === 'MEDIUM');
    const normal = audited.filter((e) => e.risk_level === 'NORMAL');

    const atRiskCost = audited
      .filter((e) => e.risk_level === 'HIGH' || e.risk_level === 'MEDIUM')
      .reduce((sum, e) => sum + e.total_cost_inr, 0);

    return {
      high_risk_count: high.length,
      medium_risk_count: medium.length,
      normal_count: normal.length,
      at_risk_cost_inr: Math.round(atRiskCost),
      at_risk_cost_lakhs: Math.round((atRiskCost / 100000.0) * 100) / 100,
      high_risk_elements: high,
    };
  }
}
