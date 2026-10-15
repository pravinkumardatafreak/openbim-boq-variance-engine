import {
  DEFAULT_CONCRETE_RATES,
  FORMWORK_AREA_MULTIPLIERS,
  FORMWORK_RATES,
  REBAR_DENSITY_THUMB_RULES,
  STEEL_RATES,
} from '../config/rates';
import { BOQLineItem, EnrichedBIMElement, KPISummary, RawBIMElement } from '../types/bim';

export class BOQEngine {
  private rateMultiplier: number;
  private customConcreteRates: Record<string, number>;
  private customSteelRatePerTonne?: number;
  private customFormworkRates: Record<string, number>;
  private rebarDensityRules: Record<string, number>;

  constructor(
    rateMultiplier: number = 1.0,
    customConcreteRates: Record<string, number> = {},
    customSteelRatePerTonne?: number,
    customFormworkRates: Record<string, number> = {},
    rebarDensityOverride: Record<string, number> = {}
  ) {
    this.rateMultiplier = rateMultiplier;
    this.customConcreteRates = customConcreteRates;
    this.customSteelRatePerTonne = customSteelRatePerTonne;
    this.customFormworkRates = customFormworkRates;
    this.rebarDensityRules = { ...REBAR_DENSITY_THUMB_RULES, ...rebarDensityOverride };
  }

  public getConcreteRateInfo(grade: string): { code: string; description: string; rate: number } {
    const gradeClean = grade.toUpperCase().replace(/\s+/g, '');
    const info = DEFAULT_CONCRETE_RATES[gradeClean] || DEFAULT_CONCRETE_RATES['DEFAULT'];
    const baseRate = this.customConcreteRates[gradeClean] || info.rate;
    return {
      code: info.code,
      description: info.description,
      rate: Math.round(baseRate * this.rateMultiplier * 100) / 100,
    };
  }

  public getSteelRateInfo(): { code: string; description: string; rate_per_tonne: number; rate_per_kg: number } {
    const baseRate = this.customSteelRatePerTonne || STEEL_RATES.rate_per_tonne;
    const effectiveTonne = Math.round(baseRate * this.rateMultiplier * 100) / 100;
    return {
      code: STEEL_RATES.code,
      description: STEEL_RATES.description,
      rate_per_tonne: effectiveTonne,
      rate_per_kg: Math.round((effectiveTonne / 1000.0) * 100) / 100,
    };
  }

  public getFormworkRateInfo(ifcType: string): { code: string; description: string; rate: number } {
    const info = FORMWORK_RATES[ifcType] || FORMWORK_RATES['DEFAULT'];
    const baseRate = this.customFormworkRates[ifcType] || info.rate;
    return {
      code: info.code,
      description: info.description,
      rate: Math.round(baseRate * this.rateMultiplier * 100) / 100,
    };
  }

  public computeElementTakeoffs(elements: RawBIMElement[]): EnrichedBIMElement[] {
    const steelInfo = this.getSteelRateInfo();

    return elements.map((el) => {
      const vol = Math.max(0, el.net_volume || 0);
      const density = this.rebarDensityRules[el.ifc_type] || this.rebarDensityRules['DEFAULT'];
      const rebarKg = Math.round(vol * density * 100) / 100;
      const rebarTonne = Math.round((rebarKg / 1000.0) * 10000) / 10000;

      // Formwork calculation
      let formworkSqm = 0;
      const dx = el.bbox_dx || 0;
      const dy = el.bbox_dy || 0;
      const dz = el.bbox_dz || 0;

      if (el.ifc_type === 'IfcSlab' && el.area && el.area > 0) {
        formworkSqm = el.area;
      } else if (el.has_geometry && dx > 0 && dy > 0 && dz > 0) {
        if (el.ifc_type === 'IfcColumn') {
          formworkSqm = Math.round(2.0 * (dx + dy) * dz * 100) / 100;
        } else if (el.ifc_type === 'IfcBeam') {
          formworkSqm = Math.round((2.0 * Math.min(dy, dz) + Math.min(dx, dy)) * Math.max(dx, dy, dz) * 100) / 100;
        } else {
          const mult = FORMWORK_AREA_MULTIPLIERS[el.ifc_type] || FORMWORK_AREA_MULTIPLIERS['DEFAULT'];
          formworkSqm = Math.round(vol * mult * 100) / 100;
        }
      } else {
        const mult = FORMWORK_AREA_MULTIPLIERS[el.ifc_type] || FORMWORK_AREA_MULTIPLIERS['DEFAULT'];
        formworkSqm = Math.round(vol * mult * 100) / 100;
      }

      const concreteRateInfo = this.getConcreteRateInfo(el.concrete_grade);
      const formworkRateInfo = this.getFormworkRateInfo(el.ifc_type);

      const concreteCost = Math.round(vol * concreteRateInfo.rate * 100) / 100;
      const rebarCost = Math.round(rebarTonne * steelInfo.rate_per_tonne * 100) / 100;
      const formworkCost = Math.round(formworkSqm * formworkRateInfo.rate * 100) / 100;
      const totalCost = Math.round((concreteCost + rebarCost + formworkCost) * 100) / 100;

      return {
        ...el,
        concrete_vol_cum: vol,
        rebar_density_kg_cum: density,
        rebar_kg: rebarKg,
        rebar_tonne: rebarTonne,
        formwork_sqm: formworkSqm,
        concrete_cost_inr: concreteCost,
        rebar_cost_inr: rebarCost,
        formwork_cost_inr: formworkCost,
        total_cost_inr: totalCost,
      };
    });
  }

  public generateAbstractBOQ(enriched: EnrichedBIMElement[]): BOQLineItem[] {
    const items: Record<
      string,
      { code: string; category: string; description: string; unit: string; quantity: number; rate: number }
    > = {};

    // 1. Concrete by Grade
    for (const el of enriched) {
      const g = el.concrete_grade;
      const cInfo = this.getConcreteRateInfo(g);
      const key = `CONC_${g}`;
      if (!items[key]) {
        items[key] = {
          code: cInfo.code,
          category: 'Concrete Works (RCC / PCC)',
          description: cInfo.description,
          unit: 'cum',
          quantity: 0,
          rate: cInfo.rate,
        };
      }
      items[key].quantity += el.concrete_vol_cum;
    }

    // 2. Steel
    const sInfo = this.getSteelRateInfo();
    const totalSteelTonne = enriched.reduce((sum, el) => sum + el.rebar_tonne, 0);
    items['STEEL_TMT'] = {
      code: sInfo.code,
      category: 'Reinforcement Steel',
      description: sInfo.description,
      unit: 'tonne',
      quantity: totalSteelTonne,
      rate: sInfo.rate_per_tonne,
    };

    // 3. Formwork by Element Class
    for (const el of enriched) {
      const fwInfo = this.getFormworkRateInfo(el.ifc_type);
      const key = `FW_${el.ifc_type}`;
      if (!items[key]) {
        items[key] = {
          code: fwInfo.code,
          category: 'Centering & Shuttering',
          description: fwInfo.description,
          unit: 'sqm',
          quantity: 0,
          rate: fwInfo.rate,
        };
      }
      items[key].quantity += el.formwork_sqm;
    }

    // Build line items & amounts
    const result: BOQLineItem[] = [];
    let grandTotal = 0;

    for (const key in items) {
      const it = items[key];
      const amt = Math.round(it.quantity * it.rate * 100) / 100;
      grandTotal += amt;
    }

    for (const key in items) {
      const it = items[key];
      const amt = Math.round(it.quantity * it.rate * 100) / 100;
      const share = grandTotal > 0 ? (amt / grandTotal) * 100 : 0;
      result.push({
        'Item Code': it.code,
        Category: it.category,
        Description: it.description,
        Unit: it.unit,
        Quantity: Math.round(it.quantity * 100) / 100,
        'Rate (INR)': it.rate,
        'Amount (INR)': amt,
        '% Share': Math.round(share * 100) / 100,
      });
    }

    // Sort by Category then Amount descending
    result.sort((a, b) => {
      if (a.Category === b.Category) {
        return b['Amount (INR)'] - a['Amount (INR)'];
      }
      return a.Category.localeCompare(b.Category);
    });

    return result;
  }

  public getKPISummary(enriched: EnrichedBIMElement[]): KPISummary {
    const totalElements = enriched.length;
    const totalConcreteCum = enriched.reduce((sum, el) => sum + el.concrete_vol_cum, 0);
    const concreteCostInr = enriched.reduce((sum, el) => sum + el.concrete_cost_inr, 0);
    const totalSteelTonne = enriched.reduce((sum, el) => sum + el.rebar_tonne, 0);
    const steelCostInr = enriched.reduce((sum, el) => sum + el.rebar_cost_inr, 0);
    const totalFormworkSqm = enriched.reduce((sum, el) => sum + el.formwork_sqm, 0);
    const formworkCostInr = enriched.reduce((sum, el) => sum + el.formwork_cost_inr, 0);
    const totalCostInr = concreteCostInr + steelCostInr + formworkCostInr;

    const rebarDensityOverall = totalConcreteCum > 0 ? (totalSteelTonne * 1000.0) / totalConcreteCum : 0;

    return {
      total_elements: totalElements,
      total_concrete_cum: Math.round(totalConcreteCum * 10) / 10,
      concrete_cost_inr: Math.round(concreteCostInr),
      total_steel_tonne: Math.round(totalSteelTonne * 10) / 10,
      steel_cost_inr: Math.round(steelCostInr),
      rebar_density_overall: Math.round(rebarDensityOverall),
      total_formwork_sqm: Math.round(totalFormworkSqm * 10) / 10,
      formwork_cost_inr: Math.round(formworkCostInr),
      total_cost_inr: Math.round(totalCostInr),
      total_cost_lakhs: Math.round((totalCostInr / 100000.0) * 100) / 100,
      total_cost_crores: Math.round((totalCostInr / 10000000.0) * 1000) / 1000,
    };
  }
}
