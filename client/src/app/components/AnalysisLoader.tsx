'use client';

import { useState, useEffect } from 'react';

// ── 메시지 데이터 ──────────────────────────────────────────────────────────────

const STEPS = [
  { message: 'DART/EDGAR에서 공시 데이터 수집 중...', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  { message: 'Claude가 산업 역사 분석 중...',          color: 'text-blue-600',    dot: 'bg-blue-500'    },
  { message: '밸류체인 구조 파악 중...',               color: 'text-violet-600',  dot: 'bg-violet-500'  },
  { message: '경쟁사 스캔 중...',                      color: 'text-orange-500',  dot: 'bg-orange-500'  },
  { message: 'LinkedIn 초안 작성 중...',               color: 'text-sky-600',     dot: 'bg-sky-500'     },
] as const;

const SUB_MESSAGES = [
  '워런 버핏도 연차보고서 읽는 데 몇 시간은 걸립니다',
  'SEC EDGAR 17만개 파일 뒤지는 중...',
  '찰리 멍거라면 이 회사를 어떻게 봤을까요',
  '숫자 뒤에 숨은 진짜 이야기를 찾는 중...',
  'AI가 10-K 읽는 속도: 인간의 200배',
];

// ── 애니메이션 차트 바 ──────────────────────────────────────────────────────────

function AnimatedBars() {
  const [heights, setHeights] = useState([38, 62, 48, 78, 55, 70, 42]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeights(prev => prev.map((_, i) => {
        // 각 바가 조금씩 독립적으로 움직이도록 이전 값 기반 랜덤 워크
        const base = [38, 62, 48, 78, 55, 70, 42][i];
        return Math.max(20, Math.min(92, base + (Math.random() - 0.5) * 50));
      }));
    }, 850);
    return () => clearInterval(timer);
  }, []);

  const colors = [
    'bg-blue-200', 'bg-blue-300', 'bg-blue-400',
    'bg-blue-600', 'bg-blue-400', 'bg-blue-300', 'bg-blue-200',
  ];

  return (
    <div className="flex items-end justify-center gap-1.5 h-14 w-28" aria-hidden>
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-3 ${colors[i]} rounded-t transition-all duration-700 ease-in-out`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

interface Props {
  companyName: string;
}

export default function AnalysisLoader({ companyName }: Props) {
  const [stepIndex, setStepIndex]   = useState(0);
  const [subIndex,  setSubIndex]    = useState(0);
  const [visible,   setVisible]     = useState(true);
  const [progress,  setProgress]    = useState(0);

  // 단계 메시지: 4초마다 페이드 전환
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setStepIndex(prev => (prev + 1) % STEPS.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // 서브 메시지: 5초마다 전환
  useEffect(() => {
    const id = setInterval(() => {
      setSubIndex(prev => (prev + 1) % SUB_MESSAGES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // 가짜 진행바: 비대칭 지수 함수로 90%에 점근 (약 75초)
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setProgress(90 * (1 - Math.exp(-elapsed / 52)));
    }, 250);
    return () => clearInterval(id);
  }, []);

  const step = STEPS[stepIndex];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-10">
      <div className="flex flex-col items-center gap-5">

        {/* 애니메이션 차트 */}
        <div className="relative">
          <AnimatedBars />
          {/* pulse 링 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="w-20 h-20 rounded-full bg-blue-100 opacity-30 animate-ping" />
          </div>
        </div>

        {/* 기업명 */}
        <div className="text-center">
          <h3 className="text-xl font-bold text-gray-900">{companyName}</h3>
          <p className="text-sm text-gray-400 mt-0.5">심층 분석 진행 중</p>
        </div>

        {/* 단계 메시지 (페이드) */}
        <div className="h-6 flex items-center justify-center">
          <p
            className={`text-sm font-semibold transition-opacity duration-300 ${step.color} ${visible ? 'opacity-100' : 'opacity-0'}`}
          >
            {step.message}
          </p>
        </div>

        {/* 단계 도트 */}
        <div className="flex gap-2 items-center">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? `w-2.5 h-2.5 ${s.dot}`
                  : i < stepIndex
                  ? `w-1.5 h-1.5 ${s.dot} opacity-40`
                  : 'w-1.5 h-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* 진행 바 */}
        <div className="w-full max-w-sm space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">분석 진행률</span>
            <span className="font-semibold text-blue-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #60a5fa, #2563eb)',
              }}
            />
          </div>
          <p className="text-xs text-gray-400 text-right">약 30~90초 소요</p>
        </div>

        {/* 서브 메시지 */}
        <p className="text-xs text-gray-400 italic text-center transition-all duration-500">
          {SUB_MESSAGES[subIndex]}
        </p>

      </div>
    </div>
  );
}
