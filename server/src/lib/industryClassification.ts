// 은행 재무제표 템플릿(financialsTableBuilder.ts) 적용 여부를 판단하기 위한 "시도 힌트" —
// SIC/KSIC만으로 넓게 잡고, 실제 적용 여부는 isGenuineBankData()(financialsTableBuilder.ts)
// 게이트가 별도로 재확인한다. 이 파일은 그 시도 힌트만 계산하며, 뱃지 노출 여부와는
// 직접 연결되지 않는다(claude.ts의 overrideFinancialsTable 참고).
import { supabase } from './supabase';

export type IndustryCategory = 'bank' | 'general';
// 2단계에서 'insurance' | 'securities' 추가 예정 — 그때 이 유니언과 아래 두 코드셋이
// 업종별로 분리될 것.

// SIC 6020~6029: 상업은행. 6035/6036: 저축기관. 6099: 예탁은행 관련 기타(소표본). 6199:
// "Finance Services" — Synchrony Financial(이 기능의 발단)이 여기 분류돼 있어 제외할 수
// 없지만, 실측 확인 결과 크립토/핀테크 등 158개사가 섞인 잡동사니 분류다. 6712/6719: 은행
// 지주(현재 cik_master 표본 0건, 향후 대비로 포함). 과분류 위험은
// financialsTableBuilder.ts의 isGenuineBankData() 게이트로 상쇄한다.
const EDGAR_BANK_SIC_CODES = new Set([
  '6020', '6021', '6022', '6029',
  '6035', '6036',
  '6099',
  '6199',
  '6712', '6719',
]);

// KSIC 64(금융업) — 641xx(은행/저축기관) + 649xx(기타 여신금융업, 금융지주회사가 여기 포함됨).
// 649xx는 금융지주 전용이 아니라 일반 지주회사와 공유하는 코드라(실측: 신한지주/KB금융과
// LS/HD현대/하림지주 등이 전부 64992) 과분류가 EDGAR보다도 크다 — 동일하게 게이트로 상쇄.
// 65(보험업)/66(금융지원서비스업)는 2단계 스코프라 제외.
const DART_BANK_KSIC_PREFIX = '64';

export async function classifyIndustryCategory(
  params: { cik?: string | null; corpCode?: string | null },
): Promise<IndustryCategory> {
  if (params.cik) {
    const cik = String(params.cik).replace(/^CIK/, '');
    const { data } = await supabase.from('cik_master').select('sic_code').eq('cik', cik).maybeSingle();
    if (data?.sic_code && EDGAR_BANK_SIC_CODES.has(data.sic_code)) return 'bank';
    return 'general';
  }
  if (params.corpCode) {
    const { data } = await supabase.from('corp_master').select('ksic_code').eq('corp_code', params.corpCode).maybeSingle();
    if (data?.ksic_code?.startsWith(DART_BANK_KSIC_PREFIX)) return 'bank';
    return 'general';
  }
  return 'general';
}
