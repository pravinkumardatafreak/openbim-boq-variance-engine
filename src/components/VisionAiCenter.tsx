import React, { useState } from 'react';
import {
  Camera,
  Cpu,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Activity,
  FileText,
  Download,
  Zap,
  Drone,
  Bot,
  Radar,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { LT_VISION_INSPECTION_FEEDS, VisionInspectionFeed } from '../core/visionAiEngine';

interface VisionAiCenterProps {
  isDarkMode?: boolean;
}

export const VisionAiCenter: React.FC<VisionAiCenterProps> = ({ isDarkMode = false }) => {
  const [selectedFeedId, setSelectedFeedId] = useState<string>('drone_column_pour');
  const [activeLayer, setActiveLayer] = useState<'all' | 'defects' | 'rebar' | 'safety'>('all');
  const [showConfidence, setShowConfidence] = useState<boolean>(true);
  const [selectedTensorRTPreset, setSelectedTensorRTPreset] = useState<'INT8' | 'FP16' | 'FP32'>('INT8');

  const feed: VisionInspectionFeed = LT_VISION_INSPECTION_FEEDS[selectedFeedId] || LT_VISION_INSPECTION_FEEDS['drone_column_pour'];

  const filteredDetections = feed.detections.filter((d) => {
    if (activeLayer === 'all') return true;
    if (activeLayer === 'defects') return d.type === 'defect';
    if (activeLayer === 'rebar') return d.type === 'rebar';
    if (activeLayer === 'safety') return d.type === 'safety';
    return true;
  });

  return (
    <div className="p-5 space-y-5">
      {/* Module Title Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600 dark:text-sky-400" />
            👁️ L&T Enterprise Vision AI, Drone Inspection & Digital Twin Center
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Engineered for L&T Construction & Infrastructure: Edge AI video analytics on NVIDIA Jetson, As-Designed (BIM) vs As-Built vision verification, automated VLM Non-Conformance Reports (NCR), and LiDAR SLAM sensor fusion.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-sky-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-sky-400" />
            NVIDIA Jetson / TensorRT 10.3 Accelerated
          </span>
        </div>
      </div>

      {/* Feed Selector Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {Object.values(LT_VISION_INSPECTION_FEEDS).map((f) => {
          const isSelected = f.id === selectedFeedId;
          return (
            <button
              key={f.id}
              onClick={() => setSelectedFeedId(f.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 dark:border-sky-500 text-indigo-950 dark:text-sky-200 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-[11px] text-slate-500 dark:text-slate-400">{f.source_type}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    f.inspection_status === 'DEFECT_DETECTED'
                      ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300'
                      : f.inspection_status === 'SAFETY_VIOLATION'
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                      : f.inspection_status === 'DIMENSIONAL_VARIANCE'
                      ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {f.inspection_status.replace('_', ' ')}
                </span>
              </div>
              <div className="font-bold text-xs truncate">{f.title.slice(3)}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{f.target_element_name} ({f.target_element_tag})</div>
            </button>
          );
        })}
      </div>

      {/* Main Inspection Grid (Feed Simulator + Digital Twin Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Simulated Camera Canvas with Detections (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs">
            {/* Camera Header Bar */}
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">LIVE FEED: {feed.source_type}</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500 dark:text-slate-400">{feed.site_location}</span>
              </div>

              {/* Layer Filter Chips */}
              <div className="flex gap-1">
                {(['all', 'defects', 'rebar', 'safety'] as const).map((layer) => (
                  <button
                    key={layer}
                    onClick={() => setActiveLayer(layer)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      activeLayer === layer
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {layer.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative w-full h-80 rounded-lg overflow-hidden bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 border border-slate-800 flex items-center justify-center shadow-inner">
              {/* Construction Grid Background Texture */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>

              {/* Watermark Overlay */}
              <div className="absolute top-2 left-2 text-[10px] font-mono text-slate-400 bg-black/60 px-2 py-1 rounded backdrop-blur-xs flex items-center gap-2">
                <span>FPS: <b>{feed.edge_profiler.throughput_fps.toFixed(1)}</b></span>
                <span>•</span>
                <span>LATENCY: <b>{feed.edge_profiler.latency_ms.toFixed(1)} ms</b></span>
                <span>•</span>
                <span>{feed.edge_profiler.target_hardware}</span>
              </div>

              <div className="absolute top-2 right-2 text-[10px] font-mono text-emerald-400 bg-black/60 px-2 py-1 rounded backdrop-blur-xs">
                PRECISION: TensorRT {selectedTensorRTPreset}
              </div>

              {/* Center Abstract Construction Element Representation */}
              <div className="relative flex flex-col items-center justify-center text-center p-6 space-y-2">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-sky-500/60 bg-sky-500/10 flex items-center justify-center text-3xl">
                  🏗️
                </div>
                <div className="text-white font-bold text-sm tracking-wide">{feed.target_element_name} ({feed.ifc_class})</div>
                <div className="text-[11px] text-slate-400 max-w-sm">{feed.work_stage}</div>
              </div>

              {/* Overlay Detections / Bounding Boxes */}
              {filteredDetections.map((det, idx) => {
                const [ymin, xmin, ymax, xmax] = det.bbox;
                const isDefect = det.type === 'defect';
                const isSafety = det.type === 'safety';
                const borderColor = isDefect ? 'border-red-500' : isSafety ? 'border-amber-500' : 'border-emerald-500';
                const tagColor = isDefect ? 'bg-red-600' : isSafety ? 'bg-amber-600' : 'bg-emerald-600';

                return (
                  <div
                    key={idx}
                    className={`absolute border-2 ${borderColor} rounded-sm transition-all pointer-events-auto group cursor-pointer`}
                    style={{
                      top: `${ymin}%`,
                      left: `${xmin}%`,
                      height: `${ymax - ymin}%`,
                      width: `${xmax - xmin}%`,
                      backgroundColor: isDefect ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                    }}
                  >
                    <div className={`absolute -top-5 left-0 ${tagColor} text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-t-sm whitespace-nowrap shadow`}>
                      {det.label} {showConfidence && `(${(det.confidence * 100).toFixed(0)}%)`}
                    </div>

                    {/* Hover detail tooltip */}
                    <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 z-30 p-2 rounded bg-slate-900/95 text-white text-[10px] max-w-xs shadow-xl border border-slate-700 pointer-events-none">
                      {det.detail}
                    </div>
                  </div>
                );
              })}

              {/* Bottom HUD Bar */}
              <div className="absolute bottom-2 inset-x-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded text-[10px] text-slate-300 flex justify-between items-center">
                <span>STATUS: <b className="text-white">{feed.inspection_status}</b></span>
                <span>MODEL: <b>YOLOv11-OBB + Mask2Former (Concrete Defect)</b></span>
                <span>LiDAR DEVIATION: <b className="text-amber-400">{feed.lidar_deviation_mm} mm</b></span>
              </div>
            </div>

            {/* Detections Summary List */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Live AI Model Detections:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredDetections.map((det, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg border text-xs space-y-0.5 ${
                      det.type === 'defect'
                        ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-200'
                        : det.type === 'safety'
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                        : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{det.label}</span>
                      <span className="font-mono text-[10px]">{(det.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="text-[11px] opacity-90">{det.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multimodal VLM QA/QC Non-Conformance Report (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Automated VLM NCR Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                Multimodal VLM Automated NCR
              </h3>
              <span className="font-mono font-bold text-[10px] text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/80 px-2 py-0.5 rounded">
                {feed.vlm_ncr_memo.ncr_number}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Cross-references site visual vision frames with the 3D BIM model and CPWD/IS-456 standards to generate binding audit documentation.
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Clause & Specification:</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{feed.vlm_ncr_memo.clause_reference}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Visual Vision AI Finding:</div>
                <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">{feed.vlm_ncr_memo.visual_finding}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 space-y-1">
                <div className="text-[10px] uppercase font-bold text-indigo-700 dark:text-sky-300">Digital Twin (BIM) Variance:</div>
                <div className="text-indigo-950 dark:text-indigo-200 leading-relaxed text-[11px]">{feed.vlm_ncr_memo.bim_variance_finding}</div>
              </div>

              <div className="p-2.5 rounded-lg bg-red-50/60 dark:bg-red-950/30 border border-red-200 dark:border-red-900 space-y-1">
                <div className="text-[10px] uppercase font-bold text-red-700 dark:text-red-300">Mandated Corrective Action:</div>
                <div className="text-red-950 dark:text-red-200 leading-relaxed text-[11px] font-medium">{feed.vlm_ncr_memo.corrective_action}</div>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Recommended Contractor Retention:</span>
                <span className="font-mono font-bold text-red-600 dark:text-red-400 text-sm">
                  ₹{feed.vlm_ncr_memo.financial_retention_inr.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Edge AI / TensorRT Profiler */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                Edge AI Hardware Profiler (Jetson MLOps)
              </h3>
              <div className="flex gap-1">
                {(['INT8', 'FP16', 'FP32'] as const).map((prec) => (
                  <button
                    key={prec}
                    onClick={() => setSelectedTensorRTPreset(prec)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      selectedTensorRTPreset === prec
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {prec}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 dark:text-slate-400 text-[10px]">Inference Latency</div>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {selectedTensorRTPreset === 'INT8'
                    ? feed.edge_profiler.latency_ms.toFixed(1)
                    : selectedTensorRTPreset === 'FP16'
                    ? (feed.edge_profiler.latency_ms * 1.4).toFixed(1)
                    : (feed.edge_profiler.latency_ms * 2.8).toFixed(1)}{' '}
                  ms
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 dark:text-slate-400 text-[10px]">Throughput (FPS)</div>
                <div className="font-mono font-bold text-indigo-600 dark:text-sky-400 text-sm">
                  {selectedTensorRTPreset === 'INT8'
                    ? feed.edge_profiler.throughput_fps.toFixed(1)
                    : selectedTensorRTPreset === 'FP16'
                    ? (feed.edge_profiler.throughput_fps / 1.4).toFixed(1)
                    : (feed.edge_profiler.throughput_fps / 2.8).toFixed(1)}{' '}
                  FPS
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 dark:text-slate-400 text-[10px]">Power Budget</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {feed.edge_profiler.power_draw_watts} W
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 dark:text-slate-400 text-[10px]">Edge Memory</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {feed.edge_profiler.memory_footprint_mb} MB
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">
              Hardware: {feed.edge_profiler.target_hardware} running {feed.edge_profiler.runtime}.
            </div>
          </div>
        </div>
      </div>

      {/* Strategic L&T Enterprise Vision AI Alignment Box */}
      <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 dark:from-slate-900 dark:via-slate-850 dark:to-indigo-950/40 space-y-2 text-xs">
        <h4 className="font-bold text-indigo-950 dark:text-sky-200 text-xs flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-sky-400" />
          Enterprise Alignment with L&T Computer Vision Lead Mandate:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-600 dark:text-slate-300">
          <div>
            <b className="text-slate-900 dark:text-white">1. As-Designed vs As-Built 3D Fusion:</b>
            <p className="mt-0.5">
              Fuses drone/camera photogrammetry with OpenBIM IFC property sets to spot rebar spacing, shuttering dimensional drift, and cold joint risks before pouring concrete.
            </p>
          </div>
          <div>
            <b className="text-slate-900 dark:text-white">2. Multimodal VLM Auditing:</b>
            <p className="mt-0.5">
              Replaces manual engineer checklists with instant multimodal NCR documentation citing CPWD DSR 2023 clauses and withholding contractor billing variance.
            </p>
          </div>
          <div>
            <b className="text-slate-900 dark:text-white">3. Jetson Edge MLOps:</b>
            <p className="mt-0.5">
              Demonstrates quantized INT8 TensorRT deployment on NVIDIA Jetson Orin with sub-12ms latency, enabling real-time edge processing on cranes and drones without cloud reliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
