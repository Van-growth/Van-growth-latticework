// SEC Financial Statement Data Sets(DERA 벌크 데이터)를 파싱해 SIC 코드별
//   - 부채/자본 비율 (Liabilities / StockholdersEquity)
//   - CFO/매출 비율 (NetCashProvidedByUsedInOperatingActivities / Revenues)
//   - 영업이익률 (OperatingIncomeLoss / Revenues)
//   - 자산회전율 (Revenues / Assets, 배수 — %아님)
//   - 매출성장률 YoY (같은 제출서 내 비교연도 값 기반, feasibility 낮으면 null)
// 를 집계해 industry_benchmark 테이블에 저장한다.
//
// 실행: npx ts-node server/scripts/secBenchmarkPrecompute.ts
//
// 데이터 출처: SEC Financial Statement Data Sets — 수동 다운로드 후
// data/raw/sec-financial-statements/<quarter>/{sub,num}.txt 로 압축 해제해둔 것을 사용한다.
// 이 스크립트는 다운로드를 하지 않음 — 파일이 이미 있다고 가정하고 실패하면 에러를 던진다.
// 파일이 분기당 num.txt 500~700MB급이라 전체를 메모리에 올리지 않고 readline으로 스트리밍
// 파싱한다.
//
// 방법론 (2026-08-11, industryBenchmarkService.ts / edgar.ts와 동일 concept 우선순위 재사용):
// - concept: 부채=Liabilities, 자본=StockholdersEquity(→...IncludingPortionAttributable...
//   NoncontrollingInterest 폴백), 자산=Assets, CFO=NetCashProvidedByUsedInOperatingActivities,
//   영업이익=OperatingIncomeLoss, 매출=Revenues→RevenueFromContractWithCustomerExcludingAssessedTax
//   →SalesRevenueNet (server/src/lib/edgar.ts의 pickConceptSeries 후보 목록과 동일 순서)
// - num.txt 필터: version이 us-gaap로 시작(커스텀/확장 태그 제외), uom=USD, segments=''
//   (세그먼트 아닌 연결전체), coreg=''(공동등록자 제외)
// - 재무상태표 항목(부채/자본/자산)은 qtrs=0(순간) + ddate가 그 제출서의 회계기간 종료일과
//   일치하는 값만. 손익/현금흐름 항목(CFO/영업이익)은 qtrs>=1 중 그 태그의 최대 qtrs(분기
//   대신 YTD/연간 우선), ddate는 현재 기간만 — 짝을 이루는 두 지표(CFO/매출, 영업이익/매출)의
//   qtrs가 서로 일치할 때만 비율 계산(기간 불일치 방지, flow/flow 비율은 duration에 불변이라
//   분기·연간 표본을 섞어도 무방).
// - 자산회전율은 flow(매출)/stock(자산) 조합이라 duration을 섞으면 스케일이 왜곡된다
//   (분기 매출/자산은 연간 매출/자산의 약 1/4) — 그래서 매출을 qtrs=4(연간)로 한정해서
//   뽑는다. 자연히 10-K 위주로 표본이 준다.
// - 매출성장률은 같은 제출서 안에서 매출 태그가 현재기간(ddate=period, qtrs=4)과 비교연도
//   (ddate가 period로부터 약 330~400일 전, qtrs=4 — 52/53주 회계연도 변형 허용) 둘 다 있을
//   때만 계산. 표본 전체에서 이 조건을 만족하는 비율이 낮으면(feasibility 체크) 이번 실행은
//   YoY 계산을 스킵하고 null로 남긴다 — 부정확한 근사보다 없는 게 낫다는 원칙.
// - 분모 최소 기준(2026-08-11 2차 조정): 매출이 분모인 지표(CFO/매출, 영업이익률, 매출성장률의
//   전년 매출)는 $10M, 자본/자산이 분모인 지표(부채/자본, 자산회전율)는 $5M 미만이면 그 표본
//   자체를 제외. $1M 기준이었을 때도 SIC 6411(보험중개업)이 자본이 작지만 $1M은 넘는 회사
//   때문에 평균이 10,749%까지 왜곡됐던 걸 발견 — 절대 하한 자체를 올려도 완전히는 못 막아서
//   (아래) 평균 대신 중앙값으로 전환하는 것과 함께 적용한다.
// - **평균이 아니라 중앙값을 저장한다** (2026-08-11, 2차 조정) — 표본이 작은 SIC는 상하위
//   1% 트리밍이 사실상 무의미하고(트리밍 경계가 최솟값/최댓값에 근접), 매출 $1M~$10M
//   구간의 소형/적자 기업은 분모가 작아 분자(손실·증감액)가 조금만 커도 비율이 수백~수천%로
//   튄다(CLAUDE.md Data Aggregation Principles의 SAAS 페니스톡 사례와 동일 패턴). 평균은 이런
//   극단치 하나에도 전체가 끌려가지만 중앙값은 훨씬 덜 민감하다 — 컬럼명도 *_avg가 아니라
//   *_median으로 명명(20260811_industry_benchmark_median.sql 마이그레이션에서 리네임).
// - 4개 분기 합쳐 CIK(회사) 단위로 최신 제출서 값 1개만 사용 — "N개 기업 기준"이 실제
//   기업 수를 의미하도록. 지표별로 독립적으로 "그 지표가 있는 가장 최근 제출서"를 고른다.
// - 윈저라이징: 5개 지표 전부 고정 상한이 아니라 **SIC 그룹 자체의 상하위 1% 백분위수**로
//   통일 클리핑(업종마다 "정상 범위"가 다르다는 걸 반영 — 은행/REIT 등 원래 고레버리지인
//   업종은 그 업종 표본 안에서는 정상 범위인 값이 잘리지 않는다). 중앙값 전환 이후로는
//   트리밍의 역할이 보조적이라(중앙값 자체가 이미 극단치에 강함) 폭은 1%/99% 그대로 유지.
//   SIC당 표본 5개 미만이면 null(MIN_SECTOR_SAMPLE_SIZE, monteCarloService.ts 재사용).

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';
import { clip, MIN_SECTOR_SAMPLE_SIZE } from '../src/services/monteCarloService';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // RLS 우회 필요 — anon key로는 쓰기 작업이 막힘
if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

const QUARTERS = ['2025q2', '2025q3', '2025q4', '2026q1'];
const DATA_ROOT = path.resolve(__dirname, '../../data/raw/sec-financial-statements');

const VALID_FORMS = new Set(['10-K', '10-K/A', '10-Q', '10-Q/A']);

const LIABILITIES_TAGS = ['Liabilities'];
const EQUITY_TAGS = ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'];
const ASSETS_TAGS = ['Assets'];
const CFO_TAGS = ['NetCashProvidedByUsedInOperatingActivities'];
const OPERATING_INCOME_TAGS = ['OperatingIncomeLoss'];
const REVENUE_TAGS = ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'];

// 재무상태표(순간값, qtrs=0, 현재기간 ddate만) / 손익·현금흐름(기간값, qtrs>=1, 현재기간만)
// / 매출(기간값, 현재기간 + 비교연도 둘 다 허용 — 성장률 계산용)
const BS_TAGS = new Set([...LIABILITIES_TAGS, ...EQUITY_TAGS, ...ASSETS_TAGS]);
const CURRENT_ONLY_FLOW_TAGS = new Set([...CFO_TAGS, ...OPERATING_INCOME_TAGS]);
const REVENUE_TAG_SET = new Set(REVENUE_TAGS);
const ALL_TAGS = new Set([...BS_TAGS, ...CURRENT_ONLY_FLOW_TAGS, ...REVENUE_TAGS]);

// 분모 최소 기준 — 지표 성격별로 다르게 적용(매출 계열 vs 재무상태표 계열), 전부 공통 원칙
// (분모가 이 미만이면 그 표본 자체를 아예 제외) 재사용.
const MIN_REVENUE_DENOMINATOR_USD = 10_000_000; // 매출이 분모: CFO/매출, 영업이익률, 매출성장률의 전년 매출
const MIN_BALANCE_DENOMINATOR_USD = 5_000_000;  // 자본/자산이 분모: 부채/자본, 자산회전율

const WINSORIZE_LOWER_P = 0.01; // 전 지표 공용 — SIC 그룹 내 하위 1%
const WINSORIZE_UPPER_P = 0.99; // 전 지표 공용 — SIC 그룹 내 상위 1%
const PRIOR_YEAR_MIN_DAYS = 330; // 비교연도 판정 창 — 52/53주 회계연도 변형 허용
const PRIOR_YEAR_MAX_DAYS = 400;

interface SubRow {
  cik: string;
  sic: string;
  period: string; // YYYYMMDD, 회계기간 종료일
  filed: string;  // YYYYMMDD — 고정폭이라 문자열 비교로 최신순 정렬 가능
}

interface FlowValue {
  ddate: string;
  qtrs: number;
  value: number;
}

// adsh -> tag -> 후보 값들 (필터 통과분만 — 태그별 정확한 조건은 parseNumTxt 참고)
type NumByAdsh = Map<string, Map<string, FlowValue[]>>;

interface BestRatio {
  sic: string;
  filed: string;
  value: number;
}

function buildHeaderIndex(headerLine: string): Record<string, number> {
  const cols = headerLine.split('\t');
  const idx: Record<string, number> = {};
  cols.forEach((c, i) => { idx[c.trim()] = i; });
  return idx;
}

// YYYYMMDD -> 1970-01-01 기준 일수 (차이 계산용, 달력 정확도 불필요)
function yyyymmddToDays(s: string): number {
  const y = parseInt(s.slice(0, 4), 10), m = parseInt(s.slice(4, 6), 10) - 1, d = parseInt(s.slice(6, 8), 10);
  return Date.UTC(y, m, d) / 86_400_000;
}

function isPriorYearWindow(ddate: string, period: string): boolean {
  const diff = yyyymmddToDays(period) - yyyymmddToDays(ddate);
  return diff >= PRIOR_YEAR_MIN_DAYS && diff <= PRIOR_YEAR_MAX_DAYS;
}

// 정렬된 배열에서 선형보간 백분위수 계산 (표준적인 최근접순위 대신 보간 방식 —
// 표본이 작을 때 계단식으로 튀지 않고 min/max 쪽으로 부드럽게 수렴한다). p=0.5면 중앙값.
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// 그룹 자체의 상하위 percentile로 클리핑 — 고정 상한과 달리 그룹마다 "정상 범위"가
// 다르다는 걸 반영한다. n이 작으면 p1/p99가 min/max에 가까워져 사실상 무클리핑.
function winsorizeByPercentile(values: number[], lowerP: number, upperP: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const lo = percentile(sorted, lowerP);
  const hi = percentile(sorted, upperP);
  return values.map(v => clip(v, lo, hi));
}

async function parseSubTxt(quarter: string): Promise<Map<string, SubRow>> {
  const filePath = path.join(DATA_ROOT, quarter, 'sub.txt');
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);

  const subMap = new Map<string, SubRow>();
  const rl = readline.createInterface({ input: fs.createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });

  let headerIdx: Record<string, number> | null = null;
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    if (lineNo === 1) { headerIdx = buildHeaderIndex(line); continue; }
    if (!line) continue;
    const cols = line.split('\t');
    const adsh = cols[headerIdx!.adsh];
    const cik = cols[headerIdx!.cik];
    const sic = cols[headerIdx!.sic];
    const form = cols[headerIdx!.form];
    const period = cols[headerIdx!.period];
    const filed = cols[headerIdx!.filed];
    if (!adsh || !cik || !sic || !/^\d+$/.test(sic)) continue;
    if (!form || !VALID_FORMS.has(form)) continue;
    if (!period || !filed) continue;
    subMap.set(adsh, { cik, sic, period, filed });
  }
  return subMap;
}

async function parseNumTxt(quarter: string, subMap: Map<string, SubRow>): Promise<NumByAdsh> {
  const filePath = path.join(DATA_ROOT, quarter, 'num.txt');
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);

  const numByAdsh: NumByAdsh = new Map();
  const rl = readline.createInterface({ input: fs.createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });

  let headerIdx: Record<string, number> | null = null;
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    if (lineNo === 1) { headerIdx = buildHeaderIndex(line); continue; }
    if (lineNo % 2_000_000 === 0) console.log(`  [${quarter}] num.txt ${lineNo.toLocaleString()} lines...`);
    if (!line) continue;

    // 값이 필요없는 라인을 최대한 싸게 걸러낸다 — adsh 먼저(폼 필터에 안 걸린 기업 제외),
    // tag는 전체 split 후 확인(6개뿐이라 비교 자체는 저렴).
    const tabIdx = line.indexOf('\t');
    if (tabIdx === -1) continue;
    const adsh = line.slice(0, tabIdx);
    const subRow = subMap.get(adsh);
    if (!subRow) continue;

    const cols = line.split('\t');
    const tag = cols[headerIdx!.tag];
    if (!ALL_TAGS.has(tag)) continue;

    const version = cols[headerIdx!.version];
    if (!version || !version.startsWith('us-gaap')) continue;
    const uom = cols[headerIdx!.uom];
    if (uom !== 'USD') continue;
    const segments = cols[headerIdx!.segments];
    if (segments) continue; // 연결 전체(세그먼트 없음)만
    const coreg = cols[headerIdx!.coreg];
    if (coreg) continue; // 공동등록자 아닌 본체만

    const qtrs = parseInt(cols[headerIdx!.qtrs], 10);
    if (!Number.isFinite(qtrs)) continue;
    const ddate = cols[headerIdx!.ddate];

    let accept: boolean;
    if (BS_TAGS.has(tag)) {
      accept = qtrs === 0 && ddate === subRow.period;
    } else if (CURRENT_ONLY_FLOW_TAGS.has(tag)) {
      accept = qtrs >= 1 && ddate === subRow.period;
    } else { // REVENUE_TAG_SET — 현재기간(모든 qtrs) 또는 비교연도(qtrs=4만, 성장률용)
      accept = qtrs >= 1 && (ddate === subRow.period || (qtrs === 4 && isPriorYearWindow(ddate, subRow.period)));
    }
    if (!accept) continue;

    const value = parseFloat(cols[headerIdx!.value]);
    if (!Number.isFinite(value)) continue;

    if (!numByAdsh.has(adsh)) numByAdsh.set(adsh, new Map());
    const tagMap = numByAdsh.get(adsh)!;
    if (!tagMap.has(tag)) tagMap.set(tag, []);
    tagMap.get(tag)!.push({ ddate, qtrs, value });
  }
  return numByAdsh;
}

// 재무상태표 항목 — 태그 우선순위 목록에서 첫 번째로 값이 있는 태그 채택 (parseNumTxt에서
// 이미 qtrs=0 + 현재기간만 통과시켰으므로 후보가 있으면 사실상 유일함)
function pickBalance(tagMap: Map<string, FlowValue[]> | undefined, tags: string[]): number | null {
  if (!tagMap) return null;
  for (const tag of tags) {
    const vals = tagMap.get(tag);
    if (vals && vals.length > 0) return vals[0].value;
  }
  return null;
}

// 손익/현금흐름/매출(현재기간) — 태그 우선순위 목록에서 첫 번째로 값이 있는 태그 채택,
// 그 태그 안에서는 qtrs가 가장 큰(분기 단독보다 YTD/연간 우선) 값을 채택. 매출 태그는
// 비교연도 값도 같은 배열에 섞여 있을 수 있어 ddate===currentPeriod로 명시적으로 걸러낸다.
function pickFlowMaxQtrs(tagMap: Map<string, FlowValue[]> | undefined, tags: string[], currentPeriod: string): FlowValue | null {
  if (!tagMap) return null;
  for (const tag of tags) {
    const vals = (tagMap.get(tag) ?? []).filter(v => v.ddate === currentPeriod);
    if (vals.length > 0) return vals.reduce((best, v) => (v.qtrs > best.qtrs ? v : best), vals[0]);
  }
  return null;
}

// 특정 qtrs(예: 자산회전율의 연간=4)를 정확히 요구하는 현재기간 값 — 없으면 null
function pickFlowExactQtrs(tagMap: Map<string, FlowValue[]> | undefined, tags: string[], currentPeriod: string, requiredQtrs: number): number | null {
  if (!tagMap) return null;
  for (const tag of tags) {
    const vals = (tagMap.get(tag) ?? []).filter(v => v.ddate === currentPeriod && v.qtrs === requiredQtrs);
    if (vals.length > 0) return vals[0].value;
  }
  return null;
}

// 매출성장률용 — 같은 제출서 안에서 현재기간+비교연도 연간(qtrs=4) 값이 둘 다 있을 때만 반환
function pickAnnualCurrentAndPrior(tagMap: Map<string, FlowValue[]> | undefined, tags: string[], currentPeriod: string): { current: number; prior: number } | null {
  if (!tagMap) return null;
  for (const tag of tags) {
    const vals = tagMap.get(tag) ?? [];
    const cur = vals.find(v => v.qtrs === 4 && v.ddate === currentPeriod);
    const pri = vals.find(v => v.qtrs === 4 && v.ddate !== currentPeriod);
    if (cur && pri) return { current: cur.value, prior: pri.value };
  }
  return null;
}

function updateBest(map: Map<string, BestRatio>, cik: string, sic: string, filed: string, value: number): void {
  const existing = map.get(cik);
  if (!existing || filed > existing.filed) map.set(cik, { sic, filed, value });
}

interface MetricStats { median: number | null; n: number | null; }

// 공용 집계 파이프라인 — 5개 지표 전부 동일 로직(표본 최소치 체크 → SIC 자체 백분위수
// 윈저라이징 → 중앙값). 평균이 아니라 중앙값을 쓰는 이유는 파일 상단 방법론 노트 참고.
function aggregateMetric(bySic: Map<string, number[]>, sic: string): MetricStats {
  const raw = bySic.get(sic) ?? [];
  if (raw.length < MIN_SECTOR_SAMPLE_SIZE) return { median: null, n: null };
  const winsorized = winsorizeByPercentile(raw, WINSORIZE_LOWER_P, WINSORIZE_UPPER_P);
  const sorted = [...winsorized].sort((a, b) => a - b);
  return { median: percentile(sorted, 0.5), n: winsorized.length };
}

function pool(best: Map<string, BestRatio>): Map<string, number[]> {
  const bySic = new Map<string, number[]>();
  for (const { sic, value } of best.values()) {
    if (!bySic.has(sic)) bySic.set(sic, []);
    bySic.get(sic)!.push(value);
  }
  return bySic;
}

async function main() {
  const debtEquityBest = new Map<string, BestRatio>();
  const cfoRevenueBest = new Map<string, BestRatio>();
  const operatingMarginBest = new Map<string, BestRatio>();
  const assetTurnoverBest = new Map<string, BestRatio>();
  const revenueGrowthBest = new Map<string, BestRatio>();

  for (const quarter of QUARTERS) {
    console.log(`\n=== ${quarter} ===`);
    const subMap = await parseSubTxt(quarter);
    console.log(`  sub.txt: ${subMap.size.toLocaleString()} submissions (10-K/10-Q, SIC 있음)`);

    const numByAdsh = await parseNumTxt(quarter, subMap);
    console.log(`  num.txt: ${numByAdsh.size.toLocaleString()} submissions with relevant tags`);

    let deCount = 0, crCount = 0, omCount = 0, atCount = 0, rgCount = 0;
    for (const [adsh, subRow] of subMap) {
      const tagMap = numByAdsh.get(adsh);
      if (!tagMap) continue;

      const liab = pickBalance(tagMap, LIABILITIES_TAGS);
      const eq = pickBalance(tagMap, EQUITY_TAGS);
      if (liab != null && eq != null && eq >= MIN_BALANCE_DENOMINATOR_USD) {
        // 고정 상한 클리핑 없이 원값 저장 — 윈저라이징은 SIC 그룹으로 다 모은 뒤 그 그룹
        // 자체의 백분위수 기준으로 한다(aggregateMetric 참고).
        updateBest(debtEquityBest, subRow.cik, subRow.sic, subRow.filed, (liab / eq) * 100);
        deCount++;
      }

      const rev = pickFlowMaxQtrs(tagMap, REVENUE_TAGS, subRow.period);
      const cfo = pickFlowMaxQtrs(tagMap, CFO_TAGS, subRow.period);
      if (rev && cfo && rev.qtrs === cfo.qtrs && rev.value >= MIN_REVENUE_DENOMINATOR_USD) {
        updateBest(cfoRevenueBest, subRow.cik, subRow.sic, subRow.filed, (cfo.value / rev.value) * 100);
        crCount++;
      }

      const opInc = pickFlowMaxQtrs(tagMap, OPERATING_INCOME_TAGS, subRow.period);
      if (rev && opInc && rev.qtrs === opInc.qtrs && rev.value >= MIN_REVENUE_DENOMINATOR_USD) {
        updateBest(operatingMarginBest, subRow.cik, subRow.sic, subRow.filed, (opInc.value / rev.value) * 100);
        omCount++;
      }

      const assets = pickBalance(tagMap, ASSETS_TAGS);
      const revAnnual = pickFlowExactQtrs(tagMap, REVENUE_TAGS, subRow.period, 4);
      if (assets != null && assets >= MIN_BALANCE_DENOMINATOR_USD && revAnnual != null && revAnnual >= MIN_REVENUE_DENOMINATOR_USD) {
        updateBest(assetTurnoverBest, subRow.cik, subRow.sic, subRow.filed, revAnnual / assets); // 배수, %아님
        atCount++;
      }

      const growth = pickAnnualCurrentAndPrior(tagMap, REVENUE_TAGS, subRow.period);
      if (growth && growth.prior >= MIN_REVENUE_DENOMINATOR_USD) {
        updateBest(revenueGrowthBest, subRow.cik, subRow.sic, subRow.filed, ((growth.current - growth.prior) / growth.prior) * 100);
        rgCount++;
      }
    }
    console.log(`  이번 분기: 부채/자본 ${deCount.toLocaleString()}, CFO/매출 ${crCount.toLocaleString()}, 영업이익률 ${omCount.toLocaleString()}, 자산회전율 ${atCount.toLocaleString()}, 매출성장률 ${rgCount.toLocaleString()}`);
  }

  console.log(`\n누적(중복제거 전, CIK 기준): 부채/자본 ${debtEquityBest.size.toLocaleString()}개사, CFO/매출 ${cfoRevenueBest.size.toLocaleString()}개사, 영업이익률 ${operatingMarginBest.size.toLocaleString()}개사, 자산회전율 ${assetTurnoverBest.size.toLocaleString()}개사, 매출성장률 ${revenueGrowthBest.size.toLocaleString()}개사`);

  // Feasibility 체크 — 매출성장률 표본이 부채/자본 대비 너무 적으면(20% 미만) 억지로 계산하지
  // 않고 이번 실행은 null로 남긴다(부정확한 근사보다 없는 게 낫다는 사용자 지침).
  const growthFeasibilityRatio = debtEquityBest.size > 0 ? revenueGrowthBest.size / debtEquityBest.size : 0;
  const GROWTH_FEASIBILITY_MIN_RATIO = 0.2;
  const growthFeasible = growthFeasibilityRatio >= GROWTH_FEASIBILITY_MIN_RATIO;
  console.log(`\n매출성장률 feasibility: ${revenueGrowthBest.size.toLocaleString()}개사 (부채/자본 표본 대비 ${(growthFeasibilityRatio * 100).toFixed(1)}%) → ${growthFeasible ? '계산에 포함' : `기준(${GROWTH_FEASIBILITY_MIN_RATIO * 100}%) 미달, 이번 실행은 null로 저장`}`);

  const debtEquityBySic = pool(debtEquityBest);
  const cfoRevenueBySic = pool(cfoRevenueBest);
  const operatingMarginBySic = pool(operatingMarginBest);
  const assetTurnoverBySic = pool(assetTurnoverBest);
  const revenueGrowthBySic = pool(revenueGrowthBest);

  const allSicCodes = new Set([
    ...debtEquityBySic.keys(), ...cfoRevenueBySic.keys(), ...operatingMarginBySic.keys(),
    ...assetTurnoverBySic.keys(), ...revenueGrowthBySic.keys(),
  ]);
  const rows: Record<string, unknown>[] = [];

  for (const sic of allSicCodes) {
    const de = aggregateMetric(debtEquityBySic, sic);
    const cr = aggregateMetric(cfoRevenueBySic, sic);
    const om = aggregateMetric(operatingMarginBySic, sic);
    const at = aggregateMetric(assetTurnoverBySic, sic);
    const rg = growthFeasible ? aggregateMetric(revenueGrowthBySic, sic) : { median: null, n: null };

    if (de.median == null && cr.median == null && om.median == null && at.median == null && rg.median == null) continue;

    rows.push({
      sic_code: sic,
      debt_equity_ratio_median: de.median, debt_equity_ratio_n: de.n,
      cfo_revenue_ratio_median: cr.median, cfo_revenue_ratio_n: cr.n,
      operating_margin_median: om.median, operating_margin_n: om.n,
      asset_turnover_median: at.median, asset_turnover_n: at.n,
      revenue_growth_median: rg.median, revenue_growth_n: rg.n,
      source_quarters: QUARTERS,
      computed_at: new Date().toISOString(),
    });
  }

  console.log(`\n저장 대상: ${rows.length.toLocaleString()}개 SIC 코드 (표본 ${MIN_SECTOR_SAMPLE_SIZE}개 미만인 지표는 null)`);

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('industry_benchmark').upsert(batch, { onConflict: 'sic_code' });
    if (error) throw error;
    console.log(`  upsert ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }

  console.log('\n완료.');
}

main().catch(err => {
  console.error('[secBenchmarkPrecompute] FAILED', err);
  process.exit(1);
});
