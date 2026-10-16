import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Database,
  Download,
  PlusCircle,
  Activity,
  Zap,
  Sparkles,
  DollarSign,
  CloudRain,
  ShieldAlert,
} from 'lucide-react';
import {
  ConstructionTimeSeriesEngine,
  DailyConstructionLog,
  TimeSeriesAnalyticsSummary,
} from '../core/constructionTimeSeries';

interface TimeSeriesProgressCenterProps {
  isDarkMode?: boolean;
}

export const TimeSeriesProgressCenter: React.FC<TimeSeriesProgressCenterProps> = ({ isDarkMode = false }) => {
  const engine = useMemo(() => new ConstructionTimeSeriesEngine(), []);
  const [logs, setLogs] = useState<DailyConstructionLog[]>(() => engine.getLogs());
  const [analytics, setAnalytics] = useState<TimeSeriesAnalyticsSummary>(() => engine.getAnalyticsSummary());

  // Input states for logging today's progress
  const [newActualConcrete, setNewActualConcrete] = useState<number>(38.5);
  const [newPlannedConcrete, setNewPlannedConcrete] = useState<number>(40.0);
  const [newRebar, setNewRebar] = useState<number>(5.4);
  const [newFormwork, setNewFormwork] = useState<number>(150);
  const [newWorkers, setNewWorkers] = useState<number>(94);
  const [newWeatherDelay, setNewWeatherDelay] = useState<number>(0);
  const [newDefects, setNewDefects] = useState<number>(0);
  const [justLogged, setJustLogged] = useState<boolean>(false);

  // Time horizon view mode
  const [viewWindow, setViewWindow] = useState<'all' | 'recent_30' | 'forecast'>('all');

  const displayedLogs = useMemo(() => {
    if (viewWindow === 'recent_30') return logs.slice(-30);
    return logs;
  }, [logs, viewWindow]);

  const handleLogProgress = () => {
    const newRecord = engine.appendDailyLog({
      planned_concrete_cum: newPlannedConcrete,
      actual_concrete_cum: newActualConcrete,
      daily_rebar_tonnes: newRebar,
      daily_formwork_sqm: newFormwork,
      daily_worker_count: newWorkers,
      weather_delay_hours: newWeatherDelay,
      vision_defects_count: newDefects,
    });

    setLogs([...engine.getLogs()]);
    setAnalytics(engine.getAnalyticsSummary());
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 3000);
  };

  const handleDownloadCSV = () => {
    const csvContent = engine.exportTrainingCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `LT_Construction_TimeSeries_Day${logs.length}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadJSON = () => {
    const jsonContent = engine.exportTrainingJSON();
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `LT_Construction_TimeSeries_Day${logs.length}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-5 space-y-5">
      {/* Module Title Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-sky-400" />
            📈 4D Construction Time-Series Engine & S-Curve Predictive Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Daily sequential dataset generation, Earned Value (SPI/CPI) tracking for early-stage substructure, and autoregressive 30-day velocity forecasting for training predictive ML models.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            ⬇️ Export ML Dataset (.csv)
          </button>
          <button
            onClick={handleDownloadJSON}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            ⬇️ PyTorch JSON
          </button>
        </div>
      </div>

      {/* KPI Performance Metric Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Current Day & Phase */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Project Day</span>
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-sky-400" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">Day {analytics.total_days_logged}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{analytics.current_phase}</div>
        </div>

        {/* Schedule Performance Index (SPI) */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Schedule Index (SPI)</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <div className={`text-xl font-black ${analytics.current_spi >= 0.95 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {analytics.current_spi.toFixed(3)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {analytics.current_spi >= 0.95 ? '✅ On Critical Path' : '⚠️ Schedule Slippage'}
          </div>
        </div>

        {/* Cost Performance Index (CPI) */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Cost Efficiency (CPI)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className={`text-xl font-black ${analytics.current_cpi >= 0.95 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {analytics.current_cpi.toFixed(3)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            EV / Actual Expenditure
          </div>
        </div>

        {/* Cumulative Volume & Variance */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Concrete Poured</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {analytics.total_actual_cum.toLocaleString()} <span className="text-xs font-normal">m³</span>
          </div>
          <div className={`text-[11px] mt-0.5 font-semibold ${analytics.variance_cum >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {analytics.variance_cum >= 0 ? `+${analytics.variance_cum} m³ ahead` : `${analytics.variance_cum} m³ behind`}
          </div>
        </div>

        {/* Projected Delay & Exposure */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Projected Slippage</span>
            <Clock className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl font-black text-red-600 dark:text-red-400">
            +{analytics.projected_delay_days} Days
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            ₹{analytics.projected_financial_exposure_lakhs} Lakhs Exposure
          </div>
        </div>
      </div>

      {/* Main Grid: S-Curve Visualization & Daily Ingestion Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: S-Curve Time-Series Chart */}
        <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 shadow-xs">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-indigo-600 dark:text-sky-400" />
              Earned Value S-Curve: Planned Baseline vs Actual vs 30-Day Forecast
            </h3>
            <div className="flex gap-1 text-[10px]">
              {(['all', 'recent_30', 'forecast'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewWindow(mode)}
                  className={`px-2 py-0.5 rounded font-bold ${
                    viewWindow === mode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {mode === 'all' ? 'Full Timeline' : mode === 'recent_30' ? 'Last 30 Days' : 'Forecast Horizon'}
                </button>
              ))}
            </div>
          </div>

          {/* S-Curve Visual Display */}
          <div className="space-y-3">
            {/* Visual Canvas Simulation Bar */}
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Start: Day 1 (Piling)</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Current: Day {analytics.total_days_logged}</span>
                <span>Target: Day {analytics.total_days_logged + 30} (Superstructure)</span>
              </div>

              {/* Progress Bar S-Curve representation */}
              <div className="relative w-full h-8 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden flex items-center">
                {/* Planned Progress Bar */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-slate-300 dark:bg-slate-700 opacity-60"
                  style={{ width: `${Math.min(100, (analytics.total_planned_cum / (analytics.total_planned_cum + 1200)) * 100)}%` }}
                />
                {/* Actual Realized Progress */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-indigo-600 dark:bg-sky-500 rounded-lg"
                  style={{ width: `${Math.min(100, (analytics.total_actual_cum / (analytics.total_planned_cum + 1200)) * 100)}%` }}
                />
                <div className="relative z-10 px-3 text-xs font-bold text-white drop-shadow-xs flex justify-between w-full">
                  <span>Actual: {analytics.total_actual_cum} m³</span>
                  <span>Planned: {analytics.total_planned_cum} m³</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" /> Realized Actual (EV)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Planned Baseline (PV)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> 95% Confidence Forecast
                  </span>
                </div>
                <span>Velocity: ~{(analytics.total_actual_cum / analytics.total_days_logged).toFixed(1)} m³/day</span>
              </div>
            </div>

            {/* Daily Sequence Micro Table */}
            <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0 font-semibold">
                  <tr>
                    <th className="p-2">Day / Date</th>
                    <th className="p-2">Phase</th>
                    <th className="p-2 text-right">Plan (m³)</th>
                    <th className="p-2 text-right">Actual (m³)</th>
                    <th className="p-2 text-right">Cum Actual</th>
                    <th className="p-2 text-right">SPI</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {displayedLogs.map((l) => (
                    <tr key={l.day} className="hover:bg-slate-50 dark:hover:bg-slate-850/50">
                      <td className="p-2 font-mono font-medium">Day {l.day} <span className="text-[10px] text-slate-400">({l.date.slice(5)})</span></td>
                      <td className="p-2 truncate max-w-[150px]">{l.phase}</td>
                      <td className="p-2 text-right font-mono text-slate-500">{l.planned_concrete_cum}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white">{l.actual_concrete_cum}</td>
                      <td className="p-2 text-right font-mono text-indigo-700 dark:text-sky-300 font-semibold">{l.cum_actual_concrete}</td>
                      <td className={`p-2 text-right font-mono font-bold ${l.spi >= 0.95 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {l.spi.toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          l.status === 'ON_TRACK'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : l.status === 'DELAYED'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Daily Log Ingestion & Retraining Form */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs text-xs">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Log Daily Progress (Day {analytics.total_days_logged + 1})
            </h3>
            {justLogged && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                ✅ Forecast Retrained
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Enter real-time pour quantities, workforce, and delays to update the project trajectory and S-Curve in real time.
          </p>

          <div className="space-y-2.5">
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Actual Concrete Poured Today (m³):</label>
              <input
                type="number"
                value={newActualConcrete}
                onChange={(e) => setNewActualConcrete(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Planned Target For Today (m³):</label>
              <input
                type="number"
                value={newPlannedConcrete}
                onChange={(e) => setNewPlannedConcrete(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Rebar Tied (t):</label>
                <input
                  type="number"
                  value={newRebar}
                  onChange={(e) => setNewRebar(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Formwork (m²):</label>
                <input
                  type="number"
                  value={newFormwork}
                  onChange={(e) => setNewFormwork(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Workers:</label>
                <input
                  type="number"
                  value={newWorkers}
                  onChange={(e) => setNewWorkers(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Rain (hrs):</label>
                <input
                  type="number"
                  value={newWeatherDelay}
                  onChange={(e) => setNewWeatherDelay(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Defects:</label>
                <input
                  type="number"
                  value={newDefects}
                  onChange={(e) => setNewDefects(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleLogProgress}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs mt-2"
            >
              <Zap className="w-3.5 h-3.5" />
              ⚡ Append Log & Re-calibrate Forecast
            </button>
          </div>

          {/* Machine Learning Model Code Snippet */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
              Future Model Training Integration (Python / PyTorch):
            </div>
            <pre className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-800 dark:text-slate-300 overflow-x-auto">
{`# Load time-series CSV for LSTM / Prophet
import pandas as pd
df = pd.read_csv('LT_Construction_TimeSeries.csv')
# Predict next-week pour volume target
X = df[['daily_rebar_tonnes', 'daily_worker_count', 'weather_delay_hours']]
y = df['actual_concrete_cum']`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
