import { AuditedBIMElement, EnrichedBIMElement } from '../types/bim';

/**
 * Fits Ridge regression (L2 regularized) to predict expected formwork and rebar
 * conditioned on member class (Column, Beam, Slab, Footing) and calculates Studentized residuals.
 */
export class StratifiedResidualScorer {
  private residualThreshold: number;

  constructor(residualThreshold: number = 2.5) {
    this.residualThreshold = residualThreshold;
  }

  // Solve (X^T X + alpha * I)^(-1) X^T y
  private fitRidge(X: number[][], y: number[], alpha: number = 1.0): number[] {
    const n = X.length;
    const p = X[0].length;

    // Normal equation X^T X + alpha I
    const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
    const Xty: number[] = Array(p).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        Xty[j] += X[i][j] * y[i];
        for (let k = 0; k < p; k++) {
          XtX[j][k] += X[i][j] * X[i][k];
        }
      }
    }

    for (let j = 0; j < p; j++) {
      XtX[j][j] += alpha;
    }

    // Solve via Gaussian elimination with partial pivoting
    const A = XtX.map((row) => [...row]);
    const b = [...Xty];

    for (let i = 0; i < p; i++) {
      let maxRow = i;
      for (let k = i + 1; k < p; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
          maxRow = k;
        }
      }
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [b[i], b[maxRow]] = [b[maxRow], b[i]];

      if (Math.abs(A[i][i]) < 1e-12) continue;

      for (let k = i + 1; k < p; k++) {
        const c = A[k][i] / A[i][i];
        for (let j = i; j < p; j++) {
          A[k][j] -= c * A[i][j];
        }
        b[k] -= c * b[i];
      }
    }

    const beta = Array(p).fill(0);
    for (let i = p - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < p; j++) {
        sum -= A[i][j] * beta[j];
      }
      beta[i] = Math.abs(A[i][i]) > 1e-12 ? sum / A[i][i] : 0;
    }

    return beta;
  }

  public fitAndScore(elements: EnrichedBIMElement[]): Partial<AuditedBIMElement>[] {
    // Group by ifc_type
    const groups = new Map<string, EnrichedBIMElement[]>();
    for (const el of elements) {
      const list = groups.get(el.ifc_type) || [];
      list.push(el);
      groups.set(el.ifc_type, list);
    }

    const resultMap = new Map<string, {
      formwork_expected_sqm: number;
      formwork_studentized_residual: number;
      rebar_expected_kg: number;
      rebar_studentized_residual: number;
      is_stratified_outlier: boolean;
    }>();

    for (const [, group] of groups.entries()) {
      const n = group.length;
      if (n < 4) {
        for (const el of group) {
          resultMap.set(el.global_id, {
            formwork_expected_sqm: el.formwork_sqm,
            formwork_studentized_residual: 0,
            rebar_expected_kg: el.rebar_kg,
            rebar_studentized_residual: 0,
            is_stratified_outlier: false,
          });
        }
        continue;
      }

      // Feature vectors: [1, vol, length, bbox_dx, bbox_dy, bbox_dz]
      const X = group.map((el) => [
        1.0,
        el.concrete_vol_cum,
        el.length || el.bbox_dx || 1.0,
        el.bbox_dx || 1.0,
        el.bbox_dy || 1.0,
        el.bbox_dz || 1.0,
      ]);

      const yFw = group.map((el) => el.formwork_sqm);
      const yRebar = group.map((el) => el.rebar_kg);

      const betaFw = this.fitRidge(X, yFw, 2.0);
      const betaRebar = this.fitRidge(X, yRebar, 2.0);

      const resFw: number[] = [];
      const resRebar: number[] = [];

      for (let i = 0; i < n; i++) {
        let pFw = 0;
        let pRebar = 0;
        for (let j = 0; j < X[i].length; j++) {
          pFw += X[i][j] * betaFw[j];
          pRebar += X[i][j] * betaRebar[j];
        }
        resFw.push(yFw[i] - pFw);
        resRebar.push(yRebar[i] - pRebar);
      }

      // Compute standard deviations
      const meanResFw = resFw.reduce((a, b) => a + b, 0) / n;
      const stdResFw = Math.sqrt(resFw.reduce((a, b) => a + Math.pow(b - meanResFw, 2), 0) / n) || 1.0;

      const meanResRebar = resRebar.reduce((a, b) => a + b, 0) / n;
      const stdResRebar = Math.sqrt(resRebar.reduce((a, b) => a + Math.pow(b - meanResRebar, 2), 0) / n) || 1.0;

      for (let i = 0; i < n; i++) {
        const el = group[i];
        const pFw = Math.max(0, yFw[i] - resFw[i]);
        const pRebar = Math.max(0, yRebar[i] - resRebar[i]);
        const zFw = Math.round((resFw[i] / stdResFw) * 100) / 100;
        const zRebar = Math.round((resRebar[i] / stdResRebar) * 100) / 100;

        const isOutlier = Math.abs(zFw) >= this.residualThreshold || Math.abs(zRebar) >= this.residualThreshold;

        resultMap.set(el.global_id, {
          formwork_expected_sqm: Math.round(pFw * 100) / 100,
          formwork_studentized_residual: zFw,
          rebar_expected_kg: Math.round(pRebar * 10) / 10,
          rebar_studentized_residual: zRebar,
          is_stratified_outlier: isOutlier,
        });
      }
    }

    return elements.map((el) => {
      return (
        resultMap.get(el.global_id) || {
          formwork_expected_sqm: el.formwork_sqm,
          formwork_studentized_residual: 0,
          rebar_expected_kg: el.rebar_kg,
          rebar_studentized_residual: 0,
          is_stratified_outlier: false,
        }
      );
    });
  }
}
