// DART 신뢰성 검증 보조 스크립트(2026-08-17) — testDartReanalysisConsistency.ts가
// "현대차"(축약명, corp_master 매칭 실패)에서 막혀 시간을 아끼기 위해 정식 등록명으로
// 1회씩만 빠르게 확인. 검증 후 삭제 예정.
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { fetchFinancialContext } from '../src/lib/financialContext';
import { analyzeCompany } from '../src/lib/claude';

const COMPANIES = ['현대자동차', 'LG화학'];

async function main() {
  for (const companyName of COMPANIES) {
    console.log(`\n\n========== ${companyName} ==========`);
    const { contextText, rawEdgar, rawDart, source } = await fetchFinancialContext(companyName);
    console.log('source:', source, '| rawEdgar 있음:', !!rawEdgar, '| rawDart 있음:', !!rawDart);
    if (rawDart) {
      console.log('rawDart summary:', JSON.stringify({
        corp_name: (rawDart as any).corp_name,
        corp_code: (rawDart as any).corp_code,
        fiscalYears: (rawDart as any).cfs?.fiscalYears ?? (rawDart as any).ofs?.fiscalYears,
      }));
    }
    const result = await analyzeCompany(companyName, contextText || undefined, undefined, {
      language: 'ko',
      rawEdgar,
      rawDart,
    });
    console.log(JSON.stringify({
      income_statement: result.financials_v2.income_statement,
      balance_sheet: result.financials_v2.balance_sheet,
    }, null, 2));
  }
}

main().catch(console.error);
