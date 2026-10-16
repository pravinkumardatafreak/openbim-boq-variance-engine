import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Sun,
  Moon,
  BrainCircuit,
  Activity,
  Database,
  Zap,
  ShieldCheck,
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
import { AnomalyBenchmarkLab, ComprehensiveBenchmarkResult } from './core/benchmarkLab';
import { ORIGINAL_BENCHMARK_DATASETS } from './data/benchmarkDatasets';
import { SemanticSORMatcher } from './core/semanticMatcher';
import { BIMGenAICopilot } from './core/genaiCopilot';
import { BOQExcelExporter } from './core/excelExporter';
import { ThreeBimViewer } from './components/ThreeBimViewer';
import { VisionAiCenter } from './components/VisionAiCenter';
import { TimeSeriesProgressCenter } from './components/TimeSeriesProgressCenter';

export const App: React.FC = () => {
  // Theme State (Light vs Dark mode with local storage persistence)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('openbim_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('openbim_theme', isDarkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Sidebar states
  const [modelSource, setModelSource] = useState<'sample' | 'custom'>('sample');
  const [customIfcName, setCustomIfcName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [rawElements, setRawElements] = useState(() => loadSampleModel().elements);
  const [modelMeta, setModelMeta] = useState<ModelMetadata>(() => loadSampleModel().metadata);

  const [activePreset, setActivePreset] = useState<string>('CPWD DSR 2023 (Delhi / Central India)');
  const [rateMultiplierPct, setRateMultiplierPct] = useState<number>(100);
  const [zScoreThresh, setZScoreThresh] = useState<number>(2.5);
  const [isoContamination, setIsoContamination] = useState<number>(0.05);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');

  // Active Tab (0 to 7)
  const [activeTab, setActiveTab] = useState<number>(0);

  // Tab 0 (3D Explorer) states
  const [colorMode, setColorMode] = useState<'risk_level' | 'ifc_type' | 'concrete_grade'>('risk_level');
  const [selectedStoreys, setSelectedStoreys] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showWireframes, setShowWireframes] = useState<boolean>(true);
  const [selectedElementTag, setSelectedElementTag] = useState<string>('#16');
  const [isInspectorExpanded, setIsInspectorExpanded] = useState<boolean>(true);

  // Tab 1 (BOQ) states
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');

  // Tab 2 (Anomaly) states
  const [riskFilter, setRiskFilter] = useState<'ALL_FLAGGED' | 'HIGH_ONLY' | 'ALL'>('ALL_FLAGGED');
  const [showGlobalShap, setShowGlobalShap] = useState<boolean>(false);

  // Tab 3 (Copilot) states
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

  // Tab 5 (Benchmark & Deep Learning Lab) states
  const [benchDatasetChoice, setBenchDatasetChoice] = useState<string>('commercial_tower_b');
  const [benchCorruptionRate, setBenchCorruptionRate] = useState<number>(8);
  const [benchmarkResult, setBenchmarkResult] = useState<ComprehensiveBenchmarkResult>(() =>
    new AnomalyBenchmarkLab().runComprehensiveBenchmark(
      loadSampleModel().elements as any,
      'commercial_tower_b',
      8
    )
  );
  const [selectedDeepElementTag, setSelectedDeepElementTag] = useState<string>('');

  // Tab 6 (Semantic Matcher) states
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

  // Instantiate TreeSHAP Explainer
  const explainer = useMemo(() => new AnomalyExplainer(), []);

  // Run AI Anomaly Detection Pipeline
  const { auditedElements, auditSummary } = useMemo(() => {
    const detector = new BIMAnomalyDetector(isoContamination, zScoreThresh);
    const audited = detector.detectAnomalies(enrichedElements);
    const summary = detector.getAuditSummary(audited);
    return { auditedElements: audited, auditSummary: summary };
  }, [enrichedElements, isoContamination, zScoreThresh]);

  // Extract all unique storeys & types
  const allStoreys = useMemo(() => {
    return Array.from(new Set(auditedElements.map((e) => e.storey))).sort();
  }, [auditedElements]);

  const allTypes = useMemo(() => {
    return Array.from(new Set(auditedElements.map((e) => e.ifc_type))).sort();
  }, [auditedElements]);

  // Re-sync 3D filters when a new model is loaded (upload / sample switch)
  const modelRevisionKey = `${modelMeta.project_name}|${rawElements.length}|${rawElements[0]?.tag ?? ''}`;
  const prevModelRevisionKey = useRef<string>('');

  useEffect(() => {
    if (prevModelRevisionKey.current === modelRevisionKey) return;
    prevModelRevisionKey.current = modelRevisionKey;
    if (allStoreys.length > 0) setSelectedStoreys(allStoreys);
    if (allTypes.length > 0) setSelectedTypes(allTypes);
  }, [modelRevisionKey, allStoreys, allTypes]);

  // Selected Element for Inspector
  const selectedElement = useMemo(() => {
    return auditedElements.find((e) => e.tag === selectedElementTag) || auditedElements[0];
  }, [auditedElements, selectedElementTag]);

  // TreeSHAP Instance Explanation for Inspector
  const shapExplanation = useMemo(() => {
    if (!explainer || !selectedElement) return null;
    return explainer.explainInstance(selectedElement, auditedElements);
  }, [explainer, selectedElement, auditedElements]);

  // Global Feature Importance
  const globalShapImportance = useMemo(() => {
    if (!explainer || auditedElements.length === 0) return [];
    return explainer.getGlobalImportance(auditedElements);
  }, [explainer, auditedElements]);

  // Run Semantic Matcher on query change
  useEffect(() => {
    if (!semanticQuery.trim()) return;
    const matcher = new SemanticSORMatcher();
    const matches = matcher.matchSpecification(semanticQuery, 3);
    setSemanticMatches(matches);
  }, [semanticQuery]);

  // Handle Model Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setModelSource('custom');
    setCustomIfcName(file.name);
    setUploadError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseIFCContent(text);
        if (parsed.elements.length > 0) {
          setModelMeta(parsed.metadata);
          setRawElements(parsed.elements);
          setSelectedElementTag(parsed.elements[0].tag);
          setAuditMemo('');
          setBenchmarkResult(
            new AnomalyBenchmarkLab().runComprehensiveBenchmark(
              parsed.elements as any,
              'active_model',
              benchCorruptionRate
            )
          );
        } else {
          setUploadError(
            'No structural elements (columns, beams, slabs, footings, walls) were found in this IFC file.'
          );
        }
      }
    };
    reader.onerror = () => {
      setUploadError('Could not read the IFC file. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setModelSource('sample');
    setCustomIfcName('');
    setUploadError('');
    const s = loadSampleModel();
    setModelMeta(s.metadata);
    setRawElements(s.elements);
    setSelectedElementTag('#16');
    setAuditMemo('');
    setBenchmarkResult(
      new AnomalyBenchmarkLab().runComprehensiveBenchmark(s.elements as any, benchDatasetChoice, benchCorruptionRate)
    );
  };

  // Run Benchmark
  const handleRunBenchmark = () => {
    const lab = new AnomalyBenchmarkLab();
    const res = lab.runComprehensiveBenchmark(enrichedElements, benchDatasetChoice, benchCorruptionRate);
    setBenchmarkResult(res);
  };

  // Selected element for Deep Learning feature attribution inspection
  const selectedDeepElement = useMemo(() => {
    if (!benchmarkResult.deep_element_predictions || benchmarkResult.deep_element_predictions.length === 0) {
      return null;
    }
    if (selectedDeepElementTag) {
      const found = benchmarkResult.deep_element_predictions.find((p) => p.tag === selectedDeepElementTag);
      if (found) return found;
    }
    // Default to the element with highest reconstruction loss
    return [...benchmarkResult.deep_element_predictions].sort((a, b) => b.reconstruction_loss - a.reconstruction_loss)[0];
  }, [benchmarkResult, selectedDeepElementTag]);

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
    <div className={`flex min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-[#F8FAFC] text-slate-900'} transition-colors duration-150`}>
      {/* ---------------- SIDEBAR CONTROLS ---------------- */}
      <aside className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 shadow-sm transition-colors duration-150">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-xl shrink-0">
              🏗️
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight leading-tight text-white">OpenBIM Control Deck</h1>
              <p className="text-[11px] text-slate-300 font-medium">Enterprise Quantity & Cost Intelligence</p>
            </div>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* 1. BIM Model Ingestion */}
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              1. BIM Model Ingestion
            </h3>

            <div className="space-y-2 mt-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors">
                <input
                  type="radio"
                  name="modelSource"
                  checked={modelSource === 'sample'}
                  onChange={handleLoadSample}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-slate-700 dark:text-slate-200">⚡ Pre-loaded Commercial Framing Model</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors">
                <input
                  type="radio"
                  name="modelSource"
                  checked={modelSource === 'custom'}
                  onChange={() => setModelSource('custom')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-slate-700 dark:text-slate-200">📁 Upload Custom IFC File</span>
              </label>
            </div>

            {modelSource === 'sample' ? (
              <div className="mt-2 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 text-[11px] text-indigo-900 dark:text-indigo-200 leading-relaxed">
                Loaded <b>Commercial Complex - Block B (G+2 Framing)</b> with 163 structural members and engineered cost dispute anomalies.
              </div>
            ) : (
              <div className="mt-2">
                <input
                  type="file"
                  accept=".ifc,.ifczip"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950/60 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900 cursor-pointer"
                />
                {customIfcName && !uploadError && (
                  <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">✓ Uploaded: {customIfcName}</p>
                )}
                {uploadError && (
                  <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 font-medium">{uploadError}</p>
                )}
              </div>
            )}
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* 2. Schedule of Rates */}
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              2. Schedule of Rates (SOR)
            </h3>

            <label className="block text-slate-600 dark:text-slate-400 text-[11px] mb-1">Select Rate Schedule:</label>
            <select
              value={activePreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {Object.keys(RATE_SCHEDULE_PRESETS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic">
              ℹ️ {RATE_SCHEDULE_PRESETS[activePreset]?.description}
            </p>

            <div className="mt-3">
              <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                <span>Fine-Tune Rate Index (%):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{rateMultiplierPct}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={150}
                value={rateMultiplierPct}
                onChange={(e) => setRateMultiplierPct(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                <span>70%</span>
                <span>100% (DSR 2023)</span>
                <span>150%</span>
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* 3. AI Anomaly Parameters */}
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              3. AI Anomaly Parameters
            </h3>

            <div className="mb-3">
              <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                <span>Z-Score Outlier Threshold:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{zScoreThresh.toFixed(1)}σ</span>
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
              <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                <span>Isolation Forest Sensitivity:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{(isoContamination * 100).toFixed(0)}%</span>
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

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* 4. Gemini GenAI Copilot */}
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              4. 🤖 Gemini GenAI Copilot
            </h3>

            <label className="block text-slate-600 dark:text-slate-400 text-[11px] mb-1">Gemini API Key:</label>
            <input
              type="password"
              placeholder="Paste GEMINI_API_KEY..."
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="mt-2">
              {geminiApiKey.trim() ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Gemini Live Generative Mode
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  ⚪ Calibrated Engineering Mode (Add key for live AI)
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* TOP STATUS BAR & THEME SWITCHER */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-300 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              CPWD DSR 2023 & IS-456 Ground-Truth Verified
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline font-medium">BIM Schema: {modelMeta.schema}</span>
          </div>

          {/* Theme Switcher Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setIsDarkMode(false)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
                !isDarkMode
                  ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Light</span>
            </button>
            <button
              onClick={() => setIsDarkMode(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
                isDarkMode
                  ? 'bg-slate-700 text-white shadow-xs border border-slate-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-sky-400" />
              <span>Dark</span>
            </button>
          </div>
        </div>

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
            <div className="shrink-0 flex items-center gap-2">
              <span className="inline-block bg-[#FF6500] text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider shadow">
                CPWD DSR 2023 COMPLIANT
              </span>
            </div>
          </div>

          <div className="mt-3.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-2.5 text-xs text-slate-100 flex items-start gap-2">
            <span className="text-amber-400 font-bold shrink-0">⚡ Automated Takeoff & Risk Verification:</span>
            <span>
              Ingests architectural and structural IFC models, extracts volumetric property sets, applies CPWD/DSR Schedule of Rates, and runs Deep Learning Neural Autoencoders + multivariate Isolation Forest anomaly detection to catch design-to-billing discrepancies in real-time.
            </span>
          </div>
        </div>

        {/* EXECUTIVE KPI RIBBON */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Card 1 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs border-t-4 border-t-[#1E3E62] dark:border-t-sky-500 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Structural Members</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{kpis.total_elements}</div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">{allStoreys.length} Building Levels</div>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs border-t-4 border-t-[#1E3E62] dark:border-t-sky-500 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Concrete Volume</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {kpis.total_concrete_cum.toFixed(1)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">m³</span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              ₹{(kpis.concrete_cost_inr / 100000).toFixed(1)}L Concrete Cost
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs border-t-4 border-t-[#1E3E62] dark:border-t-sky-500 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Reinforcement Steel</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {kpis.total_steel_tonne.toFixed(1)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">MT</span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">Avg {kpis.rebar_density_overall} kg/m³ Density</div>
          </div>

          {/* Card 4 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs border-t-4 border-t-[#1E3E62] dark:border-t-sky-500 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Project BOQ</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              ₹{kpis.total_cost_lakhs.toFixed(2)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Lakhs</span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">₹{kpis.total_cost_crores.toFixed(3)} Cr Structural Cost</div>
          </div>

          {/* Card 5 (Alert) */}
          <div
            className={`rounded-xl p-3.5 shadow-xs border-t-4 transition-colors ${
              auditSummary.high_risk_count > 0
                ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 border-t-red-500'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 border-t-emerald-500'
            }`}
          >
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                auditSummary.high_risk_count > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              Cost Dispute Risk
            </div>
            <div
              className={`text-2xl font-extrabold mt-1 ${
                auditSummary.high_risk_count > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {auditSummary.high_risk_count} <span className="text-xs font-normal">High-Risk</span>
            </div>
            <div className={`text-[11px] mt-0.5 ${auditSummary.high_risk_count > 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
              ₹{auditSummary.at_risk_cost_lakhs.toFixed(2)} Lakhs At-Risk
            </div>
          </div>
        </div>

        {/* ---------------- 9 OPERATIONAL MODULE TABS ---------------- */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
          {/* Tab Navigation Ribbon */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto bg-slate-50/70 dark:bg-slate-850 p-1 gap-1 text-xs font-medium">
            {[
              { label: '🏗️ 3D Model Explorer', id: 0 },
              { label: '📋 Automated BOQ', id: 1 },
              { label: '🔍 AI Anomaly Audit', id: 2 },
              { label: '🤖 GenAI Copilot', id: 3 },
              { label: '📊 Cost & 4D Time-Series', id: 4 },
              { label: '🧪 Benchmark & Deep Learning Lab', id: 5 },
              { label: '👁️ L&T Vision AI & Digital Twin', id: 6 },
              { label: '💰 Schedule of Rates', id: 7 },
              { label: '📥 Export Center', id: 8 },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === t.id
                    ? 'bg-white dark:bg-slate-800 text-indigo-900 dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
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
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Interactive 3D BIM Structural Viewer & Spatial Takeoff
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rotate, pan, and zoom to inspect structural members in true 3D space. Click any element to view live takeoff parameters and TreeSHAP diagnostics.
                </p>
              </div>

              {/* 3D Filter Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-850 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Color Code 3D Elements By:</label>
                  <select
                    value={colorMode}
                    onChange={(e) => setColorMode(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
                  >
                    <option value="risk_level">🚨 Risk Level (Anomalies in Red)</option>
                    <option value="ifc_type">🧱 Structural Element Class</option>
                    <option value="concrete_grade">🧪 Concrete Mix Grade</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Storey Level Filter:</label>
                  <select
                    value={selectedStoreys.length === allStoreys.length ? 'ALL' : selectedStoreys[0] || 'ALL'}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedStoreys(v === 'ALL' ? allStoreys : [v]);
                    }}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
                  >
                    <option value="ALL">All Levels ({allStoreys.length})</option>
                    {allStoreys.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Structural Element Class:</label>
                  <select
                    value={selectedTypes.length === allTypes.length ? 'ALL' : selectedTypes[0] || 'ALL'}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedTypes(v === 'ALL' ? allTypes : [v]);
                    }}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
                  >
                    <option value="ALL">All Classes ({allTypes.length})</option>
                    {allTypes.map((t) => (
                      <option key={t} value={t}>
                        {t.replace('Ifc', '')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer p-1.5 text-slate-700 dark:text-slate-200 font-medium">
                    <input
                      type="checkbox"
                      checked={showWireframes}
                      onChange={(e) => setShowWireframes(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Show Wireframe Boxes</span>
                  </label>
                </div>
              </div>

              {/* Three.js 3D Viewer Canvas */}
              <ThreeBimViewer
                elements={auditedElements}
                colorBy={colorMode}
                selectedStoreys={selectedStoreys}
                selectedTypes={selectedTypes}
                showBoundingBoxes={showWireframes}
                onSelectElement={(el) => {
                  setSelectedElementTag(el.tag);
                  setIsInspectorExpanded(true);
                }}
                selectedElementTag={selectedElementTag}
                isDarkMode={isDarkMode}
              />

              {/* Interactive Element Inspector */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-850">
                <button
                  onClick={() => setIsInspectorExpanded(!isInspectorExpanded)}
                  className="w-full p-3.5 flex justify-between items-center text-left font-bold text-slate-800 dark:text-slate-200 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      🔍 Interactive Element Inspector: <b className="text-indigo-700 dark:text-sky-300">{selectedElement.name}</b> ({selectedElement.tag})
                    </span>
                  </div>
                  {isInspectorExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isInspectorExpanded && (
                  <div className="p-4 space-y-4 bg-white dark:bg-slate-900 text-xs">
                    {/* Element Selector Dropdown */}
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Select Member to Inspect:</label>
                      <select
                        value={selectedElementTag}
                        onChange={(e) => setSelectedElementTag(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs text-slate-800 dark:text-slate-200"
                      >
                        {auditedElements.map((el) => (
                          <option key={el.tag} value={el.tag}>
                            {el.tag} | {el.name} ({el.ifc_type.replace('Ifc', '')} - {el.storey}) [Risk: {el.risk_level}]
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">IFC Class</div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedElement.ifc_type.replace('Ifc', '')}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Storey Level</div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedElement.storey}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Concrete Grade</div>
                        <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{selectedElement.concrete_grade}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Total Element Cost</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">₹{selectedElement.total_cost_inr.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Quantities Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
                        <div className="text-[10px] uppercase text-indigo-700 dark:text-indigo-300 font-semibold">Net Concrete Volume</div>
                        <div className="text-base font-extrabold text-indigo-950 dark:text-indigo-200">{selectedElement.concrete_vol_cum.toFixed(3)} m³</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
                        <div className="text-[10px] uppercase text-indigo-700 dark:text-indigo-300 font-semibold">Estimated Rebar</div>
                        <div className="text-base font-extrabold text-indigo-950 dark:text-indigo-200">{selectedElement.rebar_kg.toFixed(1)} kg</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
                        <div className="text-[10px] uppercase text-indigo-700 dark:text-indigo-300 font-semibold">Formwork Contact Area</div>
                        <div className="text-base font-extrabold text-indigo-950 dark:text-indigo-200">{selectedElement.formwork_sqm.toFixed(2)} m²</div>
                      </div>
                    </div>

                    {/* Risk Diagnosis Banner */}
                    {selectedElement.risk_level !== 'NORMAL' ? (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-xs">
                          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <span>AI Diagnosis ({selectedElement.risk_level} Risk): {selectedElement.anomaly_reasons}</span>
                        </div>
                        <div className="text-[11px] text-red-700 dark:text-red-300">
                          <b>Recommended Engineering Action:</b> {selectedElement.recommended_action}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Compliant: Member dimensions and reinforcement consumption fall within standard design norms.</span>
                      </div>
                    )}

                    {/* TreeSHAP Feature Attribution Waterfall */}
                    {shapExplanation && (
                      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                          <BrainCircuit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          TreeSHAP Local Feature Attribution (Explainable AI)
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Identifies which exact geometric features pushed this member into anomalous risk vs normalized peer baseline.
                        </p>

                        <div className="space-y-1.5">
                          {shapExplanation.feature_contributions.map((fc: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 text-[11px]">
                              <span className="w-44 font-medium text-slate-700 dark:text-slate-300 truncate">{fc.feature}</span>
                              <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden relative">
                                <div
                                  className={`h-full rounded-full ${
                                    fc.impact === 'Anomaly Inducer' ? 'bg-red-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.abs(fc.shap_value) * 80)}%` }}
                                />
                              </div>
                              <span
                                className={`w-28 text-right font-mono font-semibold ${
                                  fc.impact === 'Anomaly Inducer' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {fc.shap_value > 0 ? `+${fc.shap_value.toFixed(3)}` : fc.shap_value.toFixed(3)}
                              </span>
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
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Abstract of Cost (CPWD DSR Standard Schedule of Quantities)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Aggregated quantities categorized by CPWD item codes, mix specifications, and Indian standard units.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Filter Work Category:</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
                  >
                    {['All Categories', 'Concrete Work', 'Steel Reinforcement', 'Formwork'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* BOQ Data Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">Item Code</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-center">Unit</th>
                      <th className="p-2.5 text-right">Quantity</th>
                      <th className="p-2.5 text-right">Rate (INR)</th>
                      <th className="p-2.5 text-right">Amount (INR)</th>
                      <th className="p-2.5 text-right">% Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {boqList
                      .filter((b) => selectedCategory === 'All Categories' || b.Category === selectedCategory)
                      .map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                          <td className="p-2.5 font-mono font-bold text-indigo-700 dark:text-sky-400">{item['Item Code']}</td>
                          <td className="p-2.5 text-slate-700 dark:text-slate-300">{item.Category}</td>
                          <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate">{item.Description}</td>
                          <td className="p-2.5 text-center font-semibold text-slate-600 dark:text-slate-400">{item.Unit}</td>
                          <td className="p-2.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {item.Quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                            ₹{item['Rate (INR)'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ₹{item['Amount (INR)'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold text-indigo-600 dark:text-sky-300">
                            {item['% Share'].toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Sub-breakdown Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {['Concrete Work', 'Steel Reinforcement', 'Formwork'].map((cat) => {
                  const catAmount = boqList
                    .filter((b) => b.Category === cat)
                    .reduce((sum, b) => sum + b['Amount (INR)'], 0);
                  const share = kpis.total_cost_inr > 0 ? (catAmount / kpis.total_cost_inr) * 100 : 0;
                  return (
                    <div key={cat} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-1">
                      <div className="font-bold text-slate-700 dark:text-slate-300 text-xs">{cat}</div>
                      <div className="text-lg font-extrabold text-indigo-950 dark:text-sky-300">₹{(catAmount / 100000).toFixed(2)} Lakhs</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{share.toFixed(1)}% of total structural expenditure</div>
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
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  AI Anomaly & Cost Dispute Diagnostic Center
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Unsupervised Isolation Forest, Stratified Physical Residuals, and Cohort Z-Score analysis identifying volumetric anomalies, corrupted Qto property sets, and contractor billing risks.
                </p>
              </div>

              {/* 3 Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 border-l-4 border-l-red-500">
                  <div className="font-bold text-red-900 dark:text-red-300 text-sm">🚨 High Risk: {auditSummary.high_risk_count} Elements</div>
                  <div className="text-[11px] text-red-700 dark:text-red-400 mt-0.5">Immediate BIM audit required; volume jumps exceed peer means.</div>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 border-l-4 border-l-amber-500">
                  <div className="font-bold text-amber-900 dark:text-amber-300 text-sm">⚠️ Medium Risk: {auditSummary.medium_risk_count} Elements</div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">Unassigned concrete grades or missing base quantity sets.</div>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 border-l-4 border-l-emerald-500">
                  <div className="font-bold text-emerald-900 dark:text-emerald-300 text-sm">✅ Compliant: {auditSummary.normal_count} Elements</div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">Verified within standard statistical tolerances.</div>
                </div>
              </div>

              {/* Filter Radio Controls */}
              <div className="flex gap-4 items-center text-xs text-slate-700 dark:text-slate-300 pt-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Filter Table:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="riskFilter"
                    checked={riskFilter === 'ALL_FLAGGED'}
                    onChange={() => setRiskFilter('ALL_FLAGGED')}
                  />
                  <span>All Flagged (High & Medium)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="riskFilter"
                    checked={riskFilter === 'HIGH_ONLY'}
                    onChange={() => setRiskFilter('HIGH_ONLY')}
                  />
                  <span>High Risk Only</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="riskFilter"
                    checked={riskFilter === 'ALL'}
                    onChange={() => setRiskFilter('ALL')}
                  />
                  <span>All Elements ({auditedElements.length})</span>
                </label>
              </div>

              {/* Anomaly Data Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">Tag</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Class</th>
                      <th className="p-2.5">Storey</th>
                      <th className="p-2.5 text-right">Vol (m³)</th>
                      <th className="p-2.5 text-right">Cohort Z</th>
                      <th className="p-2.5 text-right">FW Res (σ)</th>
                      <th className="p-2.5 text-right">Rebar Res (σ)</th>
                      <th className="p-2.5 text-right">Cost (₹)</th>
                      <th className="p-2.5 text-center">Risk</th>
                      <th className="p-2.5">AI Diagnosis & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditedElements
                      .filter((e) => {
                        if (riskFilter === 'HIGH_ONLY') return e.risk_level === 'HIGH';
                        if (riskFilter === 'ALL_FLAGGED') return e.risk_level === 'HIGH' || e.risk_level === 'MEDIUM';
                        return true;
                      })
                      .map((el) => (
                        <tr
                          key={el.tag}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                            el.risk_level === 'HIGH'
                              ? 'bg-red-50/70 dark:bg-red-950/30'
                              : el.risk_level === 'MEDIUM'
                              ? 'bg-amber-50/70 dark:bg-amber-950/30'
                              : ''
                          }`}
                        >
                          <td className="p-2.5 font-mono font-bold text-indigo-700 dark:text-sky-400">{el.tag}</td>
                          <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100">{el.name}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{el.ifc_type.replace('Ifc', '')}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{el.storey}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">{el.concrete_vol_cum.toFixed(2)}</td>
                          <td
                            className={`p-2.5 text-right font-mono font-semibold ${
                              Math.abs(el.z_score_vol) > 2.0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {el.z_score_vol > 0 ? `+${el.z_score_vol.toFixed(2)}` : el.z_score_vol.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                            {el.formwork_studentized_residual.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                            {el.rebar_studentized_residual.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ₹{el.total_cost_inr.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                el.risk_level === 'HIGH'
                                  ? 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200'
                                  : el.risk_level === 'MEDIUM'
                                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                                  : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                              }`}
                            >
                              {el.risk_level}
                            </span>
                          </td>
                          <td className="p-2.5 text-[11px] max-w-xs">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{el.anomaly_reasons || 'Compliant'}</div>
                            {el.recommended_action && (
                              <div className="text-indigo-600 dark:text-sky-300 font-medium text-[10px] mt-0.5">{el.recommended_action}</div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Global SHAP Feature Importance Expander */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-850">
                <button
                  onClick={() => setShowGlobalShap(!showGlobalShap)}
                  className="w-full p-3.5 flex justify-between items-center text-left font-bold text-slate-800 dark:text-slate-200 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-750 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Global SHAP Feature Importance (Model-Wide Sensitivity)
                  </span>
                  {showGlobalShap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showGlobalShap && (
                  <div className="p-4 bg-white dark:bg-slate-900 space-y-2 text-xs">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Mean absolute TreeSHAP impact across all 163 structural members indicating primary risk drivers.
                    </p>
                    <div className="space-y-1.5 pt-1">
                      {globalShapImportance.map((imp: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="w-44 text-slate-700 dark:text-slate-300 font-medium truncate">{imp.feature}</span>
                          <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 dark:bg-sky-500 h-full rounded-full" style={{ width: `${imp.percentage}%` }} />
                          </div>
                          <span className="w-16 text-right font-mono font-bold text-slate-900 dark:text-white">{imp.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GENAI COPILOT & EXECUTIVE MEMO */}
          {activeTab === 3 && (
            <div className="p-5 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  🤖 GenAI Structural Cost Copilot & Live Audit Memorandum
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Powered by Google Gemini. Generates executive commercial audit memos and provides interactive conversational Q&A grounded in BIM model takeoffs.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Column: Executive Memo */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Executive Audit Memorandum
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Authoritative technical memorandum reviewing volumetric exposure, value engineering, and subcontractor dispute mitigation.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateMemo}
                    disabled={isGeneratingMemo}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingMemo ? 'Analyzing BIM Geometry & CPWD Rates...' : '⚡ Generate Executive Audit Memo'}
                  </button>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 max-h-[380px] overflow-y-auto text-xs whitespace-pre-wrap leading-relaxed shadow-inner text-slate-800 dark:text-slate-200">
                    {auditMemo || (
                      <span className="text-slate-400 italic">
                        Click 'Generate Executive Audit Memo' above to generate an executive review of this model...
                      </span>
                    )}
                  </div>

                  {auditMemo && (
                    <button
                      onClick={handleDownloadMemoMd}
                      className="w-full py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      ⬇️ Download Audit Memo (.md)
                    </button>
                  )}
                </div>

                {/* Right Column: Conversational Auditor */}
                <div className="space-y-3 flex flex-col h-full">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Ask the BIM Auditor (Conversational Q&A)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Ask specific clarification questions about member sizing, CPWD rates, mix grades, or dispute risks.
                    </p>
                  </div>

                  {/* Suggestion Chips */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() =>
                        handleSendMessage('Why is Column C-GF-32 flagged as a high-risk anomaly, and what is its financial impact?')
                      }
                      className="text-left p-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-200 truncate font-medium transition-colors"
                    >
                      🔍 Explain Column C-GF-32
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage('Evaluate the concrete mix grades across the building and suggest value engineering substitutions.')
                      }
                      className="text-left p-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-200 truncate font-medium transition-colors"
                    >
                      🧪 Evaluate Concrete Mixes
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage('How does the reinforcement consumption density compare to standard IS/SP-34 norms?')
                      }
                      className="text-left p-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-200 truncate font-medium transition-colors"
                    >
                      🏗️ Review Rebar Ratio
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage('Which CPWD DSR item codes apply to the foundation footings and suspended floor slabs?')
                      }
                      className="text-left p-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-200 truncate font-medium transition-colors"
                    >
                      📜 Check CPWD Item Codes
                    </button>
                  </div>

                  {/* Chat Message Box */}
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-y-auto space-y-3 h-[290px] shadow-inner text-xs">
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-lg p-2.5 ${
                            m.role === 'user'
                              ? 'bg-indigo-600 text-white rounded-br-none'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none whitespace-pre-wrap leading-relaxed'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg p-2 text-xs italic animate-pulse">
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
                      className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Structural Cost Variance Analytics & Outlier Clustering
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Multi-dimensional analysis of volume-to-cost distributions, hierarchical expenditure, and concrete mix consumption.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Cost Distribution Chart */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                    Structural Cost Breakdown by Work Category
                  </h3>
                  <div className="space-y-2 text-xs">
                    {boqList.map((b, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-700 dark:text-slate-300">{b.Description.slice(0, 36)}...</span>
                          <span className="font-bold text-slate-900 dark:text-white">₹{(b['Amount (INR)'] / 100000).toFixed(2)}L ({b['% Share'].toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 dark:bg-sky-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, b['% Share'])}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Concrete Mix Grade Distribution */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
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
                            <span className="font-bold text-indigo-900 dark:text-sky-300">{grade} RCC Mix</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{gradeVol.toFixed(1)} m³ ({share.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
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
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
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
                      <div key={st} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">{st}</div>
                        <div className="text-base font-extrabold text-indigo-950 dark:text-sky-300">₹{(stCost / 100000).toFixed(2)} Lakhs</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{stVol.toFixed(1)} m³ concrete pour</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4D Time-Series Dataset Engine & Predictive S-Curve */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <TimeSeriesProgressCenter isDarkMode={isDarkMode} />
              </div>
            </div>
          )}

          {/* TAB 5: BENCHMARK & DEEP LEARNING LAB */}
          {activeTab === 5 && (
            <div className="p-5 space-y-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-indigo-600 dark:text-sky-400" />
                    🧪 Semi-Supervised & Deep Learning Anomaly Benchmark Lab
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Comprehensive evaluation across Deep Neural Autoencoders, Latent Energy Models, Isolation Forest, and Physical Residuals against original datasets with ground-truth dispute verification.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    benchmarkResult.is_ground_truth
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  }`}>
                    {benchmarkResult.is_ground_truth ? '🎯 Verified Ground-Truth Benchmark' : '🧪 Parametric Synthetic Topology'}
                  </span>
                </div>
              </div>

              {/* Dataset Selection Bar */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-3 text-xs">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="flex-1 w-full">
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-indigo-600 dark:text-sky-400" />
                      Select Original Engineering Benchmark Dataset:
                    </label>
                    <select
                      value={benchDatasetChoice}
                      onChange={(e) => {
                        const newChoice = e.target.value;
                        setBenchDatasetChoice(newChoice);
                        const lab = new AnomalyBenchmarkLab();
                        setBenchmarkResult(lab.runComprehensiveBenchmark(enrichedElements, newChoice, benchCorruptionRate));
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      <option value="commercial_tower_b">🏢 Commercial Complex Tower B (163 elements - 3 verified dispute anomalies)</option>
                      <option value="metro_viaduct_infrastructure">🚆 Metro Rail Viaduct Pier & Box Girder (128 elements - 5 verified dispute anomalies)</option>
                      <option value="industrial_warehouse_peb">🏭 Industrial Logistics Warehouse Portal Frame (96 elements - 4 verified dispute anomalies)</option>
                      <option value="residential_highrise_core">🏙️ Residential High-Rise Tower Core (210 elements - 6 verified dispute anomalies)</option>
                      <option value="active_model">⚡ Current Ingested Model (Parametric Synthetic Perturbation)</option>
                    </select>
                  </div>

                  {benchDatasetChoice === 'active_model' && (
                    <div className="w-full md:w-56">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                        <span>Synthetic Corruption:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{benchCorruptionRate}%</span>
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
                  )}

                  <div className="shrink-0 self-end">
                    <button
                      onClick={handleRunBenchmark}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Re-Train & Benchmark
                    </button>
                  </div>
                </div>

                {/* Dataset Meta Banner */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-750 text-[11px]">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Domain:</span>{' '}
                    <b className="text-slate-800 dark:text-slate-200">
                      {ORIGINAL_BENCHMARK_DATASETS[benchDatasetChoice]?.domain || 'Active BIM File'}
                    </b>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Total Members:</span>{' '}
                    <b className="text-slate-800 dark:text-slate-200">{benchmarkResult.total_samples} elements</b>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Verified Anomalies:</span>{' '}
                    <b className="text-red-600 dark:text-red-400">
                      {benchmarkResult.anomaly_count} ({benchmarkResult.anomaly_rate_pct}%)
                    </b>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Audit Source:</span>{' '}
                    <span className="text-indigo-700 dark:text-sky-300 font-medium truncate block">
                      {benchmarkResult.dataset_source}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deep Learning Architecture & Training Convergence */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Deep Autoencoder Architecture Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <BrainCircuit className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Deep Neural Autoencoder Topology
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Symmetric feedforward reconstruction architecture mapping 8 physical features through an information bottleneck.
                  </p>

                  <div className="space-y-1.5 py-1 font-mono text-[11px]">
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Input Layer:</span>
                      <b className="text-indigo-700 dark:text-sky-300">8 Physical Features</b>
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Encoder Hidden:</span>
                      <b className="text-purple-700 dark:text-purple-300">16 Neurons (LeakyReLU)</b>
                    </div>
                    <div className="p-1.5 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex justify-between">
                      <span className="text-purple-800 dark:text-purple-300 font-bold">Latent Bottleneck:</span>
                      <b className="text-purple-900 dark:text-purple-200 font-bold">4 Dimensions</b>
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Decoder Hidden:</span>
                      <b className="text-purple-700 dark:text-purple-300">16 Neurons (LeakyReLU)</b>
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Output Layer:</span>
                      <b className="text-emerald-700 dark:text-emerald-300">8 Reconstructed Features</b>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                    Loss: MSE Reconstruction Error + Free Energy Outlier Score
                  </div>
                </div>

                {/* Training Epoch Loss Convergence Chart */}
                <div className="md:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Deep Learning Training Convergence (Epochs 1 - 30)
                    </h3>
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      {benchmarkResult.deep_learning_history.convergence_status}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Reconstruction loss decreases as the autoencoder learns the non-linear manifold of compliant engineering members.
                  </p>

                  {/* SVG Training Loss Curve */}
                  <div className="h-44 w-full bg-slate-50 dark:bg-slate-850 rounded-lg p-2 flex flex-col justify-between border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>Loss: 1.0</span>
                      <div className="flex gap-4">
                        <span className="flex items-center gap-1 text-indigo-600 dark:text-sky-400">
                          <span className="w-2.5 h-0.5 bg-indigo-600 dark:bg-sky-400 inline-block"></span> Train Loss
                        </span>
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <span className="w-2.5 h-0.5 bg-emerald-600 dark:bg-emerald-400 inline-block"></span> Val Loss
                        </span>
                      </div>
                      <span>Loss: 0.0</span>
                    </div>

                    <svg className="w-full h-32 overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
                      {/* Grid lines */}
                      <line x1="0" y1="25" x2="300" y2="25" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="3 3" />
                      <line x1="0" y1="50" x2="300" y2="50" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="3 3" />
                      <line x1="0" y1="75" x2="300" y2="75" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="3 3" />

                      {/* Train Loss Polyline */}
                      <polyline
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="2.5"
                        points={benchmarkResult.deep_learning_history.train_loss
                          .map((val, i) => `${(i / 29) * 300},${Math.min(95, Math.max(5, (1 - val) * 100))}`)
                          .join(' ')}
                      />

                      {/* Val Loss Polyline */}
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        points={benchmarkResult.deep_learning_history.val_loss
                          .map((val, i) => `${(i / 29) * 300},${Math.min(95, Math.max(5, (1 - val) * 100))}`)
                          .join(' ')}
                      />
                    </svg>

                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>Epoch 1</span>
                      <span>Epoch 15</span>
                      <span>Epoch 30 (Final: {benchmarkResult.deep_learning_history.final_train_loss})</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Model Benchmark Leaderboard Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 text-xs flex justify-between items-center">
                  <span>🏆 Multi-Paradigm Anomaly Benchmark Leaderboard</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    Evaluated against {benchmarkResult.is_ground_truth ? 'Original Ground-Truth Dispute Records' : 'Controlled Synthetic Perturbations'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2.5">Model / Algorithm Paradigm</th>
                        <th className="p-2.5 text-center">Type</th>
                        <th className="p-2.5 text-right">ROC-AUC</th>
                        <th className="p-2.5 text-right">PR-AUC (Avg Prec)</th>
                        <th className="p-2.5 text-right">Optimal F1</th>
                        <th className="p-2.5 text-right">Decision Threshold (τ*)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {Object.entries(benchmarkResult.model_results).map(([algName, data], idx) => {
                        const isDeep = algName.includes('Deep');
                        return (
                          <tr
                            key={algName}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                              idx === 0 ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                            }`}
                          >
                            <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              {algName}
                              {idx === 0 && (
                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold">
                                  Top Performer
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  isDeep
                                    ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {isDeep ? 'Deep Learning' : 'Classical ML'}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              {data.roc_auc.toFixed(3)}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-indigo-700 dark:text-sky-300">
                              {data.pr_auc.toFixed(3)}
                            </td>
                            <td className="p-2.5 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                              {data.best_f1.toFixed(3)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                              {data.optimal_threshold.toFixed(3)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deep Learning Feature Attribution & Member Inspection */}
              {selectedDeepElement && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 text-xs">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Deep Neural Reconstruction Attribution: <b className="text-indigo-700 dark:text-sky-300">{selectedDeepElement.name}</b> ({selectedDeepElement.tag})
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Decomposes which physical features generated high reconstruction loss in the latent autoencoder.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-600 dark:text-slate-400">Inspect Member:</label>
                      <select
                        value={selectedDeepElement.tag}
                        onChange={(e) => setSelectedDeepElementTag(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 font-mono text-xs text-slate-800 dark:text-slate-200"
                      >
                        {benchmarkResult.deep_element_predictions.map((p) => (
                          <option key={p.tag} value={p.tag}>
                            {p.tag} | {p.name} (Loss: {p.reconstruction_loss.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Total Reconstruction Loss</div>
                      <div className="text-base font-extrabold text-red-600 dark:text-red-400">{selectedDeepElement.reconstruction_loss.toFixed(3)}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Free Energy Score</div>
                      <div className="text-base font-extrabold text-indigo-700 dark:text-sky-300">{selectedDeepElement.energy_score.toFixed(3)}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Deep Anomaly Flag</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {selectedDeepElement.is_deep_anomaly ? '🚨 Outlier Detected' : '✅ Compliant'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Element Class</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedDeepElement.ifc_type.replace('Ifc', '')}</div>
                    </div>
                  </div>

                  {/* Feature-Level Attribution Breakdown */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Feature Reconstruction Residuals:</div>
                    {selectedDeepElement.feature_attributions.map((attr, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-[11px]">
                        <span className="w-48 font-medium text-slate-700 dark:text-slate-300 truncate">{attr.feature_name}</span>
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, attr.percent_contribution)}%` }}
                          />
                        </div>
                        <span className="w-24 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {attr.percent_contribution}% error
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Methodology Insight Box */}
              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 text-xs flex items-start gap-2.5">
                <span className="font-bold shrink-0">💡 Ground-Truth Engineering Insight:</span>
                <span>
                  By evaluating models against verified historical construction dispute datasets rather than random synthetic noise, we demonstrate that <b>Deep Neural Autoencoders</b> and <b>Isolation Forests</b> excel at multi-variate volumetric surges (ROC-AUC &gt; 0.95), while <b>Stratified Physical Residuals</b> ensure structural mechanics explainability under CPWD/IS standards.
                </span>
              </div>
            </div>
          )}

          {/* TAB 6: L&T ENTERPRISE VISION AI & DIGITAL TWIN */}
          {activeTab === 6 && (
            <VisionAiCenter isDarkMode={isDarkMode} />
          )}

          {/* TAB 7: SCHEDULE OF RATES & SEMANTIC MATCHER */}
          {activeTab === 7 && (
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Schedule of Rates (SOR) & Semantic Vector Matcher
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  CPWD Delhi Schedule of Rates (DSR 2023) baseline parameters coupled with vector space cosine similarity to match raw BIM strings to official DSR line items.
                </p>
              </div>

              {/* Semantic Rate Search Box */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-3 text-xs">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-indigo-600 dark:text-sky-400" />
                  Semantic Rate Search (Vector Cosine Similarity over CPWD DSR)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Type any raw specification, material tag, or contractor billing description to find the closest official CPWD item codes with confidence scoring.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={semanticQuery}
                    onChange={(e) => setSemanticQuery(e.target.value)}
                    placeholder="Enter structural specification string..."
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Match Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  {semanticMatches.map((m, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xs space-y-2 border-t-4 border-t-emerald-500"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 dark:text-slate-200">Rank #{idx + 1}</span>
                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {m.confidence_pct}% Match
                        </span>
                      </div>
                      <div className="font-mono font-bold text-indigo-700 dark:text-sky-400 text-xs">{m.item_code}</div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3">{m.specification}</p>
                      <div className="font-bold text-slate-900 dark:text-white text-xs pt-1 border-t border-slate-100 dark:border-slate-700">
                        Base Rate: ₹{m.base_rate_inr.toLocaleString()} / {m.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rate Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Concrete Rates Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2.5 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    Concrete Work Rates (Per m³)
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2">Grade</th>
                        <th className="p-2">DSR Code</th>
                        <th className="p-2 text-right">Base DSR 2023</th>
                        <th className="p-2 text-right">Active Rate (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {Object.entries(DEFAULT_CONCRETE_RATES)
                        .filter(([g]) => g !== 'DEFAULT')
                        .map(([g, d]) => (
                          <tr key={g} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{g}</td>
                            <td className="p-2 font-mono text-slate-600 dark:text-slate-400">{d.code}</td>
                            <td className="p-2 text-right font-mono text-slate-600 dark:text-slate-400">₹{d.rate.toLocaleString()}</td>
                            <td className="p-2 text-right font-mono font-bold text-indigo-700 dark:text-sky-300">
                              ₹{(d.rate * effectiveRateMultiplier).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Steel & Shuttering Rates Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2.5 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    Steel & Shuttering Unit Rates
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-800 dark:text-slate-200">TMT Fe-500D Reinforcement Steel ({STEEL_RATES.code})</div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Base Rate: ₹{STEEL_RATES.rate_per_tonne.toLocaleString()} / MT (₹{STEEL_RATES.rate_per_kg} / kg)
                      </div>
                      <div className="text-xs font-bold text-indigo-700 dark:text-sky-300 mt-1">
                        Active Rate: ₹{(STEEL_RATES.rate_per_tonne * effectiveRateMultiplier).toLocaleString()} / MT
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">Formwork Rates by Structural Class:</div>
                      {Object.entries(FORMWORK_RATES)
                        .filter(([t]) => t !== 'DEFAULT')
                        .map(([t, fd]) => (
                          <div key={t} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">{t.replace('Ifc', '')} Shuttering</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              ₹{(fd.rate * effectiveRateMultiplier).toFixed(2)} / m²
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: EXPORT CENTER */}
          {activeTab === 8 && (
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Professional Export Center
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Generate presentation-ready, multi-tab Microsoft Excel workbooks (.xlsx) and CSV schedules for contractor tendering, L&T ERP, and SAP integration.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Excel Workbook */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Multi-Tab Excel Workbook</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Includes Executive Summary, Abstract BOQ, Detailed Measurement Book (M-Book), and AI Anomaly Audit Log with CPWD DSR rate codes.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadExcel}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ⬇️ Download Complete BOQ (.xlsx)
                  </button>
                </div>

                {/* Abstract CSV */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-700 dark:text-sky-400">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Abstract BOQ Schedule</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Standard CSV formatted schedule for ERP, contractor tendering portals, and SAP accounting imports.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadBOQCSV}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    ⬇️ Download Abstract BOQ (.csv)
                  </button>
                </div>

                {/* Anomaly CSV */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-700 dark:text-red-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Anomaly Audit Log</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Filtered audit register of flagged high-risk items with surveyor action notes and Z-score deviations.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadAnomalyCSV}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
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
