// Sonnet 5 vs Haiku 4.5 — 리서치 단계(gatherResearch1/gatherResearch2) 비교 실험.
// 직전 synthesis 단계(9개 섹션) 테스트와 별개 — 이번엔 웹서치 리서치 단계 자체가
// $0.55(9개 섹션 Sonnet 합계) vs $3.37(프로덕션 8월 실측 평균) 격차의 원인인지 확인.
// 프로덕션 DB에는 아무것도 저장하지 않는 순수 일회성 스크립트.
//
// 실행: npx ts-node server/scripts/testHaikuVsSonnetResearch.ts
// ⚠️ 재실행하려면 먼저 claude.ts의 gatherResearch1/gatherResearch2를 export(+model
// 파라미터 추가)해야 함 — 2026-08-16 테스트 완료 후 프로덕션 코드 변경 없음 원칙에
// 따라 원상복구함(git diff 없음 확인, 실행 결과: haiku_vs_sonnet_research_apr.html/json).
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import * as fs from 'fs';
import { AsyncLocalStorage } from 'async_hooks';
import {
  anthropic,
  callSection,
  gatherResearch1,
  gatherResearch2,
  Language,
  SummaryV2,
} from '../src/lib/claude';
import { fetchFinancialContext } from '../src/lib/financialContext';

const COMPANY = '에이피알';
const LANGUAGE: Language = 'ko';
const SONNET = 'claude-sonnet-5';
const HAIKU = 'claude-haiku-4-5-20251001';

// $/MTok — 직전 테스트와 동일 단가(사용자 지정, 캐싱 미적용 기준)
const PRICING: Record<string, { input: number; output: number }> = {
  [SONNET]: { input: 2, output: 10 },
  [HAIKU]: { input: 1, output: 5 },
};
// Anthropic 공개 가격표 기준(이 세션에서 계정 청구서로 실측 검증한 값은 아님, 참고용) —
// web_search 서버 도구 $10/1,000회 = $0.01/회. fetch_url은 이 코드베이스가 만든 커스텀
// client-side 도구라 별도 과금 없음(순수 HTTP fetch, 토큰 비용에만 반영됨).
const WEB_SEARCH_FEE_PER_CALL = 0.01;

interface UsageBucket {
  input: number; output: number; cacheRead: number; cacheWrite: number;
  calls: number; webSearchRequests: number; fetchUrlRequests: number;
}
const usageStorage = new AsyncLocalStorage<UsageBucket>();

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
    bucket.webSearchRequests += (res.usage as any)?.server_tool_use?.web_search_requests ?? 0;
    const fetchUrlCalls = (res.content ?? []).filter((b: any) => b.type === 'tool_use' && b.name === 'fetch_url').length;
    bucket.fetchUrlRequests += fetchUrlCalls;
  }
  return res;
};

async function withUsage<T>(fn: () => Promise<T>): Promise<{ result: T; usage: UsageBucket; ms: number }> {
  const bucket: UsageBucket = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, webSearchRequests: 0, fetchUrlRequests: 0 };
  const t0 = Date.now();
  const result = await usageStorage.run(bucket, fn);
  return { result, usage: bucket, ms: Date.now() - t0 };
}

function tokenCost(model: string, usage: UsageBucket): number {
  const p = PRICING[model];
  return ((usage.input + usage.cacheRead + usage.cacheWrite) / 1_000_000) * p.input
    + (usage.output / 1_000_000) * p.output;
}
function toolCost(usage: UsageBucket): number {
  return usage.webSearchRequests * WEB_SEARCH_FEE_PER_CALL;
}
function totalCost(model: string, usage: UsageBucket): number {
  return tokenCost(model, usage) + toolCost(usage);
}

interface ResearchRun {
  model: string;
  research1: string;
  research2: string;
  usage1: UsageBucket;
  usage2: UsageBucket;
  ms1: number;
  ms2: number;
}

async function runResearch(model: string): Promise<ResearchRun> {
  const [r1, r2] = await Promise.all([
    withUsage(() => gatherResearch1(COMPANY, model)),
    withUsage(() => gatherResearch2(COMPANY, model)),
  ]);
  return {
    model,
    research1: r1.result,
    research2: r2.result,
    usage1: r1.usage,
    usage2: r2.usage,
    ms1: r1.ms,
    ms2: r2.ms,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sumUsage(...buckets: UsageBucket[]): UsageBucket {
  return buckets.reduce((acc, b) => ({
    input: acc.input + b.input, output: acc.output + b.output,
    cacheRead: acc.cacheRead + b.cacheRead, cacheWrite: acc.cacheWrite + b.cacheWrite,
    calls: acc.calls + b.calls, webSearchRequests: acc.webSearchRequests + b.webSearchRequests,
    fetchUrlRequests: acc.fetchUrlRequests + b.fetchUrlRequests,
  }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, webSearchRequests: 0, fetchUrlRequests: 0 });
}

function statLine(label: string, usage: UsageBucket, ms: number, model: string): string {
  return `<div class="stat-row"><span>${label}</span><span>${ms.toLocaleString()}ms · API호출 ${usage.calls}회 · web_search ${usage.webSearchRequests}회 · fetch_url ${usage.fetchUrlRequests}회 · in ${usage.input.toLocaleString()}/out ${usage.output.toLocaleString()}tok · 토큰비용 $${tokenCost(model, usage).toFixed(4)} + 도구비용 $${toolCost(usage).toFixed(4)} = $${totalCost(model, usage).toFixed(4)}</span></div>`;
}

function renderResearchColumn(run: ResearchRun): string {
  const modelLabel = run.model === SONNET ? 'Sonnet 5' : 'Haiku 4.5';
  const badgeClass = run.model === SONNET ? 'badge-sonnet' : 'badge-haiku';
  const totalUsage = sumUsage(run.usage1, run.usage2);
  const totalMs = run.ms1 + run.ms2;
  return `
    <div class="col">
      <div class="col-head"><span class="badge ${badgeClass}">${modelLabel}</span></div>
      <div class="stats">
        ${statLine('gatherResearch1', run.usage1, run.ms1, run.model)}
        ${statLine('gatherResearch2', run.usage2, run.ms2, run.model)}
        <div class="stat-row total"><span>합계</span><span>${totalMs.toLocaleString()}ms(순차 아님, 병렬) · web_search ${totalUsage.webSearchRequests}회 · 총비용 <strong>$${totalCost(run.model, totalUsage).toFixed(4)}</strong></span></div>
      </div>
      <h3>research1 (기본 정보)</h3>
      <pre class="text">${esc(run.research1 || '(빈 결과)')}</pre>
      <h3>research2 (상세 정보)</h3>
      <pre class="text">${esc(run.research2 || '(빈 결과)')}</pre>
    </div>`;
}

function renderDownstream(sonnetSummary: any, haikuResearchSummary: any, sonnetUsage: UsageBucket, haikuResearchUsage: UsageBucket): string {
  const col = (label: string, badgeClass: string, summary: any) => `
    <div class="col">
      <div class="col-head"><span class="badge ${badgeClass}">${label}</span></div>
      <div class="bullets"><div class="bullets-label">oneLiner</div><p>${esc(summary?.oneLiner ?? '(없음)')}</p></div>
      <div class="bullets"><div class="bullets-label">key_bullets</div><ul>${(summary?.key_bullets ?? []).map((b: string) => `<li>${esc(b)}</li>`).join('')}</ul></div>
      <pre class="json">${esc(JSON.stringify(summary, null, 2))}</pre>
    </div>`;
  return `
  <section class="section" id="sec-downstream">
    <h2>부가 실험 — 리서치 품질이 summary_v2로 어떻게 전파되는가 <span class="key-name">둘 다 synthesis는 Sonnet 5로 고정, 리서치 입력만 다름</span></h2>
    <div class="row">
      ${col('Sonnet 리서치 → Sonnet summary_v2', 'badge-sonnet', sonnetSummary)}
      ${col('Haiku 리서치 → Sonnet summary_v2', 'badge-haiku', haikuResearchSummary)}
    </div>
  </section>`;
}

function renderPricingTable(sonnet: ResearchRun, haiku: ResearchRun): string {
  const sTotal = sumUsage(sonnet.usage1, sonnet.usage2);
  const hTotal = sumUsage(haiku.usage1, haiku.usage2);
  const sCost = totalCost(SONNET, sTotal);
  const hCost = totalCost(HAIKU, hTotal);
  const saved = sCost - hCost;
  const pct = sCost > 0 ? (saved / sCost) * 100 : 0;
  const rows = [
    { label: 'gatherResearch1', s: sonnet.usage1, h: haiku.usage1 },
    { label: 'gatherResearch2', s: sonnet.usage2, h: haiku.usage2 },
  ].map(r => `<tr>
    <td>${r.label}</td>
    <td>${r.s.calls} / ${r.s.webSearchRequests} / ${r.s.fetchUrlRequests}</td>
    <td>${r.h.calls} / ${r.h.webSearchRequests} / ${r.h.fetchUrlRequests}</td>
    <td>${r.s.input.toLocaleString()} / ${r.s.output.toLocaleString()}</td>
    <td>${r.h.input.toLocaleString()} / ${r.h.output.toLocaleString()}</td>
    <td>$${totalCost(SONNET, r.s).toFixed(4)}</td>
    <td>$${totalCost(HAIKU, r.h).toFixed(4)}</td>
  </tr>`).join('');
  return `
  <section class="pricing" id="pricing-summary">
    <h2>가격 비교 요약표 — 리서치 단계</h2>
    <p class="note">단가: Sonnet 5 $2/$10 per MTok, Haiku 4.5 $1/$5 per MTok(캐싱 미적용 기준) + web_search 도구 비용 $0.01/회(Anthropic 공개 가격표 기준 추정치, 이 세션에서 청구서 실측 검증은 안 됨). 열 표기: API호출수/web_search수/fetch_url수.</p>
    <table>
      <thead><tr><th>단계</th><th>Sonnet 호출/검색/fetch</th><th>Haiku 호출/검색/fetch</th><th>Sonnet in/out tok</th><th>Haiku in/out tok</th><th>Sonnet 비용</th><th>Haiku 비용</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total-row">
        <td>합계</td><td>${sTotal.calls}/${sTotal.webSearchRequests}/${sTotal.fetchUrlRequests}</td><td>${hTotal.calls}/${hTotal.webSearchRequests}/${hTotal.fetchUrlRequests}</td>
        <td colspan="2"></td>
        <td><strong>$${sCost.toFixed(4)}</strong></td><td><strong>$${hCost.toFixed(4)}</strong></td>
      </tr></tfoot>
    </table>
    <div class="headline">
      <div class="headline-box"><div class="headline-label">리서치 단계 총비용 — Sonnet 5</div><div class="headline-value">$${sCost.toFixed(4)}</div></div>
      <div class="headline-box"><div class="headline-label">리서치 단계 총비용 — Haiku 4.5</div><div class="headline-value">$${hCost.toFixed(4)}</div></div>
      <div class="headline-box highlight"><div class="headline-label">절감액 / 절감률</div><div class="headline-value">$${saved.toFixed(4)} (${pct.toFixed(1)}%)</div></div>
    </div>
    <p class="note" style="margin-top:16px;">참고 — 직전 테스트의 9개 섹션(synthesis) Sonnet 합계는 $0.5534, 이 리서치 단계 Sonnet 합계는 $${sCost.toFixed(4)} — 둘을 더해도 프로덕션 8월 실측 평균 $3.37에는 못 미친다. 남은 격차는 cross_industry_nudge_v1/sources/sec_benchmark_interpretation/growth_scenario_v2(프리미엄) 등 이번 두 테스트에 포함되지 않은 나머지 호출, 그리고 이 실행이 콜드런(캐시 미적용)이 아니라 프로덕션은 배치 내 캐시 히트가 섞인다는 점, 재분석(탭별 새로고침) 호출이 8월 30건 카운트에 잡히지 않는다는(이전 세션에서 확인된) 하한값 문제 등 여러 요인의 합으로 추정 — 이번 두 테스트만으로 전액을 설명할 수는 없다.</p>
  </section>`;
}

const HTML_STYLE = `
  :root { --navy:#1e3a5f; --navy-tint:#eef3f8; --gray:#666; --border:#e2e2e2; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "Malgun Gothic", sans-serif; margin:0; padding:24px; background:#fafafa; color:#1a1a1a; }
  h1 { font-size:20px; margin:0 0 4px; }
  .meta { color:var(--gray); font-size:13px; margin-bottom:24px; }
  h2 { font-size:15px; margin:0 0 12px; padding-bottom:8px; border-bottom:2px solid var(--navy); }
  h3 { font-size:12px; color:var(--navy); margin:14px 0 6px; text-transform:uppercase; }
  .key-name { font-weight:400; color:var(--gray); font-size:12px; margin-left:8px; text-transform:none; }
  .section { margin-bottom:36px; }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width: 900px) { .row { grid-template-columns:1fr; } }
  .col { background:white; border:1px solid var(--border); border-radius:8px; padding:14px; min-width:0; }
  .col-head { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
  .badge { font-weight:700; font-size:12px; padding:3px 8px; border-radius:4px; color:white; }
  .badge-sonnet { background:var(--navy); }
  .badge-haiku { background:#8a5a00; }
  .stats { background:var(--navy-tint); border-radius:6px; padding:8px 12px; margin-bottom:6px; }
  .stat-row { display:flex; justify-content:space-between; gap:10px; font-size:11px; color:#333; padding:3px 0; border-bottom:1px dashed #d5dde5; }
  .stat-row:last-child { border-bottom:none; }
  .stat-row span:first-child { font-weight:700; color:var(--navy); white-space:nowrap; }
  .stat-row.total { font-weight:700; }
  .bullets { background:var(--navy-tint); border-radius:6px; padding:8px 12px; margin-bottom:10px; }
  .bullets-label { font-size:10px; color:var(--navy); font-weight:700; text-transform:uppercase; margin-bottom:4px; }
  .bullets ul { margin:0; padding-left:18px; font-size:12.5px; line-height:1.6; }
  .bullets p { margin:0; font-size:12.5px; line-height:1.6; }
  pre.text, pre.json { font-size:11.5px; line-height:1.6; background:#0d1117; color:#c9d1d9; padding:12px; border-radius:6px; overflow-x:auto; max-height:600px; overflow-y:auto; white-space:pre-wrap; word-break:break-word; }
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
  .headline-value { font-size:22px; font-weight:800; }
  .toc { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:24px; }
  .toc a { font-size:12px; color:var(--navy); background:white; border:1px solid var(--border); border-radius:14px; padding:4px 10px; text-decoration:none; }
`;

async function main() {
  console.log(`========== ${COMPANY} — 리서치 단계 Sonnet 5 vs Haiku 4.5 ==========`);

  console.log('[1/3] financialContext 조회 (참고용, 리서치 자체엔 미사용)...');
  const { source } = await fetchFinancialContext(COMPANY);
  console.log(`  source=${source}`);

  console.log('[2/3] gatherResearch1/2 실행 — Sonnet/Haiku 각각...');
  const [sonnetRun, haikuRun] = await Promise.all([
    runResearch(SONNET),
    runResearch(HAIKU),
  ]);
  console.log(`  Sonnet: research1 ${sonnetRun.research1.length}자/${sonnetRun.ms1}ms, research2 ${sonnetRun.research2.length}자/${sonnetRun.ms2}ms`);
  console.log(`  Haiku : research1 ${haikuRun.research1.length}자/${haikuRun.ms1}ms, research2 ${haikuRun.research2.length}자/${haikuRun.ms2}ms`);

  console.log('[3/3] 부가 실험 — summary_v2를 Sonnet으로 생성(리서치만 각각의 결과 사용)...');
  const buildContext = (r1: string, r2: string) => [
    `Company: ${COMPANY}`,
    `\n[Web research — basic info]\n${r1}`,
    `\n[Web research — detailed info]\n${r2}`,
  ].join('\n');
  const [sonnetSummary, haikuResearchSummary] = await Promise.all([
    callSection<SummaryV2>(buildContext(sonnetRun.research1, sonnetRun.research2), 'summary_v2', LANGUAGE, SONNET),
    callSection<SummaryV2>(buildContext(haikuRun.research1, haikuRun.research2), 'summary_v2', LANGUAGE, SONNET),
  ]);

  console.log('HTML 리포트 생성...');
  const jsonDump = {
    sonnet: sonnetRun, haiku: haikuRun,
    downstream: { sonnetResearchSummary: sonnetSummary, haikuResearchSummary: haikuResearchSummary },
  };
  const jsonPath = path.resolve(__dirname, '../../haiku_vs_sonnet_research_apr.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonDump, null, 2), 'utf-8');

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>Sonnet 5 vs Haiku 4.5 — 리서치 단계 — ${COMPANY}</title>
<style>${HTML_STYLE}</style>
</head>
<body>
  <h1>Sonnet 5 vs Haiku 4.5 — 리서치 단계(gatherResearch1/2) 비교 — ${COMPANY}</h1>
  <p class="meta">생성 시각: ${new Date().toISOString()} · financial source=${source} · 프로덕션 DB 미저장.</p>
  <div class="toc"><a href="#sec-research">리서치 원문</a><a href="#sec-downstream">다운스트림(summary_v2)</a><a href="#pricing-summary">가격 비교</a></div>
  <section class="section" id="sec-research">
    <h2>리서치 결과 전문 <span class="key-name">gatherResearch1 + gatherResearch2</span></h2>
    <div class="row">
      ${renderResearchColumn(sonnetRun)}
      ${renderResearchColumn(haikuRun)}
    </div>
  </section>
  ${renderDownstream(sonnetSummary, haikuResearchSummary, sumUsage(sonnetRun.usage1, sonnetRun.usage2), sumUsage(haikuRun.usage1, haikuRun.usage2))}
  ${renderPricingTable(sonnetRun, haikuRun)}
</body>
</html>`;

  const htmlPath = path.resolve(__dirname, '../../haiku_vs_sonnet_research_apr.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  console.log(`\n========== 완료 ==========`);
  console.log(`HTML: ${htmlPath}`);
  console.log(`JSON: ${jsonPath}`);

  const sTotal = sumUsage(sonnetRun.usage1, sonnetRun.usage2);
  const hTotal = sumUsage(haikuRun.usage1, haikuRun.usage2);
  console.log('\n===== 요약 =====');
  console.log(`Sonnet: web_search ${sTotal.webSearchRequests}회, fetch_url ${sTotal.fetchUrlRequests}회, in/out ${sTotal.input}/${sTotal.output}tok, 총비용 $${totalCost(SONNET, sTotal).toFixed(4)}`);
  console.log(`Haiku : web_search ${hTotal.webSearchRequests}회, fetch_url ${hTotal.fetchUrlRequests}회, in/out ${hTotal.input}/${hTotal.output}tok, 총비용 $${totalCost(HAIKU, hTotal).toFixed(4)}`);
  const saved = totalCost(SONNET, sTotal) - totalCost(HAIKU, hTotal);
  console.log(`절감액 $${saved.toFixed(4)} (${((saved / totalCost(SONNET, sTotal)) * 100).toFixed(1)}%)`);
}

main().catch(err => {
  console.error('!!!!! 실패 !!!!!');
  console.error(err);
  process.exit(1);
});
