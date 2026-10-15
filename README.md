# 🏗️ OpenBIM (IFC) Automated BOQ & Cost Variance Intelligence Engine

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![OpenBIM](https://img.shields.io/badge/BIM-IfcOpenShell_IFC4-green.svg)](https://ifcopenshell.org/)
[![Streamlit](https://img.shields.io/badge/UI-Streamlit_Cockpit-red.svg)](https://streamlit.io/)
[![Scikit-Learn](https://img.shields.io/badge/ML-Isolation_Forest-orange.svg)](https://scikit-learn.org/)
[![CPWD](https://img.shields.io/badge/Rates-CPWD_DSR_2023-purple.svg)](https://cpwd.gov.in/)

> **OpenBIM Cost Intelligence Platform:**  
> An automated pipeline for parsing Industry Foundation Classes (IFC4/IFC2x3) structural models, generating CPWD-compliant Bills of Quantities (BOQ), and performing unsupervised machine learning anomaly detection to eliminate contractor quantity disputes and cost overruns.

---

## 📌 Industry Challenge: Manual BIM Auditing & Quantity Variance in EPC Projects

BIM modelers design detailed 3D architectural and structural models in **Autodesk Revit**, **Tekla Structures**, or **Graphisoft ArchiCAD**, and export them as **IFC (Industry Foundation Classes)** files. 

Historically:
1. **Manual Quantity Auditing:** Cost engineers and quantity surveyors (QS) spend days manually exporting schedules, copy-pasting concrete volumes, rebar tonnages, and formwork areas into disparate spreadsheets to prepare the Bill of Quantities (BOQ).
2. **Cost Dispute Cycles:** Discrepancies between modeled volumes and subcontractor billing (such as accidental 3x depth typos, unassigned concrete grades, or missing property sets) lead to severe cost overruns and protracted arbitration disputes.
3. **No Automated QA:** Traditional takeoff workflows lack statistical or machine learning QA to identify anomalous geometric spikes before tenders and payment certificates are finalized.

---

## 🚀 The Solution: AI-Powered OpenBIM Cost Intelligence

This system transforms IFC BIM models into **instant, auditable, and CPWD-compliant Bills of Quantities** with built-in unsupervised machine learning anomaly detection.

```
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│  Any .ifc Model │  ───> │ IfcOpenShell Parser  │  ───> │      BOQ Engine        │
│  (Revit/Tekla)  │       │ (Qto, Geometry, Mat) │       │   (CPWD DSR 2023 SOR)  │
└─────────────────┘       └──────────────────────┘       └───────────┬────────────┘
                                                                     │
                                  ┌──────────────────────────────────┴───────────┐
                                  ▼                                              ▼
                    ┌───────────────────────────┐                  ┌───────────────────────────┐
                    │  AI Anomaly Engine        │                  │ Interactive Cockpit       │
                    │  • Isolation Forest (ML)  │                  │ • 3D BIM Viewer (Plotly)  │
                    │  • Cohort Z-Score Spikes  │                  │ • Abstract BOQ & Sunburst │
                    │  • Engineering QA Rules   │                  │ • Multi-Tab Excel Export  │
                    └───────────────────────────┘                  └───────────────────────────┘
```

---

## 🔑 Key Features

### 1. Robust IFC Model Ingestion (`core/ifc_parser.py`)
- Ingests **IFC2X3** and **IFC4** models from any major BIM platform.
- Automatically extracts primary structural elements: `IfcColumn`, `IfcBeam`, `IfcSlab`, `IfcFooting`, and `IfcWall`.
- **Multi-tiered extraction:** Scans standard BaseQuantities (`Qto_BeamBaseQuantities`, `Qto_ColumnBaseQuantities`, etc.), material layers (`IfcMaterial`, `IfcMaterialLayerSet`), and falls back to 3D bounding geometry when explicit Qto sets are missing.

### 2. Automated BOQ & CPWD / DSR Schedule of Rates (`core/boq_calculator.py`)
- Aggregates concrete quantities by grade: **M20, M25, M30, M35, M40, M50**.
- Automatically computes reinforcement steel tonnage using Indian Standard **SP-34** detailing thumb rules (e.g. 175 kg/m³ for columns, 145 kg/m³ for beams, 95 kg/m³ for footings) or custom density overrides.
- Computes shuttering/formwork contact area per element class.
- Applies standard **CPWD Delhi Schedule of Rates (DSR 2023)** item codes (e.g., `CPWD-DSR-05.33.2` for M30 RCC, `CPWD-DSR-05.22.6` for Fe-500D TMT reinforcement, `CPWD-DSR-05.09` for shuttering).
- Live rate index adjustment slider for local regional cost indexing (e.g., Tier-1 Metro Benchmark +8%, High-Rise Coastal +15%).

### 3. AI Anomaly & Variance Audit (`core/anomaly_detector.py`)
- **Unsupervised Machine Learning:** Scikit-Learn **Isolation Forest** trained on multi-dimensional geometric and cost features (`concrete_volume`, `total_cost`, `formwork_ratio`, `cost_density`) to discover non-linear dimensional outliers.
- **Statistical Cohort Z-Score Analysis:** Computes localized standard deviations for each `(ElementType, Storey)` peer cohort. Elements with $|Z| \ge 2.5$ or abnormal volume jumps (e.g. 3.5x peer average) are immediately flagged.
- **Engineering QA Checks:**
  - Flags unassigned concrete mix grades (defaulting to M25 with cost risk warning).
  - Flags corrupted microscopic quantities (e.g., volume $\le 0.01\text{ m}^3$).
  - Flags single-element cost spikes exceeding 15% of the total storey budget.

### 4. Interactive 3D BIM Viewer & Cockpit (`utils/visualizer.py` & `app.py`)
- True **3D spatial visualization** using Plotly 3D with interactive rotation, turntable, pan, and zoom.
- Color coding modes:
  - **🚨 Risk Level:** Normal elements in Slate Grey, High-Risk Anomalies in Vivid Crimson Red.
  - **🧱 Element Class:** Footings (Amber), Columns (Indigo), Beams (Cyan), Slabs (Emerald).
  - **🧪 Concrete Mix Grade:** M20, M25, M30, M35, M40.
- Deep-dive **Element Inspector** to review individual member dimensions, property sets, and cost contributions.
- Hierarchical **Cost Sunburst** and **Treemap** visualizations.

### 5. Multi-Tab Professional Excel Export (`core/excel_exporter.py`)
- Exports presentation-ready, formatted `.xlsx` workbooks using `openpyxl`:
  - **Tab 1: Executive Summary:** Project metadata, total cost, volume, steel tonnage, and risk alert status.
  - **Tab 2: Abstract of Cost (BOQ):** CPWD item codes, units, quantities, rates, amounts, and cost percentage shares.
  - **Tab 3: Itemized Measurement Sheet (M-Book):** Member-by-member takeoff with GlobalIds, names, dimensions, and individual cost items.
  - **Tab 4: Cost Anomaly Audit Log:** Flagged high/medium risk items with diagnostic explanations and recommended surveyor actions.

### 6. Synthetic Benchmark Model Generator (`core/sample_generator.py`)
- Built-in generator creates an authentic **G+2 Commercial Framed Complex** (163 structural members across Substructure, Ground Floor, First Floor, and Roof).
- Injected with realistic, intentional anomalies for algorithm validation and stress testing:
  - Column `C-GF-32` has a depth typo (2.4m instead of 0.6m) giving a **+237% volume jump** ($Z = 3.75$).
  - Footing `F-23` has an accidental $13.23\text{ m}^3$ oversized volume jump.
  - Floor Slab `S-1F-Bay13` has a corrupted $0.001\text{ m}^3$ Qto volume record.
  - Beam `B-1F-X2-2` has an unassigned concrete grade.

---

## 📂 Project Structure

```
├── app.py                      # Main Streamlit web application & cockpit
├── requirements.txt            # Python dependencies
├── README.md                   # Technical documentation and workflow guide
│
├── core/
│   ├── __init__.py
│   ├── ifc_parser.py           # IfcOpenShell multi-tier element & geometry parser
│   ├── sample_generator.py     # Synthesizes realistic G+2 commercial framing IFC
│   ├── boq_calculator.py       # CPWD DSR rate engine & steel/formwork calculator
│   ├── anomaly_detector.py     # Isolation Forest & Cohort Z-score anomaly detector
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

3. **Machine Learning Anomaly Audit:**
   - Inspect the **AI Anomaly & Variance Audit Tab** to examine Isolation Forest outlier scores and cohort Z-scores.
   - Flag design-stage dimensional input errors (e.g., column cross-section typos, microscopic slab thicknesses) before subcontractor dispute cycles or tendering.

4. **Multi-Tab Excel Delivery:**
   - Export fully formatted `.xlsx` workbooks containing Executive Summaries, CPWD Abstract of Cost, Itemized M-Books, and Audit Logs ready for executive signoff and ERP/SAP integration.

---

## 📜 License
MIT License. Open-source for BIM engineers, quantity surveyors, and construction technologists worldwide.
