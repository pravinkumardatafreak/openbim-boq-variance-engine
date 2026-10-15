import { DEFAULT_CONCRETE_RATES, FORMWORK_RATES, STEEL_RATES } from '../config/rates';
import { SORMatchResult } from '../types/bim';

interface CorpusItem {
  item_code: string;
  category: string;
  specification: string;
  unit: string;
  base_rate_inr: number;
  text_for_embedding: string;
  tokens: Set<string>;
}

export class SemanticSORMatcher {
  private corpus: CorpusItem[] = [];

  constructor() {
    this.buildCorpus();
  }

  private tokenize(text: string): Set<string> {
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const words = clean.split(/\s+/).filter((w) => w.length > 1);
    const ngrams = new Set<string>();

    for (const w of words) {
      ngrams.add(w);
      // Generate 3-char sub-tokens
      if (w.length >= 3) {
        for (let i = 0; i <= w.length - 3; i++) {
          ngrams.add(w.substring(i, i + 3));
        }
      }
    }
    return ngrams;
  }

  private buildCorpus() {
    // 1. Concrete items
    for (const [grade, data] of Object.entries(DEFAULT_CONCRETE_RATES)) {
      if (grade === 'DEFAULT') continue;
      const text = `Concrete ${grade} RCC Design Mix ordinary portland cement ${data.description} ${data.code} structural grade ${grade} pumping high performance`;
      this.corpus.push({
        item_code: data.code,
        category: 'Concrete Works',
        specification: data.description,
        unit: data.unit,
        base_rate_inr: data.rate,
        text_for_embedding: text,
        tokens: this.tokenize(text),
      });
    }

    // 2. Steel items
    const textSteel = `Steel reinforcement TMT Thermo-Mechanically Treated Fe-500D Fe-550 cutting bending binding ${STEEL_RATES.description} ${STEEL_RATES.code} high ductility`;
    this.corpus.push({
      item_code: STEEL_RATES.code,
      category: 'Reinforcement Steel',
      specification: STEEL_RATES.description,
      unit: STEEL_RATES.unit,
      base_rate_inr: STEEL_RATES.rate_per_tonne,
      text_for_embedding: textSteel,
      tokens: this.tokenize(textSteel),
    });

    // 3. Formwork items
    for (const [ifcClass, data] of Object.entries(FORMWORK_RATES)) {
      if (ifcClass === 'DEFAULT') continue;
      const memberName = ifcClass.replace('Ifc', '');
      const textFw = `Centering and shuttering formwork staging propping ${memberName} ${data.description} ${data.code} decking suspended slab column beam footing`;
      this.corpus.push({
        item_code: data.code,
        category: 'Centering & Shuttering',
        specification: data.description,
        unit: data.unit,
        base_rate_inr: data.rate,
        text_for_embedding: textFw,
        tokens: this.tokenize(textFw),
      });
    }
  }

  public matchSpecification(query: string, topK: number = 3): SORMatchResult[] {
    if (!query || !query.trim()) return [];

    const qTokens = this.tokenize(query);
    if (qTokens.size === 0) return [];

    const scored = this.corpus.map((item) => {
      // Jaccard + Cosine overlap approximation
      let overlap = 0;
      for (const t of qTokens) {
        if (item.tokens.has(t)) {
          overlap += t.length > 3 ? 1.5 : 1.0;
        }
      }

      // Bonus for exact grade match (e.g. M35, M40, Fe-500D)
      const qLower = query.toLowerCase();
      if (
        (qLower.includes('m35') && item.text_for_embedding.includes('M35')) ||
        (qLower.includes('m40') && item.text_for_embedding.includes('M40')) ||
        (qLower.includes('m30') && item.text_for_embedding.includes('M30')) ||
        (qLower.includes('m25') && item.text_for_embedding.includes('M25')) ||
        (qLower.includes('m20') && item.text_for_embedding.includes('M20')) ||
        (qLower.includes('m50') && item.text_for_embedding.includes('M50')) ||
        (qLower.includes('fe-500') && item.text_for_embedding.includes('Fe-500')) ||
        (qLower.includes('fe 500') && item.text_for_embedding.includes('Fe-500')) ||
        (qLower.includes('rebar') && item.category === 'Reinforcement Steel') ||
        (qLower.includes('shuttering') && item.category === 'Centering & Shuttering')
      ) {
        overlap += 3.0;
      }

      const denominator = Math.sqrt(qTokens.size) * Math.sqrt(item.tokens.size);
      const score = Math.min(1.0, Math.max(0.05, overlap / (denominator || 1.0)));

      return {
        item_code: item.item_code,
        category: item.category,
        specification: item.specification,
        unit: item.unit,
        base_rate_inr: item.base_rate_inr,
        similarity_score: Math.round(score * 100) / 100,
        confidence_pct: Math.min(99, Math.round(score * 100)),
      };
    });

    scored.sort((a, b) => b.similarity_score - a.similarity_score);
    return scored.slice(0, topK);
  }
}
