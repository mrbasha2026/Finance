export interface KPIHistory {
  labels: string[];        // period labels (e.g. "يناير 2024")
  revenue: number[];
  grossProfit: number[];
  netIncome: number[];
  operatingMargin: number[]; // percentage
  grossMargin: number[];     // percentage
}

export interface ForecastResult {
  values: number[];
  slope: number;
  intercept: number;
  r2: number;
}

export interface FinancialAlert {
  type: "success" | "warning" | "danger";
  titleAr: string;
  messageAr: string;
}

export function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

export function forecastValues(values: number[], periods: number): ForecastResult {
  const { slope, intercept } = linearRegression(values);
  const n = values.length;

  const forecasted = Array.from({ length: periods }, (_, i) =>
    intercept + slope * (n + i)
  );

  const r2 = computeR2(values, slope, intercept);

  return { values: forecasted, slope, intercept, r2 };
}

function computeR2(actual: number[], slope: number, intercept: number): number {
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < actual.length; i++) {
    const predicted = intercept + slope * i;
    ssTot += (actual[i] - mean) ** 2;
    ssRes += (actual[i] - predicted) ** 2;
  }
  if (ssTot === 0) return 1;
  return Math.max(0, Math.min(1, 1 - ssRes / ssTot));
}

export function detectAlerts(history: KPIHistory): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];
  const n = history.revenue.length;
  if (n < 2) return alerts;

  // Revenue trend
  const revSlope = linearRegression(history.revenue).slope;
  const avgRev = history.revenue.reduce((a, b) => a + b, 0) / n;
  const revTrendPct = avgRev > 0 ? (revSlope / avgRev) * 100 : 0;

  if (revTrendPct < -5) {
    alerts.push({
      type: "danger",
      titleAr: "تراجع الإيرادات",
      messageAr: `الإيرادات تتراجع بمعدل ${Math.abs(revTrendPct).toFixed(1)}% شهرياً — يجب مراجعة استراتيجية المبيعات.`,
    });
  } else if (revTrendPct > 5) {
    alerts.push({
      type: "success",
      titleAr: "نمو إيجابي في الإيرادات",
      messageAr: `الإيرادات تنمو بمعدل ${revTrendPct.toFixed(1)}% شهرياً — أداء ممتاز.`,
    });
  }

  // Gross margin compression
  if (history.grossMargin.length >= 2) {
    const first = history.grossMargin.slice(0, Math.ceil(n / 2));
    const last = history.grossMargin.slice(Math.ceil(n / 2));
    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const lastAvg = last.reduce((a, b) => a + b, 0) / last.length;
    const diff = lastAvg - firstAvg;

    if (diff < -3) {
      alerts.push({
        type: "warning",
        titleAr: "ضغط على هامش الربح الإجمالي",
        messageAr: `هامش الربح الإجمالي انخفض بمقدار ${Math.abs(diff).toFixed(1)} نقطة مئوية — راجع تكاليف المبيعات.`,
      });
    }
  }

  // Net income trend
  const netSlope = linearRegression(history.netIncome).slope;
  if (netSlope < 0 && history.netIncome[n - 1] < 0) {
    alerts.push({
      type: "danger",
      titleAr: "خسارة صافية متكررة",
      messageAr: "الشركة تسجل خسائر صافية متزايدة — مراجعة عاجلة للتكاليف ضرورية.",
    });
  } else if (netSlope > 0 && history.netIncome[n - 1] > 0) {
    alerts.push({
      type: "success",
      titleAr: "تحسن في صافي الدخل",
      messageAr: "صافي الدخل في مسار تصاعدي — مؤشر إيجابي على الكفاءة التشغيلية.",
    });
  }

  // Operating margin deterioration
  if (history.operatingMargin.length >= 3) {
    const opSlope = linearRegression(history.operatingMargin).slope;
    if (opSlope < -1) {
      alerts.push({
        type: "warning",
        titleAr: "تدهور الهامش التشغيلي",
        messageAr: `الهامش التشغيلي يتراجع بمعدل ${Math.abs(opSlope).toFixed(1)}% شهرياً — راجع المصروفات التشغيلية.`,
      });
    }
  }

  return alerts;
}

export function formatNumber(n: number, currency = "SAR"): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000)
    return `${(n / 1_000_000_000).toFixed(2)} مليار ${currency}`;
  if (abs >= 1_000_000)
    return `${(n / 1_000_000).toFixed(2)} مليون ${currency}`;
  if (abs >= 1_000)
    return `${(n / 1_000).toFixed(1)} ألف ${currency}`;
  return `${n.toFixed(0)} ${currency}`;
}
