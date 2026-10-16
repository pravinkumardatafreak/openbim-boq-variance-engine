/**
 * Construction 4D Time-Series Dataset Engine & Predictive Analytics
 * 
 * Provides daily sequential tracking of early-stage mega-infrastructure projects:
 * Phase 1: Mobilization & Piling (Days 1-30)
 * Phase 2: Deep Excavation & Raft/Footing Foundation Pours (Days 31-75)
 * Phase 3: Basement Retaining Walls & Plinth Level Beams (Days 76-110)
 * Phase 4: Ground Floor Transfer Slab & Superstructure Lifts (Days 111-150)
 * 
 * Models Earned Value Management (EVM), S-Curve progress, weather disruptions,
 * and autoregressive 30-day forward forecasting with dataset export for PyTorch/Prophet.
 */

export interface DailyConstructionLog {
  day: number;
  date: string;
  phase: string;
  planned_concrete_cum: number;
  actual_concrete_cum: number;
  cum_planned_concrete: number;
  cum_actual_concrete: number;
  daily_rebar_tonnes: number;
  daily_formwork_sqm: number;
  daily_worker_count: number;
  weather_delay_hours: number;
  vision_defects_count: number;
  spi: number; // Schedule Performance Index (EV / PV)
  cpi: number; // Cost Performance Index (EV / AC)
  status: 'ON_TRACK' | 'DELAYED' | 'AHEAD' | 'CRITICAL_RISK';
}

export interface TimeSeriesForecastPoint {
  day: number;
  date: string;
  forecast_daily_concrete: number;
  forecast_cum_concrete: number;
  lower_bound_cum: number;
  upper_bound_cum: number;
  projected_spi: number;
}

export interface TimeSeriesAnalyticsSummary {
  total_days_logged: number;
  current_phase: string;
  total_planned_cum: number;
  total_actual_cum: number;
  variance_cum: number;
  variance_pct: number;
  current_spi: number;
  current_cpi: number;
  projected_delay_days: number;
  projected_financial_exposure_lakhs: number;
  forecast_points: TimeSeriesForecastPoint[];
}

export class ConstructionTimeSeriesEngine {
  private logs: DailyConstructionLog[] = [];

  constructor() {
    this.generateStartingStageDataset();
  }

  /**
   * Generates a realistic 90-day time-series starting dataset representing
   * foundation and substructure execution of a commercial/infrastructure project.
   */
  public generateStartingStageDataset(): DailyConstructionLog[] {
    const logs: DailyConstructionLog[] = [];
    const startDate = new Date('2026-01-05');
    let cumPlanned = 0;
    let cumActual = 0;

    for (let day = 1; day <= 90; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + (day - 1));
      const dateStr = currentDate.toISOString().split('T')[0];

      let phase = 'Phase 1: Piling & Soil Stabilization';
      let plannedDaily = 15;
      let actualDaily = 14;
      let rebarDaily = 2.2;
      let formworkDaily = 35;
      let workers = 45;
      let weatherDelay = 0;
      let defects = 0;

      if (day <= 30) {
        // Phase 1: Mobilization, Bored Cast-in-Situ Piling
        phase = 'Phase 1: Bored Cast-in-Situ Piling & Shoring';
        plannedDaily = 18 + (day % 4) * 2;
        actualDaily = Math.max(0, plannedDaily + (Math.sin(day) * 3) - (day === 14 ? 10 : 0));
        rebarDaily = 2.8 + (Math.cos(day) * 0.4);
        formworkDaily = 40 + (day % 5) * 5;
        workers = 50 + (day % 6) * 3;
        weatherDelay = day === 14 ? 6.5 : (day % 11 === 0 ? 2 : 0);
        defects = day === 18 ? 2 : 0;
      } else if (day <= 65) {
        // Phase 2: Raft Foundation & Isolated Pedestal Footings
        phase = 'Phase 2: Raft Foundation & Substructure Footings';
        plannedDaily = 45 + (day % 5) * 4;
        // Incur a mid-foundation supply disruption around day 45-52 (monsoon rain + pump line blockage)
        const isDisrupted = day >= 46 && day <= 52;
        actualDaily = isDisrupted 
          ? Math.max(8, plannedDaily * 0.45) 
          : plannedDaily + (Math.sin(day * 0.8) * 5);
        rebarDaily = 6.5 + (Math.sin(day) * 1.2);
        formworkDaily = 120 + (day % 8) * 10;
        workers = 85 + (day % 10) * 4;
        weatherDelay = isDisrupted ? 4.5 : (day % 9 === 0 ? 1.5 : 0);
        defects = day === 48 ? 3 : (day === 52 ? 2 : 0);
      } else {
        // Phase 3: Basement Retaining Walls & Plinth Level Beams
        phase = 'Phase 3: Basement Retaining Walls & Plinth Columns';
        plannedDaily = 38 + (day % 4) * 3;
        actualDaily = plannedDaily - 3 + (Math.sin(day * 0.5) * 4); // Partial recovery
        rebarDaily = 5.2 + (Math.cos(day) * 0.8);
        formworkDaily = 145 + (day % 7) * 12;
        workers = 92 + (day % 8) * 2;
        weatherDelay = day % 15 === 0 ? 3 : 0;
        defects = day === 72 ? 1 : 0;
      }

      cumPlanned += plannedDaily;
      cumActual += actualDaily;

      // SPI & CPI calculations
      const spi = cumPlanned > 0 ? Number((cumActual / cumPlanned).toFixed(3)) : 1.0;
      // Actual Cost modeled as base planned unit cost + delay overtime
      const acCostRatio = actualDaily > 0 ? 1 + (weatherDelay > 0 ? 0.18 : 0) + (defects > 0 ? 0.12 : 0) : 1;
      const cpi = Number((Math.min(1.2, Math.max(0.75, spi * (1 / acCostRatio)))).toFixed(3));

      let status: DailyConstructionLog['status'] = 'ON_TRACK';
      if (spi < 0.82) status = 'CRITICAL_RISK';
      else if (spi < 0.94) status = 'DELAYED';
      else if (spi > 1.05) status = 'AHEAD';

      logs.push({
        day,
        date: dateStr,
        phase,
        planned_concrete_cum: Math.round(plannedDaily * 10) / 10,
        actual_concrete_cum: Math.round(actualDaily * 10) / 10,
        cum_planned_concrete: Math.round(cumPlanned * 10) / 10,
        cum_actual_concrete: Math.round(cumActual * 10) / 10,
        daily_rebar_tonnes: Math.round(rebarDaily * 10) / 10,
        daily_formwork_sqm: Math.round(formworkDaily),
        daily_worker_count: workers,
        weather_delay_hours: weatherDelay,
        vision_defects_count: defects,
        spi,
        cpi,
        status,
      });
    }

    this.logs = logs;
    return logs;
  }

  /**
   * Retrieves all historical daily records.
   */
  public getLogs(): DailyConstructionLog[] {
    return this.logs;
  }

  /**
   * Appends today's real-time site log (Day N+1) and updates the rolling S-Curve.
   */
  public appendDailyLog(entry: {
    planned_concrete_cum: number;
    actual_concrete_cum: number;
    daily_rebar_tonnes: number;
    daily_formwork_sqm: number;
    daily_worker_count: number;
    weather_delay_hours: number;
    vision_defects_count: number;
    phase?: string;
  }): DailyConstructionLog {
    const lastLog = this.logs[this.logs.length - 1];
    const newDay = (lastLog ? lastLog.day : 0) + 1;

    let nextDateStr = new Date().toISOString().split('T')[0];
    if (lastLog) {
      const prevDate = new Date(lastLog.date);
      prevDate.setDate(prevDate.getDate() + 1);
      nextDateStr = prevDate.toISOString().split('T')[0];
    }

    const prevCumPlanned = lastLog ? lastLog.cum_planned_concrete : 0;
    const prevCumActual = lastLog ? lastLog.cum_actual_concrete : 0;

    const cumPlanned = prevCumPlanned + entry.planned_concrete_cum;
    const cumActual = prevCumActual + entry.actual_concrete_cum;

    const spi = cumPlanned > 0 ? Number((cumActual / cumPlanned).toFixed(3)) : 1.0;
    const acRatio = 1 + (entry.weather_delay_hours > 0 ? 0.2 : 0) + (entry.vision_defects_count > 0 ? 0.15 : 0);
    const cpi = Number((Math.min(1.2, Math.max(0.75, spi * (1 / acRatio)))).toFixed(3));

    let status: DailyConstructionLog['status'] = 'ON_TRACK';
    if (spi < 0.82) status = 'CRITICAL_RISK';
    else if (spi < 0.94) status = 'DELAYED';
    else if (spi > 1.05) status = 'AHEAD';

    const newRecord: DailyConstructionLog = {
      day: newDay,
      date: nextDateStr,
      phase: entry.phase || (lastLog ? lastLog.phase : 'Superstructure Construction'),
      planned_concrete_cum: entry.planned_concrete_cum,
      actual_concrete_cum: entry.actual_concrete_cum,
      cum_planned_concrete: Math.round(cumPlanned * 10) / 10,
      cum_actual_concrete: Math.round(cumActual * 10) / 10,
      daily_rebar_tonnes: entry.daily_rebar_tonnes,
      daily_formwork_sqm: entry.daily_formwork_sqm,
      daily_worker_count: entry.daily_worker_count,
      weather_delay_hours: entry.weather_delay_hours,
      vision_defects_count: entry.vision_defects_count,
      spi,
      cpi,
      status,
    };

    this.logs.push(newRecord);
    return newRecord;
  }

  /**
   * Generates a 30-day forward predictive time-series forecast using
   * an autoregressive velocity and rolling exponential smoothing model.
   */
  public generateForecast(forecastDays: number = 30): TimeSeriesForecastPoint[] {
    if (this.logs.length === 0) return [];

    const recentLogs = this.logs.slice(-14); // Last 14 days velocity
    const avgRecentDaily = recentLogs.reduce((s, l) => s + l.actual_concrete_cum, 0) / recentLogs.length;
    const avgRecentPlanned = recentLogs.reduce((s, l) => s + l.planned_concrete_cum, 0) / recentLogs.length;
    const recentSpi = avgRecentPlanned > 0 ? avgRecentDaily / avgRecentPlanned : 1.0;

    const lastLog = this.logs[this.logs.length - 1];
    let runningCum = lastLog.cum_actual_concrete;
    let runningLower = lastLog.cum_actual_concrete;
    let runningUpper = lastLog.cum_actual_concrete;

    const forecastPoints: TimeSeriesForecastPoint[] = [];
    const baseDate = new Date(lastLog.date);

    // Damped trend factor recovering 0.5% per day if currently lagging
    for (let f = 1; f <= forecastDays; f++) {
      const fDate = new Date(baseDate);
      fDate.setDate(baseDate.getDate() + f);

      const targetPlanned = 36 + (f % 5) * 3;
      // Expected velocity gradually converges toward planned velocity as recovery actions apply
      const recoveryMultiplier = Math.min(1.0, recentSpi + (f * 0.006));
      const dailyForecast = targetPlanned * recoveryMultiplier;

      runningCum += dailyForecast;
      // 95% Confidence Interval widening over future horizon
      const sigma = 3.5 * Math.sqrt(f);
      runningLower += Math.max(0, dailyForecast - sigma);
      runningUpper += dailyForecast + sigma;

      forecastPoints.push({
        day: lastLog.day + f,
        date: fDate.toISOString().split('T')[0],
        forecast_daily_concrete: Math.round(dailyForecast * 10) / 10,
        forecast_cum_concrete: Math.round(runningCum * 10) / 10,
        lower_bound_cum: Math.round(runningLower * 10) / 10,
        upper_bound_cum: Math.round(runningUpper * 10) / 10,
        projected_spi: Number((recoveryMultiplier).toFixed(3)),
      });
    }

    return forecastPoints;
  }

  /**
   * Produces an executive analytics summary for project directors and planners.
   */
  public getAnalyticsSummary(): TimeSeriesAnalyticsSummary {
    const lastLog = this.logs[this.logs.length - 1] || {
      day: 0,
      phase: 'Initial',
      cum_planned_concrete: 0,
      cum_actual_concrete: 0,
      spi: 1.0,
      cpi: 1.0,
    };

    const planned = lastLog.cum_planned_concrete;
    const actual = lastLog.cum_actual_concrete;
    const variance = actual - planned;
    const variancePct = planned > 0 ? (variance / planned) * 100 : 0;

    // Projected delay: based on current deficit divided by average daily pour velocity
    const recentLogs = this.logs.slice(-14);
    const avgVelocity = recentLogs.length > 0
      ? recentLogs.reduce((s, l) => s + l.actual_concrete_cum, 0) / recentLogs.length
      : 30;
    
    const projectedDelayDays = variance < 0 ? Math.round(Math.abs(variance) / Math.max(5, avgVelocity)) : 0;
    // Commercial Liquidated Damages / Idle Crane Exposure modeled at ₹1.2 Lakhs / day delay
    const financialExposure = Number(((projectedDelayDays * 1.2) + (variance < 0 ? Math.abs(variance) * 0.08 : 0)).toFixed(2));

    const forecast = this.generateForecast(30);

    return {
      total_days_logged: lastLog.day,
      current_phase: lastLog.phase,
      total_planned_cum: planned,
      total_actual_cum: actual,
      variance_cum: Math.round(variance * 10) / 10,
      variance_pct: Number(variancePct.toFixed(1)),
      current_spi: lastLog.spi,
      current_cpi: lastLog.cpi,
      projected_delay_days: projectedDelayDays,
      projected_financial_exposure_lakhs: financialExposure,
      forecast_points: forecast,
    };
  }

  /**
   * Generates a clean CSV file string formatted for machine learning model training
   * (PyTorch Dataset, Prophet, XGBoost, Scikit-Learn).
   */
  public exportTrainingCSV(): string {
    const headers = [
      'day',
      'date',
      'phase',
      'planned_concrete_cum',
      'actual_concrete_cum',
      'cum_planned_concrete',
      'cum_actual_concrete',
      'daily_rebar_tonnes',
      'daily_formwork_sqm',
      'daily_worker_count',
      'weather_delay_hours',
      'vision_defects_count',
      'spi',
      'cpi',
      'status',
    ];

    const rows = this.logs.map((l) => [
      l.day,
      l.date,
      `"${l.phase}"`,
      l.planned_concrete_cum,
      l.actual_concrete_cum,
      l.cum_planned_concrete,
      l.cum_actual_concrete,
      l.daily_rebar_tonnes,
      l.daily_formwork_sqm,
      l.daily_worker_count,
      l.weather_delay_hours,
      l.vision_defects_count,
      l.spi,
      l.cpi,
      l.status,
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generates a JSON dataset export.
   */
  public exportTrainingJSON(): string {
    return JSON.stringify(
      {
        dataset_name: 'L&T Mega-Infrastructure Early-Stage Construction Time Series',
        metadata: {
          project: 'Commercial Complex & Metro Alignment Substructure',
          total_records: this.logs.length,
          time_horizon_days: 90,
          granularity: 'Daily (24-hour cycle)',
          standards: ['CPWD DSR 2023', 'IS-456:2000', 'Earned Value Management ISO 21508'],
          features: [
            'planned_concrete_cum',
            'actual_concrete_cum',
            'cum_planned_concrete',
            'cum_actual_concrete',
            'daily_rebar_tonnes',
            'daily_formwork_sqm',
            'daily_worker_count',
            'weather_delay_hours',
            'vision_defects_count',
            'spi',
            'cpi',
          ],
        },
        records: this.logs,
      },
      null,
      2
    );
  }
}
