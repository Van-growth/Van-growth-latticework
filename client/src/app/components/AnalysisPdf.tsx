'use client';

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  Link,
  Svg,
  Polyline,
  Circle,
} from '@react-pdf/renderer';
import type {
  AnalysisDetail,
  SummaryV2,
  IndustryHistoryV2,
  TechEvolutionV2,
  ValueChainV2,
  BusinessModelV2,
  CompetitorsV2,
  StrategyV2,
  FinancialsV2,
  FinancialsV2Row,
  FinancialsV2BSRow,
  FounderV2,
  GrowthScenarioV2,
  Source,
  AnalysisSources,
  CrossIndustryNudgeV1,
  DataSource,
} from '@/types';
import { countFinancialsReliability, getFinancialYearCols } from '@/lib/financialsReliability';
import { calcCagr, fmtCagr, fmtGrowthRevenue } from '@/lib/growthScenario';
import type { Language } from '@/app/context/LanguageContext';

// Absolute URL required: react-pdf fetches fonts via URL at render time,
// and relative paths may not resolve correctly in all environments.
const _origin = typeof window !== 'undefined' ? window.location.origin : '';
Font.register({
  family: 'NotoSansKR',
  fonts: [
    { src: `${_origin}/fonts/noto-sans-kr-400.woff`, fontWeight: 400 },
    { src: `${_origin}/fonts/noto-sans-kr-700.woff`, fontWeight: 700 },
  ],
});
// 2026-08-16 — 웹 개편(제목: Noto Serif KR / 본문: Noto Sans KR)과 동기화. 700 weight만
// 등록(본문과 동일하게 굵기 하나만 쓰는 기존 패턴 유지) — 헤딩 계층(커버/섹션/서브헤더)에만
// 적용, 본문은 NotoSansKR 그대로. 풀 한글 char셋이라 파일이 큼(2.4MB, sans 700의 ~2.7배) —
// pdf().toBlob() 동기 작업이 늘어나는 만큼 진행률 바를 CSS 무한 애니메이션으로 전환한
// ExportPdfButton.tsx 수정과 함께 적용해야 체감 프리징이 재발하지 않는다.
Font.register({
  family: 'NotoSerifKR',
  fonts: [
    { src: `${_origin}/fonts/noto-serif-kr-700.woff`, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback(w => [w]);

// 언어 토글용 번역 헬퍼 — data.language에 따라 ko/en 리터럴 중 하나를 고른다.
// 서버가 생성하는 분석 콘텐츠(v/g/c 등) 자체는 이미 올바른 언어로 생성되어 넘어오므로
// 건드리지 않는다 — 이 헬퍼는 PDF 레이아웃에 하드코딩된 UI/구조 라벨에만 사용.
function makeT(language: Language) {
  return (ko: string, en: string) => (language === 'ko' ? ko : en);
}
type TFn = ReturnType<typeof makeT>;

// 웹 UI(HomeContent.tsx PURPOSE_CATEGORIES)/uiStrings.ts와 동일한 라벨 — 새 문자열
// 체계를 만들지 않고 그대로 재사용.
function purposeCategoryLabel(category: string, t: TFn): string {
  switch (category) {
    case 'ma':          return t('인수합병', 'M&A');
    case 'investment':  return t('투자', 'Investment');
    case 'partnership': return t('파트너십', 'Partnership');
    case 'customer':    return t('고객', 'Customer');
    default:            return t('기타', 'Other');
  }
}

// NotoSansKR woff subset may lack certain glyphs — replace with ASCII equivalents.
// ▲/▼(YoY 증감 표시, financials_v2.income_statement[].yoy)와 ○/△/▼(outlook.shortTerm/
// midLongTerm 접두 기호)는 이 서브셋에 없는 글리프라 PDF 뷰어에서 인접 문자와 겹쳐 보이는
// 렌더링 깨짐이 실측으로 확인됨(2026-08-12) — 텍스트 기호로 치환.
function sp(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/₩/g, 'W')
    .replace(/©/g, '(c)')
    .replace(/®/g, '(R)')
    .replace(/™/g, '(TM)')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, '...')
    .replace(/▲/g, '^')
    .replace(/▼/g, 'v')
    .replace(/[○◯]/g, '(+)')
    .replace(/△/g, '(~)')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/[✓✔]/g, '(v)')
    .replace(/[✗✘]/g, '(x)')
    .replace(/⚠/g, '(!)')
    .replace(/[●■★]/g, '*');
}

// Claude가 생성하는 자유서술 텍스트(bull_case, oneLiner, career_trajectory 등)엔 위 특수기호가
// 스키마로 통제되지 않는 임의 위치에 나타난다(실측: "제작 → 발사 → 운용" 같은 화살표 표현이
// bull_case/founder 경력/출처 content 등 여러 필드에서 자연 발생, 2026-08-12 확인) — 필드
// 하나하나 sp()로 감싸는 대신 렌더링 전에 데이터 전체를 한 번에 재귀 정화한다.
function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return sp(value) as unknown as T;
  if (Array.isArray(value)) return value.map(sanitizeDeep) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = sanitizeDeep((value as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  return value;
}

// ── Design tokens ────────────────────────────────────────────────────────────
// 웹 앱(globals.css @theme inline)과 동일한 팔레트로 매핑 — 흰색/검은색/네이비 3색
// 기본 체계 + success/risk/source-reliability 시맨틱 예외(2026-08-17 웹 개편,
// 2026-08-16 PDF 동기화). 기존 키 이름(blue/green/red/orange 등)은 그대로 두고 값만
// 교체 — 파일 전체에서 C.blue 등으로 참조하는 곳이 많아 값만 바꾸는 쪽이 안전.
// orange는 이제 순수하게 "출처 신뢰도 L2(참고)/재무 데이터 신뢰도 배너" 용도로만 쓴다 —
// 밸류체인 병목/간접경쟁사 등 순수 비즈니스 경고 성격의 태그는 risk(red)로 통일해
// CLAUDE.md가 명시한 3색+3예외 체계 밖의 4번째 색 의미를 만들지 않는다.
const C = {
  blue:            '#1e3a5f', // navy (구 #2563EB)
  blueHover:       '#16293f', // navy-hover
  blueLight:       '#eef2f7', // navy-tint (구 #EFF6FF)
  blueLightBorder: '#d3dee8', // navy-tint-border
  dark:            '#171717', // 본문 텍스트(black) — 웹 --foreground와 동일(구 #1E293B)
  mid:             '#64748B',
  light:           '#94A3B8',
  bg:              '#F8FAFC',
  border:          '#E2E8F0',
  white:           '#FFFFFF',
  green:           '#059669', // success (구 #16A34A)
  greenBg:         '#ecfdf5',
  greenBorder:     '#a7f3d0',
  red:             '#dc2626', // risk
  redBg:           '#fef2f2',
  redBorder:       '#fecaca',
  orange:          '#d97706', // source-reference(L2/참고) 전용
  orangeBg:        '#fffbeb',
  orangeBorder:    '#fde68a',
  graySoft:        '#6b7280', // source-estimate(L3/추정) 전용
  graySoftBg:      '#f3f4f6',
  graySoftBorder:  '#e5e7eb',
};

const s = StyleSheet.create({
  page: {
    fontFamily:       'NotoSansKR',
    fontSize:         9.5,
    color:            C.dark,
    backgroundColor:  C.white,
    // 24mm/22mm 여백(2026-08-12 밀도 개선) — mm→pt 환산(1mm≈2.83pt)
    paddingHorizontal: 62,
    paddingTop:       68,
    paddingBottom:    68,
  },

  // ── Cover ──
  coverPage: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'flex-start',
    paddingLeft:     12,
  },
  coverLabel: {
    fontSize:   9,
    color:      C.blue,
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom:  16,
  },
  coverCompany: {
    fontFamily: 'NotoSerifKR',
    fontSize:   30,
    fontWeight: 700,
    color:      C.dark,
    marginBottom: 6,
  },
  coverSub: {
    fontSize:   11,
    color:      C.mid,
    marginBottom: 4,
  },
  coverDivider: {
    width:           48,
    height:          2,
    backgroundColor: C.blue,
    marginVertical:  20,
  },
  coverMeta: {
    fontSize:   8,
    color:      C.light,
    marginBottom: 3,
  },

  // ── Section ──
  section: {
    marginBottom: 26,
  },
  sectionBreak: {
    marginBottom: 26,
    marginTop:    8,
  },
  sectionHeaderWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    marginTop:       30,
    marginBottom:    14,
    paddingBottom:   9,
    borderBottom:    `2 solid ${C.blue}`,
  },
  sectionNum: {
    fontSize:   9,
    fontWeight: 700,
    color:      C.blue,
    marginRight: 7,
  },
  sectionTitle: {
    fontFamily: 'NotoSerifKR',
    fontSize:   12.5,
    fontWeight: 700,
    color:      C.dark,
  },

  // ── Sub-section ──
  subHeader: {
    fontFamily: 'NotoSerifKR',
    fontSize:   10,
    fontWeight: 700,
    color:      C.dark,
    marginTop:  16,
    marginBottom: 8,
  },

  // ── Field row ──
  row: {
    flexDirection: 'row',
    marginBottom:  6,
  },
  label: {
    width:      100,
    fontSize:   9,
    color:      C.mid,
    fontWeight: 700,
    flexShrink: 0,
  },
  value: {
    flex:     1,
    fontSize: 9,
    color:    C.dark,
    lineHeight: 1.7,
  },

  // ── Prose ──
  para: {
    fontSize:   9.5,
    color:      C.dark,
    lineHeight: 1.8,
    marginBottom: 9,
  },

  // ── Bullet list ──
  bullet: {
    fontSize:    9.5,
    color:       C.dark,
    marginBottom: 5,
    lineHeight:  1.7,
    paddingLeft: 9,
  },

  // ── Table ──
  table: {
    marginBottom: 14,
  },
  tHead: {
    flexDirection:   'row',
    backgroundColor: C.bg,
    borderBottom:    `1 solid ${C.border}`,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  tRow: {
    flexDirection:   'row',
    borderBottom:    `1 solid ${C.border}`,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  tRowAlt: {
    flexDirection:   'row',
    borderBottom:    `1 solid ${C.border}`,
    paddingVertical: 7,
    paddingHorizontal: 9,
    backgroundColor: C.bg,
  },
  th: {
    fontSize:   8,
    fontWeight: 700,
    color:      C.mid,
    flex:       1,
  },
  td: {
    fontSize: 8.5,
    color:    C.dark,
    flex:     1,
    lineHeight: 1.6,
  },
  tdItem: {
    fontSize:   8.5,
    color:      C.dark,
    width:      140,
    flexShrink: 0,
  },
  thItem: {
    fontSize:   8,
    fontWeight: 700,
    color:      C.mid,
    width:      140,
    flexShrink: 0,
  },

  // ── Card ──
  card: {
    backgroundColor: C.bg,
    borderRadius:    4,
    padding:         18,
    marginBottom:    10,
    borderLeft:      `3 solid ${C.blue}`,
  },
  cardTitle: {
    fontSize:   9.5,
    fontWeight: 700,
    color:      C.dark,
    marginBottom: 6,
  },
  cardText: {
    fontSize:   9,
    color:      C.mid,
    lineHeight: 1.8,
  },

  // ── Pain Diagnosis (산업역사+기술변화 통합 강조 박스, 웹의 <ReportSection emphasis>와
  //     동등한 시각 언어 — amber 강조는 CLAUDE.md UI/UX 원칙의 명시적 4번째 예외, source-
  //     reference와 같은 amber 토큰을 그대로 재사용) ──
  painBox: {
    backgroundColor:   C.orangeBg,
    border:            `1.5 solid ${C.orangeBorder}`,
    borderRadius:      6,
    padding:           16,
  },
  painSubTitle: {
    fontFamily: 'NotoSerifKR',
    fontSize:   10.5,
    fontWeight: 700,
    color:      C.orange,
    marginBottom: 8,
  },
  painDivider: {
    height:          1,
    backgroundColor: C.orangeBorder,
    marginVertical:  14,
  },

  // ── Reliability banner (재무 데이터 신뢰도 요약 — source-reference 토큰) ──
  reliabilityBanner: {
    backgroundColor:   C.orangeBg,
    border:            `1 solid ${C.orangeBorder}`,
    borderRadius:      4,
    paddingVertical:   10,
    paddingHorizontal: 14,
    marginBottom:      12,
  },
  reliabilityBannerText: {
    fontSize:   8.5,
    color:      C.orange,
    lineHeight: 1.6,
  },

  // ── Tag / badge ──
  tag: {
    fontSize:          7,
    color:             C.blue,
    backgroundColor:   C.blueLight,
    paddingHorizontal: 4,
    paddingVertical:   1,
    borderRadius:      3,
    marginRight:       3,
    marginBottom:      2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    marginBottom:  4,
  },

  // ── Grid 2-col ──
  grid2: {
    flexDirection: 'row',
    marginBottom:  10,
  },
  gridLeft: {
    flex:        1,
    marginRight: 10,
  },
  gridRight: {
    flex: 1,
  },

  // ── Metric chip ──
  metricRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    marginBottom:  10,
  },
  metric: {
    backgroundColor: C.bg,
    borderRadius:    4,
    padding:         10,
    marginRight:     8,
    marginBottom:    8,
    minWidth:        76,
  },
  metricLabel: {
    fontSize:   7.5,
    color:      C.light,
    marginBottom: 2,
  },
  metricValue: {
    fontSize:   10,
    fontWeight: 700,
    color:      C.dark,
  },

  // ── Financial label chips ──
  finGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    marginBottom:  10,
  },
  finChip: {
    backgroundColor: C.bg,
    borderRadius:    4,
    padding:         10,
    marginRight:     8,
    marginBottom:    8,
    minWidth:        86,
  },
  finChipLabel: {
    fontSize:   7.5,
    color:      C.light,
    marginBottom: 2,
  },
  finChipValue: {
    fontSize:   9,
    fontWeight: 700,
    color:      C.dark,
  },

  // ── Divider ──
  divider: {
    height:          1,
    backgroundColor: C.border,
    marginVertical:  10,
  },

  // ── Sources page ──
  srcGroupLabel: {
    fontSize:     9,
    fontWeight:   700,
    color:        C.mid,
    letterSpacing: 0.5,
    marginBottom: 7,
    marginTop:    16,
    paddingBottom: 5,
    borderBottom: `1 solid ${C.border}`,
  },
  srcRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginBottom:  7,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius:  3,
    backgroundColor: C.bg,
  },
  srcBadge: {
    fontSize:   6.5,
    fontWeight: 700,
    paddingHorizontal: 5,
    paddingVertical:   3,
    borderRadius: 3,
    marginRight:  7,
    marginTop:    1,
    flexShrink:   0,
  },
  srcBadgeL1: { backgroundColor: C.greenBg, color: C.green },
  srcBadgeL2: { backgroundColor: C.orangeBg, color: C.orange },
  srcBadgeL3: { backgroundColor: C.graySoftBg, color: C.graySoft },
  srcOrg: {
    fontSize:   8.5,
    fontWeight: 700,
    color:      C.dark,
    marginRight: 4,
  },
  srcDate: {
    fontSize: 8,
    color:    C.light,
    marginRight: 4,
  },
  srcContent: {
    fontSize:  8,
    color:     C.mid,
    lineHeight: 1.6,
    flex:       1,
  },
  srcUrl: {
    fontSize: 7.5,
    color:    C.blue,
    marginTop: 2,
  },

  // ── TOC ──
  tocItem: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 9,
    borderBottom:    `1 solid ${C.border}`,
  },
  tocNum: {
    fontSize:   9,
    fontWeight: 700,
    color:      C.blue,
    width:      28,
  },
  tocTitle: {
    fontSize: 10,
    color:    C.dark,
    flex:     1,
  },
  webLink: {
    fontSize: 9,
    color:    C.blue,
  },

  // ── Growth scenario (CAGR 배지 + SVG 라인차트, 2026-08-16 신규 —
  //     웹 GrowthScenarioV2Tab의 3열 CAGR 카드/라인차트와 동일한 숫자·시각 언어) ──
  cagrRow: {
    flexDirection: 'row',
    marginBottom:  12,
  },
  cagrCard: {
    flex:            1,
    backgroundColor: C.bg,
    borderRadius:    4,
    paddingVertical: 8,
    marginRight:     6,
    alignItems:      'center',
  },
  cagrLabel: {
    fontSize:   7,
    color:      C.light,
    marginBottom: 2,
  },
  cagrValue: {
    fontSize:   11,
    fontWeight: 700,
    color:      C.dark,
  },
  chartWrap: {
    marginBottom: 4,
  },
  chartAxisRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      3,
  },
  chartAxisLabel: {
    fontSize: 7,
    color:    C.light,
  },
  chartLegendRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     6,
    marginBottom:  10,
  },
  chartLegendDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    marginRight:  4,
  },
  chartLegendLabel: {
    fontSize:    7.5,
    color:       C.light,
    marginRight: 12,
  },
  finalYearCard: {
    backgroundColor: C.blueLight,
    borderRadius:    4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom:    10,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
  },
  finalYearLabel: {
    fontSize: 8.5,
    color:    C.blue,
  },
  finalYearValue: {
    fontSize:   13,
    fontWeight: 700,
    color:      C.blue,
  },

  // ── Footer ──
  footer: {
    position:   'absolute',
    bottom:     28,
    left:       62,
    right:      62,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7.5,
    color:    C.light,
  },
});

// ── Placeholder filtering (mirrors AnalysisCard.tsx isPlaceholder) ───────────

function pdfVal(v: string | number | null | undefined): string {
  if (v == null) return '—';
  const s = String(v).trim();
  if (!s || s === '-' || s === '확인 필요' || s === '공개 없음' || s === 'Not disclosed') return '—';
  if (/^-999([.,]\d+)?([%\s]|$)/.test(s)) return '—';
  return s;
}

// ── Primitives ───────────────────────────────────────────────────────────────

function SectionHeader({ num, title, id }: { num: number; title: string; id?: string }) {
  return (
    <View style={s.sectionHeaderWrap}>
      {/* react-pdf named-destination 마커 — 줄바꿈되는 콘텐츠에 직접 id를 달면 페이지가
          넘어갈 때 마지막 조각으로 점프하는 버그(react-pdf#2377)가 있어, 절대 줄바꿈되지
          않는 빈 텍스트를 헤더 맨 앞에 둬서 목적지로 쓴다. */}
      {id && <Text id={id} style={{ fontSize: 0 }} />}
      <Text style={s.sectionNum}>{String(num).padStart(2, '0')}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function FieldRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{String(value)}</Text>
    </View>
  );
}

function LabelDetailField({ label, item }: { label: string; item: { label: string; detail: string } | undefined | null }) {
  if (!item?.label) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={s.cardTitle}>{label}: {sp(item.label)}</Text>
      {item.detail && <Text style={s.cardText}>{sp(item.detail)}</Text>}
    </View>
  );
}

function SubHeader({ children }: { children: string }) {
  return <Text style={s.subHeader}>{children}</Text>;
}

function Bullet({ children }: { children: string }) {
  return <Text style={s.bullet}>• {children}</Text>;
}

function Divider() {
  return <View style={s.divider} />;
}

function KeyBulletsPdf({ bullets }: { bullets?: string[] | null }) {
  if (!bullets?.length) return null;
  return (
    <View style={{ backgroundColor: C.dark, borderRadius: 4, padding: 18, marginBottom: 16 }}>
      {bullets.map((b, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i < bullets.length - 1 ? 6 : 0 }}>
          <Text style={{ color: '#a8bed3', fontSize: 8, marginRight: 6, lineHeight: 1.7 }}>•</Text>
          <Text style={{ color: C.white, fontSize: 9, lineHeight: 1.7, flex: 1 }}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionSources({ sources, t }: { sources?: Source[] | null; t: TFn }) {
  if (!sources?.length) return null;
  return (
    <View style={{ marginTop: 14, paddingTop: 10, borderTop: `1 solid ${C.border}` }}>
      <Text style={{ fontSize: 8, fontWeight: 700, color: C.mid, marginBottom: 7, letterSpacing: 0.5 }}>{t('출처', 'Sources')}</Text>
      {sources.map((src, i) => {
        const idx = src.index ?? i + 1;
        const badgeCls = src.level === 'L1' ? s.srcBadgeL1 : src.level === 'L2' ? s.srcBadgeL2 : s.srcBadgeL3;
        const label = src.level === 'L1' ? t('공식', 'Official') : src.level === 'L2' ? t('참고', 'Reference') : t('추정', 'Estimated');
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
            <Text style={[s.srcBadge, badgeCls]}>{label}</Text>
            <Text style={{ fontSize: 8, color: C.mid, flex: 1, lineHeight: 1.6 }}>
              [{idx}] {src.organization}{src.date ? ` ${src.date}` : ''} — {src.content}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Cover Page ────────────────────────────────────────────────────────────────

function CoverPage({ data, shareUrl, language, t }: { data: AnalysisDetail; shareUrl?: string; language: Language; t: TFn }) {
  const v2 = data.summary_v2;
  const date = new Date(data.createdAt).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return (
    <View style={s.coverPage}>
      <Text style={s.coverLabel}>{t('기업 분석 보고서', 'Company Analysis Report')}</Text>
      <Text style={s.coverCompany}>{data.companyName}</Text>
      {v2?.ticker && (
        <Text style={s.coverSub}>{v2.ticker}</Text>
      )}
      {v2?.industry && (
        <Text style={s.coverSub}>{v2.industry}</Text>
      )}
      <View style={s.coverDivider} />
      {v2?.hq && <Text style={s.coverMeta}>{t('본사', 'HQ')}: {v2.hq}</Text>}
      {v2?.value_chain_position && (
        <Text style={s.coverMeta}>{t('밸류체인 위치', 'Value Chain Position')}: {v2.value_chain_position}</Text>
      )}
      <Text style={s.coverMeta}>{t('분석 일자', 'Analysis Date')}: {date}</Text>
      {data.purposeCategory && (
        <View style={{ marginTop: 10 }}>
          <Text style={[s.tag, { fontSize: 8, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' }]}>
            {t('분석 목적', 'Purpose')}: {purposeCategoryLabel(data.purposeCategory, t)}
          </Text>
          {data.purposeDetail && (
            <Text style={{ fontSize: 8, color: C.mid, marginTop: 4, lineHeight: 1.5, maxWidth: 380 }}>
              {sp(data.purposeDetail)}
            </Text>
          )}
        </View>
      )}
      {v2?.oneLiner && (
        <>
          <Divider />
          <Text style={[s.para, { marginTop: 4, fontSize: 9, color: C.mid }]}>{v2.oneLiner}</Text>
        </>
      )}
      {shareUrl && (
        <>
          <Divider />
          <Link src={shareUrl} style={s.webLink}>{t('웹에서 보기', 'View on web')} → {shareUrl}</Link>
        </>
      )}
    </View>
  );
}

// ── TOC Page ──────────────────────────────────────────────────────────────────

// id는 각 섹션의 SectionHeader에 넘기는 id와 매칭되는 내부 링크 목적지(#없는 형태).
// present는 실제 렌더링 조건(Document 본문의 `data.xxx_v2 &&`)과 반드시 동일하게 유지 —
// 안 그러면 목차에는 있는데 실제로는 없는 섹션으로 가는 죽은 링크가 생긴다.
// SourcesPage의 실제 렌더 여부 판정과 반드시 동일한 로직을 공유한다 — 이 함수 하나만
// TOC의 "11 출처 목록" present 체크와 SourcesPage의 조기 return(null) 양쪽에서 호출해,
// 두 곳이 각자 판정 로직을 따로 들고 있다가 어긋나는 사고(2026-08-16 발견 — 본문엔
// "11 출처 목록" 헤더가 실제로 뜨는데 TOC엔 항목 자체가 없던 버그)를 원천 차단한다.
function hasSourcesContent(
  sources: AnalysisSources | null | undefined,
  founderSources: Source[] | null | undefined,
  nudgeSources: Source[] | null | undefined,
): boolean {
  const hasGrouped = sources ? Object.values(sources).some(srcs => Array.isArray(srcs) && srcs.length > 0) : false;
  return hasGrouped || !!(founderSources?.length) || !!(nudgeSources?.length);
}

// 순서/번호는 웹의 sticky 그리드+스크롤 레이아웃(AnalysisCard.tsx)과 동일하게 맞춤
// (2026-08-16, 출처=진짜 최종 섹션으로 재조정) — 요약→밸류체인→비즈니스모델→
// 경쟁사→넛지→재무→전략→창업자→Pain Diagnosis→성장시나리오(프리미엄 전용,
// 있으면 여기)→출처(항상 스택 최후미).
function getTocItems(t: TFn): Array<{ num: number; id: string; title: string; present: (d: AnalysisDetail) => boolean }> {
  return [
    { num: 1,  id: 'sec-1',  title: t('기업 개요', 'Company Overview'),               present: d => !!d.summary_v2 },
    { num: 2,  id: 'sec-2',  title: t('밸류체인', 'Value Chain'),                     present: d => !!d.value_chain_v2 },
    { num: 3,  id: 'sec-3',  title: t('비즈니스 모델', 'Business Model'),             present: d => !!d.business_model_v2 },
    { num: 4,  id: 'sec-4',  title: t('경쟁사 분석', 'Competitor Analysis'),          present: d => !!d.competitors_v2 },
    { num: 5,  id: 'sec-5',  title: t('크로스인더스트리 넛지', 'Cross-Industry Nudge'), present: d => !!d.cross_industry_nudge_v1 },
    { num: 6,  id: 'sec-6',  title: t('재무 분석', 'Financial Analysis'),             present: d => !!d.financials_v2 },
    { num: 7,  id: 'sec-7',  title: t('전략 분석', 'Strategy Analysis'),              present: d => !!d.strategy_v2 },
    { num: 8,  id: 'sec-8',  title: t('창업자 분석', 'Founder Analysis'),             present: d => !!d.founder_v2 },
    { num: 9,  id: 'sec-9',  title: t('Pain Diagnosis (산업 역사 · 기술 진화)', 'Pain Diagnosis (Industry History · Tech Evolution)'), present: d => !!(d.industry_history_v2 || d.tech_evolution_v2) },
    { num: 10, id: 'sec-10', title: t('성장 시나리오', 'Growth Scenario'),            present: d => !!d.growth_scenario_v2 },
    { num: 11, id: 'sec-11', title: t('출처 목록', 'Sources'),                        present: d => hasSourcesContent(d.sources, d.founder_v2?.sources, d.cross_industry_nudge_v1?.sources) },
  ];
}

function TOCPage({ company, shareUrl, data, t }: { company: string; shareUrl?: string; data: AnalysisDetail; t: TFn }) {
  const items = getTocItems(t).filter(item => item.present(data));
  return (
    <Page size="A4" style={s.page}>
      <View style={s.section}>
        <View style={[s.sectionHeaderWrap, { marginBottom: 12 }]}>
          <Text style={s.sectionTitle}>{t('목차', 'Table of Contents')}</Text>
        </View>
        {items.map(item => (
          <Link key={item.id} src={`#${item.id}`} style={[s.tocItem, { textDecoration: 'none' }]}>
            <Text style={s.tocNum}>{String(item.num).padStart(2, '0')}</Text>
            <Text style={s.tocTitle}>{item.title}</Text>
          </Link>
        ))}
        {shareUrl && (
          <View style={{ marginTop: 20 }}>
            <Link src={shareUrl} style={s.webLink}>{t('웹에서 보기', 'View on web')} → {shareUrl}</Link>
          </View>
        )}
      </View>
      <PageFooter company={company} t={t} />
    </Page>
  );
}

// ── Section 1: 기업 개요 ─────────────────────────────────────────────────────

function SummarySection({ v, t }: { v: SummaryV2; t: TFn }) {
  return (
    <View style={s.section}>
      <SectionHeader num={1} title={t('기업 개요', 'Company Overview')} id="sec-1" />
      <KeyBulletsPdf bullets={v.key_bullets} />

      {/* Basic info */}
      <FieldRow label={t('기업명', 'Company')} value={v.company} />
      {v.ticker && <FieldRow label={t('티커', 'Ticker')} value={v.ticker} />}
      <FieldRow label={t('산업', 'Industry')} value={v.industry} />
      <FieldRow label={t('본사', 'HQ')} value={v.hq} />
      <FieldRow label={t('밸류체인 위치', 'Value Chain Position')} value={v.value_chain_position} />

      {/* Narrative */}
      {v.oneLiner && (
        <>
          <Divider />
          <Text style={s.para}>{v.oneLiner}</Text>
        </>
      )}

      <View style={s.grid2}>
        {/* Products */}
        {v.products?.length > 0 && (
          <View style={s.gridLeft}>
            <SubHeader>{t('주요 제품/서비스', 'Key Products/Services')}</SubHeader>
            {/* 매출 비중(%)은 여기서 더 이상 표시 안 함 — 재무 섹션의 "매출 구성"(revenue_lines,
                EDGAR 10-K 실측)만이 유일한 비중 출처. 이름+설명만 표시. */}
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.th, { flex: 2 }]}>{t('제품/서비스', 'Product/Service')}</Text>
                <Text style={[s.th, { flex: 3 }]}>{t('설명', 'Description')}</Text>
              </View>
              {v.products.map((p, i) => (
                <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                  <Text style={[s.td, { flex: 2 }]}>{p.name}</Text>
                  <Text style={[s.td, { flex: 3 }]}>{p.description || '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Key markets */}
        {v.key_markets?.length > 0 && (
          <View style={s.gridRight}>
            <SubHeader>{t('주요 시장', 'Key Markets')}</SubHeader>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.th, { flex: 2 }]}>{t('국가/지역', 'Country/Region')}</Text>
                <Text style={s.th}>{t('비중', 'Share')}</Text>
              </View>
              {v.key_markets.map((m, i) => (
                <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                  <Text style={[s.td, { flex: 2 }]}>{m.country}</Text>
                  <Text style={s.td}>{m.revenue_share}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Key metrics */}
      {v.key_metrics?.length > 0 && (
        <>
          <SubHeader>{t('핵심 지표', 'Key Metrics')}</SubHeader>
          <View style={s.metricRow}>
            {v.key_metrics.map((m, i) => (
              <View key={i} style={s.metric}>
                <Text style={s.metricLabel}>{m.label}</Text>
                <Text style={s.metricValue}>{m.value}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Top customers + concentration */}
      {(v.top_customers?.length > 0 || v.customer_concentration) && (
        <>
          <SubHeader>{t('주요 고객사', 'Key Customers')}</SubHeader>
          {v.top_customers?.length > 0 && (
            <Text style={[s.para, { marginBottom: 4 }]}>{v.top_customers.join(' · ')}</Text>
          )}
          {v.customer_concentration && (
            <View style={{ marginBottom: 6 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: v.customer_concentration.is_concentrated ? C.redBg : C.greenBg,
                borderRadius: 4, padding: 5, marginBottom: 5,
              }}>
                <Text style={{ fontSize: 7, color: v.customer_concentration.is_concentrated ? C.red : C.green }}>
                  {v.customer_concentration.is_concentrated ? '⚠' : '✓'} {t(
                    `상위 ${v.customer_concentration.top_n}개 고객 매출 ${v.customer_concentration.top_n_share}% 차지`,
                    `Top ${v.customer_concentration.top_n} customers account for ${v.customer_concentration.top_n_share}% of revenue`
                  )}
                  {v.customer_concentration.trend === 'diversifying' ? t(' — 다변화 진행 중', ' — diversifying') : v.customer_concentration.trend === 'concentrating' ? t(' — 집중도 심화', ' — concentration increasing') : ''}
                </Text>
              </View>
              {v.customer_concentration.customers.length > 0 && (
                <View style={s.table}>
                  <View style={s.tHead}>
                    <Text style={[s.th, { flex: 2 }]}>{t('고객사', 'Customer')}</Text>
                    <Text style={s.th}>{t('매출 비중', 'Revenue Share')}</Text>
                  </View>
                  {v.customer_concentration.customers.map((c, i) => (
                    <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                      <Text style={[s.td, { flex: 2 }]}>{c.name}</Text>
                      <Text style={s.td}>{c.revenue_share}%</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* Growth momentum / Key risks */}
      <View style={s.grid2}>
        {v.bull_case?.length > 0 && (
          <View style={[s.gridLeft, s.card, { borderLeftColor: C.green }]}>
            <Text style={s.cardTitle}>{t('성장 모멘텀', 'Growth Momentum')}</Text>
            {v.bull_case.map((b, i) => <Bullet key={i}>{sp(b)}</Bullet>)}
          </View>
        )}
        {v.bear_case?.length > 0 && (
          <View style={[s.gridRight, s.card, { borderLeftColor: C.red }]}>
            <Text style={s.cardTitle}>{t('핵심 리스크', 'Key Risks')}</Text>
            {v.bear_case.map((b, i) => <Bullet key={i}>{sp(b)}</Bullet>)}
          </View>
        )}
      </View>
      <SectionSources sources={v.sources} t={t} />
    </View>
  );
}

// ── Section 9: Pain Diagnosis (산업 역사 + 기술 진화 통합) ──────────────────────
// 2026-08-16 — 웹의 sticky 그리드+스크롤 레이아웃과 동일하게, 두 섹션을 amber 강조
// 박스 하나로 묶어 렌더링(구 별도 섹션 2/3 → 통합 섹션 9). 각 하위 파트는 자기
// 출처(SectionSources)를 그대로 유지 — 두 데이터가 서로 다른 Claude 호출 결과라
// 출처를 합치면 어느 쪽 근거인지 알 수 없어진다.

const HYPE_COLOR: Record<string, string> = {
  emerging:    C.blue,
  hype:        C.mid,
  trough:      C.red,
  recovery:    C.green,
  mainstream:  C.mid,
};

function IndustryHistoryContent({ v, t }: { v: IndustryHistoryV2; t: TFn }) {
  return (
    <View>
      <Text style={s.painSubTitle}>{t('산업 역사', 'Industry History')} — {v.industry_name}</Text>
      <KeyBulletsPdf bullets={v.key_bullets} />

      {v.why_durable?.length > 0 && (
        <>
          <SubHeader>{t('산업 내구성', 'Industry Durability')}</SubHeader>
          {v.why_durable.map((w, i) => <Bullet key={i}>{sp(w)}</Bullet>)}
        </>
      )}

      {v.chasm_points?.length > 0 && (
        <>
          <SubHeader>{t('핵심 변곡점', 'Key Inflection Points')}</SubHeader>
          {v.chasm_points.map((c, i) => <Bullet key={i}>{sp(c)}</Bullet>)}
        </>
      )}

      <SubHeader>{t('발전 타임라인', 'Development Timeline')}</SubHeader>
      {v.timeline?.map((tl, i) => (
        <View key={i} style={[s.card, { marginBottom: 5, backgroundColor: C.white }]}>
          <View style={[s.row, { marginBottom: 2 }]}>
            <Text style={[s.cardTitle, { marginBottom: 0, flex: 1 }]}>{sp(tl.period)} — {sp(tl.title)}</Text>
          </View>
          {tl.technology && <Text style={s.cardText}>{t('기술', 'Technology')}: {sp(tl.technology)}</Text>}
          {tl.market_need && <Text style={s.cardText}>{t('시장 니즈', 'Market Need')}: {sp(tl.market_need)}</Text>}
          {tl.significance && <Text style={[s.cardText, { marginTop: 2 }]}>{sp(tl.significance)}</Text>}
          {tl.key_players?.length > 0 && (
            <Text style={[s.cardText, { marginTop: 2, color: C.blue }]}>
              {t('주요 플레이어', 'Key Players')}: {tl.key_players.map(sp).join(', ')}
            </Text>
          )}
        </View>
      ))}
      <SectionSources sources={v.sources} t={t} />
    </View>
  );
}

function TechEvolutionContent({ v, t }: { v: TechEvolutionV2; t: TFn }) {
  return (
    <View>
      <Text style={s.painSubTitle}>{t('기술 진화', 'Tech Evolution')} — {v.tech_name}</Text>
      <KeyBulletsPdf bullets={v.key_bullets} />
      <LabelDetailField label={t('현재 단계', 'Current Stage')} item={v.current_stage} />
      <LabelDetailField label={t('다음 변곡점', 'Next Inflection')} item={v.next_inflection} />

      <SubHeader>{t('기술 발전 단계', 'Technology Development Stages')}</SubHeader>
      {v.stages?.map((st, i) => (
        <View key={i} style={[s.card, { borderLeftColor: HYPE_COLOR[st.hype_level] ?? C.blue, backgroundColor: C.white }]}>
          <View style={s.row}>
            <Text style={s.cardTitle}>
              {`Stage ${st.stage}  ${st.period}  ${st.title}`}
            </Text>
            <Text style={[s.tag, { marginLeft: 4, borderRadius: 3 }]}>{st.hype_level}</Text>
          </View>
          {st.description && <Text style={s.cardText}>{st.description}</Text>}
          {st.key_enablers?.length > 0 && (
            <Text style={[s.cardText, { marginTop: 2 }]}>
              {t('핵심 기술', 'Key Enablers')}: {st.key_enablers.join(', ')}
            </Text>
          )}
          {st.key_players?.length > 0 && (
            <Text style={[s.cardText, { color: C.blue }]}>
              {t('주요 플레이어', 'Key Players')}: {st.key_players.join(', ')}
            </Text>
          )}
        </View>
      ))}
      <SectionSources sources={v.sources} t={t} />
    </View>
  );
}

function PainDiagnosisSection({ industryHistory, techEvolution, t }: {
  industryHistory?: IndustryHistoryV2 | null;
  techEvolution?: TechEvolutionV2 | null;
  t: TFn;
}) {
  if (!industryHistory && !techEvolution) return null;
  return (
    <View style={s.section}>
      <SectionHeader num={9} title={t('Pain Diagnosis (산업 역사 · 기술 진화)', 'Pain Diagnosis (Industry History · Tech Evolution)')} id="sec-9" />
      <View style={s.painBox}>
        {industryHistory && <IndustryHistoryContent v={industryHistory} t={t} />}
        {industryHistory && techEvolution && <View style={s.painDivider} />}
        {techEvolution && <TechEvolutionContent v={techEvolution} t={t} />}
      </View>
    </View>
  );
}

// ── Section 4: 밸류체인 ──────────────────────────────────────────────────────

const POWER_COLOR = { high: C.green, medium: C.mid, low: C.red };

function ValueChainSection({ v, t }: { v: ValueChainV2; t: TFn }) {
  return (
    <View style={s.section}>
      <SectionHeader num={2} title={`${t('밸류체인', 'Value Chain')} — ${v.industry}`} id="sec-2" />
      <KeyBulletsPdf bullets={v.key_bullets} />
      {v.value_flow?.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={s.cardTitle}>{t('가치 흐름', 'Value Flow')}</Text>
          {v.value_flow.map((b, i) => <Bullet key={i}>{sp(b)}</Bullet>)}
        </View>
      )}
      {v.subject_position?.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={s.cardTitle}>{t('분석 기업 위치', 'Subject Company Position')}</Text>
          {v.subject_position.map((b, i) => <Bullet key={i}>{sp(b)}</Bullet>)}
        </View>
      )}

      <SubHeader>{t('레이어 구조', 'Layer Structure')}</SubHeader>
      {v.layers?.map((layer, i) => (
        <View key={i} style={[
          s.card,
          layer.is_subject ? { borderLeftColor: C.blue }
            : layer.buyer   ? { borderLeftColor: C.green, backgroundColor: C.greenBg }
            : { borderLeftColor: C.border },
        ]}>
          <View style={s.row}>
            <Text style={s.cardTitle}>{layer.name}</Text>
            {layer.is_subject && (
              <Text style={[s.tag, { marginLeft: 4, backgroundColor: C.blue, color: C.white }]}>
                {t('분석 기업', 'Subject Company')}
              </Text>
            )}
            {layer.bottleneck && (
              <Text style={[s.tag, { marginLeft: 4, backgroundColor: C.redBg, color: C.red }]}>
                {t('병목', 'Bottleneck')}
              </Text>
            )}
            {layer.buyer
              ? <Text style={[s.tag, { marginLeft: 4, backgroundColor: C.blueLight, color: C.blue }]}>{t('구매자', 'Buyer')}</Text>
              : layer.pricing_power
                ? <Text style={[s.tag, { marginLeft: 4, color: POWER_COLOR[layer.pricing_power], backgroundColor: C.bg }]}>
                    {t('가격협상력', 'Pricing Power')} {layer.pricing_power}
                  </Text>
                : null
            }
          </View>
          {layer.description && <Text style={s.cardText}>{layer.description}</Text>}
          {layer.global_leaders?.length > 0 && (
            <Text style={[s.cardText, { marginTop: 2, color: C.blue }]}>
              {t('글로벌 리더', 'Global Leaders')}: {layer.global_leaders.map(l => `${l.name}(${l.country})`).join(', ')}
            </Text>
          )}
        </View>
      ))}
      <SectionSources sources={v.sources} t={t} />
    </View>
  );
}

// ── Section 5: 비즈니스 모델 ─────────────────────────────────────────────────

function BusinessModelSection({ v, t }: { v: BusinessModelV2; t: TFn }) {
  return (
    <View style={s.section}>
      <SectionHeader num={3} title={t('비즈니스 모델', 'Business Model')} id="sec-3" />
      <KeyBulletsPdf bullets={v.key_bullets} />

      <FieldRow label={t('성장 모션', 'Growth Motion')} value={v.growth_motion} />
      {v.growth_motion_detail && <Text style={[s.para, { marginTop: 2 }]}>{v.growth_motion_detail}</Text>}

      {/* Unit economics */}
      <SubHeader>{t('유닛 이코노믹스', 'Unit Economics')}</SubHeader>
      <View style={s.finGrid}>
        {[
          { label: t('매출총이익률', 'Gross Margin'), val: pdfVal(v.unit_economics.gross_margin) !== '—' ? `${v.unit_economics.gross_margin}%` : '—' },
          { label: t('영업이익률', 'Operating Margin'),   val: pdfVal(v.unit_economics.operating_margin) !== '—' ? `${v.unit_economics.operating_margin}%` : '—' },
          { label: t('순이익률', 'Net Margin'),     val: pdfVal(v.unit_economics.net_margin) !== '—' ? `${v.unit_economics.net_margin}%` : '—' },
          { label: t('FCF 마진', 'FCF Margin'),     val: pdfVal(v.unit_economics.fcf_margin) !== '—' ? `${v.unit_economics.fcf_margin}%` : '—' },
          { label: 'NRR',         val: pdfVal(v.unit_economics.nrr) !== '—' ? `${v.unit_economics.nrr}%` : '—' },
        ].filter(m => m.val !== '—' && m.val !== '0%').map(({ label, val }, i) => (
          <View key={i} style={s.finChip}>
            <Text style={s.finChipLabel}>{label}</Text>
            <Text style={s.finChipValue}>{val}</Text>
          </View>
        ))}
      </View>

      {/* Revenue streams — 매출 비중(%)은 여기서 더 이상 표시 안 함(재무 섹션의 "매출 구성"만이
          유일한 비중 출처, 2026-08-15). operating_margin/growth_rate는 그대로 유지. */}
      {v.revenue_streams?.length > 0 && (
        <>
          <SubHeader>{t('수익 구조', 'Revenue Streams')}</SubHeader>
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, { flex: 2 }]}>{t('스트림', 'Stream')}</Text>
              <Text style={s.th}>{t('유형', 'Type')}</Text>
              <Text style={s.th}>{t('영업이익률', 'Op. Margin')}</Text>
              <Text style={s.th}>{t('성장률', 'Growth')}</Text>
            </View>
            {v.revenue_streams.map((r, i) => (
              <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                <View style={{ flex: 2 }}>
                  <Text style={s.td}>{r.name}</Text>
                  {r.description && <Text style={[s.td, { color: C.mid }]}>{r.description}</Text>}
                </View>
                <Text style={s.td}>{r.type}</Text>
                <Text style={s.td}>{pdfVal(r.operating_margin) !== '—' && r.operating_margin !== 0 ? `${r.operating_margin}%` : '—'}</Text>
                <Text style={s.td}>{pdfVal(r.growth_rate) !== '—' && r.growth_rate !== 0 ? `${r.growth_rate}%` : '—'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Moat */}
      {v.moat?.length > 0 && (
        <>
          <SubHeader>{t('경쟁 해자', 'Moat')}</SubHeader>
          {v.moat.map((m, i) => (
            <View key={i} style={[s.card, {
              borderLeftColor: m.strength === 'strong' ? C.green : m.strength === 'medium' ? C.mid : C.red,
            }]}>
              <Text style={s.cardTitle}>{m.type}  <Text style={{ fontWeight: 400, color: C.mid }}>{m.strength}</Text></Text>
              <Text style={s.cardText}>{m.description}</Text>
            </View>
          ))}
        </>
      )}
      <SectionSources sources={v.sources} t={t} />
    </View>
  );
}

// ── Section 6: 경쟁사 분석 ──────────────────────────────────────────────────

function CompetitorsSection({ v, t }: { v: CompetitorsV2; t: TFn }) {
  return (
    <View style={s.section}>
      <SectionHeader num={4} title={t('경쟁사 분석', 'Competitor Analysis')} id="sec-4" />
      <KeyBulletsPdf bullets={v.key_bullets} />
      <FieldRow label={t('경쟁 포지션', 'Competitive Position')} value={v.competitive_position} />

      {/* Direct competitors */}
      {v.direct?.length > 0 && (
        <>
          <SubHeader>{t('직접 경쟁사', 'Direct Competitors')}</SubHeader>
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, { flex: 1.5 }]}>{t('기업', 'Company')}</Text>
              <Text style={s.th}>{t('국가', 'Country')}</Text>
              <Text style={s.th}>{t('시장점유율', 'Market Share')}</Text>
              <Text style={[s.th, { flex: 2 }]}>{t('vs 분석 기업', 'vs Subject')}</Text>
            </View>
            {v.direct.map((c, i) => (
              <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                <Text style={[s.td, { flex: 1.5 }]}>{c.name}</Text>
                <Text style={s.td}>{c.country}</Text>
                <Text style={s.td}>{c.market_share}</Text>
                <Text style={[s.td, { flex: 2 }]}>{c.vs_subject}</Text>
              </View>
            ))}
          </View>
          {/* Strengths / Weaknesses for each competitor */}
          {v.direct.map((c, i) => (
            <View key={i} style={[s.card, { marginBottom: 4 }]}>
              <Text style={s.cardTitle}>{c.name}</Text>
              {c.strengths?.length > 0 && (
                <Text style={s.cardText}>
                  {t('강점', 'Strengths')}: {c.strengths.join(' / ')}
                </Text>
              )}
              {c.weaknesses?.length > 0 && (
                <Text style={s.cardText}>
                  {t('약점', 'Weaknesses')}: {c.weaknesses.join(' / ')}
                </Text>
              )}
            </View>
          ))}
        </>
      )}

      <View style={s.grid2}>
        {/* Indirect */}
        {v.indirect?.length > 0 && (
          <View style={s.gridLeft}>
            <SubHeader>{t('간접 경쟁사', 'Indirect Competitors')}</SubHeader>
            {v.indirect.map((c, i) => (
              <View key={i} style={[s.card, { borderLeftColor: C.mid }]}>
                <Text style={s.cardTitle}>{c.name}</Text>
                <Text style={s.cardText}>{c.threat}</Text>
              </View>
            ))}
          </View>
        )}
        {/* Substitutes */}
        {v.substitutes?.length > 0 && (
          <View style={s.gridRight}>
            <SubHeader>{t('대체재', 'Substitutes')}</SubHeader>
            {v.substitutes.map((c, i) => (
              <View key={i} style={[s.card, { borderLeftColor: C.red }]}>
                <Text style={s.cardTitle}>{c.name}</Text>
                <Text style={s.cardText}>{c.threat}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <SectionSources sources={v.sources} t={t} />
    </View>
  );
}

// ── Section 5: 크로스인더스트리 넛지 (Pain Diagnosis) ───────────────────────────
// 2026-08-16 신규 — 웹 리포트엔 정식 섹션으로 있었으나 PDF에 완전히 누락돼 있던
// cross_industry_nudge_v1을 추가. financial_impact_question은 프롬프트 규칙상 항상
// 질문형(숫자 단정 금지)이라 그대로 텍스트로 노출.

function CrossIndustryNudgeSection({ v, t }: { v: CrossIndustryNudgeV1; t: TFn }) {
  return (
    <View style={s.section}>
      <SectionHeader num={5} title={t('크로스인더스트리 넛지', 'Cross-Industry Nudge')} id="sec-5" />
      <KeyBulletsPdf bullets={v.key_bullets} />

      {v.industry_pain && (
        <View style={[s.card, { borderLeftColor: C.blue, marginBottom: 8 }]}>
          <Text style={s.cardTitle}>{v.industry_pain.title}</Text>
          {v.industry_pain.description?.map((d, i) => (
            <Text key={i} style={[s.cardText, { marginTop: i === 0 ? 4 : 2 }]}>{sp(d)}</Text>
          ))}
          {v.industry_pain.financial_impact_question && (
            <Text style={[s.cardText, { marginTop: 6, fontWeight: 700, color: C.dark }]}>
              {sp(v.industry_pain.financial_impact_question)}
            </Text>
          )}
        </View>
      )}

      {/* 2026-08-17 신규 — 위 산업 문제와 아래 타산업 사례를 잇는 연결 인사이트(관찰
          기록: "사례가 뜬금없이 튀어나온 것처럼 보인다"는 지적 계기). 옛 캐시 데이터는
          필드 자체가 없을 수 있어 조건부 렌더링. */}
      {v.connection_insight && (
        <View style={{ backgroundColor: C.bg, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8, borderLeft: `2 solid ${C.light}` }}>
          <Text style={{ fontSize: 7, fontWeight: 700, color: C.light, letterSpacing: 0.5, marginBottom: 2 }}>
            {t('연결고리', 'THE CONNECTION')}
          </Text>
          <Text style={{ fontSize: 8.5, color: C.mid, lineHeight: 1.5, fontStyle: 'italic' }}>
            {sp(v.connection_insight)}
          </Text>
        </View>
      )}

      {v.cross_industry_example && (
        <View style={[s.card, { borderLeftColor: C.green }]}>
          <Text style={s.cardTitle}>
            {v.cross_industry_example.source_industry} — {v.cross_industry_example.case_name}
          </Text>
          <Text style={s.cardText}>{sp(v.cross_industry_example.solution_description)}</Text>
        </View>
      )}
      <SectionSources sources={v.sources} t={t} />
    </View>
  );
}

// ── Section 7: 전략 분석 ─────────────────────────────────────────────────────

function StrategySection({ v, t }: { v: StrategyV2; t: TFn }) {
  type StratItem = { label: string; value: string };
  const pdfSections: { title: string; direction: string; items: StratItem[] }[] = [
    {
      title: t('기업 전략 (Corporate)', 'Corporate Strategy'),
      direction: v.corporate.direction ?? '',
      items: [
        v.corporate.portfolio            ? { label: t('포트폴리오', 'Portfolio'),    value: v.corporate.portfolio } : null,
        v.corporate.ma_partnerships?.length ? { label: t('M&A/파트너십', 'M&A/Partnerships'), value: v.corporate.ma_partnerships.join(', ') } : null,
        v.corporate.geographic           ? { label: t('지역 확장', 'Geographic Expansion'),    value: v.corporate.geographic } : null,
      ].filter(Boolean) as StratItem[],
    },
    {
      title: t('사업 전략 (Business)', 'Business Strategy'),
      direction: v.business.direction ?? '',
      items: [
        v.business.competitive_advantage ? { label: t('경쟁 우위', 'Competitive Advantage'),      value: v.business.competitive_advantage } : null,
        v.business.go_to_market          ? { label: 'GTM',            value: v.business.go_to_market } : null,
        v.business.product_roadmap?.length ? { label: t('로드맵', 'Roadmap'),       value: v.business.product_roadmap.join(', ') } : null,
      ].filter(Boolean) as StratItem[],
    },
    {
      title: t('재무 전략 (Financial)', 'Financial Strategy'),
      direction: v.financial.direction ?? '',
      items: [
        v.financial.capital_allocation   ? { label: t('자본 배분', 'Capital Allocation'),      value: v.financial.capital_allocation } : null,
        v.financial.investment_priority   ? { label: t('투자 우선순위', 'Investment Priority'),  value: v.financial.investment_priority } : null,
        v.financial.return_target         ? { label: t('목표 수익성', 'Return Target'),   value: v.financial.return_target } : null,
      ].filter(Boolean) as StratItem[],
    },
  ];

  const hasAny = pdfSections.some(sec => sec.direction || sec.items.length > 0);
  if (!hasAny && !v.strategy_coherence && !v.ten_year_durability?.length) return null;

  return (
    <View style={s.section}>
      <SectionHeader num={7} title={t('전략 분석', 'Strategy Analysis')} id="sec-7" />
      <KeyBulletsPdf bullets={v.key_bullets} />

      {pdfSections.map((sec, i) => (sec.direction || sec.items.length > 0) && (
        <View key={i} style={[s.card, { marginBottom: 5 }]}>
          <Text style={s.cardTitle}>{sec.title}</Text>
          {sec.direction ? <Text style={[s.cardText, { marginTop: 2 }]}>{sec.direction}</Text> : null}
          {sec.items.map((item, j) => (
            <Text key={j} style={[s.cardText, { marginTop: 3 }]}>• {item.label}: {item.value}</Text>
          ))}
        </View>
      ))}

      {v.strategy_coherence && (
        <>
          <SubHeader>{t('전략 수렴', 'Strategic Coherence')}</SubHeader>
          <Text style={s.para}>{v.strategy_coherence}</Text>
        </>
      )}
      {v.ten_year_durability?.length > 0 && (
        <>
          <SubHeader>{t('10년 지속 가능성', '10-Year Durability')}</SubHeader>
          {v.ten_year_durability.map((b, i) => <Bullet key={i}>{sp(b)}</Bullet>)}
        </>
      )}
      <SectionSources sources={v.sources} t={t} />
    </View>
  );
}

// ── Section 8: 재무 분석 ─────────────────────────────────────────────────────

function IncomeTable({ rows, t }: { rows: FinancialsV2Row[]; t: TFn }) {
  if (!rows?.length) return null;
  // 회사마다 실제로 보유한 회계연도만 컬럼으로 렌더링 — 전 행의 fy{year} 키를 합쳐서 판단
  // (특정 행 하나만 보면 그 항목이 구조적으로 없는 회사인 경우 컬럼 자체가 누락될 수 있음).
  const years = Array.from(new Set(rows.flatMap(getFinancialYearCols))).sort();
  const hasYoy = rows.some(r => r.yoy);

  return (
    <View style={s.table}>
      <View style={s.tHead}>
        <Text style={s.thItem}>{t('항목', 'Item')}</Text>
        {years.map(y => (
          <Text key={y} style={s.th}>{y.replace('fy', 'FY').toUpperCase()}</Text>
        ))}
        {hasYoy && <Text style={s.th}>YoY</Text>}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
          <Text style={s.tdItem}>{r.item}</Text>
          {years.map(y => (
            <Text key={y} style={s.td}>{pdfVal(r[y])}</Text>
          ))}
          {hasYoy && <Text style={s.td}>{sp(pdfVal(r.yoy))}</Text>}
        </View>
      ))}
    </View>
  );
}

function BSTable({ rows, t }: { rows: FinancialsV2BSRow[]; t: TFn }) {
  if (!rows?.length) return null;
  const years = Array.from(new Set(rows.flatMap(getFinancialYearCols))).sort();

  return (
    <View style={s.table}>
      <View style={s.tHead}>
        <Text style={s.thItem}>{t('항목', 'Item')}</Text>
        {years.map(y => (
          <Text key={y} style={s.th}>{y.replace('fy', 'FY').toUpperCase()}</Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
          <Text style={s.tdItem}>{r.item}</Text>
          {years.map(y => (
            <Text key={y} style={s.td}>{pdfVal(r[y])}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function FinancialsSection({ v, t, dataSource }: { v: FinancialsV2; t: TFn; dataSource?: DataSource }) {
  const { estimatedCount, unknownCount } = countFinancialsReliability(v);
  return (
    <View style={s.section}>
      <SectionHeader num={6} title={t('재무 분석', 'Financial Analysis')} id="sec-6" />
      <KeyBulletsPdf bullets={v.key_bullets} />

      {(estimatedCount > 0 || unknownCount > 0) && (
        <View style={s.reliabilityBanner}>
          <Text style={s.reliabilityBannerText}>
            {sp(t(
              `이 리포트에는 추정값 ${estimatedCount}건, 확인 필요 데이터 ${unknownCount}건이 포함되어 있습니다`,
              `This report includes ${estimatedCount} estimated value(s) and ${unknownCount} not-disclosed data point(s)`
            ))}
          </Text>
        </View>
      )}

      {/* Income statement */}
      <SubHeader>{t('손익계산서', 'Income Statement')}</SubHeader>
      <IncomeTable rows={v.income_statement} t={t} />

      {/* 매출 구성 — 회사가 실제 10-K에서 라인 구분해 공시한 경우만(서버가 R.htm에서 직접
          파싱, Claude 미생성). 라인 구분이 없는 회사는 v.revenue_lines가 undefined라 섹션째
          스킵된다. */}
      {v.revenue_lines && v.revenue_lines.length > 0 && (
        <>
          <SubHeader>{t('매출 구성', 'Revenue Mix')}</SubHeader>
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={s.thItem}>{t('항목', 'Item')}</Text>
              <Text style={s.th}>{t('금액', 'Value')}</Text>
              <Text style={s.th}>{t('비중', 'Share')}</Text>
            </View>
            {v.revenue_lines.map((rl, i) => (
              <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                <Text style={s.tdItem}>{rl.label}</Text>
                <Text style={s.td}>{rl.value}</Text>
                <Text style={s.td}>{rl.sharePct}%</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Balance sheet */}
      <SubHeader>{t('재무상태표', 'Balance Sheet')}</SubHeader>
      <BSTable rows={v.balance_sheet} t={t} />

      {/* Cash flow — 4개 지표가 전부 placeholder면 SubHeader만 뜨고 빈 그리드가 남던
          표시상 버그 수정(2026-08-16). DART 소스 기업은 현재 파이프라인이 쓰는 요약
          재무제표 엔드포인트에 현금흐름표 자체가 없어 구조적으로 항상 비어있다(백엔드
          신규 수집은 별도 백로그) — "확인 필요"가 아니라 "애초에 이 데이터가 없다"는
          걸 명확히 구분해 보여준다. */}
      {v.cash_flow && (() => {
        const cfMetrics = [
          { label: t('영업활동', 'Operating'),    val: v.cash_flow.operating },
          { label: t('투자활동', 'Investing'),    val: v.cash_flow.investing },
          { label: t('재무활동', 'Financing'),    val: v.cash_flow.financing },
          { label: 'FCF',        val: v.cash_flow.fcf },
        ].filter(m => pdfVal(m.val) !== '—');
        return (
          <>
            <SubHeader>{t('현금흐름', 'Cash Flow')}</SubHeader>
            {cfMetrics.length > 0 ? (
              <View style={s.finGrid}>
                {cfMetrics.map(({ label, val }, i) => (
                  <View key={i} style={s.finChip}>
                    <Text style={s.finChipLabel}>{label}</Text>
                    <Text style={s.finChipValue}>{pdfVal(val)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[s.cardText, { color: C.light, marginBottom: 6 }]}>
                {dataSource === 'dart'
                  ? t(
                      '현금흐름 데이터 없음 — DART 요약 재무제표는 현금흐름표를 포함하지 않습니다.',
                      'No cash flow data available — DART summary financial statements do not include a cash flow statement.'
                    )
                  : t('현금흐름 데이터 없음', 'No cash flow data available')}
              </Text>
            )}
            {v.cash_flow.notes && (
              <Text style={[s.cardText, { color: C.mid, marginBottom: 6 }]}>{v.cash_flow.notes}</Text>
            )}
          </>
        );
      })()}

      {/* Key risks */}
      {v.key_risks?.length > 0 && (
        <>
          <SubHeader>{t('핵심 리스크', 'Key Risks')}</SubHeader>
          {v.key_risks.map((r, i) => <Bullet key={i}>{r}</Bullet>)}
        </>
      )}

      {/* Outlook */}
      {v.outlook && (
        <>
          <SubHeader>{t('전망', 'Outlook')}</SubHeader>
          <View style={s.grid2}>
            {v.outlook.shortTerm && (
              <View style={s.gridLeft}>
                <View style={s.card}>
                  <Text style={s.cardTitle}>{t('단기 전망', 'Short-Term Outlook')}</Text>
                  <Text style={s.cardText}>{sp(v.outlook.shortTerm)}</Text>
                </View>
              </View>
            )}
            {v.outlook.midLongTerm && (
              <View style={s.gridRight}>
                <View style={s.card}>
                  <Text style={s.cardTitle}>{t('중장기 전망', 'Mid/Long-Term Outlook')}</Text>
                  <Text style={s.cardText}>{sp(v.outlook.midLongTerm)}</Text>
                </View>
              </View>
            )}
          </View>
          {v.outlook.keyRisks?.length > 0 && (
            <>
              <SubHeader>{t('전망 리스크', 'Outlook Risks')}</SubHeader>
              {v.outlook.keyRisks.map((r, i) => <Bullet key={i}>{r}</Bullet>)}
            </>
          )}
        </>
      )}
      <SectionSources sources={v.sources} t={t} />
    </View>
  );
}

// ── Section 9: 창업자 분석 ────────────────────────────────────────────────────

function FounderSection({ v, t }: { v: FounderV2; t: TFn }) {
  const isSerial = v.founding_history.type === 'serial';
  return (
    <View style={s.section}>
      <SectionHeader num={8} title={t('창업자 분석', 'Founder Analysis')} id="sec-8" />
      <KeyBulletsPdf bullets={v.key_bullets} />

      {/* Founder profiles */}
      {v.founders.length > 0 && (
        <>
          <SubHeader>{t('창업자 기본 정보', 'Founder Profile')}</SubHeader>
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, { flex: 1.5 }]}>{t('이름', 'Name')}</Text>
              <Text style={s.th}>{t('직함', 'Title')}</Text>
              <Text style={[s.th, { flex: 2 }]}>{t('학교', 'School')}</Text>
              <Text style={s.th}>{t('전공', 'Major')}</Text>
            </View>
            {v.founders.map((fd, i) => (
              <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                <Text style={[s.td, { flex: 1.5 }]}>{fd.name}</Text>
                <Text style={s.td}>{fd.title && fd.title !== '-' ? fd.title : '—'}</Text>
                <Text style={[s.td, { flex: 2 }]}>{fd.education && fd.education !== '-' ? fd.education : '—'}</Text>
                <Text style={s.td}>{fd.major && fd.major !== '-' ? fd.major : '—'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Career trajectory */}
      {v.career_trajectory.length > 0 && (
        <>
          <SubHeader>{t('커리어 궤적', 'Career Trajectory')}</SubHeader>
          {[...v.career_trajectory]
            .sort((a, b) => {
              const yr = (s: string) => parseInt(s.match(/\d{4}/)?.[0] ?? '9999', 10);
              return yr(a.period) - yr(b.period);
            })
            .map((ct, i) => (
            <View key={i} style={[s.row, { marginBottom: 4, paddingBottom: 4, borderBottom: `1 solid ${C.border}` }]}>
              <Text style={[s.label, { width: 80 }]}>{ct.period}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.value, { fontWeight: 700, marginBottom: 2 }]}>{ct.company}</Text>
                <Text style={[s.value, { color: C.mid }]}>{ct.role}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Founding history */}
      <SubHeader>{t('창업 이력', 'Founding History')}</SubHeader>
      <View style={[s.tagsRow, { marginBottom: 4 }]}>
        <Text style={[s.tag, {
          backgroundColor: isSerial ? C.blueLight : C.bg,
          color: isSerial ? C.blue : C.mid,
        }]}>
          {isSerial ? 'Serial Founder' : '1st Time Founder'}
        </Text>
      </View>
      {v.founding_history.previous_ventures.length > 0 ? (
        <View style={s.table}>
          <View style={s.tHead}>
            <Text style={[s.th, { flex: 2 }]}>{t('기업명', 'Company')}</Text>
            <Text style={s.th}>{t('결과', 'Outcome')}</Text>
            <Text style={s.th}>{t('엑싯 유형', 'Exit Type')}</Text>
          </View>
          {v.founding_history.previous_ventures.map((pv, i) => (
            <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
              <Text style={[s.td, { flex: 2 }]}>{pv.name}</Text>
              <Text style={s.td}>{pv.result}</Text>
              <Text style={s.td}>{pv.exit_type ?? '—'}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[s.para, { color: C.light }]}>{t('이전 창업 이력 없음', 'No previous founding history')}</Text>
      )}

      {/* Reputation */}
      {(v.reputation.sns_style !== '-' || v.reputation.media_exposure !== '-' || v.reputation.blind_glassdoor !== '-') && (
        <>
          <SubHeader>{t('평판 & 퍼블릭 시그널', 'Reputation & Public Signals')}</SubHeader>
          {v.reputation.sns_style !== '-' && (
            <View style={[s.row, { marginBottom: 6 }]}>
              <Text style={s.label}>{t('SNS 스타일', 'Social Media Style')}</Text>
              <Text style={[s.value, { lineHeight: 1.5 }]}>{v.reputation.sns_style}</Text>
            </View>
          )}
          {v.reputation.media_exposure !== '-' && (
            <View style={[s.row, { marginBottom: 6 }]}>
              <Text style={s.label}>{t('미디어 노출', 'Media Exposure')}</Text>
              <Text style={[s.value, { lineHeight: 1.5 }]}>{v.reputation.media_exposure}</Text>
            </View>
          )}
          {v.reputation.blind_glassdoor !== '-' && (
            <View style={[s.row, { marginBottom: 6 }]}>
              <Text style={s.label}>Blind/GD</Text>
              <Text style={[s.value, { lineHeight: 1.5 }]}>{v.reputation.blind_glassdoor}</Text>
            </View>
          )}
        </>
      )}

      {/* Network */}
      {(v.network.investors.length > 0 || v.network.advisors_board.length > 0 || v.network.cofounders.length > 0) && (
        <>
          <SubHeader>{t('네트워크', 'Network')}</SubHeader>
          {v.network.cofounders.length > 0 && (
            <View style={[s.row, { marginBottom: 6 }]}>
              <Text style={s.label}>{t('공동창업팀', 'Co-founders')}</Text>
              <Text style={[s.value, { lineHeight: 1.5 }]}>{v.network.cofounders.join(' · ')}</Text>
            </View>
          )}
          {v.network.investors.length > 0 && (
            <View style={[s.row, { marginBottom: 6 }]}>
              <Text style={s.label}>{t('투자자', 'Investors')}</Text>
              <Text style={[s.value, { lineHeight: 1.5 }]}>{v.network.investors.join(' · ')}</Text>
            </View>
          )}
          {v.network.advisors_board.length > 0 && (
            <View style={[s.row, { marginBottom: 6 }]}>
              <Text style={s.label}>{t('어드바이저/보드', 'Advisors/Board')}</Text>
              <Text style={[s.value, { lineHeight: 1.5 }]}>{v.network.advisors_board.join(' · ')}</Text>
            </View>
          )}
        </>
      )}

      <SectionSources sources={v.sources} t={t} />
    </View>
  );
}

// ── Section 10: 성장 시나리오 ─────────────────────────────────────────────────
// 프리미엄 필터링은 서버 응답 조립 단계에서 이미 끝난 상태로 넘어옴(growth_scenario_v2가
// null이면 이 섹션 자체를 렌더링 안 함) — 여기서 별도 isPremium 체크 불필요.
// CAGR 배지 + 라인차트는 웹 GrowthScenarioV2Tab과 동일한 숫자를 보여줘야 하므로
// calcCagr/fmtGrowthRevenue를 client/src/lib/growthScenario.ts에서 그대로 import해
// 쓴다(2026-08-16, 재구현 금지 — 연도별 표는 그대로 유지하되 차트/CAGR/최종연도 강조를
// 추가). react-pdf엔 recharts 같은 차트 라이브러리가 없어 @react-pdf/renderer의
// Svg/Polyline/Circle로 직접 그린다.

function getScenarioRowLabel(t: TFn): Record<'p10' | 'p50' | 'p90', string> {
  return {
    p10: t('보수적', 'Conservative'),
    p50: t('예상', 'Expected'),
    p90: t('낙관적', 'Optimistic'),
  };
}

// P10/P90(범위) 라인 색상 — C.blue(navy, P50 실선)의 라이트 톤. 웹은 recharts 하드코딩
// hex(#93c5fd)를 쓰지만 PDF는 3색 체계의 navy 계열로 통일(다른 섹션과 동일 원칙).
const CHART_RANGE_COLOR = '#8fa8c2';

function GrowthScenarioChart({
  g, rowLabel, t,
}: { g: GrowthScenarioV2; rowLabel: Record<'p10' | 'p50' | 'p90', string>; t: TFn }) {
  const { p10, p50, p90 } = g.simulation;
  const n = p50.length;
  if (n < 2) return null;

  const W = 470;
  const H = 100;
  const padY = 10;
  const plotH = H - padY * 2;

  const allVals = [...p10, ...p50, ...p90];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = maxVal - minVal || Math.abs(maxVal) || 1;

  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => padY + (1 - (v - minVal) / range) * plotH;
  const toPoints = (vals: number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  return (
    <View style={s.chartWrap}>
      <View style={{ position: 'relative' }}>
        <Text style={[s.chartAxisLabel, { position: 'absolute', top: 0, right: 0 }]}>
          {fmtGrowthRevenue(maxVal, g.currency)}
        </Text>
        <Text style={[s.chartAxisLabel, { position: 'absolute', bottom: 0, right: 0 }]}>
          {fmtGrowthRevenue(minVal, g.currency)}
        </Text>
        <Svg width={W} height={H}>
          <Polyline points={toPoints(p90)} stroke={CHART_RANGE_COLOR} strokeWidth={1} strokeDasharray="3,2" fill="none" />
          <Polyline points={toPoints(p10)} stroke={CHART_RANGE_COLOR} strokeWidth={1} strokeDasharray="3,2" fill="none" />
          <Polyline points={toPoints(p50)} stroke={C.blue} strokeWidth={2} fill="none" />
          {p90.map((v, i) => <Circle key={`p90-${i}`} cx={x(i)} cy={y(v)} r={1.6} fill={CHART_RANGE_COLOR} />)}
          {p10.map((v, i) => <Circle key={`p10-${i}`} cx={x(i)} cy={y(v)} r={1.6} fill={CHART_RANGE_COLOR} />)}
          {p50.map((v, i) => <Circle key={`p50-${i}`} cx={x(i)} cy={y(v)} r={2.6} fill={C.blue} />)}
        </Svg>
      </View>
      <View style={s.chartAxisRow}>
        {Array.from({ length: n }, (_, i) => (
          <Text key={i} style={s.chartAxisLabel}>Year+{i + 1}</Text>
        ))}
      </View>
      <View style={s.chartLegendRow}>
        <View style={[s.chartLegendDot, { backgroundColor: C.blue }]} />
        <Text style={s.chartLegendLabel}>{rowLabel.p50}(P50)</Text>
        <View style={[s.chartLegendDot, { backgroundColor: CHART_RANGE_COLOR }]} />
        <Text style={s.chartLegendLabel}>
          {rowLabel.p10}~{rowLabel.p90} {t('범위', 'range')}
        </Text>
      </View>
    </View>
  );
}

function GrowthScenarioSection({ g, t }: { g: GrowthScenarioV2; t: TFn }) {
  const isHigh = g.confidenceLevel === 'high';
  const sampleLabel = 'sampleSize' in g.stats
    ? t(`${g.sectorTag ?? '섹터'} 동종업계 벤치마크 ${g.stats.sampleSize}개사`, `${g.sectorTag ?? 'Sector'} peer benchmark, n=${g.stats.sampleSize}`)
    : t(`자체 공식 재무 시계열 ${g.stats.dataPoints + 1}개년`, `${g.stats.dataPoints + 1}yr own official financial history`);
  const years = g.simulation.p50.length;
  const rowLabel = getScenarioRowLabel(t);
  const cagr = {
    p10: calcCagr(g.simulation.p10),
    p50: calcCagr(g.simulation.p50),
    p90: calcCagr(g.simulation.p90),
  };
  const finalYearRevenue = g.simulation.p50[years - 1];

  return (
    <View style={s.section}>
      <SectionHeader num={10} title={t('성장 시나리오', 'Growth Scenario')} id="sec-10" />

      <View style={s.tagsRow}>
        <Text style={[s.tag, {
          backgroundColor: isHigh ? C.greenBg : C.redBg,
          color: isHigh ? C.green : C.red,
        }]}>
          {isHigh ? t('높은 신뢰도', 'High Confidence') : t('낮은 신뢰도', 'Low Confidence')} · {sampleLabel}
        </Text>
      </View>

      <Text style={s.para}>
        {g.narrative ?? t('몬테카를로 시뮬레이션(1만회) 기반 매출 성장 시나리오입니다.', 'A revenue growth scenario based on a Monte Carlo simulation (10,000 runs).')}
      </Text>
      {!isHigh && (
        <Text style={[s.para, { color: C.mid, fontSize: 7 }]}>
          {t(
            '※ 자체 재무 시계열이 부족해 업종 벤치마크로 추정한 시나리오입니다 — 참고용으로만 활용하세요.',
            '※ This scenario is estimated from industry benchmarks due to insufficient own financial history — use for reference only.'
          )}
        </Text>
      )}

      {/* CAGR 3열 배지 — 웹 GrowthScenarioV2Tab의 grid-cols-3 카드와 동일한 숫자
          (calcCagr는 공용 유틸, 첫 연도→마지막 연도 구간 CAGR). */}
      <View style={s.cagrRow}>
        {(['p10', 'p50', 'p90'] as const).map(k => (
          <View key={k} style={k === 'p90' ? [s.cagrCard, { marginRight: 0 }] : s.cagrCard}>
            <Text style={s.cagrLabel}>{rowLabel[k]} CAGR</Text>
            <Text style={s.cagrValue}>{fmtCagr(cagr[k])}</Text>
          </View>
        ))}
      </View>

      <GrowthScenarioChart g={g} rowLabel={rowLabel} t={t} />

      {/* 최종 연도(Year+N) 매출 강조 — 예상(P50) 시나리오 기준. */}
      <View style={s.finalYearCard}>
        <Text style={s.finalYearLabel}>
          {t(`Year+${years} 예상 매출(P50)`, `Year+${years} Expected Revenue (P50)`)}
        </Text>
        <Text style={s.finalYearValue}>{fmtGrowthRevenue(finalYearRevenue, g.currency)}</Text>
      </View>

      <View style={s.table}>
        <View style={s.tHead}>
          <Text style={s.th}>{t('연차', 'Year')}</Text>
          <Text style={s.th}>{rowLabel.p10}(P10)</Text>
          <Text style={s.th}>{rowLabel.p50}(P50)</Text>
          <Text style={s.th}>{rowLabel.p90}(P90)</Text>
        </View>
        {Array.from({ length: years }, (_, i) => (
          <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
            <Text style={s.td}>Year+{i + 1}</Text>
            <Text style={s.td}>{fmtGrowthRevenue(g.simulation.p10[i], g.currency)}</Text>
            <Text style={s.td}>{fmtGrowthRevenue(g.simulation.p50[i], g.currency)}</Text>
            <Text style={s.td}>{fmtGrowthRevenue(g.simulation.p90[i], g.currency)}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.para, { color: C.light, fontSize: 6.5 }]}>
        {t(
          `${rowLabel.p10}/${rowLabel.p50}/${rowLabel.p90} 시나리오 — 실제 결과와 다를 수 있는 확률적 추정치입니다.`,
          `${rowLabel.p10}/${rowLabel.p50}/${rowLabel.p90} scenarios — probabilistic estimates that may differ from actual results.`
        )}
      </Text>
    </View>
  );
}

// ── Sources Page ─────────────────────────────────────────────────────────────

function getSrcTabLabels(t: TFn): Record<string, string> {
  return {
    summary:          t('요약', 'Summary'),
    industry_history: t('산업 역사', 'Industry History'),
    tech_evolution:   t('기술 변화', 'Tech Evolution'),
    value_chain:      t('밸류체인', 'Value Chain'),
    business_model:   t('비즈니스 모델', 'Business Model'),
    competitors:      t('경쟁사', 'Competitors'),
    strategy:         t('전략', 'Strategy'),
    financials:       t('재무', 'Financials'),
    founder:          t('창업자', 'Founder'),
  };
}

function SourceRow({ src, idx, t }: { src: Source; idx: number; t: TFn }) {
  const badgeCls =
    src.level === 'L1' ? s.srcBadgeL1
    : src.level === 'L2' ? s.srcBadgeL2
    : s.srcBadgeL3;
  const label =
    src.level === 'L1' ? t('공식', 'Official')
    : src.level === 'L2' ? t('참고', 'Reference')
    : t('추정', 'Estimated');
  return (
    <View style={s.srcRow}>
      <Text style={[s.srcBadge, badgeCls]}>{label}</Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Text style={s.srcOrg}>[{src.index ?? idx + 1}] {src.organization}</Text>
          {src.date ? <Text style={s.srcDate}>{src.date}</Text> : null}
          <Text style={s.srcContent}> — {src.content}</Text>
        </View>
        {src.url ? <Text style={s.srcUrl}>{src.url}</Text> : null}
      </View>
    </View>
  );
}

function SourcesPage({ sources, founderSources, nudgeSources, company, t }: { sources: AnalysisSources; founderSources?: Source[] | null; nudgeSources?: Source[] | null; company: string; t: TFn }) {
  const entries = Object.entries(sources) as [keyof AnalysisSources, Source[]][];
  const filled = entries.filter(([, srcs]) => srcs && srcs.length > 0);
  const hasFounder = !!(founderSources && founderSources.length > 0);
  // cross_industry_nudge_v1.sources는 AnalysisSources 스키마 밖(자체 섹션 JSON에 내장) —
  // 웹의 buildSourceGroups()와 동일하게 founder와 같은 방식으로 별도 그룹 처리(2026-08-16).
  const hasNudge = !!(nudgeSources && nudgeSources.length > 0);
  if (!hasSourcesContent(sources, founderSources, nudgeSources)) return null;
  const srcTabLabels = getSrcTabLabels(t);

  return (
    <Page size="A4" style={s.page}>
      <View style={s.section}>
        <SectionHeader num={11} title={t('출처 목록', 'Sources')} id="sec-11" />
        {filled.map(([key, srcs]) => (
          <View key={key}>
            <Text style={s.srcGroupLabel}>{srcTabLabels[key] ?? key}</Text>
            {srcs.map((src, i) => (
              <SourceRow key={i} src={src} idx={i} t={t} />
            ))}
          </View>
        ))}
        {hasNudge && (
          <View>
            <Text style={s.srcGroupLabel}>{t('크로스인더스트리 넛지', 'Cross-Industry Nudge')}</Text>
            {nudgeSources!.map((src, i) => (
              <SourceRow key={i} src={src} idx={i} t={t} />
            ))}
          </View>
        )}
        {hasFounder && (
          <View>
            <Text style={s.srcGroupLabel}>{t('창업자', 'Founder')}</Text>
            {founderSources!.map((src, i) => (
              <SourceRow key={i} src={src} idx={i} t={t} />
            ))}
          </View>
        )}
      </View>
      <PageFooter company={company} t={t} />
    </Page>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

function PageFooter({ company, t }: { company: string; t: TFn }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{company} {t('기업 분석 보고서', 'Company Analysis Report')}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
        `${pageNumber} / ${totalPages}`
      } />
    </View>
  );
}

// ── Root Document ─────────────────────────────────────────────────────────────

export default function AnalysisPdf({ data: rawData, shareUrl }: { data: AnalysisDetail; shareUrl?: string }) {
  // 렌더링 전에 데이터 전체를 한 번 재귀 정화 — 개별 Text 노드마다 sp()를 감싸는 대신
  // (놓치기 쉬움) 여기서 한 번에 처리한다. language/id/날짜 등 비표시 필드도 안전(sp()는
  // 특수기호만 치환하고 일반 문자열은 그대로 통과).
  const data = sanitizeDeep(rawData);
  const language: Language = data.language === 'ko' ? 'ko' : 'en';
  const t = makeT(language);

  const hasV2 = !!(
    data.summary_v2 || data.industry_history_v2 || data.tech_evolution_v2 ||
    data.value_chain_v2 || data.business_model_v2 || data.competitors_v2 ||
    data.strategy_v2 || data.financials_v2 || data.founder_v2
  );

  return (
    <Document title={t(`${data.companyName} 기업 분석 보고서`, `${data.companyName} Company Analysis Report`)} author="1min">
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <CoverPage data={data} shareUrl={shareUrl} language={language} t={t} />
        <PageFooter company={data.companyName} t={t} />
      </Page>

      {/* TOC */}
      <TOCPage company={data.companyName} shareUrl={shareUrl} data={data} t={t} />

      {/* Content */}
      <Page size="A4" style={s.page}>
        {!hasV2 && (
          <Text style={s.para}>{t('이 분석은 최신 형식(V2)을 지원하지 않습니다. 새로운 분석을 실행해주세요.', 'This analysis does not support the latest format (V2). Please run a new analysis.')}</Text>
        )}

        {data.summary_v2 && <SummarySection v={data.summary_v2} t={t} />}
        {data.value_chain_v2 && <ValueChainSection v={data.value_chain_v2} t={t} />}
        {data.business_model_v2 && <BusinessModelSection v={data.business_model_v2} t={t} />}
        {data.competitors_v2 && <CompetitorsSection v={data.competitors_v2} t={t} />}
        {data.cross_industry_nudge_v1 && <CrossIndustryNudgeSection v={data.cross_industry_nudge_v1} t={t} />}
        {data.financials_v2 && <FinancialsSection v={data.financials_v2} t={t} dataSource={data.dataSource} />}
        {data.strategy_v2 && <StrategySection v={data.strategy_v2} t={t} />}
        {data.founder_v2 && <FounderSection v={data.founder_v2} t={t} />}
        {(data.industry_history_v2 || data.tech_evolution_v2) && (
          <PainDiagnosisSection industryHistory={data.industry_history_v2} techEvolution={data.tech_evolution_v2} t={t} />
        )}

        <PageFooter company={data.companyName} t={t} />
      </Page>

      {/* 성장 시나리오 — 프리미엄 전용, Pain Diagnosis 다음·출처 앞에 배치
          (2026-08-16 재조정 — 출처를 웹과 동일하게 진짜 최종 섹션으로 이동). */}
      {data.growth_scenario_v2 && (
        <Page size="A4" style={s.page}>
          <GrowthScenarioSection g={data.growth_scenario_v2} t={t} />
          <PageFooter company={data.companyName} t={t} />
        </Page>
      )}

      {/* Sources — 웹과 동일하게 스택의 진짜 최후미(성장 시나리오 뒤) */}
      {data.sources && (
        <SourcesPage
          sources={data.sources}
          founderSources={data.founder_v2?.sources}
          nudgeSources={data.cross_industry_nudge_v1?.sources}
          company={data.companyName}
          t={t}
        />
      )}
    </Document>
  );
}
