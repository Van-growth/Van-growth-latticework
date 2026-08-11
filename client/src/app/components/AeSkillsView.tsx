'use client';

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';

// AE Skills 탭 스텁 (2026-08) — 실제 콘텐츠 소스는 VOC.md(수동 관리 중, 저장소엔 아직 없음)
// → DB화가 백로그 "🔵 탐색 중"에 별도 등록돼 있음(CLAUDE.md 참고). 이번 라운드는 UI 뼈대만:
// 카테고리 칩 + 하드코딩 더미 카드. 로그인 게이트 없음 — HomeContent.tsx가 이 뷰를 검색/
// 로그인 플로우와 완전히 분리된 상단 탭으로 렌더링한다.
type Category = '전체' | 'Discovery' | '협상' | '커리어';
const CATEGORIES: Category[] = ['전체', 'Discovery', '협상', '커리어'];

interface SkillCard {
  id: string;
  category: Exclude<Category, '전체'>;
  title: string;
  summary: string;
}

const DUMMY_CARDS: SkillCard[] = [
  {
    id: '1',
    category: 'Discovery',
    title: '디스커버리 콜에서 예산 질문을 미루는 이유',
    summary: '예산부터 물으면 대화가 가격 협상으로 좁혀진다. 문제와 임팩트를 먼저 정량화한 뒤 예산 얘기를 꺼내면 같은 숫자도 다르게 들린다.',
  },
  {
    id: '2',
    category: '협상',
    title: '가격 저항을 만났을 때 쓰는 앵커링 재설정',
    summary: '할인 요청에 바로 숫자를 내리는 대신, 처음 제시한 가치 앵커로 돌아가 스코프를 다시 짚어주는 것부터 시작한다.',
  },
  {
    id: '3',
    category: '커리어',
    title: 'SDR에서 AE로 넘어가기 전에 채워야 할 3가지',
    summary: '파이프라인 빌드 경험, 딜 사이클 전체를 리드해본 경험, 숫자로 말하는 습관 — 승진 대화 전에 미리 준비해두면 좋다.',
  },
  {
    id: '4',
    category: 'Discovery',
    title: '챔피언과 의사결정자를 구분하는 질문법',
    summary: '"이 결정에 누가 관여하나요?" 한 줄로는 부족하다 — 예산 승인권, 최종 서명권, 실무 영향력을 각각 따로 물어야 진짜 구조가 보인다.',
  },
];

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

export default function AeSkillsView() {
  const [category, setCategory] = useState<Category>('전체');
  const cards = category === '전체' ? DUMMY_CARDS : DUMMY_CARDS.filter(c => c.category === category);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb size={18} className="text-amber-400" />
          <h2 className="text-xl font-semibold text-gray-900">AE Skills</h2>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-[1px] leading-none">
            무료
          </span>
        </div>
        <p className="text-sm text-gray-500">영업 현장에서 바로 쓰는 실전 팁 — Discovery / 협상 / 커리어</p>
      </div>

      <div className="flex gap-2 overflow-x-auto mb-6">
        {CATEGORIES.map(c => (
          <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(card => (
          <div key={card.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-blue-500 bg-blue-50 rounded px-1.5 py-0.5 mb-2">
              {card.category}
            </span>
            <h3 className="text-sm font-semibold text-gray-800 mb-1.5 leading-snug">{card.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{card.summary}</p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-300 text-center mt-8">
        준비 중인 콘텐츠예요 — 더 많은 스킬 카드가 곧 추가됩니다.
      </p>
    </div>
  );
}
