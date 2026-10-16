import { BenchmarkModelResult, EnrichedBIMElement } from '../types/bim';
import {
  ORIGINAL_BENCHMARK_DATASETS,
  OriginalBenchmarkDataset,
  GroundTruthBIMElement,
} from '../data/benchmarkDatasets';
import {
  runDeepLearningBenchmark,
  DeepLearningBenchmarkSuite,
  DeepLearningTrainingHistory,
  DeepElementPrediction,
} from './deepLearningAnomaly';

export interface ComprehensiveBenchmarkResult {
  dataset_id: string;
  dataset_name: string;
  dataset_source: string;
  is_ground_truth: boolean;
  total_samples: number;
  anomaly_count: number;
  anomaly_rate_pct: number;
  model_results: Record<string, BenchmarkModelResult>;
  deep_learning_history: DeepLearningTrainingHistory;
  deep_element_predictions: DeepElementPrediction[];
  feature_names: string[];
}

export class AnomalyBenchmarkLab {
  /**
   * Run multi-model benchmark on active loaded BIM elements (with synthetic corruption injection).
   */
  public runMultiModelBenchmark(
    elements: EnrichedBIMElement[],
    corruptionRatePct: number = 8
  ): Record<string, BenchmarkModelResult> {
    const fullSuite = this.runComprehensiveBenchmark(elements, 'active_model', corruptionRatePct);
    return fullSuite.model_results;
  }

  /**
   * Run comprehensive benchmark across Deep Learning, Isolation Forest,
   * Stratified Physical Residuals, LOF, and MCD. Supports both the active model
   * and original ground-truth verified datasets!
   */
  public runComprehensiveBenchmark(
    elements: EnrichedBIMElement[],
    datasetChoice: string = 'active_model',
    corruptionRatePct: number = 8
  ): ComprehensiveBenchmarkResult {
    let targetElements: EnrichedBIMElement[];
    let labels: number[];
    let datasetName: string;
    let datasetSource: string;
    let isGroundTruth = false;

    if (datasetChoice !== 'active_model' && ORIGINAL_BENCHMARK_DATASETS[datasetChoice]) {
      const orig = ORIGINAL_BENCHMARK_DATASETS[datasetChoice];
      isGroundTruth = true;
      datasetName = orig.name;
      datasetSource = orig.authoritative_source;

      targetElements = orig.elements.map((el) => {
        const vol = el.net_volume || 1.0;
        const rebarDensity = el.ifc_type === 'IfcColumn' ? 140 : el.ifc_type === 'IfcBeam' ? 110 : 80;
        const rebarKg = vol * rebarDensity;
        const fw = (el.length || 3.0) * (el.width || 0.4) * 2;
        return {
          ...el,
          concrete_vol_cum: vol,
          rebar_density_kg_cum: rebarDensity,
          rebar_kg: rebarKg,
          rebar_tonne: rebarKg / 1000,
          formwork_sqm: fw,
          concrete_cost_inr: vol * 6500,
          rebar_cost_inr: (rebarKg / 1000) * 72000,
          formwork_cost_inr: fw * 550,
          total_cost_inr: vol * 6500 + (rebarKg / 1000) * 72000 + fw * 550,
        };
      });

      labels = orig.elements.map((e) => e.ground_truth_label);
    } else {
      // Active loaded model: inject controlled synthetic corruption topology
      targetElements = elements.map((e) => ({ ...e }));
      const n = targetElements.length;
      const nCorrupt = Math.max(Math.floor((n * corruptionRatePct) / 100), 4);
      labels = new Array(n).fill(0);

      // Deterministic pseudo-random corruption selection for reproducibility
      for (let i = 0; i < nCorrupt; i++) {
        const idx = Math.floor(((i + 1) * 37) % n);
        labels[idx] = 1;
        const el = targetElements[idx];
        const mode = i % 3;
        if (mode === 0) {
          // Volume spike
          el.concrete_vol_cum = (el.concrete_vol_cum || 2.0) * 3.5;
        } else if (mode === 1) {
          // Steel density surge
          el.rebar_kg = (el.rebar_kg || 100) * 4.0;
          el.rebar_density_kg_cum = (el.rebar_density_kg_cum || 100) * 4.0;
        } else {
          // Formwork mismatch
          el.formwork_sqm = (el.formwork_sqm || 10) * 3.2;
        }
      }

      datasetName = '⚡ Active Loaded BIM Model (Controlled Synthetic Topology)';
      datasetSource = 'Ingested IFC File with Parametric Volumetric Perturbations';
    }

    const suite: DeepLearningBenchmarkSuite = runDeepLearningBenchmark(targetElements, labels);
    const anomCount = labels.filter((l) => l === 1).length;

    return {
      dataset_id: datasetChoice,
      dataset_name: datasetName,
      dataset_source: datasetSource,
      is_ground_truth: isGroundTruth,
      total_samples: targetElements.length,
      anomaly_count: anomCount,
      anomaly_rate_pct: Math.round((anomCount / targetElements.length) * 1000) / 10,
      model_results: suite.model_results,
      deep_learning_history: suite.training_history,
      deep_element_predictions: suite.element_predictions,
      feature_names: suite.feature_names,
    };
  }

  /**
   * Get list of all available original benchmark datasets.
   */
  public getAvailableDatasets(): OriginalBenchmarkDataset[] {
    return Object.values(ORIGINAL_BENCHMARK_DATASETS);
  }
}
