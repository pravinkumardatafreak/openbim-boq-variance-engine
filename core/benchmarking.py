"""
Semi-Supervised Synthetic Benchmarking & Threshold Calibration Framework.
Injects controlled BIM corruption topologies and compares Isolation Forest, LOF,
and Robust Mahalanobis Distance across Precision-Recall (PR-AUC) and ROC curves.
"""

from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.covariance import EllipticEnvelope
from sklearn.metrics import precision_recall_curve, roc_curve, auc, average_precision_score, f1_score
from sklearn.preprocessing import RobustScaler
import plotly.graph_objects as go


class AnomalyBenchmarkLab:
    """
    R&D evaluation framework for unsupervised anomaly detectors on synthetic BIM corruption datasets.
    """

    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        self.scaler = RobustScaler()

    def generate_synthetic_benchmark(
        self,
        df_base: pd.DataFrame,
        corruption_rate: float = 0.08,
    ) -> Tuple[pd.DataFrame, np.ndarray]:
        """
        Synthesizes an evaluation dataset by injecting realistic CAD/BIM modeling mistakes
        with ground-truth binary labels (1 = Anomaly, 0 = Normal).
        """
        np.random.seed(self.random_state)
        df_bench = df_base.copy()
        n_total = len(df_bench)
        n_corrupt = max(int(n_total * corruption_rate), 4)

        corrupt_indices = np.random.choice(df_bench.index, size=n_corrupt, replace=False)
        y_true = np.zeros(n_total, dtype=int)
        y_true[df_bench.index.isin(corrupt_indices)] = 1

        corruption_types = []
        for idx in df_bench.index:
            if idx not in corrupt_indices:
                corruption_types.append("None (Ground Truth Normal)")
                continue

            error_type = np.random.choice(["DIM_TYPO", "UNIT_SCALE", "REBAR_SURGE", "FORMWORK_GLITCH"])
            if error_type == "DIM_TYPO":
                # 3.5x depth typo (e.g. 2.1m instead of 0.6m)
                df_bench.loc[idx, "concrete_vol_cum"] *= 3.5
                df_bench.loc[idx, "total_cost_inr"] *= 3.2
                corruption_types.append("Injected: 3.5x Dimensional Cross-Section Typo")
            elif error_type == "UNIT_SCALE":
                # Microscopic volume corruption (0.005 m3)
                df_bench.loc[idx, "concrete_vol_cum"] = 0.005
                df_bench.loc[idx, "total_cost_inr"] = 45.0
                corruption_types.append("Injected: Microscopic Unit Export Glitch (0.005 m³)")
            elif error_type == "REBAR_SURGE":
                # Extreme rebar density (4.5x normal)
                df_bench.loc[idx, "rebar_kg"] *= 4.5
                df_bench.loc[idx, "total_cost_inr"] *= 2.6
                corruption_types.append("Injected: Extreme Steel Reinforcement Ratio (+350%)")
            else:
                # Formwork 0.15x
                df_bench.loc[idx, "formwork_sqm"] *= 0.15
                corruption_types.append("Injected: Under-reported Shuttering Contact Area")

        df_bench["ground_truth_label"] = y_true
        df_bench["corruption_type"] = corruption_types
        return df_bench, y_true

    def run_multi_model_benchmark(
        self,
        df_bench: pd.DataFrame,
        y_true: np.ndarray,
    ) -> Dict[str, Any]:
        """
        Trains and benchmarks 3 distinct anomaly algorithms:
        1. Isolation Forest (Tree recursive partitioning)
        2. Local Outlier Factor (Density-based reachability)
        3. Robust Elliptic Envelope (Mahalanobis Distance / Minimum Covariance Determinant)
        """
        features = ["concrete_vol_cum", "total_cost_inr", "formwork_sqm", "rebar_kg"]
        X = df_bench[features].fillna(0.0).values
        X_scaled = self.scaler.fit_transform(X)

        # 1. Isolation Forest
        iforest = IsolationForest(n_estimators=100, contamination=0.08, random_state=self.random_state)
        iforest.fit(X_scaled)
        # Higher score = more anomalous
        scores_iforest = -iforest.decision_function(X_scaled)

        # 2. Local Outlier Factor
        lof = LocalOutlierFactor(n_neighbors=min(15, len(X) - 1), novelty=True)
        lof.fit(X_scaled)
        scores_lof = -lof.score_samples(X_scaled)

        # 3. Robust Elliptic Envelope (Mahalanobis Distance)
        try:
            ee = EllipticEnvelope(contamination=0.08, random_state=self.random_state)
            ee.fit(X_scaled)
            scores_ee = -ee.score_samples(X_scaled)
        except Exception:
            scores_ee = scores_iforest

        models = {
            "Isolation Forest": scores_iforest,
            "Local Outlier Factor (LOF)": scores_lof,
            "Robust Elliptic Envelope": scores_ee,
        }

        results = {}
        for name, scores in models.items():
            # Normalize scores to [0, 1] range for unified calibration
            s_min, s_max = np.min(scores), np.max(scores)
            s_norm = (scores - s_min) / (s_max - s_min + 1e-8)

            fpr, tpr, _ = roc_curve(y_true, s_norm)
            roc_auc_val = float(auc(fpr, tpr))

            precision, recall, thresholds = precision_recall_curve(y_true, s_norm)
            pr_auc_val = float(average_precision_score(y_true, s_norm))

            # F1 calibration curve
            f1_scores = []
            for t in thresholds:
                preds = (s_norm >= t).astype(int)
                f1_scores.append(f1_score(y_true, preds, zero_division=0))

            opt_idx = np.argmax(f1_scores) if f1_scores else 0
            best_f1 = float(f1_scores[opt_idx]) if f1_scores else 0.0
            best_thresh = float(thresholds[opt_idx]) if len(thresholds) > opt_idx else 0.5

            results[name] = {
                "roc_auc": round(roc_auc_val, 3),
                "pr_auc": round(pr_auc_val, 3),
                "best_f1": round(best_f1, 3),
                "optimal_threshold": round(best_thresh, 3),
                "fpr": fpr.tolist(),
                "tpr": tpr.tolist(),
                "precision": precision.tolist(),
                "recall": recall.tolist(),
                "thresholds": thresholds.tolist(),
                "f1_scores": f1_scores,
                "scores_normalized": s_norm,
            }

        return results

    def build_roc_pr_comparison_charts(self, benchmark_results: Dict[str, Any]) -> Tuple[go.Figure, go.Figure]:
        """
        Generates interactive Plotly ROC and PR comparison curves.
        """
        # 1. ROC Curves
        fig_roc = go.Figure()
        colors = {"Isolation Forest": "#0284C7", "Local Outlier Factor (LOF)": "#10B981", "Robust Elliptic Envelope": "#F59E0B"}

        for name, data in benchmark_results.items():
            fig_roc.add_trace(
                go.Scatter(
                    x=data["fpr"],
                    y=data["tpr"],
                    mode="lines",
                    name=f"{name} (AUC = {data['roc_auc']:.3f})",
                    line=dict(color=colors.get(name, "#64748B"), width=2.5),
                )
            )

        # Baseline diagonal
        fig_roc.add_trace(
            go.Scatter(
                x=[0, 1], y=[0, 1],
                mode="lines",
                name="Chance Baseline (AUC = 0.500)",
                line=dict(color="#CBD5E1", width=1.5, dash="dash"),
            )
        )

        fig_roc.update_layout(
            title="<b>Receiver Operating Characteristic (ROC) Benchmark</b>",
            xaxis=dict(title="False Positive Rate (1 - Specificity)"),
            yaxis=dict(title="True Positive Rate (Recall / Sensitivity)"),
            template="plotly_white",
            height=400,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            margin=dict(l=40, r=20, t=50, b=40),
        )

        # 2. Precision-Recall Curves
        fig_pr = go.Figure()
        for name, data in benchmark_results.items():
            fig_pr.add_trace(
                go.Scatter(
                    x=data["recall"],
                    y=data["precision"],
                    mode="lines",
                    name=f"{name} (PR-AUC = {data['pr_auc']:.3f})",
                    line=dict(color=colors.get(name, "#64748B"), width=2.5),
                )
            )

        fig_pr.update_layout(
            title="<b>Precision-Recall (PR) Curve Benchmark</b>",
            xaxis=dict(title="Recall"),
            yaxis=dict(title="Precision"),
            template="plotly_white",
            height=400,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            margin=dict(l=40, r=20, t=50, b=40),
        )

        return fig_roc, fig_pr
