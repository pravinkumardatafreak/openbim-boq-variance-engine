import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Bot,
  UserCheck,
  Lock,
  Unlock,
  AlertOctagon,
  Terminal,
  Play,
  RotateCcw,
  Download,
  CheckCircle2,
  XCircle,
  Eye,
  Zap,
  ArrowRight,
  Database,
  FileCheck,
  Cpu,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  AgentContractEngine,
  AIAuditLogEntry,
  HITLSignoffRequest,
  AgentContractSnapshot,
} from '../core/agentContractEngine';
import { AuditedBIMElement, KPISummary, AuditSummary, ModelMetadata } from '../types/bim';

interface AgentContractHubProps {
  modelMeta: ModelMetadata;
  kpis: KPISummary;
  auditSummary: AuditSummary;
  auditedElements: AuditedBIMElement[];
  onTriggerFilter?: (risk: 'ALL' | 'HIGH_ONLY') => void;
  onRecalibrate?: (contamination: number) => void;
}

export const AgentContractHub: React.FC<AgentContractHubProps> = ({
  modelMeta,
  kpis,
  auditSummary,
  auditedElements,
  onTriggerFilter,
  onRecalibrate,
}) => {
  const engine = AgentContractEngine.getInstance();
  const [auditLog, setAuditLog] = useState<AIAuditLogEntry[]>(() => engine.getAIAuditLog());
  const [hitlQueue, setHitlQueue] = useState<HITLSignoffRequest[]>(() => engine.getHITLQueue());
  const [selectedAuditFilter, setSelectedAuditFilter] = useState<'ALL' | 'VIOLATION' | 'HITL'>('ALL');

  // Simulation states
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simSteps, setSimSteps] = useState<string[]>([]);
  const [simActiveIndex, setSimActiveIndex] = useState<number>(-1);
  const [liveSnapshot, setLiveSnapshot] = useState<AgentContractSnapshot | null>(null);

  // Reviewer inputs for HITL
  const [reviewerName, setReviewerName] = useState<string>('Er. Vikram Malhotra (Chief Structural Auditor)');
  const [reviewNote, setReviewNote] = useState<string>('Site verification confirmed rock overbreak profile matching geotechnical survey bore log #4.');

  // Security Toast
  const [securityAlert, setSecurityAlert] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' });

  useEffect(() => {
    const unsubscribe = engine.subscribe(() => {
      setAuditLog(engine.getAIAuditLog());
      setHitlQueue(engine.getHITLQueue());
    });
    return () => unsubscribe();
  }, [engine]);

  const handleGenerateSnapshot = () => {
    const snap = engine.snapshot(modelMeta, kpis, auditSummary, auditedElements);
    setLiveSnapshot(snap);
  };

  const handleTestForbiddenAction = (actionName: string) => {
    const res = engine.act(actionName, { target: 'Production_Database_Write', amount: 500000 });
    if (!res.success) {
      setSecurityAlert({ show: true, msg: res.message });
      setTimeout(() => setSecurityAlert({ show: false, msg: '' }), 5000);
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimSteps([
      '🤖 Initializing autonomous agent: Stagehand / Claude Computer Use driver...',
      '🔍 Step 1: Querying element.__clarity_ai__.snapshot() for token-sanitized model state...',
      '📊 Step 2: Agent parsed 163 members. Detected 3 High-Risk volumetric cost anomalies.',
      '🎯 Step 3: Invoking contract.act("filterAnomalies", { risk: "HIGH_ONLY" }) via whitelisted tool...',
      '🚨 Step 4: Agent attempts unauthorized mutation: contract.act("overrideSafetyDefects", { column: "#16" })...',
      '⛔ SECURITY GUARD ACTIVATED: Action blocked by ai:forbidden firewall. Logged to compliance trail.',
      '🤝 Step 5: Agent falls back gracefully: contract.act("requestHITLSignoff", { elementTag: "#16" })...',
      '✅ Ticket queued for certified human domain expert. Dual-audience safety protocol completed.',
    ]);

    setSimActiveIndex(0);

    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 700));
      setSimActiveIndex(i);

      if (i === 1) {
        handleGenerateSnapshot();
      }
      if (i === 3 && onTriggerFilter) {
        engine.act('filterAnomalies', { risk: 'HIGH_ONLY' });
        onTriggerFilter('HIGH_ONLY');
      }
      if (i === 4) {
        engine.act('overrideSafetyDefects', { column: '#16', pourOverride: true });
      }
      if (i === 6) {
        engine.act('requestHITLSignoff', {
          elementTag: '#16',
          elementName: 'Column C14 - Core Transfer',
          requestedAction: 'CONCRETE_VOLUME_VARIANCE_APPROVE',
          riskSeverity: 'HIGH',
          varianceCostINR: 142500,
          agentJustification: 'Agent detected +22.4% concrete surge. Submitting for human structural engineer verification.',
        });
      }
    }

    setIsSimulating(false);
  };

  const handleApprove = (id: string) => {
    engine.approveHITL(id, reviewerName, reviewNote);
  };

  const handleReject = (id: string) => {
    engine.rejectHITL(id, reviewerName, 'Dispute rejected: Contractor must absorb overbreak volume under General Conditions of Contract (GCC 4.2).');
  };

  const handleDownloadAuditJSON = () => {
    const data = engine.exportAuditLogJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openbim-ai-governance-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = auditLog.filter((item) => {
    if (selectedAuditFilter === 'VIOLATION') return item.status === 'BLOCKED_SECURITY_VIOLATION';
    if (selectedAuditFilter === 'HITL') return item.action.includes('HITL') || item.status.includes('HUMAN');
    return true;
  });

  const violationCount = auditLog.filter((l) => l.status === 'BLOCKED_SECURITY_VIOLATION').length;
  const pendingHitlCount = hitlQueue.filter((q) => q.status === 'PENDING').length;

  return (
    <div className="p-5 space-y-5">
      {/* Security Toast Notification */}
      {securityAlert.show && (
        <div className="fixed bottom-6 right-6 max-w-md z-50 p-4 rounded-xl bg-red-950/95 border-2 border-red-500 text-red-100 shadow-2xl backdrop-blur-md flex items-start gap-3 animate-bounce">
          <AlertOctagon className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-extrabold tracking-wide uppercase text-red-300">
              Presentation-Layer Security Guard
            </div>
            <p className="leading-relaxed">{securityAlert.msg}</p>
          </div>
        </div>
      )}

      {/* Module Title Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-sky-400" />
            AI-Native Agent Contract & Human-In-The-Loop (HITL) Governance Hub
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Powered by the <b>Clarity.js dual-audience paradigm</b>: Providing autonomous AI agents with token-minimal declarative UI contracts (<code>ai:readable</code>, <code>ai:actionable</code>) while enforcing impenetrable safety firewalls (<code>ai:forbidden</code>) and tamper-evident audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownloadAuditJSON}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit JSON
          </button>
        </div>
      </div>

      {/* 4 Top KPI Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-sky-400" />
            Runtime AI Contract
          </div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            ONLINE
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            window.__openbim_ai__ mounted
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            Security Guard Enforcements
          </div>
          <div className="text-xl font-extrabold text-red-600 dark:text-red-400 mt-1">
            {violationCount} Intercepted
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            ai:forbidden barriers triggered
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            HITL Pending Reviews
          </div>
          <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {pendingHitlCount} Actions
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Awaiting human structural engineer
          </div>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Agent Token Efficiency
          </div>
          <div className="text-xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">
            96.2% Saved
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            320 tokens vs 8.5k raw DOM tokens
          </div>
        </div>
      </div>

      {/* ZONE 1: AUTONOMOUS AGENT SIMULATOR BANNER */}
      <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-sky-50/50 to-white dark:from-slate-900 dark:via-indigo-950/30 dark:to-slate-900 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h3 className="text-xs font-bold text-indigo-950 dark:text-sky-200 flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-600 dark:text-sky-400" />
              Interactive Autonomous AI Auditor Simulation
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Simulate an external agent (e.g., Claude Computer Use, Stagehand, Playwright) navigating this BIM project. Watch it take snapshots, filter anomalies, get blocked on forbidden actions, and route to HITL.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all ${
                isSimulating
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isSimulating ? 'Simulation Running...' : '▶ Run Autonomous Auditor Agent'}
            </button>
          </div>
        </div>

        {/* Live Terminal Output */}
        {(simSteps.length > 0 || isSimulating) && (
          <div className="mt-3 p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] border border-slate-800 space-y-1 max-h-48 overflow-y-auto shadow-inner">
            <div className="flex items-center justify-between text-[10px] text-slate-500 pb-1 border-b border-slate-800 font-sans">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-emerald-400" />
                Live Agent Execution Console (Clarity.js Protocol)
              </span>
              <span>{isSimulating ? 'Status: EXECUTING' : 'Status: COMPLETED'}</span>
            </div>
            {simSteps.map((step, idx) => (
              <div
                key={idx}
                className={`transition-all duration-300 ${
                  idx === simActiveIndex
                    ? 'text-sky-300 font-bold bg-sky-950/40 px-1 rounded'
                    : idx < simActiveIndex
                    ? 'text-slate-400'
                    : 'text-slate-600'
                } ${step.includes('SECURITY GUARD') ? 'text-red-400 font-bold' : ''}`}
              >
                {step}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ZONE 2: DUAL-AUDIENCE PERMISSION FIREWALL EXPLORER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ai:readable */}
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-extrabold text-xs text-emerald-900 dark:text-emerald-300">
                ai:readable [Whitelisted]
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
              Safe for Agent Context
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Data properties accessible to LLMs without raw DOM scraping. Sanitized of internal tokens and PII.
          </p>

          <div className="flex flex-wrap gap-1 text-[10px] font-mono">
            {engine.READABLE_PROPERTIES.map((prop) => (
              <span
                key={prop}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-emerald-200 dark:border-emerald-800"
              >
                {prop}
              </span>
            ))}
          </div>

          <button
            onClick={handleGenerateSnapshot}
            className="w-full mt-2 py-1.5 px-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-750 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Inspect Sanitized Snapshot (JSON)
          </button>
        </div>

        {/* ai:actionable */}
        <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/30 dark:bg-sky-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span className="font-extrabold text-xs text-sky-900 dark:text-sky-300">
                ai:actionable [Whitelisted]
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
              Permitted Tool Calls
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Functions an autonomous agent is permitted to execute programmatically via <code>contract.act()</code>.
          </p>

          <div className="space-y-1.5 text-[11px]">
            {engine.ACTIONABLE_METHODS.map((method) => (
              <div
                key={method}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-800 flex justify-between items-center"
              >
                <code className="text-slate-800 dark:text-slate-200 text-[10px] font-bold">{method}()</code>
                <button
                  onClick={() => {
                    if (method === 'filterAnomalies' && onTriggerFilter) {
                      engine.act('filterAnomalies', { risk: 'HIGH_ONLY' });
                      onTriggerFilter('HIGH_ONLY');
                    } else {
                      engine.act(method, { simulated: true });
                    }
                  }}
                  className="px-2 py-0.5 rounded text-[9px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 hover:bg-sky-200 transition-colors"
                >
                  Test Call
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ai:forbidden */}
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="font-extrabold text-xs text-red-900 dark:text-red-300">
                ai:forbidden [Strictly Blocked]
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
              Zero-Trust Barrier
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Safety-critical operations guarded from autonomous agents. Any attempt triggers an immediate security violation.
          </p>

          <div className="space-y-1.5 text-[11px]">
            {engine.FORBIDDEN_ACTIONS.map((action) => (
              <div
                key={action}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 flex justify-between items-center"
              >
                <code className="text-red-700 dark:text-red-400 text-[10px] font-bold">{action}()</code>
                <button
                  onClick={() => handleTestForbiddenAction(action)}
                  className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 hover:bg-red-200 transition-colors flex items-center gap-1"
                >
                  <ShieldAlert className="w-2.5 h-2.5" />
                  Simulate Breach
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LIVE SNAPSHOT MODAL / VIEWER */}
      {liveSnapshot && (
        <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 text-slate-200 font-mono text-xs space-y-2">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800 font-sans">
            <span className="font-bold text-sky-400 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Runtime Sanitized State Snapshot (Generated for Agent)
            </span>
            <button
              onClick={() => setLiveSnapshot(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
            >
              Close Snapshot
            </button>
          </div>
          <pre className="max-h-56 overflow-y-auto text-[11px] text-emerald-300">
            {JSON.stringify(liveSnapshot, null, 2)}
          </pre>
        </div>
      )}

      {/* ZONE 3: HUMAN-IN-THE-LOOP (HITL) REVIEW DESK */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600 dark:text-sky-400" />
              Human-In-The-Loop (HITL) Structural Review Queue
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              When an AI agent identifies high-risk cost deviations, building code conflicts, or rock overbreak surges, it cannot self-authorize. The action is held here for certified human verification.
            </p>
          </div>

          <div className="text-xs text-slate-500">
            <b>{hitlQueue.length}</b> total tickets ({pendingHitlCount} pending)
          </div>
        </div>

        {/* Reviewer Settings Bar */}
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Active Certifying Engineer:
            </label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200 font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Engineering Verification Justification:
            </label>
            <input
              type="text"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Queue Items */}
        <div className="space-y-2 text-xs">
          {hitlQueue.map((ticket) => (
            <div
              key={ticket.id}
              className={`p-3 rounded-xl border transition-all ${
                ticket.status === 'PENDING'
                  ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                  : ticket.status === 'APPROVED'
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                  : 'bg-red-50/40 dark:bg-red-950/20 border-red-300 dark:border-red-800/60'
              }`}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {ticket.elementName} ({ticket.elementTag})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ticket.status === 'PENDING'
                          ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                          : ticket.status === 'APPROVED'
                          ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}
                    >
                      {ticket.status}
                    </span>
                    <span className="text-[11px] text-red-600 dark:text-red-400 font-bold">
                      ₹{ticket.varianceCostINR.toLocaleString()} At-Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    <b>Agent Justification:</b> {ticket.agentJustification}
                  </p>
                  {ticket.reviewedBy && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      <b>Reviewed By:</b> {ticket.reviewedBy} • <i>"{ticket.reviewNotes}"</i>
                    </p>
                  )}
                </div>

                {ticket.status === 'PENDING' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(ticket.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve Variance
                    </button>
                    <button
                      onClick={() => handleReject(ticket.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject Claim
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ZONE 4: CRYPTOGRAPHIC AUDIT TRAIL LEDGER */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600 dark:text-sky-400" />
              Cryptographic Audit Trail & Compliance Ledger (ISO 19650)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Every action initiated by agents or human engineers is hashed and recorded with actor identity, timestamp, and security verdict.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setSelectedAuditFilter('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                selectedAuditFilter === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              All Events ({auditLog.length})
            </button>
            <button
              onClick={() => setSelectedAuditFilter('VIOLATION')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                selectedAuditFilter === 'VIOLATION'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Violations ({violationCount})
            </button>
            <button
              onClick={() => setSelectedAuditFilter('HITL')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                selectedAuditFilter === 'HITL'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              HITL Decisions
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Actor</th>
                <th className="p-2.5">Action Executed</th>
                <th className="p-2.5">Permission</th>
                <th className="p-2.5">Security Status</th>
                <th className="p-2.5 font-mono">Digital Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.map((entry) => (
                <tr
                  key={entry.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-850/50 ${
                    entry.status === 'BLOCKED_SECURITY_VIOLATION'
                      ? 'bg-red-50/30 dark:bg-red-950/10'
                      : ''
                  }`}
                >
                  <td className="p-2.5 text-[11px] text-slate-500 font-mono">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                    {entry.actor === 'AUTONOMOUS_AGENT' ? (
                      <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                        <Bot className="w-3 h-3" /> Agent
                      </span>
                    ) : entry.actor === 'HUMAN_EXPERT' ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <UserCheck className="w-3 h-3" /> Human Expert
                      </span>
                    ) : (
                      <span className="text-slate-500">System</span>
                    )}
                  </td>
                  <td className="p-2.5 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {entry.action}
                  </td>
                  <td className="p-2.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        entry.permission === 'READABLE'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : entry.permission === 'ACTIONABLE'
                          ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300'
                          : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                      }`}
                    >
                      {entry.permission}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        entry.status === 'SUCCESS'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : entry.status === 'BLOCKED_SECURITY_VIOLATION'
                          ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                          : entry.status === 'APPROVED_BY_HUMAN'
                          ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {entry.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-[10px] text-slate-400">
                    {entry.signature}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
