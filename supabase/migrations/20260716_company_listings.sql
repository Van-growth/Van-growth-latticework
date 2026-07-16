-- 다중상장 회사 대응: companies(엔티티) ↔ company_listings(소스별 상장 식별자, N:1)
-- 지연 생성(lazy) 방식 — corp_master/cik_master는 그대로 두고, 유저가 typeahead에서
-- 실제로 클릭한 회사만 이 테이블에 upsert된다 (companies 테이블을 12만 행으로
-- 일괄 부풀리지 않기 위함).

CREATE TABLE IF NOT EXISTS company_listings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source     text NOT NULL CHECK (source IN ('EDGAR', 'DART')),
  identifier text NOT NULL,      -- EDGAR: cik, DART: corp_code
  ticker     text,               -- EDGAR: ticker, DART: stock_code
  exchange   text,               -- 아는 경우만(수동 시드) — corp_master/cik_master 둘 다 이 정보가 없어 일반적으론 null
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, identifier)
);

CREATE INDEX IF NOT EXISTS company_listings_company_id_idx ON company_listings(company_id);

-- 다중상장 병합 매핑 — DART corp_code ↔ EDGAR cik. 자동 이름매칭이 불가능한
-- 케이스(언어가 다름)라 수동 큐레이션. typeahead 검색 결과 병합 + resolve 시 참조.
CREATE TABLE IF NOT EXISTS company_dual_listings_manual (
  dart_corp_code text PRIMARY KEY,
  edgar_cik      text NOT NULL UNIQUE,
  note           text
);

INSERT INTO company_dual_listings_manual (dart_corp_code, edgar_cik, note) VALUES
  ('00688996', '0001445930', 'KB금융/KB Financial Group'),
  ('00159193', '0000887225', '한국전력공사/KEPCO'),
  ('00105873', '0001290109', 'LG디스플레이/LG Display'),
  ('00382199', '0001263043', '신한지주/Shinhan Financial'),
  ('00159023', '0001015650', 'SK텔레콤/SK Telecom'),
  ('01350869', '0001264136', '우리금융지주/Woori Financial (316140, 구주 053000 아님)'),
  ('00164779', '2120882',    'SK하이닉스/SK hynix ADR(SKHY) — cik_master 미동기화라 수동 등록, 아래 참고')
ON CONFLICT (dart_corp_code) DO NOTHING;

-- cik_master에 SK하이닉스 CIK가 아직 없음(2026-07-10 신규 ADR 상장, 배치 동기화 미반영) —
-- EDGAR 조회 경로가 동작하도록 수동 시드. 다음 cik_master 정식 리싱크에서 이 행이
-- 공식 SEC company_tickers.json과 다시 맞는지 확인 필요.
INSERT INTO cik_master (cik, name, ticker) VALUES
  ('2120882', 'SK hynix Inc.', 'SKHY')
ON CONFLICT (cik) DO NOTHING;
