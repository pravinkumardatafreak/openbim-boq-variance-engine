"""
OpenBIM (IFC) Automated BOQ & Cost Variance Intelligence Engine.
Streamlit Cockpit Application for BIM Quantity Takeoff, CPWD Schedule of Rates,
and AI-Powered Structural Cost Variance Diagnostics.
"""

import os
import io
import time
from pathlib import Path
import streamlit as st
import pandas as pd
import numpy as np

from core.ifc_parser import IFCModelParser
from core.sample_generator import generate_lt_sample_ifc
from core.boq_calculator import BOQEngine
from core.anomaly_detector import BIMAnomalyDetector
from core.excel_exporter import BOQExcelExporter
from config.rates import (
    DEFAULT_CONCRETE_RATES,
    STEEL_RATES,
    FORMWORK_RATES,
    REBAR_DENSITY_THUMB_RULES,
    RATE_SCHEDULE_PRESETS,
)
from utils.visualizer import (
    build_3d_bim_model,
    build_cost_sunburst,
    build_anomaly_scatter_plot,
    build_concrete_grade_breakdown,
)

# -----------------------------------------------------------------------------
# 1. Page Configuration & Custom CSS Styling
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="OpenBIM BOQ & Cost Intelligence Engine",
    page_icon="🏗️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    /* Global styling */
    .main .block-container {
        padding-top: 1.5rem;
        padding-bottom: 2.5rem;
        max-width: 96%;
    }
    
    /* Header card */
    .hero-banner {
        background: linear-gradient(135deg, #0B192C 0%, #1E3E62 60%, #001F3F 100%);
        border-radius: 12px;
        padding: 22px 28px;
        color: white;
        margin-bottom: 20px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.12);
        border-left: 6px solid #FF6500;
    }
    .hero-title {
        font-size: 1.85rem;
        font-weight: 700;
        margin: 0;
        color: #FFFFFF;
        letter-spacing: -0.5px;
    }
    .hero-subtitle {
        font-size: 0.95rem;
        color: #E2E8F0;
        margin-top: 6px;
        margin-bottom: 12px;
    }
    .hero-overview {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 9px 15px;
        border-radius: 6px;
        font-size: 0.88rem;
        color: #F8FAFC;
    }
    
    /* KPI Metric Cards */
    .metric-card {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 14px 16px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        border-top: 4px solid #1E3E62;
    }
    .metric-card-alert {
        background: #FEF2F2;
        border: 1px solid #FCA5A5;
        border-radius: 10px;
        padding: 14px 16px;
        border-top: 4px solid #EF4444;
    }
    .metric-title {
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: uppercase;
        color: #64748B;
        letter-spacing: 0.5px;
    }
    .metric-value {
        font-size: 1.55rem;
        font-weight: 700;
        color: #0F172A;
        margin-top: 4px;
    }
    .metric-sub {
        font-size: 0.75rem;
        color: #475569;
        margin-top: 2px;
    }

    /* Badges */
    .badge-high {
        background-color: #EF4444;
        color: white;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: bold;
    }
    .badge-med {
        background-color: #F59E0B;
        color: white;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: bold;
    }
    .badge-normal {
        background-color: #10B981;
        color: white;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)


# -----------------------------------------------------------------------------
# 2. Caching & Data Pipeline Helpers
# -----------------------------------------------------------------------------
@st.cache_data(show_spinner=False)
def load_and_parse_ifc(file_bytes_or_path: str, compute_3d: bool = True):
    """
    Parses IFC model and extracts structural elements and metadata.
    """
    parser = IFCModelParser(file_bytes_or_path)
    metadata = parser.get_model_metadata()
    df_elements = parser.parse_elements(compute_3d=compute_3d)
    return metadata, df_elements


# -----------------------------------------------------------------------------
# 3. Sidebar Controls
# -----------------------------------------------------------------------------
with st.sidebar:
    st.image("https://img.icons8.com/fluency/96/structural.png", width=54)
    st.title("OpenBIM Control Deck")
    st.caption("Enterprise BIM Quantity & Cost Intelligence")
    st.markdown("---")

    # Ingestion Source
    st.subheader("1. BIM Model Ingestion")
    source_choice = st.radio(
        "Choose Model Source:",
        ["⚡ Pre-loaded Commercial Framing Model", "📁 Upload Custom IFC File"],
        index=0,
    )

    ifc_path_to_load = None
    uploaded_file = None

    if source_choice == "⚡ Pre-loaded Commercial Framing Model":
        st.info("Loaded **Commercial Complex - Block B (G+2 Structural Framing)** with 163 structural members and engineered cost dispute anomalies.")
        sample_path = generate_lt_sample_ifc()
        ifc_path_to_load = sample_path
    else:
        uploaded_file = st.file_uploader(
            "Drop your .ifc structural/architectural file here",
            type=["ifc", "ifczip"],
            help="Supports standard IFC2X3 and IFC4 exported from Autodesk Revit, Tekla Structures, or ArchiCAD.",
        )
        if uploaded_file is not None:
            # Save uploaded bytes to a persistent temp path in sample_models
            temp_dir = Path("sample_models")
            temp_dir.mkdir(parents=True, exist_ok=True)
            saved_temp_path = str(temp_dir / f"uploaded_{uploaded_file.name}")
            with open(saved_temp_path, "wb") as f:
                f.write(uploaded_file.getbuffer())
            ifc_path_to_load = saved_temp_path
            st.success(f"Uploaded: {uploaded_file.name}")

    st.markdown("---")
    st.subheader("2. Schedule of Rates (SOR)")
    
    preset_name = st.selectbox(
        "Select Rate Schedule:",
        list(RATE_SCHEDULE_PRESETS.keys()),
        index=0,
    )
    preset_multiplier = RATE_SCHEDULE_PRESETS[preset_name]["multiplier"]
    st.caption(f"ℹ️ {RATE_SCHEDULE_PRESETS[preset_name]['description']}")

    rate_multiplier_slider = st.slider(
        "Fine-Tune Rate Index (%):",
        min_value=70,
        max_value=150,
        value=int(preset_multiplier * 100),
        step=1,
        help="Adjust global market price fluctuation index (materials + labor)."
    )
    active_rate_multiplier = rate_multiplier_slider / 100.0

    st.markdown("---")
    st.subheader("3. AI Anomaly Parameters")
    z_score_thresh = st.slider(
        "Z-Score Outlier Threshold:",
        min_value=1.8,
        max_value=4.0,
        value=2.5,
        step=0.1,
        help="Statistical standard deviations above peer storey mean for flagging volume jumps."
    )
    iso_contamination = st.slider(
        "Isolation Forest Sensitivity:",
        min_value=0.01,
        max_value=0.12,
        value=0.05,
        step=0.01,
        help="Expected proportion of structural geometry and rate outliers."
    )


# -----------------------------------------------------------------------------
# 4. Pipeline Execution
# -----------------------------------------------------------------------------
if ifc_path_to_load is None:
    st.warning("Please select a sample model or upload an IFC file in the sidebar to proceed.")
    st.stop()

with st.spinner("Parsing OpenBIM model geometry and property sets..."):
    t0 = time.time()
    metadata, df_raw = load_and_parse_ifc(ifc_path_to_load, compute_3d=True)
    t_parse = time.time() - t0

if df_raw.empty:
    st.error("No structural elements (IfcColumn, IfcBeam, IfcSlab, IfcFooting, IfcWall) found in the selected model.")
    st.stop()

# Compute Takeoffs & BOQ
boq_engine = BOQEngine(rate_multiplier=active_rate_multiplier)
df_enriched = boq_engine.compute_element_takeoffs(df_raw)
df_boq = boq_engine.generate_abstract_boq(df_enriched)
kpis = boq_engine.get_kpi_summary(df_enriched)

# Run Anomaly Detection
detector = BIMAnomalyDetector(contamination=iso_contamination, z_score_threshold=z_score_thresh)
df_audited = detector.detect_anomalies(df_enriched)
audit_summary = detector.get_audit_summary(df_audited)


# -----------------------------------------------------------------------------
# 5. Hero Banner & System Overview
# -----------------------------------------------------------------------------
st.markdown(f"""
<div class="hero-banner">
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
            <h1 class="hero-title">🏗️ OpenBIM (IFC) Automated BOQ & Cost Variance Intelligence</h1>
            <p class="hero-subtitle">
                Model: <b>{metadata.get('project_name', 'BIM Model')}</b> | 
                Building: <b>{metadata.get('building_name', 'Structure')}</b> | 
                Schema: <b>{metadata.get('schema', 'IFC4')}</b> | 
                Audit Duration: <b>{t_parse:.2f}s</b>
            </p>
        </div>
        <div style="text-align:right;">
            <span style="background:#FF6500; color:white; padding:4px 10px; border-radius:14px; font-size:0.75rem; font-weight:700;">
                CPWD DSR 2023 COMPLIANT
            </span>
        </div>
    </div>
    <div class="hero-overview">
        ⚡ <b>Automated Takeoff & Risk Verification:</b> Ingests architectural and structural IFC models, extracts volumetric property sets, applies CPWD/DSR Schedule of Rates, and runs multivariate Isolation Forest anomaly detection to catch design-to-billing discrepancies in real-time.
    </div>
</div>
""", unsafe_allow_html=True)


# -----------------------------------------------------------------------------
# 6. Executive KPI Ribbon
# -----------------------------------------------------------------------------
col1, col2, col3, col4, col5 = st.columns(5)

with col1:
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-title">Structural Members</div>
        <div class="metric-value">{kpis['total_elements']}</div>
        <div class="metric-sub">{len(df_audited['storey'].unique())} Building Levels</div>
    </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-title">Concrete Volume</div>
        <div class="metric-value">{kpis['total_concrete_cum']:,.1f} <span style="font-size:0.9rem; font-weight:normal;">m³</span></div>
        <div class="metric-sub">₹{kpis['concrete_cost_inr']/100000:,.1f}L Concrete Cost</div>
    </div>
    """, unsafe_allow_html=True)

with col3:
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-title">Reinforcement Steel</div>
        <div class="metric-value">{kpis['total_steel_tonne']:,.1f} <span style="font-size:0.9rem; font-weight:normal;">MT</span></div>
        <div class="metric-sub">Avg {kpis['rebar_density_overall']:.0f} kg/m³ Density</div>
    </div>
    """, unsafe_allow_html=True)

with col4:
    st.markdown(f"""
    <div class="metric-card">
        <div class="metric-title">Total Project BOQ</div>
        <div class="metric-value">₹{kpis['total_cost_lakhs']:,.2f} <span style="font-size:0.85rem; font-weight:normal;">Lakhs</span></div>
        <div class="metric-sub">₹{kpis['total_cost_crores']:.3f} Cr Structural Cost</div>
    </div>
    """, unsafe_allow_html=True)

with col5:
    alert_class = "metric-card-alert" if audit_summary["high_risk_count"] > 0 else "metric-card"
    alert_color = "#EF4444" if audit_summary["high_risk_count"] > 0 else "#10B981"
    st.markdown(f"""
    <div class="{alert_class}">
        <div class="metric-title" style="color:{alert_color};">Cost Dispute Risk</div>
        <div class="metric-value" style="color:{alert_color};">{audit_summary['high_risk_count']} <span style="font-size:0.9rem; font-weight:normal;">High-Risk</span></div>
        <div class="metric-sub">₹{audit_summary['at_risk_cost_lakhs']:,.2f} Lakhs At-Risk</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)


# -----------------------------------------------------------------------------
# 7. Cockpit Tabs
# -----------------------------------------------------------------------------
tab_3d, tab_boq, tab_anomaly, tab_analytics, tab_rates, tab_export = st.tabs([
    "🏗️ 3D Model & Takeoff Explorer",
    "📋 Automated Bill of Quantities (BOQ)",
    "🔍 AI Anomaly & Variance Audit",
    "📊 Cost Analytics & Breakdown",
    "💰 Schedule of Rates (SOR)",
    "📥 Export Center",
])


# =============================================================================
# TAB 1: 3D MODEL & TAKEOFF EXPLORER
# =============================================================================
with tab_3d:
    st.subheader("Interactive 3D BIM Structural Viewer & Spatial Takeoff")
    st.caption("Rotate, pan, and zoom to inspect structural members in true 3D space. Hover over any element to view live takeoff parameters and risk flags.")

    c_f1, c_f2, c_f3, c_f4 = st.columns([2, 2, 2, 1.5])
    
    with c_f1:
        color_mode = st.selectbox(
            "Color Code 3D Elements By:",
            ["risk_level", "ifc_type", "concrete_grade"],
            format_func=lambda x: {
                "risk_level": "🚨 Risk Level (Anomalies Highlighted in Red)",
                "ifc_type": "🧱 Structural Element Class",
                "concrete_grade": "🧪 Concrete Mix Grade",
            }[x]
        )

    with c_f2:
        all_storeys = sorted(df_audited["storey"].unique().tolist())
        selected_storeys = st.multiselect("Filter Storey / Level:", all_storeys, default=all_storeys)

    with c_f3:
        all_types = sorted(df_audited["ifc_type"].unique().tolist())
        selected_types = st.multiselect("Filter Element Class:", all_types, default=all_types)

    with c_f4:
        show_wireframes = st.checkbox("Show Wireframe Box", value=True)

    fig_3d = build_3d_bim_model(
        df_audited,
        color_by=color_mode,
        selected_storeys=selected_storeys,
        selected_types=selected_types,
        show_bounding_boxes=show_wireframes,
    )
    st.plotly_chart(fig_3d, use_container_width=True)

    # Element Inspector Expander
    with st.expander("🔍 Interactive Element Inspector (Deep Dive by Tag / ID)", expanded=False):
        selected_element_tag = st.selectbox(
            "Select Element to Inspect:",
            df_audited["tag"] + " | " + df_audited["name"],
            index=0,
        )
        el_tag = selected_element_tag.split(" | ")[0]
        el_row = df_audited[df_audited["tag"] == el_tag].iloc[0]

        ci1, ci2, ci3, ci4 = st.columns(4)
        ci1.metric("Element Name", el_row["name"])
        ci2.metric("IFC Class", el_row["ifc_type"].replace("Ifc", ""))
        ci3.metric("Storey Level", el_row["storey"])
        ci4.metric("Concrete Grade", el_row["concrete_grade"])

        ci5, ci6, ci7, ci8 = st.columns(4)
        ci5.metric("Net Volume", f"{el_row['concrete_vol_cum']:.3f} m³")
        ci6.metric("Estimated Steel", f"{el_row['rebar_kg']:.1f} kg")
        ci7.metric("Formwork Area", f"{el_row['formwork_sqm']:.2f} m²")
        ci8.metric("Total Element Cost", f"₹{el_row['total_cost_inr']:,.2f}")

        if el_row["risk_level"] in ["HIGH", "MEDIUM"]:
            st.error(f"**Anomaly Audit Flag ({el_row['risk_level']}):** {el_row['anomaly_reasons']}")
            st.info(f"**Recommended Quantity Surveyor Action:** {el_row['recommended_action']}")


# =============================================================================
# TAB 2: AUTOMATED BILL OF QUANTITIES (BOQ)
# =============================================================================
with tab_boq:
    st.subheader("Abstract of Cost (CPWD DSR Standard Schedule of Quantities)")
    st.caption("Aggregated quantities categorized by CPWD item codes, mix specifications, and Indian standard units.")

    # Filter by category
    cats = ["All Categories"] + df_boq["Category"].unique().tolist()
    sel_cat = st.selectbox("Filter Work Category:", cats, index=0)

    df_boq_display = df_boq.copy()
    if sel_cat != "All Categories":
        df_boq_display = df_boq_display[df_boq_display["Category"] == sel_cat]

    # Format numeric columns for presentation
    df_boq_formatted = df_boq_display.copy()
    df_boq_formatted["Quantity"] = df_boq_formatted["Quantity"].apply(lambda x: f"{x:,.2f}")
    df_boq_formatted["Rate (INR)"] = df_boq_formatted["Rate (INR)"].apply(lambda x: f"₹{x:,.2f}")
    df_boq_formatted["Amount (INR)"] = df_boq_formatted["Amount (INR)"].apply(lambda x: f"₹{x:,.2f}")
    df_boq_formatted["% Share"] = df_boq_formatted["% Share"].apply(lambda x: f"{x:.2f}%")

    st.dataframe(df_boq_formatted, use_container_width=True, hide_index=True)

    # Sub-breakdown: Work Category Summary
    st.markdown("#### Cost Distribution by Work Category")
    cat_summary = df_boq.groupby("Category").agg(
        Total_Amount=("Amount (INR)", "sum")
    ).reset_index()
    cat_summary["% Share"] = (cat_summary["Total_Amount"] / cat_summary["Total_Amount"].sum() * 100.0).round(2)
    cat_summary["Amount (₹ Lakhs)"] = (cat_summary["Total_Amount"] / 100000.0).round(2)

    c_b1, c_b2 = st.columns([3, 2])
    with c_b1:
        st.bar_chart(cat_summary, x="Category", y="Amount (₹ Lakhs)", color="#1E3E62")
    with c_b2:
        for _, r in cat_summary.iterrows():
            st.markdown(f"""
            <div style="background:#F8FAFC; border-left:4px solid #1E3E62; padding:10px 14px; margin-bottom:8px; border-radius:4px;">
                <b>{r['Category']}</b>: ₹{r['Amount (₹ Lakhs)']:,.2f} Lakhs ({r['% Share']:.1f}%)
            </div>
            """, unsafe_allow_html=True)


# =============================================================================
# TAB 3: AI ANOMALY & VARIANCE AUDIT
# =============================================================================
with tab_anomaly:
    st.subheader("AI Anomaly & Cost Dispute Diagnostic Center")
    st.caption("Unsupervised Machine Learning (Isolation Forest) and Cohort Z-Score analysis identifying volumetric anomalies, corrupted Qto property sets, and contractor billing risks.")

    ca1, ca2, ca3 = st.columns(3)
    with ca1:
        st.markdown(f"""
        <div style="background:#FEF2F2; border-left:5px solid #EF4444; padding:12px 16px; border-radius:6px;">
            <b style="color:#B91C1C; font-size:1.1rem;">🚨 High Risk: {audit_summary['high_risk_count']} Elements</b><br>
            <span style="font-size:0.85rem; color:#7F1D1D;">Immediate BIM audit required; volume jumps exceed peer means.</span>
        </div>
        """, unsafe_allow_html=True)
    with ca2:
        st.markdown(f"""
        <div style="background:#FFFBEB; border-left:5px solid #F59E0B; padding:12px 16px; border-radius:6px;">
            <b style="color:#B45309; font-size:1.1rem;">⚠️ Medium Risk: {audit_summary['medium_risk_count']} Elements</b><br>
            <span style="font-size:0.85rem; color:#78350F;">Unassigned concrete grades or missing base quantity sets.</span>
        </div>
        """, unsafe_allow_html=True)
    with ca3:
        st.markdown(f"""
        <div style="background:#F0FDF4; border-left:5px solid #10B981; padding:12px 16px; border-radius:6px;">
            <b style="color:#047857; font-size:1.1rem;">✅ Compliant: {audit_summary['normal_count']} Elements</b><br>
            <span style="font-size:0.85rem; color:#064E3B;">Verified within standard statistical tolerances.</span>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Filter anomaly view
    risk_filter = st.radio(
        "Display Risk Filter:",
        ["All Flagged Anomalies (High & Medium)", "High Risk Only", "All Elements"],
        horizontal=True,
    )

    if risk_filter == "High Risk Only":
        df_audit_display = df_audited[df_audited["risk_level"] == "HIGH"]
    elif risk_filter == "All Flagged Anomalies (High & Medium)":
        df_audit_display = df_audited[df_audited["risk_level"].isin(["HIGH", "MEDIUM"])]
    else:
        df_audit_display = df_audited

    if df_audit_display.empty:
        st.success("No elements match the chosen risk filter. Model conforms to engineering standards!")
    else:
        audit_cols = [
            "name", "ifc_type", "storey", "concrete_vol_cum", "cohort_mean_vol",
            "z_score_vol", "total_cost_inr", "risk_level", "anomaly_reasons", "recommended_action"
        ]
        df_show = df_audit_display[audit_cols].rename(columns={
            "name": "Element Tag / Name",
            "ifc_type": "Class",
            "storey": "Storey",
            "concrete_vol_cum": "Vol (m³)",
            "cohort_mean_vol": "Cohort Mean (m³)",
            "z_score_vol": "Z-Score",
            "total_cost_inr": "Total Cost (₹)",
            "risk_level": "Risk",
            "anomaly_reasons": "AI Diagnosis",
            "recommended_action": "Recommended Action",
        })

        st.dataframe(
            df_show.style.apply(
                lambda row: [
                    "background-color: #FEE2E2" if row["Risk"] == "HIGH" else
                    ("background-color: #FEF3C7" if row["Risk"] == "MEDIUM" else "")
                    for _ in row
                ],
                axis=1
            ),
            use_container_width=True,
            hide_index=True,
        )


# =============================================================================
# TAB 4: COST ANALYTICS & BREAKDOWN
# =============================================================================
with tab_analytics:
    st.subheader("Structural Cost Variance Analytics & Outlier Clustering")
    st.caption("Multi-dimensional analysis of volume-to-cost distributions, hierarchical expenditure, and concrete mix consumption.")

    c_g1, c_g2 = st.columns(2)
    with c_g1:
        st.plotly_chart(build_cost_sunburst(df_audited), use_container_width=True)
    with c_g2:
        st.plotly_chart(build_anomaly_scatter_plot(df_audited), use_container_width=True)

    c_g3, c_g4 = st.columns(2)
    with c_g3:
        st.plotly_chart(build_concrete_grade_breakdown(df_audited), use_container_width=True)
    with c_g4:
        # Storey cost breakdown
        storey_grp = df_audited.groupby("storey").agg(
            cost_lakhs=("total_cost_inr", lambda x: round(x.sum() / 100000.0, 2)),
            concrete_m3=("concrete_vol_cum", "sum")
        ).reset_index()
        st.markdown("#### Structural Expenditure by Storey Level")
        st.bar_chart(storey_grp, x="storey", y="cost_lakhs", color="#0284C7")


# =============================================================================
# TAB 5: SCHEDULE OF RATES (SOR)
# =============================================================================
with tab_rates:
    st.subheader("Schedule of Rates (SOR) & Structural Norms Card")
    st.caption("CPWD Delhi Schedule of Rates (DSR 2023) baseline parameters with active project multipliers.")

    cr1, cr2 = st.columns(2)
    
    with cr1:
        st.markdown("#### Concrete Work Rates (Per m³)")
        concrete_rates_table = []
        for g, d in DEFAULT_CONCRETE_RATES.items():
            if g == "DEFAULT":
                continue
            effective_rate = d["rate"] * active_rate_multiplier
            concrete_rates_table.append({
                "Grade": g,
                "DSR Code": d["code"],
                "Base DSR 2023": f"₹{d['rate']:,.2f}",
                "Active Rate (INR)": f"₹{effective_rate:,.2f}",
            })
        st.dataframe(pd.DataFrame(concrete_rates_table), hide_index=True, use_container_width=True)

    with cr2:
        st.markdown("#### Steel & Shuttering Unit Rates")
        steel_effective = STEEL_RATES["rate_per_tonne"] * active_rate_multiplier
        st.markdown(f"""
        - **TMT Reinforcement Steel ({STEEL_RATES['code']}):**
          - Base Rate: ₹{STEEL_RATES['rate_per_tonne']:,.2f} / MT (₹{STEEL_RATES['rate_per_kg']:.2f} / kg)
          - Effective Project Rate: **₹{steel_effective:,.2f} / MT**
        """)

        formwork_table = []
        for ifc_t, fd in FORMWORK_RATES.items():
            if ifc_t == "DEFAULT":
                continue
            eff = fd["rate"] * active_rate_multiplier
            formwork_table.append({
                "Structural Member": ifc_t.replace("Ifc", ""),
                "DSR Code": fd["code"],
                "Active Rate (₹/m²)": f"₹{eff:,.2f}",
            })
        st.dataframe(pd.DataFrame(formwork_table), hide_index=True, use_container_width=True)

    st.markdown("#### SP-34 Reinforcement Detailing Thumb Rules")
    thumb_cols = st.columns(len(REBAR_DENSITY_THUMB_RULES) - 1)
    for idx, (k, val) in enumerate(REBAR_DENSITY_THUMB_RULES.items()):
        if k == "DEFAULT":
            continue
        with thumb_cols[idx]:
            st.metric(k.replace("Ifc", ""), f"{val:.0f} kg/m³")


# =============================================================================
# TAB 6: EXPORT CENTER
# =============================================================================
with tab_export:
    st.subheader("Professional Export Center")
    st.caption("Generate presentation-ready, multi-tab Microsoft Excel workbooks (.xlsx) and CSV schedules for contractor tendering, L&T ERP, and SAP integration.")

    exporter = BOQExcelExporter()
    excel_bytes = exporter.export_to_bytes(
        metadata=metadata,
        kpis=kpis,
        df_boq=df_boq,
        df_audited=df_audited,
        audit_summary=audit_summary,
    )

    exp_col1, exp_col2, exp_col3 = st.columns(3)

    with exp_col1:
        st.markdown("### 📊 Multi-Tab Excel Workbook")
        st.write("Includes Executive Summary, Abstract BOQ, Detailed M-Book, and Anomaly Audit Log.")
        st.download_button(
            label="⬇️ Download Complete BOQ (.xlsx)",
            data=excel_bytes,
            file_name=f"OpenBIM_BOQ_{metadata.get('project_name', 'Project').replace(' ', '_')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
        )

    with exp_col2:
        st.markdown("### 📋 Abstract BOQ Schedule")
        st.write("Standard CSV formatted table for ERP and accounting imports.")
        csv_boq = df_boq.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="⬇️ Download Abstract BOQ (.csv)",
            data=csv_boq,
            file_name="Abstract_BOQ_CPWD.csv",
            mime="text/csv",
            use_container_width=True,
        )

    with exp_col3:
        st.markdown("### 🚨 Anomaly Audit Log")
        st.write("Filtered log of flagged high/medium risk items with surveyor action notes.")
        anomalies_only = df_audited[df_audited["risk_level"].isin(["HIGH", "MEDIUM"])]
        csv_anomalies = anomalies_only.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="⬇️ Download Anomaly Log (.csv)",
            data=csv_anomalies,
            file_name="BIM_Cost_Variance_Anomalies.csv",
            mime="text/csv",
            use_container_width=True,
        )
