// financialsTableBuilder.ts 서버 조립 리팩터링(2026-08-13, Ford FY2021/2022 공백 사고 근본
// 수정) 검증용 임시 스크립트 — 확인 후 삭제 예정.
// EDGAR 커버 대상 미국 상장사 3곳을 각 3회 재분석해, income_statement 5개 항목
// (매출/매출총이익/영업이익/순이익/EBITDA)의 5개년 수치가 3번 실행 모두 완전히
// 동일한지(실행별 비결정성이 근절됐는지) 확인한다.
// 실행: npx ts-node server/scripts/testEdgarReanalysisConsistency.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { fetchFinancialContext } from '../src/lib/financialContext';
import { analyzeCompany } from '../src/lib/claude';

const COMPANIES = ['Ford Motor', 'NVIDIA', 'Johnson & Johnson'];
const RUNS_PER_COMPANY = 3;

async function main() {
  let anyMismatch = false;

  for (const companyName of COMPANIES) {
    console.log(`\n\n========== ${companyName} ==========`);

    const { contextText, rawEdgar, rawDart, source } = await fetchFinancialContext(companyName);
    console.log('source:', source, '| rawEdgar 있음:', !!rawEdgar, '| rawDart 있음:', !!rawDart);

    const runs: any[] = [];
    for (let i = 1; i <= RUNS_PER_COMPANY; i++) {
      console.log(`\n-- run ${i}/${RUNS_PER_COMPANY} --`);
      const result = await analyzeCompany(companyName, contextText || undefined, undefined, {
        language: 'en',
        rawEdgar,
        rawDart,
      });
      console.log(JSON.stringify(result.financials_v2.income_statement, null, 2));
      runs.push(result.financials_v2.income_statement);
    }

    const baseline = JSON.stringify(runs[0]);
    const allIdentical = runs.every(r => JSON.stringify(r) === baseline);
    console.log(`\n[${companyName}] 3회 실행 income_statement 완전 동일: ${allIdentical ? 'PASS' : 'FAIL'}`);
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
