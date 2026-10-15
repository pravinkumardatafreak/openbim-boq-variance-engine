# 🏗️ OpenBIM (IFC) Automated BOQ & Cost Variance Intelligence Engine

[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/3D-Three.js-black.svg)](https://threejs.org/)
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

## 🚀 Key Engineering & Data Science Capabilities

### 1. Interactive 3D BIM Structural Viewer (`src/components/ThreeBimViewer.tsx`)
- True **3D spatial WebGL rendering** using Three.js with orbit rotation, pan, zoom, and wireframe bounding box toggles.
- Dynamic color-coding modes:
  - 🚨 **Risk Level** (High-risk anomalies highlighted in crimson red, medium in amber)
  - 🧱 **Structural Element Class** (Footings, Columns, Beams, Slabs)
  - 🧪 **Concrete Mix Grade** (M20 through M50)
- Interactive hover tooltips and click-to-inspect element diagnostics.

### 2. Automated BOQ & CPWD / DSR Schedule of Rates (`src/core/boqEngine.ts`)
- Aggregates concrete mix quantities by grade: **M20, M25, M30, M35, M40, M50**.
- Computes reinforcement steel tonnage using Indian Standard **SP-34** detailing thumb rules (175 kg/m³ for columns, 145 kg/m³ for beams, 95 kg/m³ for footings) or custom density overrides.
- Applies standard **CPWD Delhi Schedule of Rates (DSR 2023)** item codes (e.g., `CPWD-DSR-05.33.2` for M30 RCC, `CPWD-DSR-05.22.6` for Fe-500D TMT reinforcement, `CPWD-DSR-05.09` for shuttering).

### 3. Model Interpretability & Explainable AI (`src/core/shapExplainer.ts`)
- **TreeSHAP Attribution:** Calculates exact Shapley feature attributions for isolation decision scores.
- **Local Waterfall Diagnostics:** Interactive waterfall decomposition from cohort baseline expectation $E[f(x)]$ into constituent feature impacts (Volume Surge, Formwork-to-Volume Ratio, Cost Density).
- **Global Feature Importance:** Computes mean $|SHAP|$ across the entire building model.

### 4. Multi-Class Stratified Physical Residual Scoring (`src/core/stratifiedResiduals.ts`)
- **Class-Conditioned Modeling:** Avoids distribution pooling errors by conditioning on member taxonomy (`IfcColumn`, `IfcBeam`, `IfcSlab`, `IfcFooting`).
- **Regularized Physical Baseline (Ridge):** Fits L2-regularized linear models predicting expected formwork contact area ($\hat{Y}_{\text{fw}}$) and rebar weight ($\hat{Y}_{\text{rebar}}$).
- **Studentized Residuals:** Identifies physical departures ($|z_{\text{residual}}| \ge 2.5\sigma$) independent of absolute member scale.

### 5. Semi-Supervised Synthetic Benchmarking & Calibration Lab (`src/core/benchmarkLab.ts`)
- **BIM Error Injection Pipeline:** Generates controlled evaluation benchmarks with ground-truth binary labels ($y \in \{0, 1\}$) by injecting unit scale errors ($0.005\text{ m}^3$), cross-section typos ($3.5\times$ depth), rebar surges ($+350\%$), and shuttering under-reporting.
- **Multi-Detector Suite:** Concurrently benchmarks Isolation Forest, Local Outlier Factor, and Robust Elliptic Envelope.
- **Calibrated Decision Threshold ($\tau^*$):** Evaluates PR-AUC and ROC curves across cutoffs to maximize F1-Score:
  $$\tau^* = \arg\max_\tau F_1(\tau)$$

### 6. Semantic Schedule of Rates Matcher via Vector Similarity (`src/core/semanticMatcher.ts`)
- **Vector Space Retrieval:** Character + word n-gram TF-IDF vector embeddings over the official CPWD Delhi Schedule of Rates (DSR 2023).
- **Confidence Scoring:** Computes cosine similarity between unstructured BIM specification strings and DSR items with top-3 ranked matches and confidence percentages.

### 7. GenAI Structural Cost Copilot & Live Audit Memorandum (`src/core/genaiCopilot.ts`)
- **Executive Audit Memo:** Dynamically synthesizes model geometry, CPWD DSR quantities, and anomaly risk factors into an authoritative engineering memorandum covering commercial exposure, root-cause diagnostics on specific members (`Column C-GF-32`, `Footing F-23`), value engineering, and contractual action plan.
- **Conversational BIM Auditor (Live Q&A):** Interactive chat grounded in active model data powered by Google Gemini (`@google/genai`), with offline calibrated fallback.

### 8. Professional Export Center (`src/core/excelExporter.ts`)
- Multi-Tab Microsoft Excel workbook (.xlsx): Executive Summary, Abstract BOQ, Detailed M-Book, and Anomaly Audit Log.
- Direct CSV downloads for Abstract BOQ and Anomaly Log.
- Markdown export for Executive Audit Memorandum (.md).

---

## 🛠️ Development & Build

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Production build
npm run build
```
