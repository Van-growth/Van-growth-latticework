// financials_v2 프롬프트 전용 — SEC 산업 벤치마크(industry_benchmark 테이블,
// server/scripts/secBenchmarkPrecompute.ts가 SEC Financial Statement Data Sets 벌크
// 파싱으로 채움) 컨텍스트를 만든다.
//
// 기존 industry_benchmark_cache/industryBenchmarkService.ts(라이브 캐시, 이 앱에서 실제
// 검색된 EDGAR 기업만 대상이라 표본이 좁음, financials_v2.industry_benchmark 구조화 필드로
// 첨부돼 별도 UI 카드로 렌더링)와는 완전히 별개 시스템이다 — 이쪽은 SEC 전수 벌크 데이터
// 기반의 훨씬 큰 표본이고, 구조화 필드가 아니라 Claude 프롬프트에 직접 주입돼
// narrative/outlook 문장에 자연스럽게 녹아든다(2026-08-11).
//
// 회사 자신의 5개 지표는 서버에서 직접 계산한다(rawEdgar 시계열 기반, industryBenchmarkService.ts
// 의 extractLatestRatios와 동일한 "지표별로 독립적으로 가장 최근에 두 값이 다 있는 연도를
// 찾는다" 패턴 — 한 지표가 최신연도에 없다고 다른 지표까지 오래된 연도를 쓰거나 버리지
// 않음) — Claude에게 편차(%) 계산을 맡기지 않는다. 서버가 이미 ±30% 이상 벗어난 지표만
// 걸러서 넘기므로, 프롬프트는 "언급 여부를 재판단"할 필요 없이 자연스럽게 서술만 하면 된다.
import { supabase } from './supabase';
import { MIN_SECTOR_SAMPLE_SIZE } from '../services/monteCarloService';
import type { EdgarRawSeries } from './edgar';

const DEVIATION_THRESHOLD = 0.30; // ±30% 이상 벌어질 때만 언급

const METRIC_KEYS = ['debt_equity_ratio', 'cfo_revenue_ratio', 'operating_margin', 'asset_turnover', 'revenue_growth'] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

const METRIC_LABELS: Record<MetricKey, { label: string; unit: string }> = {
  debt_equity_ratio: { label: 'Debt/Equity ratio', unit: '%' },
  cfo_revenue_ratio: { label: 'Operating cash flow / Revenue ratio', unit: '%' },
  operating_margin:  { label: 'Operating margin', unit: '%' },
  asset_turnover:    { label: 'Asset turnover', unit: 'x' },
  revenue_growth:    { label: 'Revenue growth (YoY)', unit: '%' },
};

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// 분자/분모 시계열에서 "가장 최근에 두 값이 다 있는" 연도의 비율(%) — 지표마다 독립적으로 찾는다.
function latestRatioPct(num: (number | null)[], den: (number | null)[]): number | null {
  const n = Math.min(num.length, den.length);
  for (let i = 0; i < n; i++) {
    const a = num[i], b = den[i];
    if (isFiniteNum(a) && isFiniteNum(b) && b !== 0) return (a / b) * 100;
  }
  return null;
}

function computeCompanyRatios(series: EdgarRawSeries): Record<MetricKey, number | null> {
  let assetTurnover: number | null = null;
  {
    const n = Math.min(series.revenue.length, series.assets.length);
    for (let i = 0; i < n; i++) {
      const r = series.revenue[i], a = series.assets[i];
      if (isFiniteNum(r) && isFiniteNum(a) && a > 0) { assetTurnover = r / a; break; } // 배수, %아님
    }
  }
  let revenueGrowth: number | null = null;
  for (let i = 0; i < series.revenue.length - 1; i++) {
    const curr = series.revenue[i], prev = series.revenue[i + 1];
    if (isFiniteNum(curr) && isFiniteNum(prev) && prev > 0) { revenueGrowth = ((curr - prev) / prev) * 100; break; }
  }
  return {
    debt_equity_ratio: latestRatioPct(series.liabilities, series.equity),
    cfo_revenue_ratio: latestRatioPct(series.operatingCF, series.revenue),
    operating_margin:  latestRatioPct(series.operatingIncome, series.revenue),
    asset_turnover:    assetTurnover,
    revenue_growth:    revenueGrowth,
  };
}

interface BenchmarkRow {
  sic_code: string;
  debt_equity_ratio_median: number | null; debt_equity_ratio_n: number | null;
  cfo_revenue_ratio_median: number | null; cfo_revenue_ratio_n: number | null;
  operating_margin_median: number | null; operating_margin_n: number | null;
  asset_turnover_median: number | null; asset_turnover_n: number | null;
  revenue_growth_median: number | null; revenue_growth_n: number | null;
}

function medianOf(row: BenchmarkRow, key: MetricKey): number | null {
  return (row as unknown as Record<string, number | null>)[`${key}_median`];
}
function sampleNOf(row: BenchmarkRow, key: MetricKey): number | null {
  return (row as unknown as Record<string, number | null>)[`${key}_n`];
}

/**
 * financials_v2 전용 컨텍스트 블록. EDGAR 소스 기업에만 적용(DART/web_search는 SIC 체계가
 * 안 맞아 null 반환, 조용히 스킵 — cik가 없으면 그 자체로 null).
 * - 이 SIC의 표본이 전 지표 다 5개 미만(또는 행 자체가 없음): "비교 데이터 부족, 직접
 *   확인 제안" 안내 지시만 반환, 수치는 절대 안 줌.
 * - 표본은 충분한데 이 회사 수치가 어느 지표에서도 업종 중앙값 대비 ±30% 이상 안 벗어남:
 *   null 반환(벤치마크 자체를 언급하지 않음 — 매번 코멘트하면 노이즈).
 * - 벗어난 지표가 있으면: 그 지표만 골라 회사값/업종 중앙값/n과 함께 반환, 인용 시 출처
 *   배지(L1)를 어떻게 붙일지까지 지시문에 포함.
 */
export async function buildSecBenchmarkContext(rawEdgar: EdgarRawSeries | undefined | null): Promise<string | null> {
  if (!rawEdgar?.cik) return null;
  const cik = String(rawEdgar.cik).replace(/^CIK/, '');

  const { data: cikRow } = await supabase.from('cik_master').select('sic_code').eq('cik', cik).maybeSingle();
  const sicCode = cikRow?.sic_code;
  if (!sicCode) return null;

  const { data: row } = await supabase
    .from('industry_benchmark')
    .select('*')
    .eq('sic_code', sicCode)
    .maybeSingle<BenchmarkRow>();

  const reliableMetrics = row ? METRIC_KEYS.filter(k => (sampleNOf(row, k) ?? 0) >= MIN_SECTOR_SAMPLE_SIZE) : [];

  if (reliableMetrics.length === 0) {
    const maxN = row ? Math.max(0, ...METRIC_KEYS.map(k => sampleNOf(row, k) ?? 0)) : 0;
    return [
      `\n[SEC industry benchmark — SIC ${sicCode}]`,
      `Public peer sample for this SIC code is too small for a reliable comparison (largest available ` +
        `sample n=${maxN}, below the reliability threshold of ${MIN_SECTOR_SAMPLE_SIZE} companies).`,
      'Do not state any industry-average figures anywhere in this section. Instead, include one sentence ' +
        'in the narrative or outlook noting that public peer comparison data is limited for this industry, ' +
        'and — phrased as a question, never as a stated claim — suggest that confirming the company\'s ' +
        'financial position directly (e.g. in a meeting) may be more reliable than an industry benchmark here.',
    ].join('\n');
  }

  const companyRatios = computeCompanyRatios(rawEdgar);
  const deviating = reliableMetrics.filter(k => {
    const companyVal = companyRatios[k];
    const median = medianOf(row!, k);
    if (!isFiniteNum(companyVal) || !isFiniteNum(median) || median === 0) return false;
    return Math.abs(companyVal - median) / Math.abs(median) >= DEVIATION_THRESHOLD;
  });

  if (deviating.length === 0) return null; // 벗어난 지표 없음 — 벤치마크 자체를 언급 안 함

  const lines = [`\n[SEC industry benchmark — SIC ${sicCode}, median across public peer filers]`];
  for (const k of deviating) {
    const { label, unit } = METRIC_LABELS[k];
    const median = medianOf(row!, k)!;
    const n = sampleNOf(row!, k)!;
    const companyVal = companyRatios[k]!;
    // asset_turnover(x)는 은행 등 업종에서 0.01~0.05x대로 작아 소수점 1자리론 둘 다 "0.0x"로
    // 뭉개져 무의미해진다(JPM 실측으로 발견) — %단위는 1자리, x단위는 2자리로 분리.
    const decimals = unit === 'x' ? 2 : 1;
    lines.push(`· ${label}: this company ${companyVal.toFixed(decimals)}${unit} vs. industry median ${median.toFixed(decimals)}${unit} (n=${n}) — differs by 30%+`);
  }
  lines.push(
    'The figures above already differ from this company\'s own by 30% or more, so they may be worth a brief ' +
    'mention in the narrative or outlook if it fits naturally — do not force a comment on every one of them, ' +
    'and do not reference any industry figure other than the ones listed above. Phrase any statement about ' +
    'the financial impact of the difference as a question, never as a stated conclusion. For each figure you ' +
    'actually reference, add a matching entry to sources[]: level "L1", organization "SEC Financial Statement ' +
    `Data Sets", content "SIC ${sicCode}, n=<that figure's own n from above>".`,
  );
  return lines.join('\n');
}
