// DART 재무 신뢰성 검증(2026-08-17) — EDGAR용 testEdgarReanalysisConsistency.ts와 동일한
// 패턴을 DART 대상 한국 상장사 3곳에 적용. 각 3회 재분석해 financials_v2의
// income_statement/balance_sheet/cash_flow 숫자 필드가 3번 실행 모두 완전히 동일한지
// (실행별 비결정성이 없는지) 확인한다. 검증 후 삭제 예정.
// 실행: npx ts-node server/scripts/testDartReanalysisConsistency.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { fetchFinancialContext } from '../src/lib/financialContext';
import { analyzeCompany } from '../src/lib/claude';

const COMPANIES = ['삼성전자', '현대차', 'LG화학'];
const RUNS_PER_COMPANY = 3;

function extractNumericFields(financialsV2: any) {
  // 서술형 필드(key_bullets/key_risks 등)는 실행마다 문구가 달라도 되는 영역이라 제외 —
  // 숫자 필드(income_statement/balance_sheet/cash_flow)만 결정론성 검증 대상.
  return {
    income_statement: financialsV2?.income_statement ?? null,
    balance_sheet: financialsV2?.balance_sheet ?? null,
    cash_flow: financialsV2?.cash_flow ?? null,
    revenue_lines: financialsV2?.revenue_lines ?? null,
  };
}

async function main() {
  let anyMismatch = false;

  for (const companyName of COMPANIES) {
    console.log(`\n\n========== ${companyName} ==========`);

    const { contextText, rawEdgar, rawDart, source } = await fetchFinancialContext(companyName);
    console.log('source:', source, '| rawEdgar 있음:', !!rawEdgar, '| rawDart 있음:', !!rawDart);
    if (source !== 'dart') {
      console.log(`  [경고] source가 'dart'가 아님(${source}) — 이 기업은 DART 경로 검증 대상에서 벗어남`);
    }

    const runs: any[] = [];
    for (let i = 1; i <= RUNS_PER_COMPANY; i++) {
      console.log(`\n-- run ${i}/${RUNS_PER_COMPANY} --`);
      const result = await analyzeCompany(companyName, contextText || undefined, undefined, {
        language: 'ko',
        rawEdgar,
        rawDart,
      });
      const numeric = extractNumericFields(result.financials_v2);
      console.log(JSON.stringify(numeric, null, 2));
      runs.push(numeric);
    }

    const baseline = JSON.stringify(runs[0]);
    const allIdentical = runs.every(r => JSON.stringify(r) === baseline);
    console.log(`\n[${companyName}] 3회 실행 숫자 필드 완전 동일: ${allIdentical ? 'PASS' : 'FAIL'}`);
    if (!allIdentical) {
      anyMismatch = true;
      for (let i = 1; i < runs.length; i++) {
        if (JSON.stringify(runs[i]) !== baseline) {
          console.log(`  run 1 vs run ${i + 1} diff:`);
          console.log('  run1:', JSON.stringify(runs[0]));
          console.log(`  run${i + 1}:`, JSON.stringify(runs[i]));
        }
      }
    }
  }

  console.log(`\n\n========== 최종 결과: ${anyMismatch ? 'FAIL — 불일치 발견' : 'PASS — 전 기업 3회 실행 완전 동일'} ==========`);
}

main().catch(console.error);
