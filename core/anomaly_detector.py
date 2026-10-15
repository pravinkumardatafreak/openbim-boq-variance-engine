"""
AI Anomaly & Variance Audit Engine.
Combines Scikit-Learn Isolation Forest, Statistical Cohort Z-Scores, and Engineering QA Rules
to detect abnormal volume jumps, cost spikes, and missing BIM property sets.
"""

from typing import Dict, Any, List, Tuple
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler


class BIMAnomalyDetector:
    """
    Multi-model anomaly detection engine tailored for BIM / IFC structural cost estimation.
    """

    def __init__(self, contamination: float = 0.05, z_score_threshold: float = 2.5):
        self.contamination = contamination
        self.z_score_threshold = z_score_threshold
        self.scaler = RobustScaler()

    def detect_anomalies(self, df_enriched: pd.DataFrame) -> pd.DataFrame:
        """
        Runs comprehensive anomaly and cost variance detection across all elements.
        Returns the dataframe enriched with anomaly flags, scores, and explanations.
        """
        if df_enriched.empty:
            return df_enriched.copy()

        df = df_enriched.copy()

        # ---------------------------------------------------------
        # 1. Statistical Cohort Z-Score Analysis (Per Storey & Type)
        # ---------------------------------------------------------
        df["cohort"] = df["ifc_type"] + " | " + df["storey"]
        df["cohort_mean_vol"] = df.groupby("cohort")["concrete_vol_cum"].transform("mean")
        df["cohort_std_vol"] = df.groupby("cohort")["concrete_vol_cum"].transform("std").fillna(0.0)

        # Calculate Z-score safely
        std_safe = np.where(df["cohort_std_vol"] > 1e-4, df["cohort_std_vol"], 1.0)
        df["z_score_vol"] = ((df["concrete_vol_cum"] - df["cohort_mean_vol"]) / std_safe).round(2)
        df["vol_ratio_to_cohort_mean"] = np.where(
            df["cohort_mean_vol"] > 1e-4,
            (df["concrete_vol_cum"] / df["cohort_mean_vol"]).round(2),
            1.0
        )

        df["is_zscore_anomaly"] = (df["z_score_vol"].abs() >= self.z_score_threshold) & (df["cohort_std_vol"] > 1e-4)

        # ---------------------------------------------------------
        # 2. Machine Learning: Scikit-Learn Isolation Forest
        # ---------------------------------------------------------
        feature_cols = ["concrete_vol_cum", "total_cost_inr", "formwork_sqm", "rebar_kg"]
        
        # Additional engineered ratios
        df["formwork_vol_ratio"] = np.where(df["concrete_vol_cum"] > 1e-4, df["formwork_sqm"] / df["concrete_vol_cum"], 0.0)
        df["cost_vol_ratio"] = np.where(df["concrete_vol_cum"] > 1e-4, df["total_cost_inr"] / df["concrete_vol_cum"], 0.0)

        ml_features = ["concrete_vol_cum", "total_cost_inr", "formwork_vol_ratio", "cost_vol_ratio"]
        
        if len(df) >= 10:
            X = df[ml_features].fillna(0.0).values
            X_scaled = self.scaler.fit_transform(X)

            # Fit Isolation Forest
            iso_forest = IsolationForest(
                n_estimators=100,
                contamination=self.contamination,
                random_state=42
            )
            df["iforest_prediction"] = iso_forest.fit_predict(X_scaled)  # -1 for anomaly, 1 for normal
            df["iforest_score"] = iso_forest.decision_function(X_scaled).round(4)
            df["is_ml_anomaly"] = df["iforest_prediction"] == -1
        else:
            df["iforest_prediction"] = 1
            df["iforest_score"] = 0.0
            df["is_ml_anomaly"] = False

        # ---------------------------------------------------------
        # 3. Engineering QA & Contract Compliance Rules
        # ---------------------------------------------------------
        df["rule_missing_material"] = ~df["has_material"] | (df["material_name"].str.lower().str.contains("unassigned|unspecified"))
        df["rule_implicit_grade"] = ~df["is_grade_explicit"]
        df["rule_missing_qto"] = ~df["has_base_quantities"]
        df["rule_corrupt_volume"] = (df["concrete_vol_cum"] <= 0.01) & (df["ifc_type"].isin(["IfcBeam", "IfcColumn", "IfcSlab", "IfcFooting"]))
        
        # Cost concentration per storey
        storey_cost = df.groupby("storey")["total_cost_inr"].transform("sum")
        df["storey_cost_share"] = np.where(storey_cost > 0, df["total_cost_inr"] / storey_cost, 0.0)
        df["rule_cost_spike"] = (df["storey_cost_share"] >= 0.15) & (df["z_score_vol"] > 2.0)

        # ---------------------------------------------------------
        # 4. Composite Risk Level & Diagnostic Rationales
        # ---------------------------------------------------------
        def evaluate_risk_and_reasons(row) -> Tuple[str, List[str], str]:
            reasons = []
            risk = "NORMAL"

            # Check for critical errors first
            if row["rule_corrupt_volume"]:
                reasons.append("Microscopic volume (<= 0.01 m³) detected on primary structural element; potential Qto corruption.")
                risk = "HIGH"

            if row["is_zscore_anomaly"] and row["z_score_vol"] > 0:
                jump_pct = int((row["vol_ratio_to_cohort_mean"] - 1.0) * 100)
                reasons.append(f"Volume is {row['vol_ratio_to_cohort_mean']}x the peer cohort mean (+{jump_pct}% jump, Z-Score={row['z_score_vol']}).")
                risk = "HIGH"
            elif row["is_zscore_anomaly"] and row["z_score_vol"] < 0:
                reasons.append(f"Volume is significantly lower than peer cohort mean (Z-Score={row['z_score_vol']}).")
                risk = "MEDIUM" if risk != "HIGH" else "HIGH"

            if row["rule_cost_spike"]:
                reasons.append(f"Single element accounts for {round(row['storey_cost_share'] * 100, 1)}% of total storey structural cost.")
                risk = "HIGH"

            if row["is_ml_anomaly"]:
                reasons.append(f"Isolation Forest flagged multi-dimensional geometric/cost outlier (Anomaly Score: {row['iforest_score']}).")
                risk = "HIGH" if risk == "HIGH" else "MEDIUM"

            if row["rule_missing_material"]:
                reasons.append("Missing material property in IFC. Assumed standard default M25 mix.")
                risk = "MEDIUM" if risk == "NORMAL" else risk

            if row["rule_missing_qto"]:
                reasons.append("Missing standard BaseQuantities Qto set. Fallback to bounding box geometry.")
                risk = "MEDIUM" if risk == "NORMAL" else risk

            # Recommended action for QS
            if risk == "HIGH":
                action = "FLAGGED FOR BIM AUDIT: Verify model dimensions with structural engineer before contractor billing."
            elif risk == "MEDIUM":
                action = "REVIEW ADVISED: Inspect specification and confirm mix grade / Qto sets."
            else:
                action = "COMPLIANT: Passes statistical and rule-based verification."

            return risk, reasons, action

        risk_levels = []
        all_reasons = []
        recommended_actions = []

        for _, row in df.iterrows():
            r, reas, act = evaluate_risk_and_reasons(row)
            risk_levels.append(r)
            all_reasons.append("; ".join(reas) if reas else "No anomalies detected.")
            recommended_actions.append(act)

        df["risk_level"] = risk_levels
        df["anomaly_reasons"] = all_reasons
        df["recommended_action"] = recommended_actions
        df["is_any_anomaly"] = df["risk_level"].isin(["HIGH", "MEDIUM"])

        return df

    def get_audit_summary(self, df_audited: pd.DataFrame) -> Dict[str, Any]:
        """
        Returns high-level anomaly audit metrics.
        """
        if df_audited.empty:
            return {
                "total_elements": 0,
                "high_risk_count": 0,
                "medium_risk_count": 0,
                "normal_count": 0,
                "at_risk_cost_inr": 0.0,
                "at_risk_cost_lakhs": 0.0,
                "high_risk_elements": [],
            }

        high_mask = df_audited["risk_level"] == "HIGH"
        med_mask = df_audited["risk_level"] == "MEDIUM"
        norm_mask = df_audited["risk_level"] == "NORMAL"

        at_risk_cost = float(df_audited[high_mask | med_mask]["total_cost_inr"].sum())

        return {
            "total_elements": len(df_audited),
            "high_risk_count": int(high_mask.sum()),
            "medium_risk_count": int(med_mask.sum()),
            "normal_count": int(norm_mask.sum()),
            "at_risk_cost_inr": round(at_risk_cost, 2),
            "at_risk_cost_lakhs": round(at_risk_cost / 100000.0, 2),
            "high_risk_elements": df_audited[high_mask][
                ["global_id", "name", "ifc_type", "storey", "concrete_vol_cum", "total_cost_inr", "z_score_vol", "anomaly_reasons"]
            ].to_dict(orient="records"),
        }
