"""
Model Interpretability & Explainable AI (XAI) Engine.
Computes TreeSHAP feature attributions on unsupervised anomaly models and generates waterfall diagnostics.
"""

from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import IsolationForest
import plotly.graph_objects as go


class AnomalyExplainer:
    """
    Computes local and global SHAP (SHapley Additive exPlanations) values
    for tree-based anomaly detection models.
    """

    def __init__(self, model: IsolationForest, feature_names: List[str], X_train: np.ndarray):
        self.model = model
        self.feature_names = feature_names
        self.X_train = X_train
        self.explainer = shap.TreeExplainer(model)
        self.expected_value = float(self.explainer.expected_value) if np.isscalar(self.explainer.expected_value) else float(self.explainer.expected_value[0])

    def explain_instance(self, x_instance: np.ndarray) -> Dict[str, Any]:
        """
        Computes SHAP values for a single structural element instance.
        """
        if x_instance.ndim == 1:
            x_instance = x_instance.reshape(1, -1)
            
        shap_vals = self.explainer.shap_values(x_instance)
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[0]
            
        instance_shap = shap_vals[0]
        instance_features = x_instance[0]
        
        feature_contributions = []
        for name, val, s_val in zip(self.feature_names, instance_features, instance_shap):
            feature_contributions.append({
                "feature": name,
                "feature_value": float(val),
                "shap_value": float(s_val),
                "impact": "Anomaly Inducer" if s_val < 0 else "Normalizing Factor",
            })
            
        # Sort by absolute impact
        feature_contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        
        predicted_score = float(self.model.decision_function(x_instance)[0])
        
        return {
            "expected_value": self.expected_value,
            "predicted_score": predicted_score,
            "feature_contributions": feature_contributions,
        }

    def generate_waterfall_chart(self, element_name: str, explanation: Dict[str, Any]) -> go.Figure:
        """
        Builds an interactive Plotly Waterfall plot showing local SHAP attribution.
        Negative SHAP values drive the element into anomaly territory (decision function < 0).
        """
        contribs = explanation["feature_contributions"]
        base_val = explanation["expected_value"]
        pred_val = explanation["predicted_score"]
        
        names = ["Base Value (Cohort Mean)"] + [c["feature"] for c in contribs] + ["Final Anomaly Score"]
        measures = ["absolute"] + ["relative"] * len(contribs) + ["total"]
        y_vals = [base_val] + [c["shap_value"] for c in contribs] + [pred_val]
        
        text_vals = [f"{base_val:.3f}"] + [f"{c['shap_value']:+.3f}<br>({c['feature_value']:.2f})" for c in contribs] + [f"{pred_val:.3f}"]

        fig = go.Figure(
            go.Waterfall(
                name="SHAP Attribution",
                orientation="v",
                measure=measures,
                x=names,
                textposition="outside",
                text=text_vals,
                y=y_vals,
                connector=dict(line=dict(color="#94A3B8", width=1, dash="dot")),
                decreasing=dict(marker=dict(color="#EF4444")),  # Red for anomaly driver
                increasing=dict(marker=dict(color="#10B981")),  # Green for conforming factor
                totals=dict(marker=dict(color="#1E3E62")),
            )
        )

        fig.update_layout(
            title=f"<b>Local SHAP Attribution:</b> {element_name}<br><sup>Features shifting anomaly score below zero indicate primary root causes</sup>",
            waterfallgap=0.3,
            xaxis=dict(tickangle=-20),
            yaxis=dict(title="Isolation Forest Decision Function Score"),
            template="plotly_white",
            height=430,
            margin=dict(l=40, r=40, t=60, b=50),
        )

        return fig

    def compute_global_feature_importance(self, X_all: np.ndarray) -> pd.DataFrame:
        """
        Computes mean absolute SHAP value across the entire building model.
        """
        shap_vals = self.explainer.shap_values(X_all)
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[0]
            
        mean_abs_shap = np.mean(np.abs(shap_vals), axis=0)
        df_imp = pd.DataFrame({
            "Feature": self.feature_names,
            "Mean_Abs_SHAP": mean_abs_shap,
        }).sort_values(by="Mean_Abs_SHAP", ascending=False)
        
        df_imp["Relative_Importance_Pct"] = (df_imp["Mean_Abs_SHAP"] / df_imp["Mean_Abs_SHAP"].sum() * 100.0).round(2)
        return df_imp
