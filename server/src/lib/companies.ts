// 회사명 dedup 헬퍼 (2026-08-21) — companies.upsert({onConflict:'name'})는 Postgres
// UNIQUE(name)이 대소문자/공백을 그대로 구분해서, 표기만 다른 같은 회사가 서로 다른
// company_id로 쪼개지는 사고를 못 막는다(워트인텔리전스 "WERT Intelligence"/
// "wert intelligence" 실측 — company_listings가 없는 비상장 회사는 이 문자열 완전일치가
// 유일한 dedup 수단이라 특히 취약). "회사명Test"/"회사명 Test"류 공백 유무 차이도 동일
// 계열 문제라 함께 처리한다.
//
// 정규화 컬럼을 DB에 새로 만들지 않고 인메모리 비교로 처리 — 공백 차이는 SQL
// ILIKE만으로 못 잡고(중간 공백이 있으면 리터럴 자체가 달라짐), 정규화 컬럼을
// 추가하려면 마이그레이션+기존 행 백필이 필요해 스코프가 커진다. companies는 지연
// 생성 설계상 소규모(2026-08-21 기준 수백 행)라 매번 전체 스캔해도 비용 미미 —
// 테이블이 커질 경우를 대비해 상한을 두고 초과 시 경고만 남긴다(정확성보다 안전한
// 실패 우선 — 상한 초과 시에도 예외 없이 upsert 폴백으로 계속 동작).
//
// ⚠️ 공백 제거 정규화는 "완전히 다른 두 회사가 공백 유무로만 구분되는" 극단적
// 케이스를 코드로 배제할 수 없다(예: "SK텔레콤"/"SK 텔레콤"이 실제로는 같은 회사일
// 가능성이 높지만 100% 증명은 불가) — dedup 실패(이미 실제 발생한 확인된 버그)의
// 대가가 오탐 병합(이론적 리스크)보다 크다고 판단해 병합은 진행하되, 정규화로
// 매칭될 때(원문이 완전히 같지 않을 때)마다 경고 로그를 남겨 추적 가능하게 한다.
import { supabase } from './supabase';

const MAX_SCAN_ROWS = 5000;

// 대소문자 무시 + 앞뒤/중간 공백 전부 제거 — "SK 텔레콤"/"SK텔레콤", "Open AI"/"OpenAI"
// 전부 같은 키로 수렴한다.
function normalizeCompanyName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

export async function findOrCreateCompany(rawName: string): Promise<{ id: string; name: string }> {
  const name = rawName.trim();
  const normalized = normalizeCompanyName(name);

  const { data: all, error: listErr } = await supabase
    .from('companies')
    .select('id, name, created_at')
    .order('created_at', { ascending: true })
    .limit(MAX_SCAN_ROWS);
  if (listErr) throw listErr;
  if ((all?.length ?? 0) >= MAX_SCAN_ROWS) {
    console.warn(`[companies] findOrCreateCompany: companies 테이블이 ${MAX_SCAN_ROWS}행 이상 — dedup 스캔이 일부 누락될 수 있음`);
  }

  const match = (all ?? []).find(c => normalizeCompanyName(c.name) === normalized);
  if (match) {
    if (match.name !== name) {
      console.warn(`[companies] dedup 정규화 매칭: "${name}" → 기존 "${match.name}"(${match.id}) 재사용 — 원문이 다름(대소문자/공백 차이), 실제 동일 회사인지 확인 권장`);
    }
    return match;
  }

  const { data: created, error: upsertErr } = await supabase
    .from('companies')
    .upsert({ name }, { onConflict: 'name' })
    .select('id, name')
    .single();
  if (upsertErr) throw upsertErr;
  return created;
}
