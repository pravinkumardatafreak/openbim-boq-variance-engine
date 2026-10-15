# 🏗️ OpenBIM (IFC) Automated BOQ & Cost Variance Intelligence Engine

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![OpenBIM](https://img.shields.io/badge/BIM-IfcOpenShell_IFC4-green.svg)](https://ifcopenshell.org/)
[![Streamlit](https://img.shields.io/badge/UI-Streamlit_Cockpit-red.svg)](https://streamlit.io/)
[![Scikit-Learn](https://img.shields.io/badge/ML-Isolation_Forest_&_LOF-orange.svg)](https://scikit-learn.org/)
[![SHAP](https://img.shields.io/badge/XAI-TreeSHAP-brightgreen.svg)](https://shap.readthedocs.io/)
[![Google Gemini](https://img.shields.io/badge/GenAI-Google_Gemini-4285F4.svg)](https://ai.google.dev/)
[![CPWD](https://img.shields.io/badge/Rates-CPWD_DSR_2023-purple.svg)](https://cpwd.gov.in/)

> **OpenBIM Cost Intelligence Platform:**  
> An automated, production-grade computational pipeline for parsing Industry Foundation Classes (IFC4/IFC2x3) structural models, generating CPWD-compliant Bills of Quantities (BOQ), performing Explainable AI (TreeSHAP) anomaly diagnostics, evaluating unsupervised detection on synthetic corruption benchmarks, and synthesizing live executive structural audit memos via Google Gemini GenAI.

---

## 📌 Industry Challenge: Manual BIM Auditing & Quantity Variance in EPC Projects

BIM modelers design detailed 3D architectural and structural models in **Autodesk Revit**, **Tekla Structures**, or **Graphisoft ArchiCAD**, and export them as **IFC (Industry Foundation Classes)** files. 

Historically:
1. **Manual Quantity Auditing:** Cost engineers and quantity surveyors (QS) spend days manually exporting schedules, copy-pasting concrete volumes, rebar tonnages, and formwork areas into disparate spreadsheets to prepare the Bill of Quantities (BOQ).
2. **Cost Dispute Cycles:** Discrepancies between modeled volumes and subcontractor billing (such as accidental 3x depth typos, unassigned concrete grades, or missing property sets) lead to severe cost overruns and protracted arbitration disputes.
3. **Black-Box Alert Fatigue:** Unsupervised anomaly detectors often pool disparate member distributions together (e.g. comparing thin expansive slabs to slender heavy columns) or flag alerts without explainable root-cause attribution.

---

## 🚀 The Solution: AI-Powered OpenBIM Cost Intelligence

This system transforms IFC BIM models into **instant, auditable, and CPWD-compliant Bills of Quantities** backed by rigorous data science methodology:

```
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│  Any .ifc Model │  ───> │ IfcOpenShell Parser  │  ───> │      BOQ Engine        │
│  (Revit/Tekla)  │       │ (Qto, Geometry, Mat) │       │   (CPWD DSR 2023 SOR)  │
└─────────────────┘       └──────────────────────┘       └───────────┬────────────┘
                                                                     │
                                  ┌──────────────────────────────────┴───────────┐
                                  ▼                                              ▼
                    ┌───────────────────────────┐                  ┌───────────────────────────┐
                    │  AI Anomaly & XAI Suite   │                  │  Enterprise Cockpit & UI  │
                    │  • TreeSHAP Waterfall     │                  │  • 3D BIM Viewer (Plotly) │
                    │  • Stratified Residuals   │                  │  • Abstract BOQ & Sunburst│
                    │  • Multi-Model Benchmark  │                  │  • Multi-Tab Excel Export │
                    │  • Semantic DSR Matcher   │                  │  • R&D Calibration Lab    │
                    └─────────────┬─────────────┘                  └─────────────┬─────────────┘
                                  │                                              │
                                  └──────────────────────┬───────────────────────┘
                                                         ▼
                                          ┌─────────────────────────────┐
                                          │ 🤖 GenAI Structural Copilot │
                                          │ • Live Executive Audit Memo │
                                          │ • Conversational Q&A Auditor│
                                          │ • Google Gemini (2.5/3.5)   │
                                          └─────────────────────────────┘
```

---

## 🔑 Key Engineering & Data Science Capabilities

### 1. GenAI Structural Cost Copilot & Live Audit Memorandum (`core/genai_copilot.py`)
- **Automated Executive Audit Memo:** Dynamically synthesizes model geometry, CPWD DSR quantities, and anomaly risk factors into an authoritative executive engineering memorandum covering:
  1. *Executive Synthesis & Commercial Exposure:* Identifies total expenditure and financial risk tied to anomalous members.
  2. *Root-Cause Member Diagnostics:* Explains modeling errors (e.g. cross-section dimension typos, missing base quantities) in specific members like `Column C-GF-32` and `Footing F-23`.
  3. *Value Engineering Recommendations:* Evaluates concrete grade substitutions (e.g., M40 to M35 on non-critical members) and shuttering standardization to cut material costs.
  4. *Pre-Tender Action Plan:* Recommends contract reconciliation steps prior to Letter of Intent (LOI) issuance.
- **Conversational BIM Auditor (Live Q&A):** Provides interactive conversational question answering grounded in the active IFC model data. Cost surveyors can ask targeted clarification questions about member sizing, CPWD rates, mix grades, or dispute risks with instant, quantitative citations.
- **Resilient Multi-Model Failover:** Implements sequential fallback across Google Gemini models (`gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.7-flash`, `gemini-3.8-flash`) via the modern `google-genai` SDK, with instant offline fallback to a verified structural baseline when operating without network connectivity.

### 2. Model Interpretability & Explainable AI (`core/interpretability.py`)
- **TreeSHAP Attribution:** Calculates exact Shapley values for the Isolation Forest decision function using `shap.TreeExplainer`.
- **Local Waterfall Diagnostics:** When a surveyor selects any structural member, the engine renders an interactive waterfall plot decomposing the prediction from baseline expectation $E[f(x)]$ into constituent feature impacts (Volume Surge, Formwork-to-Volume Ratio, Rebar Density, Cost Density).
- **Global Feature Importance:** Computes $E[|\text{SHAP}|]$ across the entire building model to identify primary dimensional risk drivers.

### 3. Multi-Class Stratified Physical Residual Scoring (`core/stratified_residuals.py`)
- **Class-Conditioned Modeling:** Avoids distribution pooling errors by conditioning on member taxonomy (`IfcColumn`, `IfcBeam`, `IfcSlab`, `IfcFooting`). Slabs naturally possess large surface-to-volume ratios, while columns carry high reinforcement ratios.
- **Regularized Physical Baseline (Ridge):** Fits L2-regularized linear models predicting expected formwork contact area ($\hat{Y}_{\text{fw}}$) and rebar weight ($\hat{Y}_{\text{rebar}}$) from physical bounding dimensions and span lengths.
- **Studentized Residuals:** Identifies physical departures ($|z_{\text{residual}}| \ge 2.5\sigma$) independent of absolute member scale.

### 4. Semi-Supervised Synthetic Benchmarking & Calibration Lab (`core/benchmarking.py`)
- **BIM Error Injection Pipeline:** Generates controlled evaluation benchmarks with ground-truth binary labels ($y \in \{0, 1\}$) by injecting parameterized unit errors ($1000\times$ mm³ to m³), cross-section typos ($3.5\times$ depth), rebar surges ($+350\%$), and shuttering under-reporting.
- **Multi-Detector Suite:** Concurrently benchmarks:
  - **Isolation Forest** (Tree-based recursive partitioning)
  - **Local Outlier Factor (LOF)** (Density-based local reachability distance)
  - **Robust Elliptic Envelope** (Mahalanobis distance via Minimum Covariance Determinant)
- **Calibrated Decision Threshold ($\tau^*$):** Evaluates Precision-Recall (PR-AUC) and ROC curves across varying cutoffs to determine the optimal threshold maximizing the F1-Score:
  $$\tau^* = \arg\max_\tau F_1(\tau)$$

### 5. Semantic Schedule of Rates Matcher via Vector Similarity (`core/semantic_matcher.py`)
- **Vector Space Retrieval:** Replaces brittle regex matching with character + word n-gram TF-IDF vector embeddings over the official CPWD Delhi Schedule of Rates (DSR 2023).
- **Confidence Scoring:** Computes cosine similarity between unstructured BIM specification strings (e.g., `"M35 High Performance Pumping Concrete with 150mm slump for transfer girder"`) and DSR items, returning top-3 ranked matches with confidence percentages and tier classifications.

### 6. Automated BOQ & CPWD / DSR Schedule of Rates (`core/boq_calculator.py`)
- Aggregates concrete mix quantities by grade: **M20, M25, M30, M35, M40, M50**.
- Computes reinforcement steel tonnage using Indian Standard **SP-34** detailing thumb rules (175 kg/m³ for columns, 145 kg/m³ for beams, 95 kg/m³ for footings) or custom density overrides.
- Applies standard **CPWD Delhi Schedule of Rates (DSR 2023)** item codes (e.g., `CPWD-DSR-05.33.2` for M30 RCC, `CPWD-DSR-05.22.6` for Fe-500D TMT reinforcement, `CPWD-DSR-05.09` for shuttering).

### 7. Interactive 3D BIM Viewer & Cockpit (`utils/visualizer.py` & `app.py`)
- True **3D spatial visualization** using Plotly 3D with interactive rotation, turntable, pan, and zoom.
- Color coding modes:
  - **🚨 Risk Level:** Normal elements in Slate Grey, High-Risk Anomalies in Vivid Crimson Red.
  - **🧱 Element Class:** Footings (Amber), Columns (Indigo), Beams (Cyan), Slabs (Emerald).
  - **🧪 Concrete Mix Grade:** M20, M25, M30, M35, M40.
- Hierarchical **Cost Sunburst** and **Treemap** visualizations.

### 8. Multi-Tab Professional Excel Export (`core/excel_exporter.py`)
- Exports presentation-ready, formatted `.xlsx` workbooks using `openpyxl`:
  - **Tab 1: Executive Summary:** Project metadata, total cost, volume, steel tonnage, and risk alert status.
  - **Tab 2: Abstract of Cost (BOQ):** CPWD item codes, units, quantities, rates, amounts, and cost percentage shares.
  - **Tab 3: Itemized Measurement Sheet (M-Book):** Member-by-member takeoff with GlobalIds, names, dimensions, and individual cost items.
  - **Tab 4: Cost Anomaly Audit Log:** Flagged high/medium risk items with diagnostic explanations and recommended surveyor actions.

---

## 📂 Project Structure

```
├── app.py                      # Main Streamlit web application & cockpit
├── requirements.txt            # Python dependencies (including SHAP)
├── README.md                   # Technical documentation and workflow guide
│
├── core/
│   ├── __init__.py
│   ├── ifc_parser.py           # IfcOpenShell multi-tier element & geometry parser
│   ├── sample_generator.py     # Synthesizes realistic G+2 commercial framing IFC
│   ├── boq_calculator.py       # CPWD DSR rate engine & steel/formwork calculator
│   ├── anomaly_detector.py     # Multi-layer anomaly detector (Z-Score + ML + QA)
│   ├── interpretability.py     # TreeSHAP explainability & waterfall diagnostics
│   ├── stratified_residuals.py # Class-conditioned Ridge physical regression
│   ├── benchmarking.py         # Multi-model ROC/PR calibration lab
│   ├── semantic_matcher.py     # Vector space cosine similarity DSR matcher
│   ├── genai_copilot.py        # Google Gemini GenAI audit memo & conversational copilot
│   └── excel_exporter.py       # Multi-tab professional openpyxl Excel exporter
│
├── config/
│   ├── __init__.py
│   └── rates.py                # CPWD DSR 2023 rates, thumb rules & multipliers
│
├── utils/
│   ├── __init__.py
│   └── visualizer.py           # Plotly 3D structural model & cost analytics
│
└── sample_models/              # Stores benchmark & uploaded IFC models
```

---

## ⚡ Quickstart Guide

### 1. Prerequisites
- Python 3.10+ (Tested on Python 3.10, 3.11, 3.12, 3.13, 3.14)
- Pip

### 2. Installation
```bash
pip install -r requirements.txt
```

### 3. Run the Cockpit
```bash
streamlit run app.py
```
Open your browser to `http://localhost:8501`.

---

## 💡 Enterprise Quality Assurance & Verification Workflow

1. **Ingestion & Automated Takeoff:**
   - Drop any structural IFC file exported from Revit, Tekla, or ArchiCAD into the cockpit or load the pre-configured commercial framing benchmark.
   - The engine automatically resolves spatial containers, storeys, concrete grades, and base quantities in under 2 seconds.

2. **Visual 3D Triage:**
   - Review structural elements in the interactive 3D viewer.
   - Switch Color Mode to **Risk Level** to immediately spot red-highlighted geometric or volumetric anomalies across the building framing.

3. **Explainable AI (TreeSHAP) Root Cause Analysis:**
   - Select any flagged element to generate a local waterfall plot decomposing the anomaly score into its primary physical drivers (volume surge, aspect ratio mismatch, formwork-to-volume discrepancy).

4. **Model Benchmarking & Threshold Calibration:**
   - Navigate to the **R&D Benchmark & Calibration Lab** to evaluate Isolation Forest vs. LOF vs. Elliptic Envelope across ROC and PR curves on parameterized BIM error injections, calibrating the optimal decision cutoff threshold $\tau^*$.

5. **GenAI Executive Audit & Conversational Q&A:**
   - Switch to **GenAI Audit Memo & Copilot** to stream comprehensive executive engineering audit memos reviewing financial exposure, value engineering mix alternatives, and pre-tender mitigation steps.
   - Engage with the conversational copilot to ask targeted queries on CPWD item codes, IS 456 concrete grades, or contractor billing risks.

6. **Multi-Tab Excel Delivery:**
   - Export fully formatted `.xlsx` workbooks containing Executive Summaries, CPWD Abstract of Cost, Itemized M-Books, and Audit Logs ready for executive signoff and ERP/SAP integration.

---

## 📜 License
MIT License. Open-source for BIM engineers, quantity surveyors, and construction technologists worldwide.
