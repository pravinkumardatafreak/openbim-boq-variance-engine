"""
Multi-Class Stratified Residual Scoring Engine.
Trains class-conditioned regularized linear models (Ridge) to predict expected physical quantities
and computes Studentized residuals to avoid distribution pooling errors across disparate element types.
"""

from typing import Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler


class StratifiedResidualScorer:
    """
    Fits domain-specific physical relationship models per structural class (Columns, Beams, Slabs, Footings).
    Evaluates departures from class-conditional physical expectations using Studentized Residuals.
    """

    def __init__(self, residual_threshold: float = 2.5):
        self.residual_threshold = residual_threshold
        self.models: Dict[str, Dict[str, Any]] = {}

    def fit_and_score(self, df_elements: pd.DataFrame) -> pd.DataFrame:
        """
        Calculates class-conditioned expected quantities and studentized residuals.
        """
        if df_elements.empty:
            return df_elements.copy()

        df = df_elements.copy()
        df["formwork_expected_sqm"] = 0.0
        df["formwork_studentized_residual"] = 0.0
        df["rebar_expected_kg"] = 0.0
        df["rebar_studentized_residual"] = 0.0
        df["is_stratified_outlier"] = False

        for ifc_class, group in df.groupby("ifc_type"):
            n_samples = len(group)
            if n_samples < 4:
                # Fallback for very small groups
                df.loc[group.index, "formwork_expected_sqm"] = group["formwork_sqm"]
                df.loc[group.index, "rebar_expected_kg"] = group["rebar_kg"]
                continue

            # Feature matrix for physical prediction
            # Slabs: Area and Thickness dictate volume & formwork
            # Columns/Beams: Span/Length and Cross-section dictate volume & formwork
            X_feats = ["concrete_vol_cum", "length", "bbox_dx", "bbox_dy", "bbox_dz"]
            X = group[X_feats].fillna(0.0).values
            y_formwork = group["formwork_sqm"].values
            y_rebar = group["rebar_kg"].values

            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            # Fit Ridge model with L2 regularization to prevent overfitting on collinear dimensions
            model_formwork = Ridge(alpha=1.0)
            model_formwork.fit(X_scaled, y_formwork)
            pred_formwork = model_formwork.predict(X_scaled)

            # Compute Studentized / Standardized Residuals
            res_fw = y_formwork - pred_formwork
            std_res_fw = np.std(res_fw)
            z_res_fw = res_fw / (std_res_fw + 1e-6)

            model_rebar = Ridge(alpha=1.0)
            model_rebar.fit(X_scaled, y_rebar)
            pred_rebar = model_rebar.predict(X_scaled)
            res_rebar = y_rebar - pred_rebar
            std_res_rebar = np.std(res_rebar)
            z_res_rebar = res_rebar / (std_res_rebar + 1e-6)

            # Assign back to dataframe
            df.loc[group.index, "formwork_expected_sqm"] = np.round(pred_formwork, 2)
            df.loc[group.index, "formwork_studentized_residual"] = np.round(z_res_fw, 2)
            df.loc[group.index, "rebar_expected_kg"] = np.round(pred_rebar, 1)
            df.loc[group.index, "rebar_studentized_residual"] = np.round(z_res_rebar, 2)

            is_outlier = (np.abs(z_res_fw) >= self.residual_threshold) | (np.abs(z_res_rebar) >= self.residual_threshold)
            df.loc[group.index, "is_stratified_outlier"] = is_outlier

            # Store fitted model metadata
            self.models[ifc_class] = {
                "r2_formwork": float(model_formwork.score(X_scaled, y_formwork)),
                "r2_rebar": float(model_rebar.score(X_scaled, y_rebar)),
                "rmse_formwork": float(np.sqrt(np.mean(res_fw**2))),
                "rmse_rebar": float(np.sqrt(np.mean(res_rebar**2))),
            }

        return df

    def get_model_diagnostics(self) -> pd.DataFrame:
        """
        Returns goodness-of-fit R2 and RMSE diagnostics per structural class.
        """
        records = []
        for ifc_class, diag in self.models.items():
            records.append({
                "Structural Class": ifc_class.replace("Ifc", ""),
                "Formwork R² Fit": round(diag["r2_formwork"], 3),
                "Formwork RMSE (m²)": round(diag["rmse_formwork"], 2),
                "Rebar R² Fit": round(diag["r2_rebar"], 3),
                "Rebar RMSE (kg)": round(diag["rmse_rebar"], 1),
            })
        return pd.DataFrame(records)
