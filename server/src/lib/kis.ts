// KIS (한국투자증권) Open API client
// Env: KIS_APP_KEY, KIS_APP_SECRET

const BASE = 'https://openapi.koreainvestment.com:9443';

async function fetchJson<T>(
  url: string,
  options: RequestInit,
  timeoutMs = 10_000,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Token cache (23.5h) ───────────────────────────────────────────────────────

let _token: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(): Promise<string | null> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const key    = process.env.KIS_APP_KEY;
  const secret = process.env.KIS_APP_SECRET;
  if (!key || !secret) return null;

  const res = await fetchJson<{ access_token?: string; error_description?: string }>(
    `${BASE}/oauth2/tokenP`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ grant_type: 'client_credentials', appkey: key, appsecret: secret }),
    },
  );

  if (!res?.access_token) {
    console.warn('[kis] token 발급 실패:', res?.error_description);
    return null;
  }

  _token       = res.access_token;
  _tokenExpiry = Date.now() + 23.5 * 60 * 60 * 1000;
  return _token;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KisQuote {
  stockCode:  string;
  price:      string;   // 현재가
  marketCap:  string;   // 시가총액 (억원)
  per:        string;
  pbr:        string;
  eps:        string;
  bps:        string;
  high52:     string;   // 52주 최고가
  low52:      string;   // 52주 최저가
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchKisQuote(stockCode: string): Promise<KisQuote | null> {
  if (!stockCode) return null;

  const token  = await getAccessToken();
  const appKey = process.env.KIS_APP_KEY;
  const appSec = process.env.KIS_APP_SECRET;
  if (!token || !appKey || !appSec) return null;

  const res = await fetchJson<{
    rt_cd?: string;
    output?: Record<string, string>;
  }>(
    `${BASE}/uapi/domestic-stock/v1/quotations/inquire-price` +
      `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${encodeURIComponent(stockCode)}`,
    {
      headers: {
        'authorization': `Bearer ${token}`,
        'appkey':        appKey,
        'appsecret':     appSec,
        'tr_id':         'FHKST01010100',
        'custtype':      'P',
      },
    },
  );

  if (res?.rt_cd !== '0' || !res.output) return null;

  const o = res.output;
  return {
    stockCode,
    price:     o.stck_prpr   ? `${parseInt(o.stck_prpr).toLocaleString('ko-KR')}원`   : '-',
    marketCap: o.hts_avls    ? `${Math.round(parseInt(o.hts_avls) / 100_000_000).toLocaleString('ko-KR')}억원` : '-',
    per:       o.per         ? `${o.per}배`    : '-',
    pbr:       o.pbr         ? `${o.pbr}배`    : '-',
    eps:       o.eps         ? `${parseInt(o.eps).toLocaleString('ko-KR')}원` : '-',
    bps:       o.bps         ? `${parseInt(o.bps).toLocaleString('ko-KR')}원` : '-',
    high52:    o.w52hgpr     ? `${parseInt(o.w52hgpr).toLocaleString('ko-KR')}원`   : '-',
    low52:     o.w52lwpr     ? `${parseInt(o.w52lwpr).toLocaleString('ko-KR')}원`   : '-',
  };
}
