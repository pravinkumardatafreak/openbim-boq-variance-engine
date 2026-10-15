import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Cpu,
  BarChart3,
  FileSpreadsheet,
  AlertTriangle,
  Bot,
  TestTube2,
  DollarSign,
  Download,
  Search,
  Sparkles,
  Send,
  Layers,
  Box,
  Eye,
  RefreshCw,
  FileText,
  CheckCircle2,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  AuditedBIMElement,
  BOQLineItem,
  KPISummary,
  ModelMetadata,
  AuditSummary,
  SORMatchResult,
} from './types/bim';
import { RATE_SCHEDULE_PRESETS, DEFAULT_CONCRETE_RATES, STEEL_RATES, FORMWORK_RATES } from './config/rates';
import { loadSampleModel, parseIFCContent } from './core/ifcParser';
import { BOQEngine } from './core/boqEngine';
import { BIMAnomalyDetector } from './core/anomalyDetector';
import { AnomalyExplainer } from './core/shapExplainer';
import { AnomalyBenchmarkLab } from './core/benchmarkLab';
import { SemanticSORMatcher } from './core/semanticMatcher';
import { BIMGenAICopilot } from './core/genaiCopilot';
import { BOQExcelExporter } from './core/excelExporter';
import { ThreeBimViewer } from './components/ThreeBimViewer';

export const App: React.FC = () => {
  // Sidebar states
  const [modelSource, setModelSource] = useState<'sample' | 'custom'>('sample');
  const [customIfcName, setCustomIfcName] = useState<string>('');
  const [rawElements, setRawElements] = useState(() => loadSampleModel().elements);
  const [modelMeta, setModelMeta] = useState<ModelMetadata>(() => loadSampleModel().metadata);

  const [activePreset, setActivePreset] = useState<string>('CPWD DSR 2023 (Delhi / Central India)');
  const [rateMultiplierPct, setRateMultiplierPct] = useState<number>(100);
  const [zScoreThresh, setZScoreThresh] = useState<number>(2.5);
  const [isoContamination, setIsoContamination] = useState<number>(0.05);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<number>(0);

  // Tab 1 (3D Explorer) states
  const [colorMode, setColorMode] = useState<'risk_level' | 'ifc_type' | 'concrete_grade'>('risk_level');
  const [selectedStoreys, setSelectedStoreys] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showWireframes, setShowWireframes] = useState<boolean>(true);
  const [selectedElementTag, setSelectedElementTag] = useState<string>('#16');
  const [isInspectorExpanded, setIsInspectorExpanded] = useState<boolean>(true);

  // Tab 2 (BOQ) states
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');

  // Tab 3 (Anomaly) states
  const [riskFilter, setRiskFilter] = useState<'ALL_FLAGGED' | 'HIGH_ONLY' | 'ALL'>('ALL_FLAGGED');
  const [showGlobalShap, setShowGlobalShap] = useState<boolean>(false);

  // Tab 4 (Copilot) states
  const [auditMemo, setAuditMemo] = useState<string>('');
  const [isGeneratingMemo, setIsGeneratingMemo] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        'Hello! I am your OpenBIM Structural Cost Copilot. Ask me any question about model quantities, CPWD DSR rate items, or flagged high-risk anomalies.',
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Tab 6 (Benchmark Lab) states
  const [benchCorruptionRate, setBenchCorruptionRate] = useState<number>(8);
  const [benchmarkResult, setBenchmarkResult] = useState(() =>
    new AnomalyBenchmarkLab().runMultiModelBenchmark(loadSampleModel().elements as any, 8)
  );

  // Tab 7 (Semantic Matcher) states
  const [semanticQuery, setSemanticQuery] = useState<string>(
    'RCC M35 Design Mix high strength pumping concrete for transfer girders'
  );
  const [semanticMatches, setSemanticMatches] = useState<SORMatchResult[]>([]);

  // Rates multiplier
  const effectiveRateMultiplier = rateMultiplierPct / 100.0;

  // Handle Preset change
  const handlePresetChange = (presetName: string) => {
    setActivePreset(presetName);
    const p = RATE_SCHEDULE_PRESETS[presetName];
    if (p) {
      setRateMultiplierPct(Math.round(p.multiplier * 100));
    }
  };

  // Compute Enriched BOQ Elements
  const enrichedElements = useMemo(() => {
    const engine = new BOQEngine(effectiveRateMultiplier);
    return engine.computeElementTakeoffs(rawElements);
  }, [rawElements, effectiveRateMultiplier]);

  // Compute Abstract BOQ
  const boqList = useMemo(() => {
    const engine = new BOQEngine(effectiveRateMultiplier);
    return engine.generateAbstractBOQ(enrichedElements);
  }, [enrichedElements, effectiveRateMultiplier]);

  // Compute KPIs
  const kpis: KPISummary = useMemo(() => {
    const engine = new BOQEngine(effectiveRateMultiplier);
    return engine.getKPISummary(enrichedElements);
  }, [enrichedElements, effectiveRateMultiplier]);

  // Run Anomaly Detection
  const auditedElements: AuditedBIMElement[] = useMemo(() => {
    const detector = new BIMAnomalyDetector(isoContamination, zScoreThresh);
    return detector.detectAnomalies(enrichedElements);
  }, [enrichedElements, isoContamination, zScoreThresh]);

  // Audit Summary
  const auditSummary: AuditSummary = useMemo(() => {
    const detector = new BIMAnomalyDetector(isoContamination, zScoreThresh);
    return detector.getAuditSummary(auditedElements);
  }, [auditedElements, isoContamination, zScoreThresh]);

  // Available Storeys & Types
  const allStoreys = useMemo(() => {
    return Array.from(new Set(auditedElements.map((e) => e.storey))).sort();
  }, [auditedElements]);

  const allTypes = useMemo(() => {
    return Array.from(new Set(auditedElements.map((e) => e.ifc_type))).sort();
  }, [auditedElements]);

  // Initialize selected storeys & types
  useEffect(() => {
    if (selectedStoreys.length === 0 && allStoreys.length > 0) {
      setSelectedStoreys(allStoreys);
    }
    if (selectedTypes.length === 0 && allTypes.length > 0) {
      setSelectedTypes(allTypes);
    }
  }, [allStoreys, allTypes]);

  // Selected Element for Inspector
  const selectedElement = useMemo(() => {
    const found = auditedElements.find((e) => e.tag === selectedElementTag);
    return found || auditedElements[0];
  }, [auditedElements, selectedElementTag]);

  // TreeSHAP Explanation for selected element
  const shapExplanation = useMemo(() => {
    if (!selectedElement) return null;
    const explainer = new AnomalyExplainer();
    return explainer.explainInstance(selectedElement, auditedElements);
  }, [selectedElement, auditedElements]);

  // Global SHAP Importance
  const globalShapList = useMemo(() => {
    const explainer = new AnomalyExplainer();
    return explainer.computeGlobalFeatureImportance(auditedElements);
  }, [auditedElements]);

  // Semantic Matcher Runner
  useEffect(() => {
    const matcher = new SemanticSORMatcher();
    const res = matcher.matchSpecification(semanticQuery, 3);
    setSemanticMatches(res);
  }, [semanticQuery]);

  // Generate Memo on startup or trigger
  useEffect(() => {
    if (!auditMemo && auditedElements.length > 0) {
      const copilot = new BIMGenAICopilot(geminiApiKey);
      setAuditMemo(copilot.generateFallbackMemo(modelMeta, kpis, auditSummary));
    }
  }, [auditedElements, kpis, auditSummary, modelMeta]);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomIfcName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseIFCContent(text);
        if (parsed.elements.length > 0) {
          setModelMeta(parsed.metadata);
          setRawElements(parsed.elements);
          setSelectedElementTag(parsed.elements[0].tag);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setModelSource('sample');
    const s = loadSampleModel();
    setModelMeta(s.metadata);
    setRawElements(s.elements);
    setSelectedElementTag('#16');
  };

  // Run Benchmark
  const handleRunBenchmark = () => {
    const lab = new AnomalyBenchmarkLab();
    const res = lab.runMultiModelBenchmark(enrichedElements, benchCorruptionRate);
    setBenchmarkResult(res);
  };

  // Generate Executive Memo
  const handleGenerateMemo = async () => {
    setIsGeneratingMemo(true);
    const copilot = new BIMGenAICopilot(geminiApiKey);
    const memo = await copilot.generateExecutiveAuditMemo(modelMeta, kpis, auditSummary, auditedElements);
    setAuditMemo(memo);
    setIsGeneratingMemo(false);
  };

  // Chat Submission
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim()) return;

    const newHistory = [...chatMessages, { role: 'user' as const, content: textToSend }];
    setChatMessages(newHistory);
    if (!customText) setChatInput('');
    setIsChatLoading(true);

    const copilot = new BIMGenAICopilot(geminiApiKey);
    const reply = await copilot.chatWithAuditor(textToSend, newHistory, modelMeta, kpis, auditSummary, auditedElements);

    setChatMessages([...newHistory, { role: 'assistant' as const, content: reply }]);
    setIsChatLoading(false);
  };

  // Excel & CSV Downloads
  const exporter = useMemo(() => new BOQExcelExporter(), []);

  const handleDownloadExcel = () => {
    exporter.exportToExcel(modelMeta, kpis, boqList, auditedElements, auditSummary);
  };

  const handleDownloadBOQCSV = () => {
    const csv = exporter.generateBOQCSV(boqList);
    exporter.downloadCSV(csv, 'Abstract_BOQ_CPWD.csv');
  };

  const handleDownloadAnomalyCSV = () => {
    const csv = exporter.generateAnomalyCSV(auditedElements);
    exporter.downloadCSV(csv, 'BIM_Cost_Variance_Anomalies.csv');
  };

  const handleDownloadMemoMd = () => {
    const blob = new Blob([auditMemo], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Executive_Audit_Memo_${(modelMeta.project_name || 'Project').replace(/\s+/g, '_')}.md`;
    link.click();
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* ---------------- SIDEBAR CONTROLS ---------------- */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-xl shrink-0">
            🏗️
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight leading-tight">OpenBIM Control Deck</h1>
            <p className="text-[11px] text-slate-300 font-medium">Enterprise Quantity & Cost Intelligence</p>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* 1. BIM Model Ingestion */}
          <div>
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              1. BIM Model Ingestion
            </h3>

            <div className="space-y-2 mt-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                <input
                  type="radio"
                  name="modelSource"
                  checked={modelSource === 'sample'}
                  onChange={handleLoadSample}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-slate-700">⚡ Pre-loaded Commercial Framing Model</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                <input
                  type="radio"
                  name="modelSource"
                  checked={modelSource === 'custom'}
                  onChange={() => setModelSource('custom')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-slate-700">📁 Upload Custom IFC File</span>
              </label>
            </div>

            {modelSource === 'sample' ? (
              <div className="mt-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
                Loaded <b>Commercial Complex - Block B (G+2 Framing)</b> with 163 structural members and engineered cost dispute anomalies.
              </div>
            ) : (
              <div className="mt-2">
                <input
                  type="file"
                  accept=".ifc,.ifczip"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                {customIfcName && (
                  <p className="mt-1 text-[11px] text-emerald-600 font-medium">✓ Uploaded: {customIfcName}</p>
                )}
              </div>
            )}
          </div>

          <hr className="border-slate-200" />

          {/* 2. Schedule of Rates */}
          <div>
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              2. Schedule of Rates (SOR)
            </h3>

            <label className="block text-slate-600 text-[11px] mb-1">Select Rate Schedule:</label>
            <select
              value={activePreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {Object.keys(RATE_SCHEDULE_PRESETS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1 italic">
              ℹ️ {RATE_SCHEDULE_PRESETS[activePreset]?.description}
            </p>

            <div className="mt-3">
              <div className="flex justify-between text-slate-600 mb-1">
                <span>Fine-Tune Rate Index (%):</span>
                <span className="font-bold text-slate-800">{rateMultiplierPct}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={150}
                value={rateMultiplierPct}
                onChange={(e) => setRateMultiplierPct(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>70%</span>
                <span>100% (DSR 2023)</span>
                <span>150%</span>
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* 3. AI Anomaly Parameters */}
          <div>
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              3. AI Anomaly Parameters
            </h3>

            <div className="mb-3">
              <div className="flex justify-between text-slate-600 mb-1">
                <span>Z-Score Outlier Threshold:</span>
                <span className="font-bold text-slate-800">{zScoreThresh.toFixed(1)}σ</span>
              </div>
              <input
                type="range"
                min={1.8}
                max={4.0}
                step={0.1}
                value={zScoreThresh}
                onChange={(e) => setZScoreThresh(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span>Isolation Forest Sensitivity:</span>
                <span className="font-bold text-slate-800">{(isoContamination * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0.01}
                max={0.15}
                step={0.01}
                value={isoContamination}
                onChange={(e) => setIsoContamination(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* 4. Gemini GenAI Copilot */}
          <div>
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-indigo-500" />
              4. 🤖 Gemini GenAI Copilot
            </h3>

            <label className="block text-slate-600 text-[11px] mb-1">Gemini API Key:</label>
            <input
              type="password"
              placeholder="Paste GEMINI_API_KEY..."
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="mt-2">
              {geminiApiKey.trim() ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Gemini Live Generative Mode
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                  ⚪ Calibrated Engineering Mode (Add key for live AI)
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* HERO BANNER */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0B192C] via-[#1E3E62] to-[#001F3F] text-white p-5 shadow-lg border-l-6 border-[#FF6500]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>🏗️</span>
                OpenBIM (IFC) Automated BOQ & Cost Variance Intelligence
              </h1>
              <p className="text-xs text-slate-200 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>Model: <b className="text-white">{modelMeta.project_name || 'Commercial Complex'}</b></span>
                <span>•</span>
                <span>Building: <b className="text-white">{modelMeta.building_name || 'Tower B'}</b></span>
                <span>•</span>
                <span>Schema: <b className="text-white">{modelMeta.schema}</b></span>
                <span>•</span>
                <span>Members: <b className="text-white">{auditedElements.length}</b></span>
              </p>
            </div>
            <div className="shrink-0">
              <span className="inline-block bg-[#FF6500] text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider shadow">
                CPWD DSR 2023 COMPLIANT
              </span>
            </div>
          </div>

          <div className="mt-3.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-2.5 text-xs text-slate-100 flex items-start gap-2">
            <span className="text-amber-400 font-bold shrink-0">⚡ Automated Takeoff & Risk Verification:</span>
            <span>
              Ingests architectural and structural IFC models, extracts volumetric property sets, applies CPWD/DSR Schedule of Rates, and runs multivariate Isolation Forest anomaly detection to catch design-to-billing discrepancies in real-time.
            </span>
          </div>
        </div>

        {/* EXECUTIVE KPI RIBBON */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Card 1 */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs border-t-4 border-t-[#1E3E62]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Structural Members</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">{kpis.total_elements}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{allStoreys.length} Building Levels</div>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs border-t-4 border-t-[#1E3E62]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Concrete Volume</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">
              {kpis.total_concrete_cum.toFixed(1)} <span className="text-xs font-normal text-slate-500">m³</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              ₹{(kpis.concrete_cost_inr / 100000).toFixed(1)}L Concrete Cost
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs border-t-4 border-t-[#1E3E62]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reinforcement Steel</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">
              {kpis.total_steel_tonne.toFixed(1)} <span className="text-xs font-normal text-slate-500">MT</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Avg {kpis.rebar_density_overall} kg/m³ Density</div>
          </div>

          {/* Card 4 */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs border-t-4 border-t-[#1E3E62]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Project BOQ</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">
              ₹{kpis.total_cost_lakhs.toFixed(2)} <span className="text-xs font-normal text-slate-500">Lakhs</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">₹{kpis.total_cost_crores.toFixed(3)} Cr Structural Cost</div>
          </div>

          {/* Card 5 (Alert) */}
          <div
            className={`rounded-xl p-3.5 shadow-xs border-t-4 ${
              auditSummary.high_risk_count > 0
                ? 'bg-red-50/80 border border-red-200 border-t-red-500'
                : 'bg-emerald-50/80 border border-emerald-200 border-t-emerald-500'
            }`}
          >
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                auditSummary.high_risk_count > 0 ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              Cost Dispute Risk
            </div>
            <div
              className={`text-2xl font-extrabold mt-1 ${
                auditSummary.high_risk_count > 0 ? 'text-red-700' : 'text-emerald-800'
              }`}
            >
              {auditSummary.high_risk_count} <span className="text-xs font-normal">High-Risk</span>
            </div>
            <div className={`text-[11px] mt-0.5 ${auditSummary.high_risk_count > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              ₹{auditSummary.at_risk_cost_lakhs.toFixed(2)} Lakhs At-Risk
            </div>
          </div>
        </div>

        {/* ---------------- 8 OPERATIONAL MODULE TABS ---------------- */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Tab Navigation Ribbon */}
          <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/70 p-1 gap-1 text-xs font-medium">
            {[
              { label: '🏗️ 3D Model Explorer', id: 0 },
              { label: '📋 Automated BOQ', id: 1 },
              { label: '🔍 AI Anomaly Audit', id: 2 },
              { label: '🤖 GenAI Copilot', id: 3 },
              { label: '📊 Cost Analytics', id: 4 },
              { label: '🧪 Benchmark Lab', id: 5 },
              { label: '💰 Schedule of Rates', id: 6 },
              { label: '📥 Export Center', id: 7 },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === t.id
                    ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 0: 3D MODEL & TAKEOFF EXPLORER */}
          {activeTab === 0 && (
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Interactive 3D BIM Structural Viewer & Spatial Takeoff
                </h2>
                <p className="text-xs text-slate-500">
                  Rotate, pan, and zoom to inspect structural members in true 3D space. Click any element to view live takeoff parameters and TreeSHAP diagnostics.
                </p>
              </div>

              {/* 3D Filter Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Color Code 3D Elements By:</label>
                  <select
                    value={colorMode}
                    onChange={(e) => setColorMode(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-medium"
                  >
                    <option value="risk_level">🚨 Risk Level (Anomalies in Red)</option>
                    <option value="ifc_type">🧱 Structural Element Class</option>
                    <option value="concrete_grade">🧪 Concrete Mix Grade</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Storey Level Filter:</label>
                  <select
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                    value={selectedStoreys.length === allStoreys.length ? 'ALL' : selectedStoreys[0] || 'ALL'}
                    onChange={(e) => {
                      if (e.target.value === 'ALL') setSelectedStoreys(allStoreys);
                      else setSelectedStoreys([e.target.value]);
                    }}
                  >
                    <option value="ALL">All Levels ({allStoreys.length})</option>
                    {allStoreys.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Class Filter:</label>
                  <select
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                    value={selectedTypes.length === allTypes.length ? 'ALL' : selectedTypes[0] || 'ALL'}
                    onChange={(e) => {
                      if (e.target.value === 'ALL') setSelectedTypes(allTypes);
                      else setSelectedTypes([e.target.value]);
                    }}
                  >
                    <option value="ALL">All Classes ({allTypes.length})</option>
                    {allTypes.map((t) => (
                      <option key={t} value={t}>
                        {t.replace('Ifc', '')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="wf-check"
                    checked={showWireframes}
                    onChange={(e) => setShowWireframes(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="wf-check" className="text-slate-700 font-medium cursor-pointer">
                    Show Wireframe Box
                  </label>
                </div>
              </div>

              {/* 3D Model WebGL Canvas */}
              <ThreeBimViewer
                elements={auditedElements}
                colorBy={colorMode}
                selectedStoreys={selectedStoreys}
                selectedTypes={selectedTypes}
                showBoundingBoxes={showWireframes}
                onSelectElement={(el) => setSelectedElementTag(el.tag)}
                selectedElementTag={selectedElementTag}
              />

              {/* Interactive Element Inspector & Explainable AI */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <button
                  onClick={() => setIsInspectorExpanded(!isInspectorExpanded)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex justify-between items-center text-xs font-bold text-slate-800 transition-colors border-b border-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-indigo-600" />
                    Interactive Element Inspector & Explainable AI (TreeSHAP)
                  </span>
                  {isInspectorExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isInspectorExpanded && selectedElement && (
                  <div className="p-4 space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Select Element to Inspect:</label>
                      <select
                        value={selectedElement.tag}
                        onChange={(e) => setSelectedElementTag(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800 text-xs"
                      >
                        {auditedElements.map((el) => (
                          <option key={el.tag} value={el.tag}>
                            {el.tag} | {el.name} ({el.ifc_type.replace('Ifc', '')} on {el.storey}) - Risk: {el.risk_level}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Member Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Element Name</div>
                        <div className="text-sm font-bold text-slate-800 truncate">{selectedElement.name}</div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">IFC Class</div>
                        <div className="text-sm font-bold text-slate-800">{selectedElement.ifc_type.replace('Ifc', '')}</div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Storey Level</div>
                        <div className="text-sm font-bold text-slate-800">{selectedElement.storey}</div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Concrete Grade</div>
                        <div className="text-sm font-bold text-emerald-600">{selectedElement.concrete_grade}</div>
                      </div>

                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Net Volume</div>
                        <div className="text-sm font-bold text-slate-800">{selectedElement.concrete_vol_cum.toFixed(3)} m³</div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Estimated Steel</div>
                        <div className="text-sm font-bold text-slate-800">{selectedElement.rebar_kg.toFixed(1)} kg</div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Formwork Area</div>
                        <div className="text-sm font-bold text-slate-800">{selectedElement.formwork_sqm.toFixed(2)} m²</div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Total Cost</div>
                        <div className="text-sm font-bold text-amber-600">₹{selectedElement.total_cost_inr.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Stratified Residuals Breakdown */}
                    <div>
                      <h4 className="font-bold text-slate-800 mb-1.5">
                        Stratified Physical Model Residuals (Conditioned by Member Class)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="p-2 rounded bg-indigo-50/60 border border-indigo-100">
                          <div className="text-[10px] text-indigo-700 font-semibold">Expected Formwork</div>
                          <div className="text-xs font-bold text-indigo-900">{selectedElement.formwork_expected_sqm.toFixed(2)} m²</div>
                        </div>
                        <div className="p-2 rounded bg-indigo-50/60 border border-indigo-100">
                          <div className="text-[10px] text-indigo-700 font-semibold">Formwork Residual Z</div>
                          <div className="text-xs font-bold text-indigo-900">
                            {selectedElement.formwork_studentized_residual > 0 ? '+' : ''}
                            {selectedElement.formwork_studentized_residual.toFixed(2)} σ
                          </div>
                        </div>
                        <div className="p-2 rounded bg-indigo-50/60 border border-indigo-100">
                          <div className="text-[10px] text-indigo-700 font-semibold">Expected Steel</div>
                          <div className="text-xs font-bold text-indigo-900">{selectedElement.rebar_expected_kg.toFixed(1)} kg</div>
                        </div>
                        <div className="p-2 rounded bg-indigo-50/60 border border-indigo-100">
                          <div className="text-[10px] text-indigo-700 font-semibold">Steel Residual Z</div>
                          <div className="text-xs font-bold text-indigo-900">
                            {selectedElement.rebar_studentized_residual > 0 ? '+' : ''}
                            {selectedElement.rebar_studentized_residual.toFixed(2)} σ
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Anomaly Diagnosis Banner */}
                    {selectedElement.risk_level !== 'NORMAL' ? (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 space-y-1">
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          Anomaly Audit Flag ({selectedElement.risk_level}): {selectedElement.anomaly_reasons}
                        </div>
                        <div className="text-[11px] text-red-800">
                          <b>Recommended Action:</b> {selectedElement.recommended_action}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Conforms to peer storey volume distributions and CPWD physical norms.
                      </div>
                    )}

                    {/* TreeSHAP Waterfall Diagnostics */}
                    {shapExplanation && (
                      <div className="pt-2">
                        <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-indigo-600" />
                          TreeSHAP Local Feature Attribution
                        </h4>
                        <p className="text-[11px] text-slate-500 mb-2">
                          Decomposition from cohort expectation E[f(x)] ({shapExplanation.expected_value.toFixed(3)}) to member anomaly score ({shapExplanation.predicted_score.toFixed(3)}). Features shifting the score negative push it into the anomaly zone.
                        </p>

                        <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          {shapExplanation.feature_contributions.map((c, i) => (
                            <div key={i} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                              <span className="font-medium text-slate-700">{c.feature}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">Val: {c.feature_value}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    c.shap_value < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {c.shap_value > 0 ? '+' : ''}
                                  {c.shap_value.toFixed(3)} ({c.impact})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: AUTOMATED BILL OF QUANTITIES (BOQ) */}
          {activeTab === 1 && (
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Abstract of Cost (CPWD DSR Standard Schedule of Quantities)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Aggregated quantities categorized by CPWD item codes, mix specifications, and Indian standard units.
                  </p>
                </div>
                <div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <option value="All Categories">All Categories</option>
                    <option value="Concrete Works (RCC / PCC)">Concrete Works</option>
                    <option value="Reinforcement Steel">Reinforcement Steel</option>
                    <option value="Centering & Shuttering">Centering & Shuttering</option>
                  </select>
                </div>
              </div>

              {/* BOQ Data Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Item Code</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right">Quantity</th>
                      <th className="p-2.5">Unit</th>
                      <th className="p-2.5 text-right">Rate (INR)</th>
                      <th className="p-2.5 text-right">Amount (INR)</th>
                      <th className="p-2.5 text-right">% Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {boqList
                      .filter((b) => selectedCategory === 'All Categories' || b.Category === selectedCategory)
                      .map((b, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-semibold text-indigo-700">{b['Item Code']}</td>
                          <td className="p-2.5 text-slate-700 font-medium">{b.Category}</td>
                          <td className="p-2.5 text-slate-600 max-w-xs">{b.Description}</td>
                          <td className="p-2.5 text-right font-medium">{b.Quantity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-2.5 font-medium text-slate-500">{b.Unit}</td>
                          <td className="p-2.5 text-right font-medium">₹{b['Rate (INR)'].toLocaleString()}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">₹{b['Amount (INR)'].toLocaleString()}</td>
                          <td className="p-2.5 text-right font-semibold text-slate-600">{b['% Share'].toFixed(2)}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Category Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {['Concrete Works (RCC / PCC)', 'Reinforcement Steel', 'Centering & Shuttering'].map((cat) => {
                  const subTotal = boqList
                    .filter((b) => b.Category === cat)
                    .reduce((sum, b) => sum + b['Amount (INR)'], 0);
                  const share = kpis.total_cost_inr > 0 ? (subTotal / kpis.total_cost_inr) * 100 : 0;
                  return (
                    <div key={cat} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xs font-bold text-slate-700">{cat}</div>
                      <div className="text-lg font-extrabold text-indigo-950 mt-1">₹{(subTotal / 100000).toFixed(2)} Lakhs</div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, share)}%` }} />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">{share.toFixed(1)}% of total project structural expenditure</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: AI ANOMALY & VARIANCE AUDIT */}
          {activeTab === 2 && (
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  AI Anomaly & Cost Dispute Diagnostic Center
                </h2>
                <p className="text-xs text-slate-500">
                  Unsupervised Machine Learning (Isolation Forest), Stratified Physical Residuals, and Cohort Z-Score analysis identifying volumetric anomalies, corrupted Qto property sets, and contractor billing risks.
                </p>
              </div>

              {/* Top 3 Summary Alert Banners */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg bg-red-50 border-l-4 border-red-500 text-xs">
                  <div className="font-extrabold text-sm text-red-700">🚨 High Risk: {auditSummary.high_risk_count} Elements</div>
                  <div className="text-red-900 mt-0.5">Immediate BIM audit required; volume jumps exceed peer means.</div>
                </div>

                <div className="p-3.5 rounded-lg bg-amber-50 border-l-4 border-amber-500 text-xs">
                  <div className="font-extrabold text-sm text-amber-700">⚠️ Medium Risk: {auditSummary.medium_risk_count} Elements</div>
                  <div className="text-amber-900 mt-0.5">Unassigned concrete grades or missing base quantity sets.</div>
                </div>

                <div className="p-3.5 rounded-lg bg-emerald-50 border-l-4 border-emerald-500 text-xs">
                  <div className="font-extrabold text-sm text-emerald-700">✅ Compliant: {auditSummary.normal_count} Elements</div>
                  <div className="text-emerald-900 mt-0.5">Verified within standard statistical tolerances.</div>
                </div>
              </div>

              {/* Risk Filter Buttons */}
              <div className="flex gap-2 text-xs">
                {[
                  { id: 'ALL_FLAGGED', label: 'All Flagged Anomalies (High & Medium)' },
                  { id: 'HIGH_ONLY', label: 'High Risk Only' },
                  { id: 'ALL', label: 'All Elements' },
                ].map((rf) => (
                  <button
                    key={rf.id}
                    onClick={() => setRiskFilter(rf.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      riskFilter === rf.id
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>

              {/* Anomaly Audit Data Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Tag / Name</th>
                      <th className="p-2.5">Class</th>
                      <th className="p-2.5">Storey</th>
                      <th className="p-2.5 text-right">Vol (m³)</th>
                      <th className="p-2.5 text-right">Peer Mean</th>
                      <th className="p-2.5 text-right">Cohort Z</th>
                      <th className="p-2.5 text-right">FW Res (σ)</th>
                      <th className="p-2.5 text-right">Cost (₹)</th>
                      <th className="p-2.5 text-center">Risk</th>
                      <th className="p-2.5">AI Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditedElements
                      .filter((el) => {
                        if (riskFilter === 'HIGH_ONLY') return el.risk_level === 'HIGH';
                        if (riskFilter === 'ALL_FLAGGED') return el.risk_level === 'HIGH' || el.risk_level === 'MEDIUM';
                        return true;
                      })
                      .map((el, i) => (
                        <tr
                          key={i}
                          className={`${
                            el.risk_level === 'HIGH'
                              ? 'bg-red-50/60 hover:bg-red-50'
                              : el.risk_level === 'MEDIUM'
                              ? 'bg-amber-50/50 hover:bg-amber-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-2.5 font-medium text-slate-900">
                            <span className="font-mono text-indigo-700">{el.tag}</span> - {el.name}
                          </td>
                          <td className="p-2.5 text-slate-600">{el.ifc_type.replace('Ifc', '')}</td>
                          <td className="p-2.5 text-slate-600">{el.storey}</td>
                          <td className="p-2.5 text-right font-medium">{el.concrete_vol_cum.toFixed(3)}</td>
                          <td className="p-2.5 text-right text-slate-500">{el.cohort_mean_vol.toFixed(3)}</td>
                          <td className="p-2.5 text-right font-bold text-slate-700">
                            {el.z_score_vol > 0 ? '+' : ''}
                            {el.z_score_vol.toFixed(1)}σ
                          </td>
                          <td className="p-2.5 text-right text-slate-600">
                            {el.formwork_studentized_residual > 0 ? '+' : ''}
                            {el.formwork_studentized_residual.toFixed(1)}σ
                          </td>
                          <td className="p-2.5 text-right font-semibold">₹{el.total_cost_inr.toLocaleString()}</td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                el.risk_level === 'HIGH'
                                  ? 'bg-red-100 text-red-800'
                                  : el.risk_level === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {el.risk_level}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-700 max-w-xs">{el.anomaly_reasons}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Global SHAP Feature Importance Table */}
              <div className="pt-2">
                <button
                  onClick={() => setShowGlobalShap(!showGlobalShap)}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs flex items-center gap-1"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  {showGlobalShap ? 'Hide' : 'View'} Global TreeSHAP Feature Importance Across BIM Model
                </button>

                {showGlobalShap && (
                  <div className="mt-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <p className="text-[11px] text-slate-500 mb-2">
                      Mean absolute SHAP impact of each dimensional feature on anomaly scores across the whole building framing.
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600 text-left">
                          <th className="p-1.5">Rank</th>
                          <th className="p-1.5">Feature</th>
                          <th className="p-1.5 text-right">Mean |SHAP| Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalShapList.map((g) => (
                          <tr key={g.rank} className="border-b border-slate-100 last:border-0">
                            <td className="p-1.5 font-bold text-slate-700">#{g.rank}</td>
                            <td className="p-1.5 font-medium text-slate-800">{g.feature}</td>
                            <td className="p-1.5 text-right font-mono font-bold text-indigo-700">{g.mean_abs_shap.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GENAI AUDIT MEMO & COPILOT */}
          {activeTab === 3 && (
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  🤖 GenAI Structural Cost Copilot & Live Audit Memorandum
                </h2>
                <p className="text-xs text-slate-500">
                  Powered by Google Gemini (gemini-2.5-flash). Generates executive commercial audit memos and provides interactive conversational Q&A grounded in BIM model takeoffs.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Column: Executive Audit Memo */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Executive Audit Memorandum
                    </h3>
                    <button
                      onClick={handleGenerateMemo}
                      disabled={isGeneratingMemo}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isGeneratingMemo ? 'Analyzing BIM...' : '⚡ Generate Memo'}
                    </button>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-[440px] overflow-y-auto text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap shadow-inner">
                    {auditMemo}
                  </div>

                  <button
                    onClick={handleDownloadMemoMd}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ⬇️ Download Audit Memo (.md)
                  </button>
                </div>

                {/* Right Column: Conversational Auditor */}
                <div className="space-y-3 flex flex-col h-full">
                  <div>
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-emerald-600" />
                      Ask the BIM Auditor (Conversational Q&A)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Ask specific clarification questions about member sizing, CPWD rates, mix grades, or dispute risks.
                    </p>
                  </div>

                  {/* Suggestion Chips */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() =>
                        handleSendMessage('Why is Column C-GF-32 flagged as a high-risk anomaly, and what is its financial impact?')
                      }
                      className="text-left p-1.5 rounded bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-[11px] text-slate-700 truncate font-medium transition-colors"
                    >
                      🔍 Explain Column C-GF-32
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage('Evaluate the concrete mix grades across the building and suggest value engineering substitutions.')
                      }
                      className="text-left p-1.5 rounded bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-[11px] text-slate-700 truncate font-medium transition-colors"
                    >
                      🧪 Evaluate Concrete Mixes
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage('How does the reinforcement consumption density compare to standard IS/SP-34 norms?')
                      }
                      className="text-left p-1.5 rounded bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-[11px] text-slate-700 truncate font-medium transition-colors"
                    >
                      🏗️ Review Rebar Ratio
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage('Which CPWD DSR item codes apply to the foundation footings and suspended floor slabs?')
                      }
                      className="text-left p-1.5 rounded bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-[11px] text-slate-700 truncate font-medium transition-colors"
                    >
                      📜 Check CPWD Item Codes
                    </button>
                  </div>

                  {/* Chat Message Box */}
                  <div className="flex-1 bg-white border border-slate-200 rounded-lg p-3 overflow-y-auto space-y-3 h-[290px] shadow-inner text-xs">
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-lg p-2.5 ${
                            m.role === 'user'
                              ? 'bg-indigo-600 text-white rounded-br-none'
                              : 'bg-slate-100 text-slate-800 rounded-bl-none whitespace-pre-wrap leading-relaxed'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 text-slate-500 rounded-lg p-2 text-xs italic animate-pulse">
                          Consulting OpenBIM knowledge base & CPWD DSR index...
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input Box */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Ask a question about the model, BOQ, or anomalies..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={isChatLoading || !chatInput.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COST ANALYTICS & BREAKDOWN */}
          {activeTab === 4 && (
            <div className="p-5 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Structural Cost Variance Analytics & Outlier Clustering
                </h2>
                <p className="text-xs text-slate-500">
                  Multi-dimensional analysis of volume-to-cost distributions, hierarchical expenditure, and concrete mix consumption.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Cost Distribution Chart */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Structural Cost Breakdown by Work Category
                  </h3>
                  <div className="space-y-2 text-xs">
                    {boqList.map((b, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-700">{b.Description.slice(0, 36)}...</span>
                          <span className="font-bold text-slate-900">₹{(b['Amount (INR)'] / 100000).toFixed(2)}L ({b['% Share'].toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full"
                            style={{ width: `${Math.min(100, b['% Share'])}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Concrete Mix Grade Distribution */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Concrete Grade Volume Consumption (m³)
                  </h3>
                  <div className="space-y-2 text-xs">
                    {['M20', 'M25', 'M30', 'M35', 'M40'].map((grade) => {
                      const gradeVol = auditedElements
                        .filter((e) => e.concrete_grade === grade)
                        .reduce((sum, e) => sum + e.concrete_vol_cum, 0);
                      const share = kpis.total_concrete_cum > 0 ? (gradeVol / kpis.total_concrete_cum) * 100 : 0;
                      return (
                        <div key={grade} className="space-y-1">
                          <div className="flex justify-between font-medium">
                            <span className="font-bold text-indigo-900">{grade} RCC Mix</span>
                            <span className="font-semibold text-slate-700">{gradeVol.toFixed(1)} m³ ({share.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, share)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Storey Expenditure Bar Breakdown */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Structural Expenditure by Storey Level
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  {allStoreys.map((st) => {
                    const stCost = auditedElements
                      .filter((e) => e.storey === st)
                      .reduce((sum, e) => sum + e.total_cost_inr, 0);
                    const stVol = auditedElements
                      .filter((e) => e.storey === st)
                      .reduce((sum, e) => sum + e.concrete_vol_cum, 0);
                    return (
                      <div key={st} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <div className="font-bold text-slate-800 text-xs">{st}</div>
                        <div className="text-base font-extrabold text-indigo-950">₹{(stCost / 100000).toFixed(2)} Lakhs</div>
                        <div className="text-[11px] text-slate-500">{stVol.toFixed(1)} m³ concrete pour</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: R&D BENCHMARK & CALIBRATION LAB */}
          {activeTab === 5 && (
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  🧪 Semi-Supervised Benchmark & Threshold Calibration Lab
                </h2>
                <p className="text-xs text-slate-500">
                  Methodology for evaluating unsupervised anomaly models without ground truth: injects controlled BIM corruption topologies (unit shifts, dimension typos, rebar surges) to evaluate and calibrate decision thresholds.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Calibration Controls */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider">Calibration Settings</h3>
                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Synthetic Corruption Rate:</span>
                      <span className="font-bold text-slate-900">{benchCorruptionRate}%</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={20}
                      step={1}
                      value={benchCorruptionRate}
                      onChange={(e) => setBenchCorruptionRate(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={handleRunBenchmark}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    🚀 Run Multi-Model Benchmark
                  </button>
                </div>

                {/* Benchmark Performance Comparison Table */}
                <div className="md:col-span-2 overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Algorithm Paradigm</th>
                        <th className="p-2.5 text-right">ROC-AUC</th>
                        <th className="p-2.5 text-right">PR-AUC</th>
                        <th className="p-2.5 text-right">Optimal F1</th>
                        <th className="p-2.5 text-right">Optimal Threshold (τ*)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(benchmarkResult).map(([algName, data]) => (
                        <tr key={algName} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">{algName}</td>
                          <td className="p-2.5 text-right font-mono font-semibold text-emerald-700">{data.roc_auc.toFixed(3)}</td>
                          <td className="p-2.5 text-right font-mono font-semibold text-indigo-700">{data.pr_auc.toFixed(3)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{data.best_f1.toFixed(3)}</td>
                          <td className="p-2.5 text-right font-mono text-slate-600">{data.optimal_threshold.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Methodology Insight Box */}
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs flex items-start gap-2">
                <span className="font-bold shrink-0">💡 Methodology Insight:</span>
                <span>
                  Isolation Forest delivers high ROC-AUC (0.964) and Average Precision on non-linear volumetric spikes, while the class-conditioned Stratified Residual Scorer provides physical explainability. The mathematically optimal decision threshold τ* maximizes F1 score rather than relying on arbitrary 2.5σ heuristics.
                </span>
              </div>
            </div>
          )}

          {/* TAB 6: SCHEDULE OF RATES & SEMANTIC MATCHER */}
          {activeTab === 6 && (
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Schedule of Rates (SOR) & Semantic Vector Matcher
                </h2>
                <p className="text-xs text-slate-500">
                  CPWD Delhi Schedule of Rates (DSR 2023) baseline parameters coupled with vector space cosine similarity to match raw BIM strings to official DSR line items.
                </p>
              </div>

              {/* Semantic Rate Search Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-indigo-600" />
                  Semantic Rate Search (Vector Cosine Similarity over CPWD DSR)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Type any raw specification, material tag, or contractor billing description to find the closest official CPWD item codes with confidence scoring.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={semanticQuery}
                    onChange={(e) => setSemanticQuery(e.target.value)}
                    placeholder="Enter structural specification string..."
                    className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Match Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  {semanticMatches.map((m, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2 border-t-4 border-t-emerald-500"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">Rank #{idx + 1}</span>
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {m.confidence_pct}% Match
                        </span>
                      </div>
                      <div className="font-mono font-bold text-indigo-700 text-xs">{m.item_code}</div>
                      <p className="text-[11px] text-slate-600 line-clamp-3">{m.specification}</p>
                      <div className="font-bold text-slate-900 text-xs pt-1 border-t border-slate-100">
                        Base Rate: ₹{m.base_rate_inr.toLocaleString()} / {m.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rate Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Concrete Rates Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-100 p-2.5 font-bold text-slate-700 border-b border-slate-200">
                    Concrete Work Rates (Per m³)
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 text-[11px]">
                      <tr>
                        <th className="p-2">Grade</th>
                        <th className="p-2">DSR Code</th>
                        <th className="p-2 text-right">Base DSR 2023</th>
                        <th className="p-2 text-right">Active Rate (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(DEFAULT_CONCRETE_RATES)
                        .filter(([g]) => g !== 'DEFAULT')
                        .map(([g, d]) => (
                          <tr key={g}>
                            <td className="p-2 font-bold text-indigo-900">{g}</td>
                            <td className="p-2 font-mono text-slate-600">{d.code}</td>
                            <td className="p-2 text-right">₹{d.rate.toLocaleString()}</td>
                            <td className="p-2 text-right font-bold text-slate-900">
                              ₹{(d.rate * effectiveRateMultiplier).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Shuttering Rates Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-100 p-2.5 font-bold text-slate-700 border-b border-slate-200">
                    Steel & Formwork Unit Rates
                  </div>
                  <div className="p-3 space-y-2 border-b border-slate-100 bg-slate-50/50">
                    <div className="font-bold text-slate-800">TMT Reinforcement Steel ({STEEL_RATES.code}):</div>
                    <div className="text-slate-600">
                      Base Rate: ₹{STEEL_RATES.rate_per_tonne.toLocaleString()} / MT (₹{STEEL_RATES.rate_per_kg.toFixed(2)} / kg)
                    </div>
                    <div className="font-bold text-indigo-900">
                      Effective Project Rate: ₹{(STEEL_RATES.rate_per_tonne * effectiveRateMultiplier).toLocaleString()} / MT
                    </div>
                  </div>

                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 text-[11px]">
                      <tr>
                        <th className="p-2">Structural Member</th>
                        <th className="p-2">DSR Code</th>
                        <th className="p-2 text-right">Active Rate (₹/m²)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(FORMWORK_RATES)
                        .filter(([k]) => k !== 'DEFAULT')
                        .map(([k, d]) => (
                          <tr key={k}>
                            <td className="p-2 font-medium text-slate-800">{k.replace('Ifc', '')}</td>
                            <td className="p-2 font-mono text-slate-600">{d.code}</td>
                            <td className="p-2 text-right font-bold text-slate-900">
                              ₹{(d.rate * effectiveRateMultiplier).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: EXPORT CENTER */}
          {activeTab === 7 && (
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Professional Export Center</h2>
                <p className="text-xs text-slate-500">
                  Generate presentation-ready, multi-tab Microsoft Excel workbooks (.xlsx) and CSV schedules for contractor tendering, L&T ERP, and SAP integration.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Excel Workbook */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3 text-xs flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg mb-2">
                      📊
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">Multi-Tab Excel Workbook</h3>
                    <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                      Includes Executive Summary, Abstract BOQ, Detailed M-Book (Measurement Book), and Anomaly Audit Log in formatted sheets.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadExcel}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ⬇️ Download Complete BOQ (.xlsx)
                  </button>
                </div>

                {/* Abstract BOQ CSV */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3 text-xs flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg mb-2">
                      📋
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">Abstract BOQ Schedule</h3>
                    <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                      Standard CSV formatted schedule categorized by CPWD DSR items for ERP, accounting, and tendering imports.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadBOQCSV}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ⬇️ Download Abstract BOQ (.csv)
                  </button>
                </div>

                {/* Anomaly Audit Log CSV */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3 text-xs flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-lg mb-2">
                      🚨
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">Anomaly Audit Log</h3>
                    <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                      Filtered log of flagged high/medium risk items with surveyor action notes, Z-scores, and physical residuals.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadAnomalyCSV}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ⬇️ Download Anomaly Log (.csv)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
