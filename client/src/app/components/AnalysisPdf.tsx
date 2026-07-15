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
  Source,
  AnalysisSources,
} from '@/types';
import { countFinancialsReliability } from '@/lib/financialsReliability';

// Absolute URL required: react-pdf fetches fonts via URL at render time,
// and relative paths may not resolve correctly in all environments.
const _origin = typeof window !== 'undefined' ? window.location.origin : '';
Font.register({
  family: 'NotoSansKR',
  fonts: [
    { src: `${_origin}/fonts/noto-sans-kr-400.woff`, fontWeight: 400 },
  ],
});
Font.registerHyphenationCallback(w => [w]);

// NotoSansKR woff subset may lack certain glyphs — replace with ASCII equivalents
function sp(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/₩/g, 'W')
    .replace(/©/g, '(c)')
    .replace(/®/g, '(R)')
    .replace(/™/g, '(TM)')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, '...');
}

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  blue:       '#2563EB',
  blueLight:  '#EFF6FF',
  dark:       '#1E293B',
  mid:        '#64748B',
  light:      '#94A3B8',
  bg:         '#F8FAFC',
  border:     '#E2E8F0',
  white:      '#FFFFFF',
  green:      '#16A34A',
  red:        '#DC2626',
  orange:     '#D97706',
};

const s = StyleSheet.create({
  page: {
    fontFamily:       'NotoSansKR',
    fontSize:         8.5,
    color:            C.dark,
    backgroundColor:  C.white,
    paddingHorizontal: 36,
    paddingTop:       32,
    paddingBottom:    32,
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
    marginBottom: 18,
  },
  sectionBreak: {
    marginBottom: 18,
    marginTop:    4,
  },
  sectionHeaderWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    marginBottom:    8,
    paddingBottom:   5,
    borderBottom:    `2 solid ${C.blue}`,
  },
  sectionNum: {
    fontSize:   8,
    fontWeight: 700,
    color:      C.blue,
    marginRight: 6,
  },
  sectionTitle: {
    fontSize:   11,
    fontWeight: 700,
    color:      C.dark,
  },

  // ── Sub-section ──
  subHeader: {
    fontSize:   8.5,
    fontWeight: 700,
    color:      C.dark,
    marginTop:  8,
    marginBottom: 4,
  },

  // ── Field row ──
  row: {
    flexDirection: 'row',
    marginBottom:  3,
  },
  label: {
    width:      90,
    fontSize:   8,
    color:      C.mid,
    fontWeight: 700,
    flexShrink: 0,
  },
  value: {
    flex:     1,
    fontSize: 8,
    color:    C.dark,
    lineHeight: 1.4,
  },

  // ── Prose ──
  para: {
    fontSize:   8,
    color:      C.dark,
    lineHeight: 1.5,
    marginBottom: 5,
  },

  // ── Bullet list ──
  bullet: {
    fontSize:    8,
    color:       C.dark,
    marginBottom: 2,
    lineHeight:  1.4,
    paddingLeft: 6,
  },

  // ── Table ──
  table: {
    marginBottom: 8,
  },
  tHead: {
    flexDirection:   'row',
    backgroundColor: C.bg,
    borderBottom:    `1 solid ${C.border}`,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tRow: {
    flexDirection:   'row',
    borderBottom:    `1 solid ${C.border}`,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tRowAlt: {
    flexDirection:   'row',
    borderBottom:    `1 solid ${C.border}`,
    paddingVertical: 3,
    paddingHorizontal: 4,
    backgroundColor: C.bg,
  },
  th: {
    fontSize:   7,
    fontWeight: 700,
    color:      C.mid,
    flex:       1,
  },
  td: {
    fontSize: 7,
    color:    C.dark,
    flex:     1,
    lineHeight: 1.3,
  },
  tdItem: {
    fontSize:   7,
    color:      C.dark,
    width:      130,
    flexShrink: 0,
  },
  thItem: {
    fontSize:   7,
    fontWeight: 700,
    color:      C.mid,
    width:      130,
    flexShrink: 0,
  },

  // ── Card ──
  card: {
    backgroundColor: C.bg,
    borderRadius:    4,
    padding:         8,
    marginBottom:    5,
    borderLeft:      `3 solid ${C.blue}`,
  },
  cardTitle: {
    fontSize:   8.5,
    fontWeight: 700,
    color:      C.dark,
    marginBottom: 3,
  },
  cardText: {
    fontSize:   7.5,
    color:      C.mid,
    lineHeight: 1.4,
  },

  // ── Reliability banner (재무 데이터 신뢰도 요약, amber-50/100/700 대응) ──
  reliabilityBanner: {
    backgroundColor:   '#FFFBEB',
    border:            '1 solid #FEF3C7',
    borderRadius:      4,
    paddingVertical:   5,
    paddingHorizontal: 8,
    marginBottom:      8,
  },
  reliabilityBannerText: {
    fontSize:   7.5,
    color:      '#B45309',
    lineHeight: 1.4,
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
    marginBottom:  6,
  },
  gridLeft: {
    flex:        1,
    marginRight: 6,
  },
  gridRight: {
    flex: 1,
  },

  // ── Metric chip ──
  metricRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    marginBottom:  6,
  },
  metric: {
    backgroundColor: C.bg,
    borderRadius:    4,
    padding:         6,
    marginRight:     5,
    marginBottom:    5,
    minWidth:        70,
  },
  metricLabel: {
    fontSize:   6.5,
    color:      C.light,
    marginBottom: 1,
  },
  metricValue: {
    fontSize:   9,
    fontWeight: 700,
    color:      C.dark,
  },

  // ── Financial label chips ──
  finGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    marginBottom:  6,
  },
  finChip: {
    backgroundColor: C.bg,
    borderRadius:    4,
    padding:         6,
    marginRight:     5,
    marginBottom:    5,
    minWidth:        80,
  },
  finChipLabel: {
    fontSize:   6.5,
    color:      C.light,
    marginBottom: 1,
  },
  finChipValue: {
    fontSize:   8,
    fontWeight: 700,
    color:      C.dark,
  },

  // ── Divider ──
  divider: {
    height:          1,
    backgroundColor: C.border,
    marginVertical:  6,
  },

  // ── Sources page ──
  srcGroupLabel: {
    fontSize:     8,
    fontWeight:   700,
    color:        C.mid,
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop:    10,
    paddingBottom: 3,
    borderBottom: `1 solid ${C.border}`,
  },
  srcRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginBottom:  4,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius:  3,
    backgroundColor: C.bg,
  },
  srcBadge: {
    fontSize:   6,
    fontWeight: 700,
    paddingHorizontal: 4,
    paddingVertical:   2,
    borderRadius: 3,
    marginRight:  5,
    marginTop:    1,
    flexShrink:   0,
  },
  srcBadgeL1: { backgroundColor: '#F0FDF4', color: '#16A34A' },
  srcBadgeL2: { backgroundColor: '#FFFBEB', color: '#D97706' },
  srcBadgeL3: { backgroundColor: '#F1F5F9', color: '#64748B' },
  srcOrg: {
    fontSize:   7.5,
    fontWeight: 700,
    color:      C.dark,
    marginRight: 3,
  },
  srcDate: {
    fontSize: 7,
    color:    C.light,
    marginRight: 3,
  },
  srcContent: {
    fontSize:  7,
    color:     C.mid,
    lineHeight: 1.4,
    flex:       1,
  },
  srcUrl: {
    fontSize: 6.5,
    color:    C.blue,
    marginTop: 1,
  },

  // ── TOC ──
  tocItem: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 5,
    borderBottom:    `1 solid ${C.border}`,
  },
  tocNum: {
    fontSize:   8,
    fontWeight: 700,
    color:      C.blue,
    width:      24,
  },
  tocTitle: {
    fontSize: 9,
    color:    C.dark,
    flex:     1,
  },
  webLink: {
    fontSize: 8,
    color:    C.blue,
  },

  // ── Footer ──
  footer: {
    position:   'absolute',
    bottom:     16,
    left:       36,
    right:      36,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6.5,
    color:    C.light,
  },
});

// ── Placeholder filtering (mirrors AnalysisCard.tsx isPlaceholder) ───────────

function pdfVal(v: string | number | null | undefined): string {
  if (v == null) return '—';
  const s = String(v).trim();
  if (!s || s === '-' || s === '확인 필요' || s === '공개 없음') return '—';
  if (/^-999([.,]\d+)?([%\s]|$)/.test(s)) return '—';
  return s;
}

// ── Primitives ───────────────────────────────────────────────────────────────

function SectionHeader({ num, title }: { num: number; title: string }) {
  return (
    <View style={s.sectionHeaderWrap}>
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
    <View style={{ backgroundColor: C.dark, borderRadius: 4, padding: 10, marginBottom: 10 }}>
      {bullets.map((b, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i < bullets.length - 1 ? 3 : 0 }}>
          <Text style={{ color: '#60A5FA', fontSize: 7, marginRight: 4, lineHeight: 1.5 }}>•</Text>
          <Text style={{ color: C.white, fontSize: 8, lineHeight: 1.5, flex: 1 }}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionSources({ sources }: { sources?: Source[] | null }) {
  if (!sources?.length) return null;
  return (
    <View style={{ marginTop: 8, paddingTop: 6, borderTop: `1 solid ${C.border}` }}>
      <Text style={{ fontSize: 7, fontWeight: 700, color: C.mid, marginBottom: 4, letterSpacing: 0.5 }}>출처</Text>
      {sources.map((src, i) => {
        const idx = src.index ?? i + 1;
        const badgeCls = src.level === 'L1' ? s.srcBadgeL1 : src.level === 'L2' ? s.srcBadgeL2 : s.srcBadgeL3;
        const label = src.level === 'L1' ? '공식' : src.level === 'L2' ? '참고' : '추정';
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 }}>
            <Text style={[s.srcBadge, badgeCls]}>{label}</Text>
            <Text style={{ fontSize: 7, color: C.mid, flex: 1, lineHeight: 1.3 }}>
              [{idx}] {src.organization}{src.date ? ` ${src.date}` : ''} — {src.content}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Cover Page ────────────────────────────────────────────────────────────────

function CoverPage({ data, shareUrl }: { data: AnalysisDetail; shareUrl?: string }) {
  const v2 = data.summary_v2;
  const date = new Date(data.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return (
    <View style={s.coverPage}>
      <Text style={s.coverLabel}>기업 분석 보고서</Text>
      <Text style={s.coverCompany}>{data.companyName}</Text>
      {v2?.ticker && (
        <Text style={s.coverSub}>{v2.ticker}</Text>
      )}
      {v2?.industry && (
        <Text style={s.coverSub}>{v2.industry}</Text>
      )}
      <View style={s.coverDivider} />
      {v2?.hq && <Text style={s.coverMeta}>본사: {v2.hq}</Text>}
      {v2?.value_chain_position && (
        <Text style={s.coverMeta}>밸류체인 위치: {v2.value_chain_position}</Text>
      )}
      <Text style={s.coverMeta}>분석 일자: {date}</Text>
      {v2?.oneLiner && (
        <>
          <Divider />
          <Text style={[s.para, { marginTop: 4, fontSize: 9, color: C.mid }]}>{v2.oneLiner}</Text>
        </>
      )}
      {shareUrl && (
        <>
          <Divider />
          <Link src={shareUrl} style={s.webLink}>웹에서 보기 → {shareUrl}</Link>
        </>
      )}
    </View>
  );
}

// ── TOC Page ──────────────────────────────────────────────────────────────────

const TOC_SECTIONS = [
  { num: 1, title: '기업 개요' },
  { num: 2, title: '산업 역사' },
  { num: 3, title: '기술 변화' },
  { num: 4, title: '밸류체인' },
  { num: 5, title: '비즈니스 모델' },
  { num: 6, title: '경쟁사 분석' },
  { num: 7, title: '전략 분석' },
  { num: 8, title: '재무 분석' },
  { num: 9, title: '창업자 분석' },
];

function TOCPage({ company, shareUrl }: { company: string; shareUrl?: string }) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.section}>
        <View style={[s.sectionHeaderWrap, { marginBottom: 12 }]}>
          <Text style={s.sectionTitle}>목차</Text>
        </View>
        {TOC_SECTIONS.map(item => (
          <View key={item.num} style={s.tocItem}>
            <Text style={s.tocNum}>{String(item.num).padStart(2, '0')}</Text>
            <Text style={s.tocTitle}>{item.title}</Text>
          </View>
        ))}
        {shareUrl && (
          <View style={{ marginTop: 20 }}>
            <Link src={shareUrl} style={s.webLink}>웹에서 보기 → {shareUrl}</Link>
          </View>
        )}
      </View>
      <PageFooter company={company} />
    </Page>
  );
}

// ── Section 1: 기업 개요 ─────────────────────────────────────────────────────

function SummarySection({ v }: { v: SummaryV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={1} title="기업 개요" />
      <KeyBulletsPdf bullets={v.key_bullets} />

      {/* Basic info */}
      <FieldRow label="기업명" value={v.company} />
      {v.ticker && <FieldRow label="티커" value={v.ticker} />}
      <FieldRow label="산업" value={v.industry} />
      <FieldRow label="본사" value={v.hq} />
      <FieldRow label="밸류체인 위치" value={v.value_chain_position} />

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
            <SubHeader>주요 제품/서비스</SubHeader>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.th, { flex: 2 }]}>제품/서비스</Text>
                <Text style={s.th}>매출 비중</Text>
              </View>
              {v.products.map((p, i) => (
                <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                  <Text style={[s.td, { flex: 2 }]}>{p.name}</Text>
                  <Text style={s.td}>{p.revenue_share}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Key markets */}
        {v.key_markets?.length > 0 && (
          <View style={s.gridRight}>
            <SubHeader>주요 시장</SubHeader>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.th, { flex: 2 }]}>국가/지역</Text>
                <Text style={s.th}>비중</Text>
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
          <SubHeader>핵심 지표</SubHeader>
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
          <SubHeader>주요 고객사</SubHeader>
          {v.top_customers?.length > 0 && (
            <Text style={[s.para, { marginBottom: 4 }]}>{v.top_customers.join(' · ')}</Text>
          )}
          {v.customer_concentration && (
            <View style={{ marginBottom: 6 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: v.customer_concentration.is_concentrated ? '#FFFBEB' : '#F0FDF4',
                borderRadius: 4, padding: 5, marginBottom: 5,
              }}>
                <Text style={{ fontSize: 7, color: v.customer_concentration.is_concentrated ? '#D97706' : '#16A34A' }}>
                  {v.customer_concentration.is_concentrated ? '⚠' : '✓'} 상위 {v.customer_concentration.top_n}개 고객 매출 {v.customer_concentration.top_n_share}% 차지
                  {v.customer_concentration.trend === 'diversifying' ? ' — 다변화 진행 중' : v.customer_concentration.trend === 'concentrating' ? ' — 집중도 심화' : ''}
                </Text>
              </View>
              {v.customer_concentration.customers.length > 0 && (
                <View style={s.table}>
                  <View style={s.tHead}>
                    <Text style={[s.th, { flex: 2 }]}>고객사</Text>
                    <Text style={s.th}>매출 비중</Text>
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

      {/* 성장 모멘텀 / 핵심 리스크 */}
      <View style={s.grid2}>
        {v.bull_case && (
          <View style={[s.gridLeft, s.card, { borderLeftColor: C.green }]}>
            <Text style={s.cardTitle}>성장 모멘텀</Text>
            <Text style={s.cardText}>{v.bull_case}</Text>
          </View>
        )}
        {v.bear_case && (
          <View style={[s.gridRight, s.card, { borderLeftColor: C.red }]}>
            <Text style={s.cardTitle}>핵심 리스크</Text>
            <Text style={s.cardText}>{v.bear_case}</Text>
          </View>
        )}
      </View>
      <SectionSources sources={v.sources} />
    </View>
  );
}

// ── Section 2: 산업 역사 ─────────────────────────────────────────────────────

function IndustryHistorySection({ v }: { v: IndustryHistoryV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={2} title={`산업 역사 — ${v.industry_name}`} />
      <KeyBulletsPdf bullets={v.key_bullets} />

      {v.why_durable && (
        <>
          <SubHeader>산업 내구성</SubHeader>
          <Text style={s.para}>{sp(v.why_durable)}</Text>
        </>
      )}

      {v.chasm_points?.length > 0 && (
        <>
          <SubHeader>핵심 변곡점</SubHeader>
          {v.chasm_points.map((c, i) => <Bullet key={i}>{sp(c)}</Bullet>)}
        </>
      )}

      <SubHeader>발전 타임라인</SubHeader>
      {v.timeline?.map((t, i) => (
        <View key={i} style={[s.card, { marginBottom: 5 }]}>
          <View style={[s.row, { marginBottom: 2 }]}>
            <Text style={[s.cardTitle, { marginBottom: 0, flex: 1 }]}>{sp(t.period)} — {sp(t.title)}</Text>
          </View>
          {t.technology && <Text style={s.cardText}>기술: {sp(t.technology)}</Text>}
          {t.market_need && <Text style={s.cardText}>시장 니즈: {sp(t.market_need)}</Text>}
          {t.significance && <Text style={[s.cardText, { marginTop: 2 }]}>{sp(t.significance)}</Text>}
          {t.key_players?.length > 0 && (
            <Text style={[s.cardText, { marginTop: 2, color: C.blue }]}>
              주요 플레이어: {t.key_players.map(sp).join(', ')}
            </Text>
          )}
        </View>
      ))}
      <SectionSources sources={v.sources} />
    </View>
  );
}

// ── Section 3: 기술 진화 ─────────────────────────────────────────────────────

const HYPE_COLOR: Record<string, string> = {
  emerging:    C.blue,
  hype:        C.orange,
  trough:      C.red,
  recovery:    C.green,
  mainstream:  C.mid,
};

function TechEvolutionSection({ v }: { v: TechEvolutionV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={3} title={`기술 진화 — ${v.tech_name}`} />
      <KeyBulletsPdf bullets={v.key_bullets} />
      <FieldRow label="현재 단계" value={v.current_stage} />
      <FieldRow label="다음 변곡점" value={v.next_inflection} />

      <SubHeader>기술 발전 단계</SubHeader>
      {v.stages?.map((st, i) => (
        <View key={i} style={[s.card, { borderLeftColor: HYPE_COLOR[st.hype_level] ?? C.blue }]}>
          <View style={s.row}>
            <Text style={s.cardTitle}>
              {`Stage ${st.stage}  ${st.period}  ${st.title}`}
            </Text>
            <Text style={[s.tag, { marginLeft: 4, borderRadius: 3 }]}>{st.hype_level}</Text>
          </View>
          {st.description && <Text style={s.cardText}>{st.description}</Text>}
          {st.key_enablers?.length > 0 && (
            <Text style={[s.cardText, { marginTop: 2 }]}>
              핵심 기술: {st.key_enablers.join(', ')}
            </Text>
          )}
          {st.key_players?.length > 0 && (
            <Text style={[s.cardText, { color: C.blue }]}>
              주요 플레이어: {st.key_players.join(', ')}
            </Text>
          )}
        </View>
      ))}
      <SectionSources sources={v.sources} />
    </View>
  );
}

// ── Section 4: 밸류체인 ──────────────────────────────────────────────────────

const POWER_COLOR = { high: C.green, medium: C.orange, low: C.red };

function ValueChainSection({ v }: { v: ValueChainV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={4} title={`밸류체인 — ${v.industry}`} />
      <KeyBulletsPdf bullets={v.key_bullets} />
      <FieldRow label="가치 흐름" value={v.value_flow} />
      <FieldRow label="분석 기업 위치" value={v.subject_position} />

      <SubHeader>레이어 구조</SubHeader>
      {v.layers?.map((layer, i) => (
        <View key={i} style={[
          s.card,
          layer.is_subject ? { borderLeftColor: C.blue }
            : layer.buyer   ? { borderLeftColor: C.green, backgroundColor: '#F0FDF4' }
            : { borderLeftColor: C.border },
        ]}>
          <View style={s.row}>
            <Text style={s.cardTitle}>{layer.name}</Text>
            {layer.is_subject && (
              <Text style={[s.tag, { marginLeft: 4, backgroundColor: C.blue, color: C.white }]}>
                분석 기업
              </Text>
            )}
            {layer.bottleneck && (
              <Text style={[s.tag, { marginLeft: 4, backgroundColor: '#FEF3C7', color: C.orange }]}>
                병목
              </Text>
            )}
            {layer.buyer
              ? <Text style={[s.tag, { marginLeft: 4, backgroundColor: '#DBEAFE', color: C.blue }]}>구매자</Text>
              : layer.pricing_power
                ? <Text style={[s.tag, { marginLeft: 4, color: POWER_COLOR[layer.pricing_power], backgroundColor: C.bg }]}>
                    가격협상력 {layer.pricing_power}
                  </Text>
                : null
            }
          </View>
          {layer.description && <Text style={s.cardText}>{layer.description}</Text>}
          {layer.global_leaders?.length > 0 && (
            <Text style={[s.cardText, { marginTop: 2, color: C.blue }]}>
              글로벌 리더: {layer.global_leaders.map(l => `${l.name}(${l.country})`).join(', ')}
            </Text>
          )}
        </View>
      ))}
      <SectionSources sources={v.sources} />
    </View>
  );
}

// ── Section 5: 비즈니스 모델 ─────────────────────────────────────────────────

function BusinessModelSection({ v }: { v: BusinessModelV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={5} title="비즈니스 모델" />
      <KeyBulletsPdf bullets={v.key_bullets} />

      <FieldRow label="성장 모션" value={v.growth_motion} />
      {v.growth_motion_detail && <Text style={[s.para, { marginTop: 2 }]}>{v.growth_motion_detail}</Text>}

      {/* Unit economics */}
      <SubHeader>유닛 이코노믹스</SubHeader>
      <View style={s.finGrid}>
        {[
          { label: '매출총이익률', val: pdfVal(v.unit_economics.gross_margin) !== '—' ? `${v.unit_economics.gross_margin}%` : '—' },
          { label: '영업이익률',   val: pdfVal(v.unit_economics.operating_margin) !== '—' ? `${v.unit_economics.operating_margin}%` : '—' },
          { label: '순이익률',     val: pdfVal(v.unit_economics.net_margin) !== '—' ? `${v.unit_economics.net_margin}%` : '—' },
          { label: 'FCF 마진',     val: pdfVal(v.unit_economics.fcf_margin) !== '—' ? `${v.unit_economics.fcf_margin}%` : '—' },
          { label: 'NRR',         val: pdfVal(v.unit_economics.nrr) !== '—' ? `${v.unit_economics.nrr}%` : '—' },
        ].filter(m => m.val !== '—' && m.val !== '0%').map(({ label, val }, i) => (
          <View key={i} style={s.finChip}>
            <Text style={s.finChipLabel}>{label}</Text>
            <Text style={s.finChipValue}>{val}</Text>
          </View>
        ))}
      </View>

      {/* Revenue streams */}
      {v.revenue_streams?.length > 0 && (
        <>
          <SubHeader>수익 구조</SubHeader>
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, { flex: 2 }]}>스트림</Text>
              <Text style={s.th}>유형</Text>
              <Text style={s.th}>비중</Text>
              <Text style={s.th}>영업이익률</Text>
              <Text style={s.th}>성장률</Text>
            </View>
            {v.revenue_streams.map((r, i) => (
              <View key={i} style={i % 2 === 0 ? s.tRow : s.tRowAlt}>
                <Text style={[s.td, { flex: 2 }]}>{r.name}</Text>
                <Text style={s.td}>{r.type}</Text>
                <Text style={s.td}>{pdfVal(r.revenue_share) !== '—' ? `${r.revenue_share}%` : '—'}</Text>
                <Text style={s.td}>{pdfVal(r.operating_margin) !== '—' ? `${r.operating_margin}%` : '—'}</Text>
                <Text style={s.td}>{pdfVal(r.growth_rate) !== '—' ? `${r.growth_rate}%` : '—'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Moat */}
      {v.moat?.length > 0 && (
        <>
          <SubHeader>경쟁 해자</SubHeader>
          {v.moat.map((m, i) => (
            <View key={i} style={[s.card, {
              borderLeftColor: m.strength === 'strong' ? C.green : m.strength === 'medium' ? C.orange : C.light,
            }]}>
              <Text style={s.cardTitle}>{m.type}  <Text style={{ fontWeight: 400, color: C.mid }}>{m.strength}</Text></Text>
              <Text style={s.cardText}>{m.description}</Text>
            </View>
          ))}
        </>
      )}
      <SectionSources sources={v.sources} />
    </View>
  );
}

// ── Section 6: 경쟁사 분석 ──────────────────────────────────────────────────

function CompetitorsSection({ v }: { v: CompetitorsV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={6} title="경쟁사 분석" />
      <KeyBulletsPdf bullets={v.key_bullets} />
      <FieldRow label="경쟁 포지션" value={v.competitive_position} />

      {/* Direct competitors */}
      {v.direct?.length > 0 && (
        <>
          <SubHeader>직접 경쟁사</SubHeader>
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, { flex: 1.5 }]}>기업</Text>
              <Text style={s.th}>국가</Text>
              <Text style={s.th}>시장점유율</Text>
              <Text style={[s.th, { flex: 2 }]}>vs 분석 기업</Text>
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
                  강점: {c.strengths.join(' / ')}
                </Text>
              )}
              {c.weaknesses?.length > 0 && (
                <Text style={s.cardText}>
                  약점: {c.weaknesses.join(' / ')}
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
            <SubHeader>간접 경쟁사</SubHeader>
            {v.indirect.map((c, i) => (
              <View key={i} style={[s.card, { borderLeftColor: C.orange }]}>
                <Text style={s.cardTitle}>{c.name}</Text>
                <Text style={s.cardText}>{c.threat}</Text>
              </View>
            ))}
          </View>
        )}
        {/* Substitutes */}
        {v.substitutes?.length > 0 && (
          <View style={s.gridRight}>
            <SubHeader>대체재</SubHeader>
            {v.substitutes.map((c, i) => (
              <View key={i} style={[s.card, { borderLeftColor: C.red }]}>
                <Text style={s.cardTitle}>{c.name}</Text>
                <Text style={s.cardText}>{c.threat}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <SectionSources sources={v.sources} />
    </View>
  );
}

// ── Section 7: 전략 분석 ─────────────────────────────────────────────────────

function StrategySection({ v }: { v: StrategyV2 }) {
  type StratItem = { label: string; value: string };
  const pdfSections: { title: string; direction: string; items: StratItem[] }[] = [
    {
      title: '기업 전략 (Corporate)',
      direction: v.corporate.direction ?? '',
      items: [
        v.corporate.portfolio            ? { label: '포트폴리오',    value: v.corporate.portfolio } : null,
        v.corporate.ma_partnerships?.length ? { label: 'M&A/파트너십', value: v.corporate.ma_partnerships.join(', ') } : null,
        v.corporate.geographic           ? { label: '지역 확장',    value: v.corporate.geographic } : null,
      ].filter(Boolean) as StratItem[],
    },
    {
      title: '사업 전략 (Business)',
      direction: v.business.direction ?? '',
      items: [
        v.business.competitive_advantage ? { label: '경쟁 우위',      value: v.business.competitive_advantage } : null,
        v.business.go_to_market          ? { label: 'GTM',            value: v.business.go_to_market } : null,
        v.business.product_roadmap?.length ? { label: '로드맵',       value: v.business.product_roadmap.join(', ') } : null,
      ].filter(Boolean) as StratItem[],
    },
    {
      title: '재무 전략 (Financial)',
      direction: v.financial.direction ?? '',
      items: [
        v.financial.capital_allocation   ? { label: '자본 배분',      value: v.financial.capital_allocation } : null,
        v.financial.investment_priority   ? { label: '투자 우선순위',  value: v.financial.investment_priority } : null,
        v.financial.return_target         ? { label: '목표 수익성',   value: v.financial.return_target } : null,
      ].filter(Boolean) as StratItem[],
    },
  ];

  const hasAny = pdfSections.some(sec => sec.direction || sec.items.length > 0);
  if (!hasAny && !v.strategy_coherence && !v.ten_year_durability) return null;

  return (
    <View style={s.section}>
      <SectionHeader num={7} title="전략 분석" />
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
          <SubHeader>전략 수렴</SubHeader>
          <Text style={s.para}>{v.strategy_coherence}</Text>
        </>
      )}
      {v.ten_year_durability && (
        <>
          <SubHeader>10년 지속 가능성</SubHeader>
          <Text style={s.para}>{v.ten_year_durability}</Text>
        </>
      )}
      <SectionSources sources={v.sources} />
    </View>
  );
}

// ── Section 8: 재무 분석 ─────────────────────────────────────────────────────

function IncomeTable({ rows }: { rows: FinancialsV2Row[] }) {
  if (!rows?.length) return null;
  const sample = rows[0] ?? {};
  const years = (['fy2021', 'fy2022', 'fy2023', 'fy2024', 'fy2025'] as const)
    .filter(y => y in sample && sample[y] != null);
  const hasYoy = 'yoy' in sample && rows.some(r => r.yoy);

  return (
    <View style={s.table}>
      <View style={s.tHead}>
        <Text style={s.thItem}>항목</Text>
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
          {hasYoy && <Text style={s.td}>{pdfVal(r.yoy)}</Text>}
        </View>
      ))}
    </View>
  );
}

function BSTable({ rows }: { rows: FinancialsV2BSRow[] }) {
  if (!rows?.length) return null;
  const sample = rows[0] ?? {};
  const years = (['fy2023', 'fy2024', 'fy2025'] as const)
    .filter(y => y in sample && sample[y] != null);

  return (
    <View style={s.table}>
      <View style={s.tHead}>
        <Text style={s.thItem}>항목</Text>
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

function FinancialsSection({ v }: { v: FinancialsV2 }) {
  const mb = v.munger_buffett_metrics;
  const { estimatedCount, unknownCount } = countFinancialsReliability(v);
  return (
    <View style={s.section}>
      <SectionHeader num={8} title="재무 분석" />
      <KeyBulletsPdf bullets={v.key_bullets} />

      {(estimatedCount > 0 || unknownCount > 0) && (
        <View style={s.reliabilityBanner}>
          <Text style={s.reliabilityBannerText}>
            {sp(`이 리포트에는 추정값 ${estimatedCount}건, 확인 필요 데이터 ${unknownCount}건이 포함되어 있습니다`)}
          </Text>
        </View>
      )}

      {v.narrative && <Text style={[s.para, { marginBottom: 8 }]}>{v.narrative}</Text>}

      {/* Munger-Buffett metrics */}
      <SubHeader>Munger-Buffett 지표</SubHeader>
      <View style={s.finGrid}>
        {[
          { label: 'ROE',         val: mb.roe },
          { label: 'ROIC',        val: mb.roic },
          { label: 'Owner Earnings', val: mb.owner_earnings },
          { label: '부채비율',       val: mb.debt_to_equity },
          { label: '이자보상배율',    val: mb.interest_coverage },
          { label: '재투자율',       val: mb.reinvestment_rate },
        ].filter(m => pdfVal(m.val) !== '—').map(({ label, val }, i) => (
          <View key={i} style={s.finChip}>
            <Text style={s.finChipLabel}>{label}</Text>
            <Text style={s.finChipValue}>{pdfVal(val)}</Text>
          </View>
        ))}
      </View>

      {/* Income statement */}
      <SubHeader>손익계산서</SubHeader>
      <IncomeTable rows={v.income_statement} />

      {/* Balance sheet */}
      <SubHeader>재무상태표</SubHeader>
      <BSTable rows={v.balance_sheet} />

      {/* Cash flow */}
      {v.cash_flow && (
        <>
          <SubHeader>현금흐름</SubHeader>
          <View style={s.finGrid}>
            {[
              { label: '영업활동',    val: v.cash_flow.operating },
              { label: '투자활동',    val: v.cash_flow.investing },
              { label: '재무활동',    val: v.cash_flow.financing },
              { label: 'FCF',        val: v.cash_flow.fcf },
            ].filter(m => pdfVal(m.val) !== '—').map(({ label, val }, i) => (
              <View key={i} style={s.finChip}>
                <Text style={s.finChipLabel}>{label}</Text>
                <Text style={s.finChipValue}>{pdfVal(val)}</Text>
              </View>
            ))}
          </View>
          {v.cash_flow.notes && (
            <Text style={[s.cardText, { color: C.mid, marginBottom: 6 }]}>{v.cash_flow.notes}</Text>
          )}
        </>
      )}

      {/* Key risks */}
      {v.key_risks?.length > 0 && (
        <>
          <SubHeader>핵심 리스크</SubHeader>
          {v.key_risks.map((r, i) => <Bullet key={i}>{r}</Bullet>)}
        </>
      )}

      {/* Outlook */}
      {v.outlook && (
        <>
          <SubHeader>전망</SubHeader>
          <View style={s.grid2}>
            {v.outlook.shortTerm && (
              <View style={s.gridLeft}>
                <View style={s.card}>
                  <Text style={s.cardTitle}>단기 전망</Text>
                  <Text style={s.cardText}>{v.outlook.shortTerm}</Text>
                </View>
              </View>
            )}
            {v.outlook.midLongTerm && (
              <View style={s.gridRight}>
                <View style={s.card}>
                  <Text style={s.cardTitle}>중장기 전망</Text>
                  <Text style={s.cardText}>{v.outlook.midLongTerm}</Text>
                </View>
              </View>
            )}
          </View>
          {v.outlook.keyRisks?.length > 0 && (
            <>
              <SubHeader>전망 리스크</SubHeader>
              {v.outlook.keyRisks.map((r, i) => <Bullet key={i}>{r}</Bullet>)}
            </>
          )}
        </>
      )}
      <SectionSources sources={v.sources} />
    </View>
  );
}

// ── Section 9: 창업자 분석 ────────────────────────────────────────────────────

function FounderSection({ v }: { v: FounderV2 }) {
  const isSerial = v.founding_history.type === 'serial';
  return (
    <View style={s.section}>
      <SectionHeader num={9} title="창업자 분석" />
      <KeyBulletsPdf bullets={v.key_bullets} />

      {/* Founder profiles */}
      {v.founders.length > 0 && (
        <>
          <SubHeader>창업자 기본 정보</SubHeader>
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, { flex: 1.5 }]}>이름</Text>
              <Text style={s.th}>직함</Text>
              <Text style={[s.th, { flex: 2 }]}>학교</Text>
              <Text style={s.th}>전공</Text>
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
          <SubHeader>커리어 궤적</SubHeader>
          {[...v.career_trajectory]
            .sort((a, b) => {
              const yr = (s: string) => parseInt(s.match(/\d{4}/)?.[0] ?? '9999', 10);
              return yr(a.period) - yr(b.period);
            })
            .map((ct, i) => (
            <View key={i} style={[s.row, { marginBottom: 4, paddingBottom: 4, borderBottom: `1 solid ${C.border}` }]}>
              <Text style={[s.label, { width: 80 }]}>{ct.period}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.value, { fontWeight: 700 }]}>{ct.company}</Text>
                <Text style={[s.value, { color: C.mid }]}>{ct.role}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Founding history */}
      <SubHeader>창업 이력</SubHeader>
      <View style={[s.tagsRow, { marginBottom: 4 }]}>
        <Text style={[s.tag, {
          backgroundColor: isSerial ? '#EDE9FE' : C.bg,
          color: isSerial ? '#7C3AED' : C.mid,
        }]}>
          {isSerial ? 'Serial Founder' : '1st Time Founder'}
        </Text>
      </View>
      {v.founding_history.previous_ventures.length > 0 ? (
        <View style={s.table}>
          <View style={s.tHead}>
            <Text style={[s.th, { flex: 2 }]}>기업명</Text>
            <Text style={s.th}>결과</Text>
            <Text style={s.th}>엑싯 유형</Text>
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
        <Text style={[s.para, { color: C.light }]}>이전 창업 이력 없음</Text>
      )}

      {/* Reputation */}
      {(v.reputation.sns_style !== '-' || v.reputation.media_exposure !== '-' || v.reputation.blind_glassdoor !== '-') && (
        <>
          <SubHeader>평판 & 퍼블릭 시그널</SubHeader>
          {v.reputation.sns_style !== '-' && (
            <View style={s.row}>
              <Text style={s.label}>SNS 스타일</Text>
              <Text style={s.value}>{v.reputation.sns_style}</Text>
            </View>
          )}
          {v.reputation.media_exposure !== '-' && (
            <View style={s.row}>
              <Text style={s.label}>미디어 노출</Text>
              <Text style={s.value}>{v.reputation.media_exposure}</Text>
            </View>
          )}
          {v.reputation.blind_glassdoor !== '-' && (
            <View style={s.row}>
              <Text style={s.label}>Blind/GD</Text>
              <Text style={s.value}>{v.reputation.blind_glassdoor}</Text>
            </View>
          )}
        </>
      )}

      {/* Network */}
      {(v.network.investors.length > 0 || v.network.advisors_board.length > 0 || v.network.cofounders.length > 0) && (
        <>
          <SubHeader>네트워크</SubHeader>
          {v.network.cofounders.length > 0 && (
            <View style={s.row}>
              <Text style={s.label}>공동창업팀</Text>
              <Text style={s.value}>{v.network.cofounders.join(' · ')}</Text>
            </View>
          )}
          {v.network.investors.length > 0 && (
            <View style={s.row}>
              <Text style={s.label}>투자자</Text>
              <Text style={s.value}>{v.network.investors.join(' · ')}</Text>
            </View>
          )}
          {v.network.advisors_board.length > 0 && (
            <View style={s.row}>
              <Text style={s.label}>어드바이저/보드</Text>
              <Text style={s.value}>{v.network.advisors_board.join(' · ')}</Text>
            </View>
          )}
        </>
      )}

      <SectionSources sources={v.sources} />
    </View>
  );
}

// ── Sources Page ─────────────────────────────────────────────────────────────

const SRC_TAB_LABELS: Record<string, string> = {
  summary:          '요약',
  industry_history: '산업 역사',
  tech_evolution:   '기술 변화',
  value_chain:      '밸류체인',
  business_model:   '비즈니스 모델',
  competitors:      '경쟁사',
  strategy:         '전략',
  financials:       '재무',
  founder:          '창업자',
};

function SourceRow({ src, idx }: { src: Source; idx: number }) {
  const badgeCls =
    src.level === 'L1' ? s.srcBadgeL1
    : src.level === 'L2' ? s.srcBadgeL2
    : s.srcBadgeL3;
  const label =
    src.level === 'L1' ? '공식'
    : src.level === 'L2' ? '참고'
    : '추정';
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

function SourcesPage({ sources, founderSources, company }: { sources: AnalysisSources; founderSources?: Source[] | null; company: string }) {
  const entries = Object.entries(sources) as [keyof AnalysisSources, Source[]][];
  const filled = entries.filter(([, srcs]) => srcs && srcs.length > 0);
  const hasFounder = !!(founderSources && founderSources.length > 0);
  if (filled.length === 0 && !hasFounder) return null;

  return (
    <Page size="A4" style={s.page}>
      <View style={s.section}>
        <SectionHeader num={10} title="출처 목록" />
        {filled.map(([key, srcs]) => (
          <View key={key}>
            <Text style={s.srcGroupLabel}>{SRC_TAB_LABELS[key] ?? key}</Text>
            {srcs.map((src, i) => (
              <SourceRow key={i} src={src} idx={i} />
            ))}
          </View>
        ))}
        {hasFounder && (
          <View>
            <Text style={s.srcGroupLabel}>창업자</Text>
            {founderSources!.map((src, i) => (
              <SourceRow key={i} src={src} idx={i} />
            ))}
          </View>
        )}
      </View>
      <PageFooter company={company} />
    </Page>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

function PageFooter({ company }: { company: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{company} 기업 분석 보고서</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
        `${pageNumber} / ${totalPages}`
      } />
    </View>
  );
}

// ── Root Document ─────────────────────────────────────────────────────────────

export default function AnalysisPdf({ data, shareUrl }: { data: AnalysisDetail; shareUrl?: string }) {
  const hasV2 = !!(
    data.summary_v2 || data.industry_history_v2 || data.tech_evolution_v2 ||
    data.value_chain_v2 || data.business_model_v2 || data.competitors_v2 ||
    data.strategy_v2 || data.financials_v2 || data.founder_v2
  );

  return (
    <Document title={`${data.companyName} 기업 분석 보고서`} author="1min">
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <CoverPage data={data} shareUrl={shareUrl} />
        <PageFooter company={data.companyName} />
      </Page>

      {/* TOC */}
      <TOCPage company={data.companyName} shareUrl={shareUrl} />

      {/* Content */}
      <Page size="A4" style={s.page}>
        {!hasV2 && (
          <Text style={s.para}>이 분석은 최신 형식(V2)을 지원하지 않습니다. 새로운 분석을 실행해주세요.</Text>
        )}

        {data.summary_v2 && <SummarySection v={data.summary_v2} />}
        {data.industry_history_v2 && <IndustryHistorySection v={data.industry_history_v2} />}
        {data.tech_evolution_v2 && <TechEvolutionSection v={data.tech_evolution_v2} />}
        {data.value_chain_v2 && <ValueChainSection v={data.value_chain_v2} />}
        {data.business_model_v2 && <BusinessModelSection v={data.business_model_v2} />}
        {data.competitors_v2 && <CompetitorsSection v={data.competitors_v2} />}
        {data.strategy_v2 && <StrategySection v={data.strategy_v2} />}
        {data.financials_v2 && <FinancialsSection v={data.financials_v2} />}
        {data.founder_v2 && <FounderSection v={data.founder_v2} />}

        <PageFooter company={data.companyName} />
      </Page>

      {/* Sources */}
      {data.sources && (
        <SourcesPage
          sources={data.sources}
          founderSources={data.founder_v2?.sources}
          company={data.companyName}
        />
      )}
    </Document>
  );
}
