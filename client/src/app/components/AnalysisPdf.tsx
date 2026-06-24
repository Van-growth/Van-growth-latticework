'use client';

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
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
  Source,
  AnalysisSources,
} from '@/types';

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
Font.registerHyphenationCallback(w => [w]);

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

// ── Cover Page ────────────────────────────────────────────────────────────────

function CoverPage({ data }: { data: AnalysisDetail }) {
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
    </View>
  );
}

// ── Section 1: 기업 개요 ─────────────────────────────────────────────────────

function SummarySection({ v }: { v: SummaryV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={1} title="기업 개요" />

      {/* Basic info */}
      <FieldRow label="기업명" value={v.company} />
      {v.ticker && <FieldRow label="티커" value={v.ticker} />}
      <FieldRow label="산업" value={v.industry} />
      <FieldRow label="본사" value={v.hq} />
      <FieldRow label="밸류체인 위치" value={v.value_chain_position} />

      {/* One-liner */}
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

      {/* Top customers */}
      {v.top_customers?.length > 0 && (
        <>
          <SubHeader>주요 고객</SubHeader>
          <Text style={s.para}>{v.top_customers.join(' · ')}</Text>
        </>
      )}

      {/* Bull / Bear */}
      <View style={s.grid2}>
        {v.bull_case && (
          <View style={[s.gridLeft, s.card, { borderLeftColor: C.green }]}>
            <Text style={s.cardTitle}>Bull Case</Text>
            <Text style={s.cardText}>{v.bull_case}</Text>
          </View>
        )}
        {v.bear_case && (
          <View style={[s.gridRight, s.card, { borderLeftColor: C.red }]}>
            <Text style={s.cardTitle}>Bear Case</Text>
            <Text style={s.cardText}>{v.bear_case}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Section 2: 산업 역사 ─────────────────────────────────────────────────────

function IndustryHistorySection({ v }: { v: IndustryHistoryV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={2} title={`산업 역사 — ${v.industry_name}`} />

      {v.why_durable && (
        <>
          <SubHeader>산업 내구성</SubHeader>
          <Text style={s.para}>{v.why_durable}</Text>
        </>
      )}

      {v.chasm_points?.length > 0 && (
        <>
          <SubHeader>핵심 변곡점</SubHeader>
          {v.chasm_points.map((c, i) => <Bullet key={i}>{c}</Bullet>)}
        </>
      )}

      <SubHeader>발전 타임라인</SubHeader>
      {v.timeline?.map((t, i) => (
        <View key={i} style={[s.card, { marginBottom: 5 }]}>
          <View style={[s.row, { marginBottom: 2 }]}>
            <Text style={[s.cardTitle, { marginBottom: 0, flex: 1 }]}>{t.period} — {t.title}</Text>
          </View>
          {t.technology && <Text style={s.cardText}>기술: {t.technology}</Text>}
          {t.market_need && <Text style={s.cardText}>시장 니즈: {t.market_need}</Text>}
          {t.significance && <Text style={[s.cardText, { marginTop: 2 }]}>{t.significance}</Text>}
          {t.key_players?.length > 0 && (
            <Text style={[s.cardText, { marginTop: 2, color: C.blue }]}>
              주요 플레이어: {t.key_players.join(', ')}
            </Text>
          )}
        </View>
      ))}
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
    </View>
  );
}

// ── Section 4: 밸류체인 ──────────────────────────────────────────────────────

const POWER_COLOR = { high: C.green, medium: C.orange, low: C.red };

function ValueChainSection({ v }: { v: ValueChainV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={4} title={`밸류체인 — ${v.industry}`} />
      <FieldRow label="가치 흐름" value={v.value_flow} />
      <FieldRow label="분석 기업 위치" value={v.subject_position} />

      <SubHeader>레이어 구조</SubHeader>
      {v.layers?.map((layer, i) => (
        <View key={i} style={[
          s.card,
          layer.is_subject ? { borderLeftColor: C.blue } : { borderLeftColor: C.border },
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
            <Text style={[s.tag, {
              marginLeft: 4,
              color: POWER_COLOR[layer.pricing_power],
              backgroundColor: C.bg,
            }]}>
              가격협상력 {layer.pricing_power}
            </Text>
          </View>
          {layer.description && <Text style={s.cardText}>{layer.description}</Text>}
          {layer.global_leaders?.length > 0 && (
            <Text style={[s.cardText, { marginTop: 2, color: C.blue }]}>
              글로벌 리더: {layer.global_leaders.map(l => `${l.name}(${l.country})`).join(', ')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ── Section 5: 비즈니스 모델 ─────────────────────────────────────────────────

function BusinessModelSection({ v }: { v: BusinessModelV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={5} title="비즈니스 모델" />

      <FieldRow label="성장 모션" value={v.growth_motion} />
      {v.growth_motion_detail && <Text style={[s.para, { marginTop: 2 }]}>{v.growth_motion_detail}</Text>}

      {/* Unit economics */}
      <SubHeader>유닛 이코노믹스</SubHeader>
      <View style={s.finGrid}>
        {[
          { label: '매출총이익률', val: `${v.unit_economics.gross_margin}%` },
          { label: '영업이익률',   val: `${v.unit_economics.operating_margin}%` },
          { label: '순이익률',     val: `${v.unit_economics.net_margin}%` },
          { label: 'FCF 마진',     val: `${v.unit_economics.fcf_margin}%` },
          { label: 'NRR',         val: `${v.unit_economics.nrr}%` },
        ].map(({ label, val }, i) => (
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
                <Text style={s.td}>{r.revenue_share}%</Text>
                <Text style={s.td}>{r.operating_margin}%</Text>
                <Text style={s.td}>{r.growth_rate}%</Text>
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
    </View>
  );
}

// ── Section 6: 경쟁사 분석 ──────────────────────────────────────────────────

function CompetitorsSection({ v }: { v: CompetitorsV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={6} title="경쟁사 분석" />
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
    </View>
  );
}

// ── Section 7: 전략 분석 ─────────────────────────────────────────────────────

function StrategySection({ v }: { v: StrategyV2 }) {
  return (
    <View style={s.section}>
      <SectionHeader num={7} title="전략 분석" />

      <View style={s.grid2}>
        {/* Corporate */}
        <View style={s.gridLeft}>
          <View style={s.card}>
            <Text style={s.cardTitle}>기업 전략</Text>
            <Text style={s.cardText}>{v.corporate.direction}</Text>
            {v.corporate.portfolio && (
              <Text style={[s.cardText, { marginTop: 3 }]}>포트폴리오: {v.corporate.portfolio}</Text>
            )}
            {v.corporate.geographic && (
              <Text style={[s.cardText, { marginTop: 3 }]}>지역 확장: {v.corporate.geographic}</Text>
            )}
            {v.corporate.ma_partnerships?.length > 0 && (
              <Text style={[s.cardText, { marginTop: 3, color: C.blue }]}>
                M&A/파트너십: {v.corporate.ma_partnerships.join(', ')}
              </Text>
            )}
          </View>
        </View>
        {/* Business */}
        <View style={s.gridRight}>
          <View style={s.card}>
            <Text style={s.cardTitle}>사업 전략</Text>
            <Text style={s.cardText}>{v.business.direction}</Text>
            {v.business.competitive_advantage && (
              <Text style={[s.cardText, { marginTop: 3 }]}>경쟁 우위: {v.business.competitive_advantage}</Text>
            )}
            {v.business.go_to_market && (
              <Text style={[s.cardText, { marginTop: 3 }]}>GTM: {v.business.go_to_market}</Text>
            )}
            {v.business.product_roadmap?.length > 0 && (
              <Text style={[s.cardText, { marginTop: 3, color: C.blue }]}>
                로드맵: {v.business.product_roadmap.join(', ')}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Financial strategy */}
      <View style={s.card}>
        <Text style={s.cardTitle}>재무 전략</Text>
        <Text style={s.cardText}>{v.financial.direction}</Text>
        {v.financial.capital_allocation && (
          <Text style={[s.cardText, { marginTop: 3 }]}>자본 배분: {v.financial.capital_allocation}</Text>
        )}
        {v.financial.investment_priority && (
          <Text style={[s.cardText, { marginTop: 3 }]}>투자 우선순위: {v.financial.investment_priority}</Text>
        )}
        {v.financial.return_target && (
          <Text style={[s.cardText, { marginTop: 3 }]}>수익 목표: {v.financial.return_target}</Text>
        )}
      </View>

      {v.strategy_coherence && (
        <>
          <SubHeader>전략 일관성</SubHeader>
          <Text style={s.para}>{v.strategy_coherence}</Text>
        </>
      )}

      {v.ten_year_durability && (
        <>
          <SubHeader>10년 지속 가능성</SubHeader>
          <Text style={s.para}>{v.ten_year_durability}</Text>
        </>
      )}
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
            <Text key={y} style={s.td}>{r[y] ?? '—'}</Text>
          ))}
          {hasYoy && <Text style={s.td}>{r.yoy ?? '—'}</Text>}
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
            <Text key={y} style={s.td}>{r[y] ?? '—'}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function FinancialsSection({ v }: { v: FinancialsV2 }) {
  const mb = v.munger_buffett_metrics;
  return (
    <View style={s.section}>
      <SectionHeader num={8} title="재무 분석" />

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
        ].map(({ label, val }, i) => (
          <View key={i} style={s.finChip}>
            <Text style={s.finChipLabel}>{label}</Text>
            <Text style={s.finChipValue}>{val ?? '—'}</Text>
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
            ].map(({ label, val }, i) => (
              <View key={i} style={s.finChip}>
                <Text style={s.finChipLabel}>{label}</Text>
                <Text style={s.finChipValue}>{val ?? '—'}</Text>
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
};

function SourceRow({ src, idx }: { src: Source; idx: number }) {
  const badgeCls =
    src.level === 'L1' ? s.srcBadgeL1
    : src.level === 'L2' ? s.srcBadgeL2
    : s.srcBadgeL3;
  const label =
    src.level === 'L1' ? 'L1 공식'
    : src.level === 'L2' ? 'L2 기관'
    : 'L3 추정';
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

function SourcesPage({ sources, company }: { sources: AnalysisSources; company: string }) {
  const entries = Object.entries(sources) as [keyof AnalysisSources, Source[]][];
  const filled = entries.filter(([, srcs]) => srcs && srcs.length > 0);
  if (filled.length === 0) return null;

  return (
    <Page size="A4" style={s.page}>
      <View style={s.section}>
        <SectionHeader num={9} title="출처 목록" />
        {filled.map(([key, srcs]) => (
          <View key={key}>
            <Text style={s.srcGroupLabel}>{SRC_TAB_LABELS[key] ?? key}</Text>
            {srcs.map((src, i) => (
              <SourceRow key={i} src={src} idx={i} />
            ))}
          </View>
        ))}
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

export default function AnalysisPdf({ data }: { data: AnalysisDetail }) {
  const hasV2 = !!(
    data.summary_v2 || data.industry_history_v2 || data.tech_evolution_v2 ||
    data.value_chain_v2 || data.business_model_v2 || data.competitors_v2 ||
    data.strategy_v2 || data.financials_v2
  );

  return (
    <Document title={`${data.companyName} 기업 분석 보고서`} author="Latticework">
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <CoverPage data={data} />
        <PageFooter company={data.companyName} />
      </Page>

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

        <PageFooter company={data.companyName} />
      </Page>

      {/* Sources */}
      {data.sources && (
        <SourcesPage sources={data.sources} company={data.companyName} />
      )}
    </Document>
  );
}
