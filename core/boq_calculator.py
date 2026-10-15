"""
Automated Bill of Quantities (BOQ) and Cost Engine.
Applies CPWD / DSR Standard Schedule of Rates, structural thumb rules, and cost aggregation.
"""

from typing import Dict, Any, Tuple
import pandas as pd
import numpy as np

from config.rates import (
    DEFAULT_CONCRETE_RATES,
    STEEL_RATES,
    FORMWORK_RATES,
    REBAR_DENSITY_THUMB_RULES,
    FORMWORK_AREA_MULTIPLIERS,
)


class BOQEngine:
    """
    Computes concrete, steel reinforcement, formwork quantities, and costs
    from parsed IFC structural elements.
    """

    def __init__(
        self,
        rate_multiplier: float = 1.0,
        custom_concrete_rates: Dict[str, float] = None,
        custom_steel_rate_per_tonne: float = None,
        custom_formwork_rates: Dict[str, float] = None,
        rebar_density_override: Dict[str, float] = None,
    ):
        self.rate_multiplier = float(rate_multiplier)
        self.custom_concrete_rates = custom_concrete_rates or {}
        self.custom_steel_rate_per_tonne = custom_steel_rate_per_tonne
        self.custom_formwork_rates = custom_formwork_rates or {}
        self.rebar_density_rules = {**REBAR_DENSITY_THUMB_RULES, **(rebar_density_override or {})}

    def get_concrete_rate_info(self, grade: str) -> Tuple[str, str, float]:
        """Returns (item_code, description, rate_inr) for concrete grade."""
        grade_clean = grade.upper().replace(" ", "")
        info = DEFAULT_CONCRETE_RATES.get(grade_clean, DEFAULT_CONCRETE_RATES["DEFAULT"])
        base_rate = self.custom_concrete_rates.get(grade_clean, info["rate"])
        return info["code"], info["description"], round(base_rate * self.rate_multiplier, 2)

    def get_steel_rate_info(self) -> Tuple[str, str, float]:
        """Returns (item_code, description, rate_per_tonne_inr)."""
        base_rate = self.custom_steel_rate_per_tonne or STEEL_RATES["rate_per_tonne"]
        return STEEL_RATES["code"], STEEL_RATES["description"], round(base_rate * self.rate_multiplier, 2)

    def get_formwork_rate_info(self, ifc_type: str) -> Tuple[str, str, float]:
        """Returns (item_code, description, rate_per_sqm_inr)."""
        info = FORMWORK_RATES.get(ifc_type, FORMWORK_RATES["DEFAULT"])
        base_rate = self.custom_formwork_rates.get(ifc_type, info["rate"])
        return info["code"], info["description"], round(base_rate * self.rate_multiplier, 2)

    def compute_element_takeoffs(self, df_elements: pd.DataFrame) -> pd.DataFrame:
        """
        Enriches elements dataframe with concrete, steel, formwork, and individual cost items.
        """
        if df_elements.empty:
            return df_elements.copy()

        df = df_elements.copy()

        # 1. Concrete Quantity (cum)
        df["concrete_vol_cum"] = df["net_volume"].fillna(0.0).clip(lower=0.0)

        # 2. Steel Reinforcement (kg and MT)
        def calc_rebar_kg(row):
            density = self.rebar_density_rules.get(row["ifc_type"], self.rebar_density_rules["DEFAULT"])
            return round(row["concrete_vol_cum"] * density, 2)

        df["rebar_density_kg_cum"] = df["ifc_type"].map(lambda t: self.rebar_density_rules.get(t, self.rebar_density_rules["DEFAULT"]))
        df["rebar_kg"] = df.apply(calc_rebar_kg, axis=1)
        df["rebar_tonne"] = (df["rebar_kg"] / 1000.0).round(4)

        # 3. Shuttering / Formwork Contact Area (sqm)
        def calc_shuttering(row):
            ifc_type = row["ifc_type"]
            vol = row["concrete_vol_cum"]
            # If explicit net_area exists for slabs, use it directly
            if ifc_type == "IfcSlab" and row.get("area") and row["area"] > 0:
                return round(float(row["area"]), 2)
            
            # Geometric formula if dimensions are present
            dx, dy, dz = row.get("bbox_dx", 0), row.get("bbox_dy", 0), row.get("bbox_dz", 0)
            if row.get("has_geometry") and dx > 0 and dy > 0 and dz > 0:
                if ifc_type == "IfcColumn":
                    return round(2.0 * (dx + dy) * dz, 2)
                elif ifc_type == "IfcBeam":
                    # Formwork on two sides + soffit
                    return round((2.0 * min(dy, dz) + min(dx, dy)) * max(dx, dy, dz), 2)
            
            multiplier = FORMWORK_AREA_MULTIPLIERS.get(ifc_type, FORMWORK_AREA_MULTIPLIERS["DEFAULT"])
            return round(vol * multiplier, 2)

        df["formwork_sqm"] = df.apply(calc_shuttering, axis=1)

        # 4. Item Costs
        _, _, steel_rate_tonne = self.get_steel_rate_info()
        df["steel_rate_inr"] = steel_rate_tonne
        df["steel_cost_inr"] = (df["rebar_tonne"] * steel_rate_tonne).round(2)

        concrete_rates = []
        concrete_codes = []
        for grade in df["concrete_grade"]:
            code, _, rate = self.get_concrete_rate_info(grade)
            concrete_codes.append(code)
            concrete_rates.append(rate)

        df["concrete_item_code"] = concrete_codes
        df["concrete_rate_inr"] = concrete_rates
        df["concrete_cost_inr"] = (df["concrete_vol_cum"] * df["concrete_rate_inr"]).round(2)

        formwork_rates = []
        formwork_codes = []
        for ifc_type in df["ifc_type"]:
            code, _, rate = self.get_formwork_rate_info(ifc_type)
            formwork_codes.append(code)
            formwork_rates.append(rate)

        df["formwork_item_code"] = formwork_codes
        df["formwork_rate_inr"] = formwork_rates
        df["formwork_cost_inr"] = (df["formwork_sqm"] * df["formwork_rate_inr"]).round(2)

        # 5. Total Element Cost
        df["total_cost_inr"] = (df["concrete_cost_inr"] + df["steel_cost_inr"] + df["formwork_cost_inr"]).round(2)
        df["cost_per_cum_inr"] = np.where(df["concrete_vol_cum"] > 0, (df["total_cost_inr"] / df["concrete_vol_cum"]).round(2), 0.0)

        return df

    def generate_abstract_boq(self, df_enriched: pd.DataFrame) -> pd.DataFrame:
        """
        Creates the standardized CPWD / DSR Abstract of Cost (BOQ) aggregated table.
        """
        if df_enriched.empty:
            return pd.DataFrame()

        boq_rows = []

        # A. CONCRETE ITEMS BY GRADE
        concrete_grp = df_enriched.groupby("concrete_grade")["concrete_vol_cum"].sum().reset_index()
        for _, row in concrete_grp.iterrows():
            grade = row["concrete_grade"]
            qty = round(float(row["concrete_vol_cum"]), 3)
            if qty <= 0:
                continue
            code, desc, rate = self.get_concrete_rate_info(grade)
            amount = round(qty * rate, 2)
            boq_rows.append({
                "Category": "Concrete Works",
                "Item Code": code,
                "Description": f"{desc} [{grade}]",
                "Unit": "cum",
                "Quantity": qty,
                "Rate (INR)": rate,
                "Amount (INR)": amount,
            })

        # B. STEEL REINFORCEMENT
        total_steel_tonne = round(float(df_enriched["rebar_tonne"].sum()), 3)
        code_s, desc_s, rate_s = self.get_steel_rate_info()
        amount_s = round(total_steel_tonne * rate_s, 2)
        boq_rows.append({
            "Category": "Reinforcement Steel",
            "Item Code": code_s,
            "Description": desc_s,
            "Unit": "tonne",
            "Quantity": total_steel_tonne,
            "Rate (INR)": rate_s,
            "Amount (INR)": amount_s,
        })

        # C. FORMWORK / SHUTTERING BY ELEMENT TYPE
        formwork_grp = df_enriched.groupby("ifc_type")["formwork_sqm"].sum().reset_index()
        for _, row in formwork_grp.iterrows():
            ifc_type = row["ifc_type"]
            qty = round(float(row["formwork_sqm"]), 2)
            if qty <= 0:
                continue
            code_f, desc_f, rate_f = self.get_formwork_rate_info(ifc_type)
            amount_f = round(qty * rate_f, 2)
            boq_rows.append({
                "Category": "Centering & Shuttering",
                "Item Code": code_f,
                "Description": f"{desc_f} [{ifc_type.replace('Ifc', '')}]",
                "Unit": "sqm",
                "Quantity": qty,
                "Rate (INR)": rate_f,
                "Amount (INR)": amount_f,
            })

        df_boq = pd.DataFrame(boq_rows)
        total_project_cost = df_boq["Amount (INR)"].sum()
        if total_project_cost > 0:
            df_boq["% Share"] = ((df_boq["Amount (INR)"] / total_project_cost) * 100.0).round(2)
        else:
            df_boq["% Share"] = 0.0

        return df_boq

    def get_kpi_summary(self, df_enriched: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculates high-level executive KPIs for dashboard cards.
        """
        if df_enriched.empty:
            return {
                "total_elements": 0,
                "total_concrete_cum": 0.0,
                "total_steel_tonne": 0.0,
                "total_steel_kg": 0.0,
                "total_formwork_sqm": 0.0,
                "total_cost_inr": 0.0,
                "total_cost_lakhs": 0.0,
                "total_cost_crores": 0.0,
                "concrete_cost_inr": 0.0,
                "steel_cost_inr": 0.0,
                "formwork_cost_inr": 0.0,
                "rebar_density_overall": 0.0,
            }

        total_concrete = float(df_enriched["concrete_vol_cum"].sum())
        total_steel_kg = float(df_enriched["rebar_kg"].sum())
        total_steel_tonne = float(df_enriched["rebar_tonne"].sum())
        total_formwork = float(df_enriched["formwork_sqm"].sum())
        
        concrete_cost = float(df_enriched["concrete_cost_inr"].sum())
        steel_cost = float(df_enriched["steel_cost_inr"].sum())
        formwork_cost = float(df_enriched["formwork_cost_inr"].sum())
        total_cost = float(df_enriched["total_cost_inr"].sum())

        rebar_density = (total_steel_kg / total_concrete) if total_concrete > 0 else 0.0

        return {
            "total_elements": len(df_enriched),
            "total_concrete_cum": round(total_concrete, 2),
            "total_steel_tonne": round(total_steel_tonne, 2),
            "total_steel_kg": round(total_steel_kg, 1),
            "total_formwork_sqm": round(total_formwork, 2),
            "total_cost_inr": round(total_cost, 2),
            "total_cost_lakhs": round(total_cost / 100000.0, 2),
            "total_cost_crores": round(total_cost / 10000000.0, 4),
            "concrete_cost_inr": round(concrete_cost, 2),
            "steel_cost_inr": round(steel_cost, 2),
            "formwork_cost_inr": round(formwork_cost, 2),
            "rebar_density_overall": round(rebar_density, 1),
        }
