// Sonnet 5 vs Haiku 4.5 품질/비용 비교 실험 — 에이피알(APR Corporation) 1개 기업.
// 목적: Pain Diagnosis 상시실행 여부 + Haiku 티어링 재검토를 위한 실측 데이터 확보.
// 프로덕션 DB에는 아무것도 저장하지 않는 순수 일회성 스크립트(analyzeCompany() 미사용,
// callSection()/callFounderSection()/gatherResearch1·2를 직접 호출).
//
// 공정 비교를 위한 통제: gatherResearch1/gatherResearch2를 딱 한 번만 실행해 리서치
// 결과를 고정한 뒤, 그 동일한 sharedContext를 9개 섹션 각각에 Sonnet/Haiku 두 모델로
// 넘겨 호출한다(founder_v2만 예외 — 프로덕션에서도 shared research를 안 쓰고 자체
// 에이전틱 웹서치를 돌리는 구조라, 그 실제 동작 그대로 모델만 바꿔 재현한다).
//
// 실행: npx ts-node server/scripts/testHaikuVsSonnetApr.ts
// ⚠️ 재실행하려면 먼저 claude.ts에 gatherResearch1/gatherResearch2/callFounderSection을
// export(+ callFounderSection에 model 파라미터 추가)해야 함 — 2026-08-16 테스트 완료 후
// 프로덕션 코드 변경 없음 원칙에 따라 원상복구함(git diff 없음 확인).
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import * as fs from 'fs';
import { AsyncLocalStorage } from 'async_hooks';
import {
  anthropic,
  callSection,
  callFounderSection,
  gatherResearch1,
  gatherResearch2,
  Language,
  SummaryV2,
  ValueChainV2,
  BusinessModelV2,
  CompetitorsV2,
  FinancialsV2,
  StrategyV2,
  FounderV2,
  IndustryHistoryV2,
  TechEvolutionV2,
} from '../src/lib/claude';
import { fetchFinancialContext } from '../src/lib/financialContext';

const COMPANY = '에이피알';
const LANGUAGE: Language = 'ko';
const SONNET = 'claude-sonnet-5';
const HAIKU = 'claude-haiku-4-5-20251001';

// $/MTok — 사용자 지정 단가(요청 원문 그대로, 캐싱 미적용 기준)
const PRICING: Record<string, { input: number; output: number }> = {
  [SONNET]: { input: 2, output: 10 },
  [HAIKU]: { input: 1, output: 5 },
};

interface UsageBucket { input: number; output: number; cacheRead: number; cacheWrite: number; calls: number }
const usageStorage = new AsyncLocalStorage<UsageBucket>();

// anthropic.messages.create()를 런타임에만 감싼다 — claude.ts 파일 자체는 건드리지
// 않음(모델 파라미터를 그대로 통과시키고 usage만 부가로 기록). AsyncLocalStorage로
// 동시 실행되는 Sonnet/Haiku 호출의 usage가 서로 섞이지 않도록 격리.
const origCreate = anthropic.messages.create.bind(anthropic.messages);
(anthropic.messages as any).create = async function (params: any, opts?: any) {
  const res = await origCreate(params, opts);
  const bucket = usageStorage.getStore();
  if (bucket) {
    bucket.input += res.usage?.input_tokens ?? 0;
    bucket.output += res.usage?.output_tokens ?? 0;
    bucket.cacheRead += res.usage?.cache_read_input_tokens ?? 0;
    bucket.cacheWrite += res.usage?.cache_creation_input_tokens ?? 0;
    bucket.calls += 1;
  }
  return res;
};

async function withUsage<T>(fn: () => Promise<T>): Promise<{ result: T; usage: UsageBucket; ms: number }> {
  const bucket: UsageBucket = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 };
  const t0 = Date.now();
  const result = await usageStorage.run(bucket, fn);
  return { result, usage: bucket, ms: Date.now() - t0 };
}

function cost(model: string, usage: UsageBucket): number {
  const p = PRICING[model];
  // 캐싱 미적용 기준 — cache_read/cache_write 토큰도 전부 input 단가로 계산(각주 명시).
  return ((usage.input + usage.cacheRead + usage.cacheWrite) / 1_000_000) * p.input
    + (usage.output / 1_000_000) * p.output;
}

const SECTION_LABELS: Record<string, string> = {
  summary_v2: '01 기업개요',
  value_chain_v2: '02 밸류체인',
  business_model_v2: '03 비즈니스모델',
  competitors_v2: '04 경쟁사',
  financials_v2: '05 재무',
  strategy_v2: '06 전략',
  founder_v2: '07 창업자',
  industry_history_v2: '08 산업역사',
  tech_evolution_v2: '09 기술변화',
};

const CALLSECTION_KEYS = [
  'summary_v2', 'value_chain_v2', 'business_model_v2', 'competitors_v2',
  'financials_v2', 'strategy_v2', 'industry_history_v2', 'tech_evolution_v2',
] as const;

interface SectionRunResult {
  model: string;
  result: unknown;
  usage: UsageBucket;
  ms: number;
  costUsd: number;
  validJson: boolean;
}

interface SectionComparison {
  key: string;
  label: string;
  sonnet: SectionRunResult;
  haiku: SectionRunResult;
}

async function runOne(sectionKey: string, context: string, model: string): Promise<SectionRunResult> {
  const { result, usage, ms } = await withUsage(() => callSection<any>(context, sectionKey, LANGUAGE, model));
  return { model, result, usage, ms, costUsd: cost(model, usage), validJson: result !== null };
}

async function runFounder(model: string): Promise<SectionRunResult> {
  const { result, usage, ms } = await withUsage(() => callFounderSection(COMPANY, LANGUAGE, model));
  return { model, result, usage, ms, costUsd: cost(model, usage), validJson: result !== null };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderKeyBullets(result: any): string {
  const bullets: string[] = Array.isArray(result?.key_bullets) ? result.key_bullets : [];
  if (bullets.length === 0) return '';
  return `<div class="bullets"><div class="bullets-label">key_bullets</div><ul>${bullets.map(b => `<li>${esc(String(b))}</li>`).join('')}</ul></div>`;
}

function renderColumn(r: SectionRunResult): string {
  const modelLabel = r.model === SONNET ? 'Sonnet 5' : 'Haiku 4.5';
  const badgeClass = r.model === SONNET ? 'badge-sonnet' : 'badge-haiku';
  const jsonStr = r.result === null ? '(JSON 파싱 실패 — null)' : JSON.stringify(r.result, null, 2);
  return `
    <div class="col">
      <div class="col-head">
        <span class="badge ${badgeClass}">${modelLabel}</span>
        <span class="stat">${r.ms.toLocaleString()}ms</span>
        <span class="stat">in ${r.usage.input.toLocaleString()} / out ${r.usage.output.toLocaleString()} tok</span>
        <span class="stat cost">$${r.costUsd.toFixed(4)}</span>
        ${r.validJson ? '' : '<span class="stat fail">JSON 파싱 실패</span>'}
      </div>
      ${renderKeyBullets(r.result)}
      <pre class="json">${esc(jsonStr)}</pre>
    </div>`;
}

function renderSection(c: SectionComparison): string {
  return `
  <section class="section" id="sec-${c.key}">
    <h2>${c.label} <span class="key-name">${c.key}</span></h2>
    <div class="row">
      ${renderColumn(c.sonnet)}
      ${renderColumn(c.haiku)}
    </div>
  </section>`;
}

function renderPricingTable(comparisons: SectionComparison[]): string {
  let sonnetTotal = 0, haikuTotal = 0;
  const rows = comparisons.map(c => {
    sonnetTotal += c.sonnet.costUsd;
    haikuTotal += c.haiku.costUsd;
    const saved = c.sonnet.costUsd - c.haiku.costUsd;
    const pct = c.sonnet.costUsd > 0 ? (saved / c.sonnet.costUsd) * 100 : 0;
    return `<tr>
      <td>${c.label}</td>
      <td>${c.sonnet.usage.input.toLocaleString()} / ${c.sonnet.usage.output.toLocaleString()}</td>
      <td>${c.haiku.usage.input.toLocaleString()} / ${c.haiku.usage.output.toLocaleString()}</td>
      <td>$${c.sonnet.costUsd.toFixed(4)}</td>
      <td>$${c.haiku.costUsd.toFixed(4)}</td>
      <td>$${saved.toFixed(4)}</td>
      <td>${pct.toFixed(1)}%</td>
    </tr>`;
  }).join('');
  const totalSaved = sonnetTotal - haikuTotal;
  const totalPct = sonnetTotal > 0 ? (totalSaved / sonnetTotal) * 100 : 0;
  const AVG_MEASURED = 3.37;
  return `
  <section class="pricing" id="pricing-summary">
    <h2>가격 비교 요약표</h2>
    <p class="note">단가: Sonnet 5 $2/$10 per MTok(input/output), Haiku 4.5 $1/$5 per MTok — 캐싱 미적용 기준(cache_read/cache_write 토큰도 input 단가로 환산). 이번 실측 실행에서 실제 소모된 토큰 기준 계산.</p>
    <table>
      <thead>
        <tr><th>섹션</th><th>Sonnet in/out tok</th><th>Haiku in/out tok</th><th>Sonnet 비용</th><th>Haiku 비용</th><th>절감액</th><th>절감률</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td>합계 (9개 섹션)</td>
          <td colspan="2"></td>
          <td><strong>$${sonnetTotal.toFixed(4)}</strong></td>
          <td><strong>$${haikuTotal.toFixed(4)}</strong></td>
          <td><strong>$${totalSaved.toFixed(4)}</strong></td>
          <td><strong>${totalPct.toFixed(1)}%</strong></td>
        </tr>
      </tfoot>
    </table>
    <div class="headline">
      <div class="headline-box">
        <div class="headline-label">분석 1건당 총 비용 — Sonnet 5 전체</div>
        <div class="headline-value">$${sonnetTotal.toFixed(4)}</div>
      </div>
      <div class="headline-box">
        <div class="headline-label">분석 1건당 총 비용 — Haiku 4.5 전체</div>
        <div class="headline-value">$${haikuTotal.toFixed(4)}</div>
      </div>
      <div class="headline-box highlight">
        <div class="headline-label">오늘 실측한 실제 평균 단가(8월 30건 블렌디드, $101.23÷30)</div>
        <div class="headline-value">$${AVG_MEASURED.toFixed(2)}</div>
        <div class="headline-sub">이 테스트의 Sonnet 합계($${sonnetTotal.toFixed(2)})와 비교 — 차이는 캐싱 적용/gatherResearch·웹서치 비용/모델 단가 버전 차이 등에서 발생할 수 있음(참고용, 정밀 대조 아님)</div>
      </div>
    </div>
  </section>`;
}

const HTML_STYLE = `
  :root { --navy:#1e3a5f; --navy-tint:#eef3f8; --gray:#666; --border:#e2e2e2; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "Malgun Gothic", sans-serif; margin:0; padding:24px; background:#fafafa; color:#1a1a1a; }
  h1 { font-size:20px; margin:0 0 4px; }
  .meta { color:var(--gray); font-size:13px; margin-bottom:24px; }
  h2 { font-size:15px; margin:0 0 12px; padding-bottom:8px; border-bottom:2px solid var(--navy); }
  .key-name { font-weight:400; color:var(--gray); font-size:12px; margin-left:8px; }
  .section { margin-bottom:36px; }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width: 900px) { .row { grid-template-columns:1fr; } }
  .col { background:white; border:1px solid var(--border); border-radius:8px; padding:14px; min-width:0; }
  .col-head { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:10px; }
  .badge { font-weight:700; font-size:12px; padding:3px 8px; border-radius:4px; color:white; }
  .badge-sonnet { background:var(--navy); }
  .badge-haiku { background:#8a5a00; }
  .stat { font-size:11px; color:var(--gray); background:#f2f2f2; padding:2px 6px; border-radius:4px; }
  .stat.cost { color:#0a6b2b; font-weight:700; background:#e8f5ec; }
  .stat.fail { color:#b00020; background:#fdecec; font-weight:700; }
  .bullets { background:var(--navy-tint); border-radius:6px; padding:8px 12px; margin-bottom:10px; }
  .bullets-label { font-size:10px; color:var(--navy); font-weight:700; text-transform:uppercase; margin-bottom:4px; }
  .bullets ul { margin:0; padding-left:18px; font-size:12.5px; line-height:1.6; }
  pre.json { font-size:11px; line-height:1.5; background:#0d1117; color:#c9d1d9; padding:12px; border-radius:6px; overflow-x:auto; max-height:520px; overflow-y:auto; white-space:pre-wrap; word-break:break-word; }
  .pricing { margin-top:40px; padding-top:20px; border-top:3px solid var(--navy); }
  .pricing .note { font-size:12px; color:var(--gray); margin-bottom:12px; }
  table { width:100%; border-collapse:collapse; font-size:13px; background:white; }
  th, td { border:1px solid var(--border); padding:8px 10px; text-align:right; }
  th:first-child, td:first-child { text-align:left; }
  thead th { background:var(--navy-tint); }
  .total-row td { background:#fff8e1; font-size:14px; }
  .headline { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-top:20px; }
  @media (max-width: 900px) { .headline { grid-template-columns:1fr; } }
  .headline-box { background:white; border:1px solid var(--border); border-radius:8px; padding:16px; text-align:center; }
  .headline-box.highlight { background:var(--navy); color:white; }
  .headline-label { font-size:11px; color:var(--gray); margin-bottom:6px; }
  .headline-box.highlight .headline-label { color:#cdd9e6; }
  .headline-value { font-size:24px; font-weight:800; }
  .headline-sub { font-size:10px; color:#cdd9e6; margin-top:6px; }
  .toc { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:24px; }
  .toc a { font-size:12px; color:var(--navy); background:white; border:1px solid var(--border); border-radius:14px; padding:4px 10px; text-decoration:none; }
`;

async function main() {
  console.log(`========== ${COMPANY} — Sonnet 5 vs Haiku 4.5 품질/비용 비교 ==========`);

  console.log('[1/4] financialContext 조회...');
  const { contextText, source } = await fetchFinancialContext(COMPANY);
  console.log(`  source=${source}`);

  console.log('[2/4] gatherResearch1/2 실행 (딱 1회, 이후 고정)...');
  const t0 = Date.now();
  const [research1, research2] = await Promise.all([gatherResearch1(COMPANY), gatherResearch2(COMPANY)]);
  console.log(`  완료 ${Date.now() - t0}ms (research1 ${research1.length}자, research2 ${research2.length}자)`);

  const sharedContext = [
    `Company: ${COMPANY}`,
    contextText ? `\n[Disclosed data — prioritize these figures]\n${contextText}` : null,
    `\n[Web research — basic info]\n${research1}`,
    `\n[Web research — detailed info]\n${research2}`,
  ].filter(Boolean).join('\n');

  console.log('[3/4] 9개 섹션 × 2개 모델 = 18회 호출 (섹션별 Sonnet/Haiku 병렬)...');
  const comparisons: SectionComparison[] = [];

  for (const key of CALLSECTION_KEYS) {
    console.log(`  - ${key} 실행 중...`);
    const t = Date.now();
    const [sonnet, haiku] = await Promise.all([
      runOne(key, sharedContext, SONNET),
      runOne(key, sharedContext, HAIKU),
    ]);
    console.log(`    완료 ${Date.now() - t}ms (sonnet ${sonnet.ms}ms/$${sonnet.costUsd.toFixed(4)}, haiku ${haiku.ms}ms/$${haiku.costUsd.toFixed(4)})`);
    comparisons.push({ key, label: SECTION_LABELS[key], sonnet, haiku });
  }

  console.log('  - founder_v2 실행 중 (자체 에이전틱 웹서치, shared research 미사용)...');
  const tf = Date.now();
  const [founderSonnet, founderHaiku] = await Promise.all([
    runFounder(SONNET),
    runFounder(HAIKU),
  ]);
  console.log(`    완료 ${Date.now() - tf}ms (sonnet ${founderSonnet.ms}ms/$${founderSonnet.costUsd.toFixed(4)}, haiku ${founderHaiku.ms}ms/$${founderHaiku.costUsd.toFixed(4)})`);
  comparisons.push({ key: 'founder_v2', label: SECTION_LABELS.founder_v2, sonnet: founderSonnet, haiku: founderHaiku });

  // 사이드바 순서(요약→밸류체인→비즈니스모델→경쟁사→재무→전략→창업자→산업역사→기술변화)로 정렬
  const ORDER = ['summary_v2', 'value_chain_v2', 'business_model_v2', 'competitors_v2', 'financials_v2', 'strategy_v2', 'founder_v2', 'industry_history_v2', 'tech_evolution_v2'];
  comparisons.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));

  console.log('[4/4] HTML 리포트 생성...');
  const jsonDump = comparisons.map(c => ({
    key: c.key,
    sonnet: { model: c.sonnet.model, usage: c.sonnet.usage, ms: c.sonnet.ms, costUsd: c.sonnet.costUsd, validJson: c.sonnet.validJson, result: c.sonnet.result },
    haiku: { model: c.haiku.model, usage: c.haiku.usage, ms: c.haiku.ms, costUsd: c.haiku.costUsd, validJson: c.haiku.validJson, result: c.haiku.result },
  }));
  const jsonPath = path.resolve(__dirname, '../../haiku_vs_sonnet_apr.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonDump, null, 2), 'utf-8');

  const toc = comparisons.map(c => `<a href="#sec-${c.key}">${c.label}</a>`).join('') + '<a href="#pricing-summary">가격 비교</a>';
  const sectionsHtml = comparisons.map(renderSection).join('\n');
  const pricingHtml = renderPricingTable(comparisons);

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>Sonnet 5 vs Haiku 4.5 — ${COMPANY}</title>
<style>${HTML_STYLE}</style>
</head>
<body>
  <h1>Sonnet 5 vs Haiku 4.5 품질/비용 비교 — ${COMPANY}</h1>
  <p class="meta">생성 시각: ${new Date().toISOString()} · 리서치는 1회 고정(research1 ${research1.length}자 / research2 ${research2.length}자, financial source=${source}) 후 9개 섹션을 각 모델로 병렬 호출. 프로덕션 DB 미저장.</p>
  <div class="toc">${toc}</div>
  ${sectionsHtml}
  ${pricingHtml}
</body>
</html>`;

  const htmlPath = path.resolve(__dirname, '../../haiku_vs_sonnet_apr.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  console.log(`\n========== 완료 ==========`);
  console.log(`HTML: ${htmlPath}`);
  console.log(`JSON: ${jsonPath}`);

  console.log('\n===== 요약 테이블 =====');
  let sonnetTotal = 0, haikuTotal = 0;
  for (const c of comparisons) {
    sonnetTotal += c.sonnet.costUsd;
    haikuTotal += c.haiku.costUsd;
    console.log(`${c.label.padEnd(14)} sonnet=$${c.sonnet.costUsd.toFixed(4)}(${c.sonnet.ms}ms,valid=${c.sonnet.validJson})  haiku=$${c.haiku.costUsd.toFixed(4)}(${c.haiku.ms}ms,valid=${c.haiku.validJson})`);
  }
  console.log(`합계: sonnet=$${sonnetTotal.toFixed(4)}  haiku=$${haikuTotal.toFixed(4)}  절감률=${(((sonnetTotal - haikuTotal) / sonnetTotal) * 100).toFixed(1)}%`);
}

main().catch(err => {
  console.error('!!!!! 실패 !!!!!');
  console.error(err);
  process.exit(1);
});
